export const PRIMARY_CHAT_ID = 'main';

export type PermissionDecision = 'allow' | 'deny';
export type PermissionOutcome = PermissionDecision | 'external';
export type AttachmentType = 'image' | 'voice' | 'file';

export type ChatThinking = {
  id: string;
  text: string;
  createdAt: string;
};

export type ChatAttachment = {
  attachmentType: AttachmentType;
  fileName: string;
  localPath?: string;
  uri?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationMs?: number;
};

type ChatBaseMessage = {
  id: string;
  chatId: string;
  time: string;
  createdAt: string;
};

type ChatAuthoredMessageBase = ChatBaseMessage & {
  role: 'user' | 'assistant';
  replyTo?: string;
  thinking?: ChatThinking;
};

export type ChatTextMessage = ChatAuthoredMessageBase & {
  type: 'text';
  text: string;
};

export type ChatAttachmentMessage = ChatAuthoredMessageBase & {
  type: 'attachment';
  attachment: ChatAttachment;
  caption?: string;
};

export type ChatPermissionMessage = ChatBaseMessage & {
  type: 'permission';
  toolName: string;
  detail: string;
  summary?: string;
  status: 'pending' | 'submitting' | 'resolved';
  decision?: PermissionOutcome;
  resolvedAt?: string;
};

export type ChatMessage =
  | ChatTextMessage
  | ChatAttachmentMessage
  | ChatPermissionMessage;
