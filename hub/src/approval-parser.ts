const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b[@-_]/g;

const TOOL_LINE_PATTERNS = [
  {kind: 'bash', pattern: /^●\s+Bash\((.+)\)?$/},
  {kind: 'read', pattern: /^●\s+Reading\s+(.+)$/},
  {kind: 'read', pattern: /^\s*Read\s+(.+)$/},
  {kind: 'edit', pattern: /^●\s+Edit\((.+)\)?$/},
  {kind: 'edit', pattern: /^●\s+Update\((.+)\)?$/},
  {kind: 'write', pattern: /^●\s+Write\((.+)\)?$/},
  {kind: 'task', pattern: /^●\s+Task\((.+)\)?$/},
];

const APPROVAL_OPTION_PATTERN = /^(?:[❯>]\s*)?(\d+)\.\s+(.*)$/;
const APPROVAL_QUESTION_PATTERN = /^\s*Do you want to .+\?\s*$/i;
const APPROVAL_REQUIRED_PATTERN = /^\s*This command requires approval\s*$/i;
const APPROVAL_HINT_PATTERN = /Enter to confirm|Esc to cancel|Tab to amend/i;
const DIVIDER_LINE_PATTERN = /^\s*[─╌-]{10,}\s*$/;
const PROMPT_LINE_PATTERN = /^[❯>]\s*(.*)$/;
const SESSION_SURVEY_PATTERN = /^\s*How is Claude doing this session/i;
const SESSION_SURVEY_DISMISS_PATTERN = /^\s*0:\s*Dismiss\b/i;

export type ApprovalOption = {
  index: number;
  label: string;
  selected: boolean;
};

export type ApprovalSnapshot = {
  pending: boolean;
  fingerprint: string | null;
  toolName: string | null;
  summary: string | null;
  detail: string | null;
  allowIndex: number | null;
  denyIndex: number | null;
  options: ApprovalOption[];
};

export function parseApprovalSnapshot(screenText: string): ApprovalSnapshot {
  const lines = normalizeScreenText(screenText)
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''));
  const parsedTool = parseTool(lines);
  const approval = parseApprovalBlock(lines);

  if (!approval.pending) {
    return {
      pending: false,
      fingerprint: null,
      toolName: null,
      summary: null,
      detail: null,
      allowIndex: null,
      denyIndex: null,
      options: [],
    };
  }

  const blockLines = lines
    .slice(approval.blockStartIndex, approval.blockEndIndex + 1)
    .map(cleanDetailLine)
    .filter(Boolean);
  const toolName =
    parsedTool.label ??
    normalizeToolNameFromTitle(approval.title) ??
    'Action';
  const contextSummary = [approval.title, approval.command].filter(Boolean).join(' · ');
  const summary = parsedTool.summary ?? (contextSummary || approval.question);
  const fingerprint = [
    toolName,
    summary,
    ...blockLines.map(normalizeFingerprintLine),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  return {
    pending: true,
    fingerprint,
    toolName,
    summary,
    detail: blockLines.join('\n'),
    allowIndex: findAllowIndex(approval.options),
    denyIndex: findDenyIndex(approval.options),
    options: approval.options,
  };
}

export function shouldDismissSessionSurvey(screenText: string): boolean {
  const lines = normalizeScreenText(screenText)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const hasTitle = lines.some(line => SESSION_SURVEY_PATTERN.test(line));
  const hasDismissOption = lines.some(line => SESSION_SURVEY_DISMISS_PATTERN.test(line));

  return hasTitle && hasDismissOption;
}

function normalizeScreenText(screenText: string): string {
  return String(screenText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(ANSI_PATTERN, '');
}

function parseTool(
  lines: string[],
): {label: string | null; summary: string | null; index: number} {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    for (const candidate of TOOL_LINE_PATTERNS) {
      const match = line.match(candidate.pattern);
      if (!match) continue;
      return {
        label: capitalize(candidate.kind),
        summary: match[1]?.trim() ?? null,
        index,
      };
    }
  }

  return {
    label: null,
    summary: null,
    index: -1,
  };
}

