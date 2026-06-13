export type PermissionDecision = 'allow' | 'deny';
export type PermissionOutcome = PermissionDecision | 'external';

export type ChatTextMessage = {
  id: string;
  type: 'text';
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

export type ChatPermissionMessage = {
  id: string;
  type: 'permission';
  toolName: string;
  detail: string;
  time: string;
  summary?: string;
  status: 'pending' | 'submitting' | 'resolved';
  decision?: PermissionOutcome;
  resolvedAt?: string;
};

export type ChatMessage = ChatTextMessage | ChatPermissionMessage;
