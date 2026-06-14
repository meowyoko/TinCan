import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import {
  parseApprovalSnapshot,
  shouldDismissSessionSurvey,
  type ApprovalSnapshot,
} from "./approval-parser.js";
import { config } from "./config.js";
import { formatChannelMessage } from "./channel.js";
import {
  capturePane,
  dismissSessionSurvey,
  hasTmuxSession,
  sendApprovalDecision,
  sendToTmux,
} from "./tmux.js";
import type {
  BridgeToHub,
  ClientToHub,
  HubBridgeAck,
  HubToBridge,
  HubToClient,
  InboundEnvelope,
  AttachmentPayload,
  PermissionDecision,
  PermissionOutcome,
  ReadyState,
  UploadAttachmentPayload,
} from "./protocol.js";

type Client = {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
};

type QueueItem = {
  envelope: InboundEnvelope;
  clientId: string;
};

type PendingPermissionRequest = {
  bridgeReqId: string;
  ws: WebSocket;
};

type ActiveApproval = {
  id: string;
  fingerprint: string;
  comparisonKey: string;
  toolName: string;
  summary: string | null;
  detail: string;
  allowIndex: number | null;
  denyIndex: number | null;
  decisionSent: PermissionDecision | null;
  missingPolls: number;
};

const APPROVAL_MISS_GRACE_POLLS = 2;
const DEFAULT_ATTACHMENT_EXT: Record<AttachmentPayload["attachment_type"], string> = {
  image: ".bin",
  voice: ".bin",
  file: ".bin",
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
const pendingPermissionRequests = new Map<string, PendingPermissionRequest>();

let clientCounter = 0;
let bridge: WebSocket | null = null;
let tmuxAlive = false;
let busy = false;
let draining = false;
let busyTimer: NodeJS.Timeout | null = null;
let approvalPollBusy = false;
let activeApproval: ActiveApproval | null = null;
let surveyDismissedAt = 0;

function log(message: string): void {
  process.stderr.write(`tin-can hub: ${message}\n`);
}

function getReadyState(): ReadyState {
  const approvalPending = activeApproval !== null;

  return {
    tmux_alive: tmuxAlive,
    bridge_alive: bridge?.readyState === WebSocket.OPEN,
    busy,
    approval_pending: approvalPending,
    ready: tmuxAlive && bridge?.readyState === WebSocket.OPEN && !busy && !approvalPending,
  };
}

function send(client: Client, payload: HubToClient): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload: HubToClient): void {
  for (const client of clients.values()) {
    if (client.authenticated) {
      send(client, payload);
    }
  }
}

function broadcastStatusForRuntime(): void {
  if (!tmuxAlive) {
    broadcast({
      type: "status",
      state: "offline",
      message: "tmux session is offline",
      detail: getReadyState(),
    });
    return;
  }

  if (activeApproval) {
    broadcast({
      type: "status",
      state: "busy",
      message: "Waiting for permission approval",
      detail: getReadyState(),
    });
    return;
  }

  broadcast({
    type: "status",
    state: busy ? "thinking" : "idle",
    message: busy ? "Message delivered to CC" : "CC is ready",
    detail: getReadyState(),
  });
}

function setBusy(nextBusy: boolean): void {
  busy = nextBusy;
  if (busyTimer) {
    clearTimeout(busyTimer);
  }

  if (nextBusy) {
    busyTimer = setTimeout(() => {
      busy = false;
      broadcastStatusForRuntime();
      drainQueue().catch((err: unknown) => log(`queue drain after timeout failed: ${String(err)}`));
    }, config.busyTimeoutMs);
  }

  broadcastStatusForRuntime();
}

async function refreshTmuxState(): Promise<void> {
  const next = await hasTmuxSession(config.tmuxSession);
  if (next !== tmuxAlive) {
    tmuxAlive = next;
    broadcastStatusForRuntime();
  }
}