function parseApprovalBlock(lines: string[]): {
  pending: boolean;
  title: string | null;
  command: string | null;
  question: string | null;
  options: ApprovalOption[];
  blockStartIndex: number;
  blockEndIndex: number;
} {
  const questionIndex = lines.findIndex(line => APPROVAL_QUESTION_PATTERN.test(line));
  const requiredIndex = lines.findIndex(line => APPROVAL_REQUIRED_PATTERN.test(line));
  const anchorIndex = questionIndex >= 0 ? questionIndex : requiredIndex;
  const options: ApprovalOption[] = [];
  let firstOptionIndex = -1;
  let hintLineIndex = -1;

  for (let index = Math.max(0, lines.length - 18); index < lines.length; index += 1) {
    const line = lines[index];
    const optionMatch = line.trim().match(APPROVAL_OPTION_PATTERN);
    if (optionMatch) {
      if (firstOptionIndex === -1) {
        firstOptionIndex = index;
      }
      options.push({
        index: Number(optionMatch[1]),
        label: optionMatch[2].trim(),
        selected: /^[❯>]/.test(line.trim()),
      });
      continue;
    }

    if (APPROVAL_HINT_PATTERN.test(line)) {
      hintLineIndex = index;
    }
  }

  const effectiveAnchorIndex = anchorIndex >= 0 ? anchorIndex : firstOptionIndex;

  if (
    effectiveAnchorIndex === -1 ||
    !isApprovalAnchorNearTailEnd(lines, effectiveAnchorIndex) ||
    (anchorIndex === -1 && (options.length === 0 || hintLineIndex === -1))
  ) {
    return {
      pending: false,
      title: null,
      command: null,
      question: null,
      options: [],
      blockStartIndex: -1,
      blockEndIndex: -1,
    };
  }

  const contextLines: string[] = [];
  for (
    let index = Math.max(0, effectiveAnchorIndex - 8);
    index < effectiveAnchorIndex;
    index += 1
  ) {
    const line = lines[index].trim();
    if (!line || DIVIDER_LINE_PATTERN.test(line)) continue;
    if (/^●\s+/.test(line) || PROMPT_LINE_PATTERN.test(line)) continue;
    contextLines.push(line);
  }

  let title: string | null = null;
  let command: string | null = null;
  if (contextLines.length > 0) {
    [title, command] = contextLines;
  }

  const blockStartIndex = Math.max(0, effectiveAnchorIndex - 10);
  const blockEndIndex = hintLineIndex >= 0 ? hintLineIndex : effectiveAnchorIndex + options.length;

  return {
    pending: true,
    title: title ?? null,
    command: command ?? null,
    question: anchorIndex >= 0 ? lines[anchorIndex]?.trim() ?? null : null,
    options,
    blockStartIndex,
    blockEndIndex,
  };
}

function isApprovalAnchorNearTailEnd(lines: string[], anchorIndex: number): boolean {
  const lastNonEmptyIndex = findLastNonEmptyIndex(lines);
  if (lastNonEmptyIndex === -1) return false;
  return anchorIndex >= Math.max(0, lastNonEmptyIndex - 12);
}

function findLastNonEmptyIndex(lines: string[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (String(lines[index] ?? '').trim()) {
      return index;
    }
  }

  return -1;
}

function findAllowIndex(options: ApprovalOption[]): number | null {
  return options.find(option => /^yes\b/i.test(option.label))?.index ?? options[0]?.index ?? null;
}

function findDenyIndex(options: ApprovalOption[]): number | null {
  return (
    options.find(option => /^no\b/i.test(option.label))?.index ??
    options.find(option => /^continue without\b/i.test(option.label))?.index ??
    options.find(option => /\bdeny\b|\breject\b/i.test(option.label))?.index ??
    null
  );
}

function cleanDetailLine(line: string): string {
  return line
    .replace(/^[❯>]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFingerprintLine(line: string): string {
  return cleanDetailLine(line).toLowerCase();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeToolNameFromTitle(title: string | null): string | null {
  if (!title) return null;
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  const match = normalizedTitle.match(/^(.+?)\s+command$/i);
  if (match?.[1]) {
    return capitalize(match[1].trim());
  }
  return normalizedTitle;
}
