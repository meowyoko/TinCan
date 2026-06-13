export type ReadyState = {
  tmux_alive: boolean;
  bridge_alive: boolean;
  busy: boolean;
  approval_pending: boolean;
  ready: boolean;
};

export type PermissionDecision = "allow" | "deny";
export type PermissionOutcome = PermissionDecision | "external";

export type ClientToHub =
  | { type: "auth"; pin: string }
  | { type: "message"; id: string; text: string; ts: string }
  | { type: "permission_decision"; request_id: string; decision: PermissionDecision; ts: string }
  | { type: "ping" };

export type HubToClient =
  | { type: "auth_required" }
  | { type: "auth_ok"; state: ReadyState }
  | { type: "auth_fail"; message: string }
  | { type: "ack"; id: string; queued: boolean }
  | { type: "reply"; id: string; text: string; reply_to?: string; ts: string }
  | { type: "permission_request"; id: string; tool: string; detail: string; summary?: string; ts: string }
  | { type: "permission_resolved"; id: string; decision: PermissionOutcome; resolved_at: string }
  | {
      type: "status";
      state: "idle" | "thinking" | "error" | "offline" | "busy";
      message?: string;
      detail?: ReadyState;
    }
  | { type: "pong"; ts: string }
  | { type: "error"; message: string };

export type BridgeToHub =
  | { type: "reply"; id?: string; chat_id: string; text: string; reply_to?: string; _req_id?: string }
  | { type: "permission_request"; id?: string; tool: string; detail: string; summary?: string; ts?: string; _req_id?: string };

export type HubBridgeAck = {
  _req_id: string;
  ok: boolean;
  id?: string;
  error?: string;
  decision?: PermissionDecision;
  resolved_at?: string;
};

export type HubToBridge = HubBridgeAck;

export type InboundEnvelope = {
  chat_id: string;
  message_id: string;
  user: string;
  ts: string;
  text: string;
};