async function syncApprovalState(): Promise<void> {
  if (approvalPollBusy || !tmuxAlive) return;
  approvalPollBusy = true;

  try {
    const paneText = await capturePane(
      config.tmuxSession,
      -config.approvalTailLines,
      config.sendTimeoutMs,
    );
    if (shouldDismissSessionSurvey(paneText)) {
      const now = Date.now();
      if (now - surveyDismissedAt > 1500) {
        await dismissSessionSurvey(config.tmuxSession, config.sendTimeoutMs);
        surveyDismissedAt = now;
      }
    }
    const snapshot = parseApprovalSnapshot(paneText);
    applyApprovalSnapshot(snapshot);
  } catch (error) {
    log(`approval poll failed: ${String(error)}`);
  } finally {
    approvalPollBusy = false;
  }
}

function applyApprovalSnapshot(snapshot: ApprovalSnapshot): void {
  if (!snapshot.pending) {
    if (!activeApproval) {
      return;
    }

    if (activeApproval.missingPolls < APPROVAL_MISS_GRACE_POLLS) {
      activeApproval = {
        ...activeApproval,
        missingPolls: activeApproval.missingPolls + 1,
      };
      return;
    }

    finishActiveApproval(activeApproval.decisionSent === null ? "external" : null);
    return;
  }

  const nextApproval = approvalFromSnapshot(snapshot);

  if (activeApproval) {
    activeApproval = {
      ...activeApproval,
      fingerprint: nextApproval.fingerprint,
      comparisonKey: nextApproval.comparisonKey,
      toolName: nextApproval.toolName,
      summary: nextApproval.summary,
      detail: nextApproval.detail,
      allowIndex: nextApproval.allowIndex,
      denyIndex: nextApproval.denyIndex,
      missingPolls: 0,
    };
    return;
  }

  activeApproval = nextApproval;
  broadcast({
    type: "permission_request",
    id: nextApproval.id,
    tool: nextApproval.toolName,
    detail: nextApproval.detail,
    summary: nextApproval.summary ?? undefined,
    ts: new Date().toISOString(),
  });
  broadcastStatusForRuntime();
}

function approvalFromSnapshot(snapshot: ApprovalSnapshot): ActiveApproval {
  const toolName = snapshot.toolName ?? "Action";
  const summary = snapshot.summary ?? null;
  const detail = snapshot.detail ?? "";
  const fingerprint = snapshot.fingerprint ?? randomUUID();

  return {
    id: randomUUID(),
    fingerprint,
    comparisonKey: buildApprovalComparisonKey(toolName, summary, detail),
    toolName,
    summary,
    detail,
    allowIndex: snapshot.allowIndex,
    denyIndex: snapshot.denyIndex,
    decisionSent: null,
    missingPolls: 0,
  };
}

function finishActiveApproval(
  outcome: PermissionOutcome | null,
  shouldDrainQueue = true,
): void {
  if (!activeApproval) {
    return;
  }

  const resolvedApproval = activeApproval;
  activeApproval = null;

  if (outcome) {
    broadcast({
      type: "permission_resolved",
      id: resolvedApproval.id,
      decision: outcome,
      resolved_at: new Date().toISOString(),
    });
  }

  broadcastStatusForRuntime();
  if (shouldDrainQueue) {
    void drainQueue();
  }
}

