import type {
  AttachmentType,
  PermissionDecision,
  PermissionOutcome,
} from '../types/chat';

export type TinCanStatus = 'idle' | 'thinking' | 'error' | 'offline' | 'busy';

export type HubAttachment = {
  attachment_type: AttachmentType;
  file_name: string;
  file_path?: string;
  file_uri?: string;
  mime_type?: string;
  size_bytes?: number;
  duration_ms?: number;
};

export type OutboundAttachment = HubAttachment & {
  data_base64: string;
};

type HubReplyBase = {
  type: 'reply';
  id: string;
  chat_id: string;
  reply_to?: string;
  ts: string;
};

export type HubTextReply = HubReplyBase & {
  kind?: 'text';
  text: string;
};

export type HubAttachmentReply = HubReplyBase & {
  kind: 'attachment';
  text?: string;
  attachment: HubAttachment;
};

export type HubThinking = {
  type: 'thinking';
  id: string;
  chat_id: string;
  reply_to: string;
  text: string;
  ts: string;
};

export type HubStatus = {
  type: 'status';
  state: TinCanStatus;
  message?: string;
};

export type HubPermissionRequest = {
  type: 'permission_request';
  id: string;
  tool: string;
  detail: string;
  summary?: string;
  ts: string;
};

export type HubPermissionResolved = {
  type: 'permission_resolved';
  id: string;
  decision: PermissionOutcome;
  resolved_at: string;
};

export type HubEvent =
  | HubTextReply
  | HubAttachmentReply
  | HubThinking
  | HubStatus
  | HubPermissionRequest
  | HubPermissionResolved
  | {type: 'auth_required'}
  | {type: 'auth_ok'}
  | {type: 'auth_fail'; message: string}
  | {type: 'ack'; id: string; queued: boolean}
  | {type: 'error'; message: string}
  | {type: 'pong'; ts: string};

type TinCanSocketOptions = {
  url: string;
  pin?: string;
  onEvent: (event: HubEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError: (message: string) => void;
};

export class TinCanSocket {
  private ws: WebSocket | null = null;

  constructor(private readonly options: TinCanSocketOptions) {}

  connect(): void {
    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
      this.options.onOpen?.();
      if (this.options.pin) {
        this.ws?.send(JSON.stringify({type: 'auth', pin: this.options.pin}));
      }
    };

    this.ws.onmessage = message => {
      try {
        this.options.onEvent(JSON.parse(message.data) as HubEvent);
      } catch {
        this.options.onError('Hub returned invalid JSON');
      }
    };

    this.ws.onerror = () => {
      this.options.onError('WebSocket connection failed');
    };

    this.ws.onclose = () => {
      this.options.onClose?.();
    };
  }

  send(chatId: string, text: string): string | null {
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return null;
    }

    this.ws.send(
      JSON.stringify({
        type: 'message',
        id,
        chat_id: chatId,
        text,
        ts: new Date().toISOString(),
      }),
    );
    return id;
  }

  sendAttachment(
    chatId: string,
    attachment: OutboundAttachment,
    text = '',
  ): string | null {
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return null;
    }

    this.ws.send(
      JSON.stringify({
        type: 'message',
        id,
        chat_id: chatId,
        text,
        attachment,
        ts: new Date().toISOString(),
      }),
    );
    return id;
  }

  resolvePermission(requestId: string, decision: PermissionDecision): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.ws.send(
      JSON.stringify({
        type: 'permission_decision',
        request_id: requestId,
        decision,
        ts: new Date().toISOString(),
      }),
    );
    return true;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
