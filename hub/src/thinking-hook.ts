import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { WebSocket } from "ws";

const STATE_PATH = join(homedir(), ".claude", "tincan-thinking-state.json");

type CliArgs = {
  chatId?: string;
  hubUrl?: string;
  pin?: string;
  replyTo?: string;
  text?: string;
  transcript?: string;
};

type ThinkingPair = {
  chatId: string;
  replyTo: string;
  text: string;
};

type StateFile = {
  transcriptPath: string;
  lastLine: number;
  pendingThinking?: string[];
  pendingReply?: { chatId?: string; toolUseId?: string; thinkingText: string };
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const hubUrl = args.hubUrl ?? `ws://127.0.0.1:${process.env.TINCAN_PORT ?? "3100"}`;
  const pin = args.pin ?? process.env.TINCAN_PIN ?? "";
  const chatId = args.chatId ?? "main";

  if (args.text && args.replyTo) {
    await sendThinking({ url: hubUrl, pin, chatId, replyTo: args.replyTo, text: args.text });
    return;
  }

  if (!args.transcript) {
    return;
  }

  const state = await loadState(args.transcript);
  const raw = await readFile(args.transcript, "utf8");
  const allLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (state.lastLine >= allLines.length) {
    return;
  }

  const newLines = allLines.slice(state.lastLine);
  const carryOver = {
    thinkingChunks: state.pendingThinking ?? [],
    pendingReply: state.pendingReply ?? undefined,
  };
  const { pairs, remainingThinking, remainingReply } = extractPairs(newLines, chatId, carryOver);

  for (const pair of pairs) {
    await sendThinking({ url: hubUrl, pin, ...pair });
  }

  await saveState(args.transcript, allLines.length, remainingThinking, remainingReply);
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

async function loadState(transcriptPath: string): Promise<StateFile> {
  try {
    if (!existsSync(STATE_PATH)) {
      return { transcriptPath, lastLine: 0 };
    }
    const raw = await readFile(STATE_PATH, "utf8");
    const state = JSON.parse(raw) as StateFile;
    if (state.transcriptPath !== transcriptPath) {
      return { transcriptPath, lastLine: 0 };
    }
    return state;
  } catch {
    return { transcriptPath, lastLine: 0 };
  }
}

async function saveState(
  transcriptPath: string,
  lastLine: number,
  pendingThinking?: string[],
  pendingReply?: PendingReply,
): Promise<void> {
  const state: StateFile = { transcriptPath, lastLine };
  if (pendingThinking && pendingThinking.length > 0) {
    state.pendingThinking = pendingThinking;
  }
  if (pendingReply) {
    state.pendingReply = pendingReply;
  }
  await writeFile(STATE_PATH, JSON.stringify(state), "utf8");
}

type PendingReply = { chatId?: string; toolUseId?: string; thinkingText: string };

type CarryOver = {
  thinkingChunks: string[];
  pendingReply?: PendingReply;
};

type ExtractionResult = {
  pairs: ThinkingPair[];
  remainingThinking: string[];
  remainingReply?: PendingReply;
};

function extractPairs(lines: string[], defaultChatId: string, carryOver?: CarryOver): ExtractionResult {
  const pairs: ThinkingPair[] = [];
  const thinkingChunks: string[] = carryOver?.thinkingChunks ? [...carryOver.thinkingChunks] : [];
  let pending: PendingReply | undefined = carryOver?.pendingReply;

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== "object") {
      continue;
    }

    const record = parsed as Record<string, unknown>;

    const thinking = extractThinkingText(record);
    if (thinking) {
      thinkingChunks.push(thinking);
    }

    const replyInfo = findReplyInRecord(record);
    if (replyInfo && thinkingChunks.length > 0) {
      if (replyInfo.replyTo) {
        pairs.push({
          chatId: replyInfo.chatId ?? defaultChatId,
          replyTo: replyInfo.replyTo,
          text: thinkingChunks.join("\n\n"),
        });
        thinkingChunks.length = 0;
        pending = undefined;
      } else {
        pending = {
          chatId: replyInfo.chatId,
          toolUseId: replyInfo.toolUseId,
          thinkingText: thinkingChunks.join("\n\n"),
        };
        thinkingChunks.length = 0;
      }
    }

    if (pending) {
      const sentId = extractSentId(record, pending.toolUseId);
      if (sentId) {
        pairs.push({
          chatId: pending.chatId ?? defaultChatId,
          replyTo: sentId,
          text: pending.thinkingText,
        });
        pending = undefined;
      }
    }
  }

  return {
    pairs,
    remainingThinking: [...thinkingChunks],
    remainingReply: pending,
  };
}