function buildApprovalComparisonKey(
  toolName: string,
  summary: string | null,
  detail: string,
): string {
  const stableDetail = detail
    .split("\n")
    .map(line => line.trim())
    .find(Boolean) ?? "";

  return [toolName, summary ?? "", stableDetail]
    .join("\n")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function drainQueue(): Promise<void> {
  if (draining || busy || activeApproval) return;
  draining = true;

  try {
    while (queue.length > 0) {
      await refreshTmuxState();
      await syncApprovalState();
      if (!getReadyState().ready) {
        return;
      }

      const item = queue.shift();
      if (!item) {
        return;
      }

      const payload = formatChannelMessage(item.envelope);
      await sendToTmux(config.tmuxSession, payload, config.sendTimeoutMs);
      setBusy(true);
    }
  } catch (error) {
    broadcast({
      type: "status",
      state: "error",
      message: "Failed to inject message into tmux",
      detail: getReadyState(),
    });
    log(`tmux inject failed: ${String(error)}`);
  } finally {
    draining = false;
  }
}

async function enqueueMessage(
  client: Client,
  msg: Extract<ClientToHub, { type: "message" }>,
): Promise<void> {
  const now = new Date().toISOString();
  const chatId = msg.chat_id?.trim() || client.id;
  const attachment = msg.attachment
    ? await materializeAttachment(msg.attachment, msg.id)
    : undefined;
  const fallbackText = attachment ? `[${attachment.attachment_type}] ${attachment.file_name}` : "";
  queue.push({
    clientId: client.id,
    envelope: {
      chat_id: chatId,
      message_id: msg.id,
      user: config.channelUser,
      ts: msg.ts || now,
      text: msg.text || fallbackText,
      attachment,
    },
  });

  send(client, { type: "ack", id: msg.id, queued: true });
  void drainQueue();
}

async function resolvePermission(
  msg: Extract<ClientToHub, { type: "permission_decision" }>,
  client: Client,
): Promise<void> {
  const resolvedAt = msg.ts || new Date().toISOString();

  if (activeApproval && activeApproval.id === msg.request_id) {
    try {
      await sendApprovalDecision(
        config.tmuxSession,
        msg.decision,
        config.sendTimeoutMs,
        activeApproval.denyIndex,
      );
    } catch (error) {
      send(client, {
        type: "error",
        message: `failed to inject approval response: ${String(error)}`,
      });
      return;
    }

    activeApproval = {
      ...activeApproval,
      decisionSent: msg.decision,
      missingPolls: 0,
    };
    broadcast({
      type: "permission_resolved",
      id: msg.request_id,
      decision: msg.decision,
      resolved_at: resolvedAt,
    });
    broadcastStatusForRuntime();
    return;
  }

  const pending = pendingPermissionRequests.get(msg.request_id);
  if (pending) {
    if (pending.ws.readyState !== WebSocket.OPEN) {
      send(client, {
        type: "error",
        message: "MCP bridge is offline, cannot resolve permission",
      });
      pendingPermissionRequests.delete(msg.request_id);
      return;
    }

    const outbound: HubToBridge = {
      _req_id: pending.bridgeReqId,
      ok: true,
      id: msg.request_id,
      decision: msg.decision,
      resolved_at: resolvedAt,
    };

    pending.ws.send(JSON.stringify(outbound));
    pendingPermissionRequests.delete(msg.request_id);
    broadcast({
      type: "permission_resolved",
      id: msg.request_id,
      decision: msg.decision,
      resolved_at: resolvedAt,
    });
    return;
  }

  send(client, { type: "error", message: "permission request is no longer pending" });
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
    authenticated: !config.pin,
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
      if (!msg.text.trim() && !msg.attachment) {
        send(client, { type: "error", message: "message text is empty" });
        return;
      }

      void enqueueMessage(client, msg).catch(error => {
        send(client, {
          type: "error",
          message: `failed to prepare attachment: ${String(error)}`,
        });
      });
      return;
    }

    if (msg.type === "thinking") {
      const chatId = msg.chat_id?.trim() || PRIMARY_CHAT_ID;
      broadcast({
        type: "thinking",
        id: msg.id,
        chat_id: chatId,
        reply_to: msg.reply_to,
        text: msg.text,
        ts: msg.ts || new Date().toISOString(),
      });
      send(client, { type: "ack", id: msg.id, queued: false });
      return;
    }

    if (msg.type === "permission_decision") {
      void resolvePermission(msg, client);
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
  broadcastStatusForRuntime();
  void drainQueue();

  ws.on("message", (raw) => {
    let msg: BridgeToHub;
    try {
      msg = JSON.parse(raw.toString()) as BridgeToHub;
    } catch {
      return;
    }

    if (msg.type === "reply") {
      const id = msg.id ?? randomUUID();
      const basePayload = {
        type: "reply",
        id,
        chat_id: msg.chat_id,
        reply_to: msg.reply_to,
        ts: new Date().toISOString(),
      } as const;

      broadcast(msg.attachment ? {
        ...basePayload,
        kind: "attachment",
        text: msg.text,
        attachment: msg.attachment,
      } : {
        ...basePayload,
        text: msg.text ?? "",
      });

      if (msg._req_id && ws.readyState === WebSocket.OPEN) {
        const response: HubBridgeAck = { _req_id: msg._req_id, ok: true, id };
        ws.send(JSON.stringify(response));
      }

      setBusy(false);
      void drainQueue();
      return;
    }

    if (msg.type === "thinking") {
      const id = msg.id ?? randomUUID();
      broadcast({
        type: "thinking",
        id,
        chat_id: msg.chat_id,
        reply_to: msg.reply_to,
        text: msg.text,
        ts: msg.ts ?? new Date().toISOString(),
      });

      if (msg._req_id && ws.readyState === WebSocket.OPEN) {
        const response: HubBridgeAck = { _req_id: msg._req_id, ok: true, id };
        ws.send(JSON.stringify(response));
      }
      return;
    }

    if (msg.type === "permission_request") {
      const permissionId = msg.id ?? randomUUID();

      if (msg._req_id) {
        pendingPermissionRequests.set(permissionId, {
          bridgeReqId: msg._req_id,
          ws,
        });
      }

      broadcast({
        type: "permission_request",
        id: permissionId,
        tool: msg.tool,
        detail: msg.detail,
        summary: msg.summary,
        ts: msg.ts ?? new Date().toISOString(),
      });
    }
  });

  ws.on("close", () => {
    if (bridge === ws) {
      bridge = null;
      setBusy(false);
      for (const [requestId, pending] of pendingPermissionRequests.entries()) {
        if (pending.ws === ws) {
          pendingPermissionRequests.delete(requestId);
        }
      }
      broadcast({
        type: "status",
        state: "offline",
        message: "MCP bridge disconnected",
        detail: getReadyState(),
      });
    }
  });
});

