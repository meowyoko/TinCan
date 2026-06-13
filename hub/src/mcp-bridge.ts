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
          reply_to: { type: "string", description: "optional message_id to thread under" }
        },
        required: ["chat_id", "text"]
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
  if (request.params.name !== "tincan_reply" && request.params.name !== "tincan_request_permission") {
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

  const chatId = typeof args.chat_id === "string" ? args.chat_id : "";
  const text = typeof args.text === "string" ? args.text : "";
  const replyTo = typeof args.reply_to === "string" ? args.reply_to : undefined;

  if (!chatId || !text) {
    return {
      content: [{ type: "text", text: "chat_id and text are required" }],
      isError: true
    };
  }

  try {
    const result = await hubRequest({
      type: "reply",
      chat_id: chatId,
      text,
      reply_to: replyTo
    });

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
