export type ReadyState = {
  tmux_alive: boolean;
  bridge_alive: boolean;
  busy: boolean;
  ready: boolean;
};

export type ClientToHub =
  | { type: "auth"; pin: string }
  | { type: "message"; id: string; text: string; ts: string }
  | { type: "ping" };

export type HubToClient =
  | { type: "auth_required" }
  | { type: "auth_ok"; state: ReadyState }
  | { type: "auth_fail"; message: string }
  | { type: "ack"; id: string; queued: boolean }
  | { type: "reply"; id: string; text: string; reply_to?: string; ts: string }
  | { type: "status"; state: "idle" | "thinking" | "error" | "offline" | "busy"; message?: string; detail?: ReadyState }
  | { type: "pong"; ts: string }
  | { type: "error"; message: string };

export type BridgeToHub =
  | { type: "reply"; id?: string; chat_id: string; text: string; reply_to?: string; _req_id?: string };

export type HubToBridge =
  | { _req_id: string; ok: boolean; id?: string; error?: string };

export type InboundEnvelope = {
  chat_id: string;
  message_id: string;
  user: string;
  ts: string;
  text: string;
};