setInterval(() => {
  void refreshTmuxState();
}, 5000);

setInterval(() => {
  void syncApprovalState();
}, config.approvalPollMs);

await refreshTmuxState();
await syncApprovalState();

httpServer.listen(config.clientPort, "0.0.0.0", () => {
  log(`client WebSocket listening on ${config.clientPort}`);
  log(`bridge WebSocket listening on 127.0.0.1:${config.bridgePort}`);
  log(`tmux session: ${config.tmuxSession}`);
});

const PRIMARY_CHAT_ID = "main";

async function materializeAttachment(
  attachment: UploadAttachmentPayload,
  messageId: string,
): Promise<AttachmentPayload> {
  if (!attachment.data_base64) {
    return stripAttachmentData(attachment);
  }

  await mkdir(config.uploadDir, { recursive: true });
  const extension = resolveAttachmentExtension(attachment);
  const storedName = `${Date.now()}-${sanitizeForFilename(messageId)}${extension}`;
  const storedPath = join(config.uploadDir, storedName);

  await writeFile(storedPath, Buffer.from(attachment.data_base64, "base64"));

  return {
    attachment_type: attachment.attachment_type,
    file_name: attachment.file_name,
    file_path: storedPath,
    file_uri: attachment.file_uri,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    duration_ms: attachment.duration_ms,
  };
}

function stripAttachmentData(
  attachment: UploadAttachmentPayload,
): AttachmentPayload {
  return {
    attachment_type: attachment.attachment_type,
    file_name: attachment.file_name,
    file_path: attachment.file_path,
    file_uri: attachment.file_uri,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    duration_ms: attachment.duration_ms,
  };
}

function resolveAttachmentExtension(
  attachment: UploadAttachmentPayload,
): string {
  const fromName = extname(attachment.file_name ?? "").trim();
  if (fromName) {
    return fromName;
  }

  return DEFAULT_ATTACHMENT_EXT[attachment.attachment_type];
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
