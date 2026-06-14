import { WebSocket } from "ws";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import type { HubBridgeAck, HubToBridge } from "./protocol.js";

type PendingRequest = {
  resolve: (value: HubBridgeAck) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

let hub: WebSocket | null = null;
let hubReady = false;
let requestCounter = 0;
const pending = new Map<string, PendingRequest>();

function log(message: string): void {
  process.stderr.write(`tin-can mcp: ${message}\n`);
}

function connectHub(): void {
  hub = new WebSocket(`ws://127.0.0.1:${config.bridgePort}`);

  hub.on("open", () => {
    hubReady = true;
    log("connected to hub");
  });

  hub.on("message", (raw) => {
    let msg: HubToBridge;
    try {
      msg = JSON.parse(raw.toString()) as HubToBridge;
    } catch {
      return;
    }

    if (!("_req_id" in msg)) return;

    const request = pending.get(msg._req_id);
    if (!request) return;

    pending.delete(msg._req_id);
    clearTimeout(request.timer);
    request.resolve(msg as HubBridgeAck);
  });

  hub.on("close", () => {
    hubReady = false;
    log("hub disconnected, reconnecting");
    setTimeout(connectHub, 2000);
  });

  hub.on("error", () => {
    hubReady = false;
  });
}

function hubRequest(payload: Record<string, unknown>, timeoutMs = 10000): Promise<HubBridgeAck> {
  return new Promise((resolve, reject) => {
    if (!hub || !hubReady || hub.readyState !== WebSocket.OPEN) {
      reject(new Error("hub is not connected"));
      return;
    }

    const id = `req_${++requestCounter}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("hub request timed out"));
    }, timeoutMs);

    pending.set(id, { resolve, reject, timer });
    hub.send(JSON.stringify({ ...payload, _req_id: id }));
  });
}

const server = new Server(
  {
    name: "tin-can",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    },
    instructions: [
      "Use tincan_reply to reply to messages received from <channel source=\"tin-can\">.",
      "Pass chat_id and reply_to when they are present in the channel tag.",
      "Use tincan_report_thinking to attach post-response thinking text to a reply.",
      "Before sensitive actions, use tincan_request_permission and wait for the decision."
    ].join("\n")
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "tincan_reply",
      description: "Reply to Tin-Can app",
      inputSchema: {
        type: "object",
        properties: {
          chat_id: { type: "string" },
          text: { type: "string" },
          reply_to: { type: "string", description: "optional message_id to thread under" },
          attachment_type: { type: "string", enum: ["image", "voice", "file"] },
          file_path: { type: "string", description: "local file path to send to Tin-Can" },
          file_name: { type: "string", description: "display name for the attachment" },
          file_uri: { type: "string", description: "optional remote or file uri for preview" },
          mime_type: { type: "string" },
          size_bytes: { type: "number" },
          duration_ms: { type: "number", description: "voice duration in milliseconds" }
        },
        required: ["chat_id"]
      }
    },
    {
      name: "tincan_report_thinking",
      description: "Attach thinking text to an existing Tin-Can reply",
      inputSchema: {
        type: "object",
        properties: {
          chat_id: { type: "string" },
          reply_to: { type: "string", description: "assistant message id that this thinking belongs to" },
          text: { type: "string", description: "thinking text to show in the app" }
        },
        required: ["chat_id", "reply_to", "text"]
      }
    },
    {
      name: "tincan_request_permission",
      description: "Ask the Tin-Can user to approve or deny a sensitive action",
      inputSchema: {
        type: "object",
        properties: {
          tool: { type: "string", description: "tool or action name, for example Bash or Edit" },
          summary: { type: "string", description: "short human-facing summary" },
          detail: { type: "string", description: "full command or change detail shown in the approval card" }
        },
        required: ["tool", "detail"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (
    request.params.name !== "tincan_reply" &&
    request.params.name !== "tincan_request_permission" &&
    request.params.name !== "tincan_report_thinking"
  ) {
    return {
      content: [{ type: "text", text: `unknown tool: ${request.params.name}` }],
      isError: true
    };
  }

  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  if (request.params.name === "tincan_request_permission") {
    const tool = typeof args.tool === "string" ? args.tool : "";
    const detail = typeof args.detail === "string" ? args.detail : "";
    const summary = typeof args.summary === "string" ? args.summary : undefined;

    if (!tool || !detail) {
      return {
        content: [{ type: "text", text: "tool and detail are required" }],
        isError: true
      };
    }

    try {
      const result = await hubRequest(
        {
          type: "permission_request",
          tool,
          summary,
          detail
        },
        5 * 60 * 1000
      );

      if (!result.ok) {
        return {
          content: [{ type: "text", text: result.error ?? "permission request failed" }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              request_id: result.id,
              decision: result.decision ?? "deny",
              resolved_at: result.resolved_at ?? new Date().toISOString()
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }

  if (request.params.name === "tincan_report_thinking") {
    const chatId = typeof args.chat_id === "string" ? args.chat_id : "";
    const replyTo = typeof args.reply_to === "string" ? args.reply_to : "";
    const text = typeof args.text === "string" ? args.text : "";

    if (!chatId || !replyTo || !text) {
      return {
        content: [{ type: "text", text: "chat_id, reply_to and text are required" }],
        isError: true
      };
    }

    try {
      const result = await hubRequest({
        type: "thinking",
        chat_id: chatId,
        reply_to: replyTo,
        text
      });

      if (!result.ok) {
        return {
          content: [{ type: "text", text: result.error ?? "thinking report failed" }],
          isError: true
        };
      }

      return {
        content: [{ type: "text", text: `thinking sent (id: ${result.id})` }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }

  const chatId = typeof args.chat_id === "string" ? args.chat_id : "";
  const text = typeof args.text === "string" ? args.text : "";
  const replyTo = typeof args.reply_to === "string" ? args.reply_to : undefined;
  const attachmentType = typeof args.attachment_type === "string" ? args.attachment_type : undefined;
  const filePath = typeof args.file_path === "string" ? args.file_path : undefined;
  const fileName = typeof args.file_name === "string" ? args.file_name : undefined;
  const fileUri = typeof args.file_uri === "string" ? args.file_uri : undefined;
  const mimeType = typeof args.mime_type === "string" ? args.mime_type : undefined;
  const sizeBytes = typeof args.size_bytes === "number" ? args.size_bytes : undefined;
  const durationMs = typeof args.duration_ms === "number" ? args.duration_ms : undefined;

  if (!chatId || (!text && !filePath)) {
    return {
      content: [{ type: "text", text: "chat_id plus text or file_path are required" }],
      isError: true
    };
  }

  try {
    const payload: Record<string, unknown> = {
      type: "reply",
      chat_id: chatId,
      text,
      reply_to: replyTo
    };

    if (attachmentType && filePath) {
      payload.attachment = {
        attachment_type: attachmentType,
        file_name: fileName ?? filePath.split(/[\\/]/).pop() ?? "attachment",
        file_path: filePath,
        file_uri: fileUri,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        duration_ms: durationMs
      };
    }

    const result = await hubRequest(payload);

    if (!result.ok) {
      return {
        content: [{ type: "text", text: result.error ?? "reply failed" }],
        isError: true
      };
    }

    return {
      content: [{ type: "text", text: `sent (id: ${result.id})` }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true
    };
  }
});

connectHub();

const transport = new StdioServerTransport();
await server.connect(transport);
log("MCP server connected");
