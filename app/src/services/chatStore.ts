import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';
import type {
  ChatAttachmentMessage,
  ChatMessage,
  ChatPermissionMessage,
  ChatTextMessage,
} from '../types/chat';

SQLite.enablePromise(true);

type MessageRow = {
  id: string;
  chat_id: string;
  type: string;
  role: string | null;
  content: string;
  metadata_json: string | null;
  reply_to: string | null;
  timestamp: string;
};

const DB_NAME = 'tincan.db';
let dbPromise: Promise<SQLiteDatabase> | null = null;

export async function loadMessages(chatId: string): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT id, chat_id, type, role, content, metadata_json, reply_to, timestamp
       FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp ASC, id ASC`,
    [chatId],
  );

  const messages: ChatMessage[] = [];
  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows.item(index) as MessageRow;
    const message = fromRow(row);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

export async function upsertMessage(message: ChatMessage): Promise<void> {
  const db = await getDatabase();
  const row = toRow(message);

  await db.executeSql(
    `INSERT OR REPLACE INTO messages
      (id, chat_id, type, role, content, metadata_json, reply_to, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.chat_id,
      row.type,
      row.role,
      row.content,
      row.metadata_json,
      row.reply_to,
      row.timestamp,
    ],
  );
}

export async function deleteMessageById(messageId: string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(`DELETE FROM messages WHERE id = ?`, [messageId]);
}

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabase({
      name: DB_NAME,
      location: 'default',
    }).then(async db => {
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          chat_id TEXT NOT NULL,
          type TEXT NOT NULL,
          role TEXT,
          content TEXT NOT NULL,
          metadata_json TEXT,
          reply_to TEXT,
          timestamp TEXT NOT NULL
        )`,
      );
      await db.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_messages_chat_time
          ON messages(chat_id, timestamp)`,
      );
      return db;
    });
  }

  return dbPromise;
}

function toRow(message: ChatMessage): MessageRow {
  if (message.type === 'text') {
    return {
      id: message.id,
      chat_id: message.chatId,
      type: message.type,
      role: message.role,
      content: message.text,
      metadata_json: JSON.stringify({
        thinking: message.thinking ?? null,
      }),
      reply_to: message.replyTo ?? null,
      timestamp: message.createdAt,
    };
  }

  if (message.type === 'attachment') {
    return {
      id: message.id,
      chat_id: message.chatId,
      type: message.type,
      role: message.role,
      content: message.caption ?? message.attachment.fileName,
      metadata_json: JSON.stringify({
        attachment: message.attachment,
        thinking: message.thinking ?? null,
      }),
      reply_to: message.replyTo ?? null,
      timestamp: message.createdAt,
    };
  }

  return {
    id: message.id,
    chat_id: message.chatId,
    type: message.type,
    role: null,
    content: message.detail,
    metadata_json: JSON.stringify({
      toolName: message.toolName,
      summary: message.summary ?? null,
      status: message.status,
      decision: message.decision ?? null,
      resolvedAt: message.resolvedAt ?? null,
    }),
    reply_to: null,
    timestamp: message.createdAt,
  };
}

function fromRow(row: MessageRow): ChatMessage | null {
  const metadata = parseJson(row.metadata_json);
  const time = formatTime(row.timestamp);

  if (row.type === 'text') {
    return {
      id: row.id,
      chatId: row.chat_id,
      type: 'text',
      role: row.role === 'user' ? 'user' : 'assistant',
      text: row.content,
      replyTo: stringOrUndefined(row.reply_to),
      thinking: metadata?.thinking,
      time,
      createdAt: row.timestamp,
    } satisfies ChatTextMessage;
  }

  if (row.type === 'attachment' && metadata?.attachment) {
    return {
      id: row.id,
      chatId: row.chat_id,
      type: 'attachment',
      role: row.role === 'user' ? 'user' : 'assistant',
      caption: row.content || undefined,
      attachment: metadata.attachment,
      replyTo: stringOrUndefined(row.reply_to),
      thinking: metadata?.thinking,
      time,
      createdAt: row.timestamp,
    } satisfies ChatAttachmentMessage;
  }

  if (row.type === 'permission') {
    return {
      id: row.id,
      chatId: row.chat_id,
      type: 'permission',
      toolName: metadata?.toolName ?? 'Action',
      detail: row.content,
      summary: stringOrUndefined(metadata?.summary),
      status: metadata?.status ?? 'pending',
      decision: metadata?.decision ?? undefined,
      resolvedAt: stringOrUndefined(metadata?.resolvedAt),
      time,
      createdAt: row.timestamp,
    } satisfies ChatPermissionMessage;
  }

  return null;
}

function parseJson(value: string | null): Record<string, any> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    return null;
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