type ReplyInfo = { chatId?: string; replyTo?: string; toolUseId?: string };

function findReplyInRecord(record: Record<string, unknown>): ReplyInfo | undefined {
  if (record.type === "assistant" && record.message && typeof record.message === "object") {
    const msg = record.message as Record<string, unknown>;
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        if (b.type === "tool_use" && isTinCanReplyName(b.name)) {
          const input = b.input as Record<string, unknown> | undefined;
          return {
            chatId: typeof input?.chat_id === "string" ? input.chat_id : undefined,
            replyTo: typeof input?.reply_to === "string" ? input.reply_to : undefined,
            toolUseId: typeof b.id === "string" ? b.id : undefined,
          };
        }
      }
    }
  }

  if (isTinCanReplyCall(record)) {
    const args = extractArgumentsRecord(record);
    return {
      chatId: typeof args?.chat_id === "string" ? args.chat_id : undefined,
      replyTo: typeof args?.reply_to === "string" ? args.reply_to : undefined,
      toolUseId: typeof record.id === "string" ? record.id : undefined,
    };
  }

  return undefined;
}

function extractSentId(record: Record<string, unknown>, toolUseId?: string): string | undefined {
  if (record.type !== "user") return undefined;
  const msg = record.message;
  if (!msg || typeof msg !== "object") return undefined;
  const content = (msg as Record<string, unknown>).content;
  if (!Array.isArray(content)) return undefined;

  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    if (block.type !== "tool_result") continue;
    if (toolUseId && block.tool_use_id !== toolUseId) continue;

    const text = Array.isArray(block.content)
      ? block.content.map((c: any) => typeof c === "string" ? c : c?.text ?? "").join("")
      : typeof block.content === "string" ? block.content : "";

    const match = text.match(/sent \(id:\s*([^)]+)\)/i);
    if (match) return match[1];
  }

  return undefined;
}

function extractThinkingText(record: Record<string, unknown>): string | undefined {
  if (record.type === "assistant" && record.message && typeof record.message === "object") {
    const msg = record.message as Record<string, unknown>;
    if (Array.isArray(msg.content)) {
      const chunks: string[] = [];
      for (const block of msg.content) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        if (b.type !== "thinking") continue;

        if (typeof b.thinking === "string" && b.thinking.trim()) {
          chunks.push(b.thinking.trim());
        } else if (typeof b.text === "string" && (b.text as string).trim()) {
          chunks.push((b.text as string).trim());
        }
      }
      if (chunks.length > 0) {
        return chunks.join("\n");
      }
    }
  }

  if (record.type === "thinking" && typeof record.thinking === "string" && (record.thinking as string).trim()) {
    return (record.thinking as string).trim();
  }

  if (record.type === "thinking" && typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }

  return undefined;
}

function isTinCanReplyName(name: unknown): boolean {
  return name === "tincan_reply" || name === "mcp__tin-can__tincan_reply";
}

function isTinCanReplyCall(record: Record<string, unknown>): boolean {
  return (
    isTinCanReplyName(record.name) ||
    isTinCanReplyName(record.tool_name) ||
    isTinCanReplyName(record.tool)
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
