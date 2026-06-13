import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "./config.js";
import { formatChannelMessage } from "./channel.js";
import { hasTmuxSession, sendToTmux } from "./tmux.js";
import type { BridgeToHub, ClientToHub, HubToBridge, HubToClient, InboundEnvelope, ReadyState } from "./protocol.js";

type Client = {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
};

type QueueItem = {
  envelope: InboundEnvelope;
  clientId: string;
};

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...getReadyState(), clients: clients.size, queue: queue.length }));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

const clientWss = new WebSocketServer({ server: httpServer });
const bridgeWss = new WebSocketServer({ port: config.bridgePort, host: "127.0.0.1" });

const clients = new Map<string, Client>();
const queue: QueueItem[] = [];

let clientCounter = 0;
let bridge: WebSocket | null = null;
let tmuxAlive = false;
let busy = false;
let draining = false;
let busyTimer: NodeJS.Timeout | null = null;

function log(message: string): void {
  process.stderr.write(`tin-can hub: ${message}\n`);
}

function getReadyState(): ReadyState {
  return {
    tmux_alive: tmuxAlive,
    bridge_alive: bridge?.readyState === WebSocket.OPEN,
    busy,
    ready: tmuxAlive && bridge?.readyState === WebSocket.OPEN && !busy
  };
}

function send(client: Client, payload: HubToClient): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload: HubToClient): void {
  for (const client of clients.values()) {
    if (client.authenticated) send(client, payload);
  }
}

function setBusy(nextBusy: boolean): void {
  busy = nextBusy;
  if (busyTimer) clearTimeout(busyTimer);

  if (nextBusy) {
    busyTimer = setTimeout(() => {
      busy = false;
      broadcast({ type: "status", state: "idle", message: "CC busy timeout released", detail: getReadyState() });
      drainQueue().catch((err: unknown) => log(`queue drain after timeout failed: ${String(err)}`));
    }, config.busyTimeoutMs);
  }

  broadcast({
    type: "status",
    state: nextBusy ? "thinking" : "idle",
    message: nextBusy ? "Message delivered to CC" : "CC is ready",
    detail: getReadyState()
  });
}

async function refreshTmuxState(): Promise<void> {
  const next = await hasTmuxSession(config.tmuxSession);
  if (next !== tmuxAlive) {
    tmuxAlive = next;
    broadcast({
      type: "status",
      state: next ? "idle" : "offline",
      message: next ? "tmux session is online" : "tmux session is offline",
      detail: getReadyState()
    });
  }
}

async function drainQueue(): Promise<void> {
  if (draining || busy) return;
  draining = true;

  try {
    while (queue.length > 0) {
      await refreshTmuxState();
      if (!getReadyState().ready) return;

      const item = queue.shift();
      if (!item) return;

      const payload = formatChannelMessage(item.envelope);
      await sendToTmux(config.tmuxSession, payload, config.sendTimeoutMs);
      setBusy(true);
    }
  } catch (error) {
    broadcast({
      type: "status",
      state: "error",
      message: "Failed to inject message into tmux",
      detail: getReadyState()
    });
    log(`tmux inject failed: ${String(error)}`);
  } finally {
    draining = false;
  }
}

function enqueueMessage(client: Client, msg: Extract<ClientToHub, { type: "message" }>): void {
  const now = new Date().toISOString();
  queue.push({
    clientId: client.id,
    envelope: {
      chat_id: client.id,
      message_id: msg.id,
      user: config.channelUser,
      ts: msg.ts || now,
      text: msg.text
    }
  });

  send(client, { type: "ack", id: msg.id, queued: true });
  void drainQueue();
}

function parseMessage(raw: WebSocket.RawData): ClientToHub | null {
  try {
    return JSON.parse(raw.toString()) as ClientToHub;
  } catch {
    return null;
  }
}

clientWss.on("connection", (ws) => {
  clientCounter += 1;

  const client: Client = {
    id: `c_${clientCounter}`,
    ws,
    authenticated: !config.pin
  };

  clients.set(client.id, client);

  if (client.authenticated) {
    send(client, { type: "auth_ok", state: getReadyState() });
  } else {
    send(client, { type: "auth_required" });
  }

  ws.on("message", (raw) => {
    const msg = parseMessage(raw);
    if (!msg) {
      send(client, { type: "error", message: "invalid JSON" });
      return;
    }

    if (msg.type === "auth") {
      if (config.pin && msg.pin !== config.pin) {
        send(client, { type: "auth_fail", message: "wrong PIN" });
        return;
      }

      client.authenticated = true;
      send(client, { type: "auth_ok", state: getReadyState() });
      return;
    }

    if (!client.authenticated) {
      send(client, { type: "error", message: "not authenticated" });
      return;
    }

    if (msg.type === "ping") {
      send(client, { type: "pong", ts: new Date().toISOString() });
      return;
    }

    if (msg.type === "message") {
      if (!msg.text.trim()) {
        send(client, { type: "error", message: "message text is empty" });
        return;
      }

      enqueueMessage(client, msg);
    }
  });

  ws.on("close", () => {
    clients.delete(client.id);
  });
});

bridgeWss.on("connection", (ws) => {
  if (bridge && bridge.readyState === WebSocket.OPEN) {
    bridge.close(1000, "replaced by new bridge");
  }

  bridge = ws;
  broadcast({ type: "status", state: busy ? "thinking" : "idle", message: "MCP bridge connected", detail: getReadyState() });
  void drainQueue();

  ws.on("message", (raw) => {
    let msg: BridgeToHub;
    try {
      msg = JSON.parse(raw.toString()) as BridgeToHub;
    } catch {
      return;
    }

    if (msg.type !== "reply") return;

    const id = msg.id ?? randomUUID();
    broadcast({
      type: "reply",
      id,
      text: msg.text,
      reply_to: msg.reply_to,
      ts: new Date().toISOString()
    });

    if (msg._req_id && ws.readyState === WebSocket.OPEN) {
      const response: HubToBridge = { _req_id: msg._req_id, ok: true, id };
      ws.send(JSON.stringify(response));
    }

    setBusy(false);
    void drainQueue();
  });

  ws.on("close", () => {
    if (bridge === ws) {
      bridge = null;
      setBusy(false);
      broadcast({ type: "status", state: "offline", message: "MCP bridge disconnected", detail: getReadyState() });
    }
  });
});

setInterval(() => {
  void refreshTmuxState();
}, 5000);

await refreshTmuxState();

httpServer.listen(config.clientPort, "0.0.0.0", () => {
  log(`client WebSocket listening on ${config.clientPort}`);
  log(`bridge WebSocket listening on 127.0.0.1:${config.bridgePort}`);
  log(`tmux session: ${config.tmuxSession}`);
});
