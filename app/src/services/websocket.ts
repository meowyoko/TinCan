export type TinCanStatus = 'idle' | 'thinking' | 'error' | 'offline' | 'busy';

export type HubReply = {
  type: 'reply';
  id: string;
  text: string;
  reply_to?: string;
  ts: string;
};

export type HubStatus = {
  type: 'status';
  state: TinCanStatus;
  message?: string;
};

export type HubEvent = HubReply | HubStatus | {type: 'ack'; id: string; queued: boolean};

type TinCanSocketOptions = {
  url: string;
  pin?: string;
  onEvent: (event: HubEvent) => void;
  onError: (message: string) => void;
};

export class TinCanSocket {
  private ws: WebSocket | null = null;

  constructor(private readonly options: TinCanSocketOptions) {}

  connect(): void {
    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
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
  }

  send(text: string): string {
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.ws?.send(
      JSON.stringify({
        type: 'message',
        id,
        text,
        ts: new Date().toISOString(),
      }),
    );
    return id;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
