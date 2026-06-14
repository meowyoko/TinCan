import { readFile } from "node:fs/promises";
import { WebSocket } from "ws";

type CliArgs = {
  chatId?: string;
  hubUrl?: string;
  pin?: string;
  replyTo?: string;
  text?: string;
  transcript?: string;
};

type TranscriptExtraction = {
  chatId?: string;
  replyTo?: string;
  text?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const extracted = args.transcript
    ? await extractFromTranscript(args.transcript)
    : {};

  const chatId = args.chatId ?? extracted.chatId ?? "main";
  const replyTo = args.replyTo ?? extracted.replyTo;
  const text = args.text ?? extracted.text;
  const hubUrl = args.hubUrl ?? `ws://127.0.0.1:${process.env.TINCAN_PORT ?? "3100"}`;
  const pin = args.pin ?? process.env.TINCAN_PIN ?? "";

  if (!replyTo || !text) {
    if (args.transcript && !args.replyTo && !args.text) {
      return;
    }
    throw new Error("reply_to and thinking text are required. Pass them explicitly or provide a transcript.");
  }

  await sendThinking({
    url: hubUrl,
    pin,
    chatId,
    replyTo,
    text,
  });
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!current.startsWith("--")) {
      continue;
    }

    switch (current) {
      case "--chat-id":
        args.chatId = next;
        index += 1;
        break;
      case "--hub-url":
        args.hubUrl = next;
        index += 1;
        break;
      case "--pin":
        args.pin = next;
        index += 1;
        break;
      case "--reply-to":
        args.replyTo = next;
        index += 1;
        break;
      case "--text":
        args.text = next;
        index += 1;
        break;
      case "--transcript":
        args.transcript = next;
        index += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

async function extractFromTranscript(transcriptPath: string): Promise<TranscriptExtraction> {
  const raw = await readFile(transcriptPath, "utf8");
  const parsedLines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const currentTurn = collectLatestTurn(parsedLines);

  const state: TranscriptExtraction & { lastSentId?: string } = {};

  for (const parsed of currentTurn) {
    visitNode(parsed, state);
  }

  return {
    chatId: state.chatId,
    replyTo: state.replyTo ?? state.lastSentId,
    text: state.text,
  };
}

function collectLatestTurn(lines: string[]): unknown[] {
  const turn: unknown[] = [];
  let seenTurnContent = false;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    let parsed: unknown;

    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      continue;
    }

    if (seenTurnContent && isUserTurnBoundary(parsed)) {
      break;
    }

    if (containsTurnContent(parsed)) {
      seenTurnContent = true;
    }

    turn.push(parsed);
  }

  return turn.reverse();
}

function isUserTurnBoundary(node: unknown): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const record = node as Record<string, unknown>;
  if (record.type !== "user") {
    return false;
  }

  const message = record.message;
  return (
    !!message &&
    typeof message === "object" &&
    (message as Record<string, unknown>).role === "user"
  );
}

function containsTurnContent(node: unknown): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const record = node as Record<string, unknown>;
  if (record.type === "assistant") {
    return true;
  }

  if (record.type === "thinking") {
    return true;
  }

  return isTinCanReplyCall(record);
}

function visitNode(node: unknown, state: TranscriptExtraction & { lastSentId?: string }): void {
  if (typeof node === "string") {
    const sentMatch = node.match(/sent \(id:\s*([^)]+)\)/i);
    if (sentMatch) {
      state.lastSentId = sentMatch[1];
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      visitNode(item, state);
    }
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;
  const candidateThinking = extractThinkingText(record);
  if (candidateThinking) {
    state.text = candidateThinking;
  }

  if (isTinCanReplyCall(record)) {
    const args = extractArgumentsRecord(record);
    if (typeof args?.chat_id === "string") {
      state.chatId = args.chat_id;
    }
    if (typeof args?.reply_to === "string") {
      state.replyTo = args.reply_to;
    }
  }

  for (const value of Object.values(record)) {
    visitNode(value, state);
  }
}

function extractThinkingText(record: Record<string, unknown>): string | undefined {
  if (record.type === "thinking" && typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }

  if (record.type === "thinking" && Array.isArray(record.content)) {
    const joined = record.content
      .map(item => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string") {
          return String((item as Record<string, unknown>).text);
        }
        return "";
      })
      .join("\n")
      .trim();
    if (joined) {
      return joined;
    }
  }

  if (Array.isArray(record.content)) {
    const thinkingBlocks = record.content
      .map(item => {
        if (!item || typeof item !== "object") {
          return "";
        }

        const block = item as Record<string, unknown>;
        if (block.type !== "thinking") {
          return "";
        }

        if (typeof block.text === "string") {
          return block.text;
        }

        if (Array.isArray(block.content)) {
          return block.content
            .map(value =>
              value && typeof value === "object" && typeof (value as Record<string, unknown>).text === "string"
                ? String((value as Record<string, unknown>).text)
                : typeof value === "string"
                  ? value
                  : "",
            )
            .join("\n");
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();

    if (thinkingBlocks) {
      return thinkingBlocks;
    }
  }

  return undefined;
}

function isTinCanReplyCall(record: Record<string, unknown>): boolean {
  return (
    record.name === "tincan_reply" ||
    record.name === "mcp__tin-can__tincan_reply" ||
    record.tool_name === "tincan_reply" ||
    record.tool_name === "mcp__tin-can__tincan_reply" ||
    record.tool === "tincan_reply" ||
    record.tool === "mcp__tin-can__tincan_reply"
  );
}

function extractArgumentsRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const candidates = [record.arguments, record.args, record.input];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }

    if (typeof candidate === "string") {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

async function sendThinking(params: {
  url: string;
  pin: string;
  chatId: string;
  replyTo: string;
  text: string;
}): Promise<void> {
  const messageId = `thinking_${Date.now()}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(params.url);
    let sent = false;

    const finish = (callback: () => void): void => {
      ws.removeAllListeners();
      try {
        ws.close();
      } catch {
        // ignore close failures
      }
      callback();
    };

    ws.on("message", raw => {
      let parsed: any;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (parsed.type === "auth_required") {
        if (!params.pin) {
          finish(() => reject(new Error("hub requires TINCAN_PIN for thinking hook")));
          return;
        }

        ws.send(JSON.stringify({ type: "auth", pin: params.pin }));
        return;
      }

      if (parsed.type === "auth_fail") {
        finish(() => reject(new Error(parsed.message ?? "hub auth failed")));
        return;
      }

      if (parsed.type === "auth_ok" && !sent) {
        sent = true;
        ws.send(
          JSON.stringify({
            type: "thinking",
            id: messageId,
            chat_id: params.chatId,
            reply_to: params.replyTo,
            text: params.text,
            ts: new Date().toISOString(),
          }),
        );
        return;
      }

      if (parsed.type === "ack" && parsed.id === messageId) {
        finish(resolve);
        return;
      }

      if (parsed.type === "error") {
        finish(() => reject(new Error(parsed.message ?? "hub rejected thinking payload")));
      }
    });

    ws.on("error", error => {
      finish(() => reject(error));
    });
  });
}

main().catch(error => {
  process.stderr.write(`tin-can thinking hook: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
