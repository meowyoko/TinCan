import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AttachmentMessageCard} from '../components/AttachmentMessageCard';
import {InputBar} from '../components/InputBar';
import {MessageBubble} from '../components/MessageBubble';
import {PermissionCard} from '../components/PermissionCard';
import {TopBar} from '../components/TopBar';
import {pickAttachmentForUpload} from '../services/attachments';
import {
  deleteMessageById,
  loadMessages,
  upsertMessage,
} from '../services/chatStore';
import {tinCanConfig} from '../services/tincanConfig';
import {
  TinCanSocket,
  type HubEvent,
  type HubTextReply,
  type TinCanStatus,
} from '../services/websocket';
import {colors, typography} from '../theme/colors';
import type {
  ChatAttachmentMessage,
  ChatMessage,
  ChatPermissionMessage,
  ChatTextMessage,
  ChatThinking,
  PermissionDecision,
  PermissionOutcome,
} from '../types/chat';
import {PRIMARY_CHAT_ID} from '../types/chat';

type ChatScreenProps = {
  onBack: () => void;
};

export function ChatScreen({onBack}: ChatScreenProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionLabel, setConnectionLabel] = useState(
    tinCanConfig.enabled ? '连接中：Tin-Can Hub' : '展示模式：未连接 Hub',
  );
  const [remoteStatus, setRemoteStatus] = useState<TinCanStatus>('offline');
  const socketRef = useRef<TinCanSocket | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingThinkingRef = useRef<Map<string, ChatThinking>>(new Map());

  const statusText = useMemo(() => {
    if (!tinCanConfig.enabled) {
      return connectionLabel;
    }
    return `正在对话：Ciel · ${connectionLabel}`;
  }, [connectionLabel]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateMessages(): Promise<void> {
      const storedMessages = await loadMessages(PRIMARY_CHAT_ID);
      if (cancelled) {
        return;
      }

      if (storedMessages.length > 0) {
        commitMessages(storedMessages);
        return;
      }

      const seeded = createInitialMessages();
      commitMessages(seeded);

      if (!tinCanConfig.enabled) {
        for (const message of seeded) {
          await upsertMessage(message);
        }
      }
    }

    ignorePromise(hydrateMessages());

    return () => {
      cancelled = true;
    };
  }, []);

  const handleHubEvent = useCallback((event: HubEvent): void => {
    if (event.type === 'auth_required') {
      setConnectionLabel('等待 PIN 鉴权');
      return;
    }

    if (event.type === 'auth_ok') {
      setConnectionLabel('Hub 鉴权通过');
      setRemoteStatus('idle');
      return;
    }

    if (event.type === 'auth_fail') {
      setConnectionLabel(`鉴权失败：${event.message}`);
      setRemoteStatus('error');
      return;
    }

    if (event.type === 'ack') {
      setConnectionLabel(event.queued ? '消息已进入队列' : '消息已送达');
      setRemoteStatus('busy');
      return;
    }

    if (event.type === 'status') {
      setRemoteStatus(event.state);
      setConnectionLabel(statusMessage(event.state, event.message));
      return;
    }

    if (event.type === 'permission_request') {
      setRemoteStatus('busy');
      setConnectionLabel('收到审批请求');
      const message: ChatPermissionMessage = {
        id: event.id,
        chatId: PRIMARY_CHAT_ID,
        type: 'permission',
        toolName: event.tool,
        summary: event.summary,
        detail: event.detail,
        time: formatTime(event.ts),
        createdAt: event.ts,
        status: 'pending',
      };
      const next = upsertPermissionMessage(messagesRef.current, message);
      commitMessages(next);
      ignorePromise(upsertMessage(message));
      return;
    }

    if (event.type === 'permission_resolved') {
      setConnectionLabel(permissionResolutionLabel(event.decision));
      setRemoteStatus('idle');
      const {messages: nextMessages, updated} = resolvePermissionMessage(
        messagesRef.current,
        event.id,
        event.decision,
        event.resolved_at,
      );
      commitMessages(nextMessages);
      if (updated) {
        ignorePromise(upsertMessage(updated));
      }
      return;
    }

    if (event.type === 'thinking') {
      const thinking: ChatThinking = {
        id: event.id,
        text: event.text,
        createdAt: event.ts,
      };
      const {messages: nextMessages, updated} = attachThinkingToReply(
        messagesRef.current,
        event.reply_to,
        thinking,
      );

      if (updated) {
        commitMessages(nextMessages);
        ignorePromise(upsertMessage(updated));
      } else {
        pendingThinkingRef.current.set(event.reply_to, thinking);
      }
      return;
    }

    if (event.type === 'error') {
      setConnectionLabel(event.message);
      setRemoteStatus('error');
      return;
    }

    if (event.type === 'reply') {
      setRemoteStatus('idle');
      setConnectionLabel('Ciel 已回复');
      const nextMessage = buildIncomingMessage(
        event,
        pendingThinkingRef.current,
      );
      const next = upsertChatMessage(messagesRef.current, nextMessage);
      commitMessages(next);
      ignorePromise(upsertMessage(nextMessage));
    }
  }, []);

  useEffect(() => {
    if (!tinCanConfig.enabled) {
      return;
    }

    const socket = new TinCanSocket({
      url: tinCanConfig.hubUrl,
      pin: tinCanConfig.pin,
      onOpen: () => {
        setConnectionLabel('Hub 已连接');
        setRemoteStatus('idle');
      },
      onClose: () => {
        setConnectionLabel('Hub 已断开');
        setRemoteStatus('offline');
      },
      onError: message => {
        setConnectionLabel(message);
        setRemoteStatus('error');
      },
      onEvent: handleHubEvent,
    });

    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [handleHubEvent]);

  function handleSend(text: string): void {
    const now = new Date().toISOString();
    const remoteId = socketRef.current?.send(PRIMARY_CHAT_ID, text);
    const outgoingMessage: ChatTextMessage = {
      id: remoteId ?? `local_${Date.now()}`,
      chatId: PRIMARY_CHAT_ID,
      type: 'text',
      role: 'user',
      text,
      time: formatTime(now),
      createdAt: now,
    };

    const next = [...messagesRef.current, outgoingMessage];
    commitMessages(next);
    ignorePromise(upsertMessage(outgoingMessage));

    if (tinCanConfig.enabled) {
      setConnectionLabel(
        remoteId ? '正在投递到 Hub' : 'Hub 未连接，本地已记录消息',
      );
      setRemoteStatus(remoteId ? 'busy' : 'offline');
    }
  }

  function handleAddPress(): void {
    ignorePromise(handlePickAttachment());
  }

  async function handlePickAttachment(): Promise<void> {
    try {
      const picked = await pickAttachmentForUpload();
      if (!picked) {
        return;
      }

      const remoteId = socketRef.current?.sendAttachment(
        PRIMARY_CHAT_ID,
        picked.outbound,
        '',
      );

      const localMessage: ChatAttachmentMessage = {
        ...picked.localMessage,
        id: remoteId ?? picked.localMessage.id,
      };

      const next = [...messagesRef.current, localMessage];
      commitMessages(next);
      await upsertMessage(localMessage);

      if (tinCanConfig.enabled) {
        setConnectionLabel(
          remoteId ? '附件正在上传到 Hub' : 'Hub 未连接，本地已记录附件',
        );
        setRemoteStatus(remoteId ? 'busy' : 'offline');
      }
    } catch (error) {
      Alert.alert(
        '附件发送失败',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  function handlePermissionDecision(
    messageId: string,
    decision: PermissionDecision,
  ): void {
    if (tinCanConfig.enabled) {
      const sent = socketRef.current?.resolvePermission(messageId, decision) ?? false;
      if (sent) {
        const {messages: nextMessages, updated} = markPermissionSubmitting(
          messagesRef.current,
          messageId,
        );
        commitMessages(nextMessages);
        if (updated) {
          ignorePromise(upsertMessage(updated));
        }
        setConnectionLabel(decision === 'deny' ? '已提交拒绝' : '已提交允许');
        setRemoteStatus('busy');
      } else {
        setConnectionLabel('Hub 未连接，请示未送达');
        setRemoteStatus('error');
      }
      return;
    }

    const resolvedAt = new Date().toISOString();
    const {messages: nextMessages, updated} = resolvePermissionMessage(
      messagesRef.current,
      messageId,
      decision,
      resolvedAt,
    );
    commitMessages(nextMessages);
    if (updated) {
      ignorePromise(upsertMessage(updated));
    }
  }

  function handleDeleteRequest(message: ChatMessage): void {
    Alert.alert(
      '只删除本地消息？',
      '这不会影响 Hub、channel 标签或 Ciel 侧记录。',
      [
        {text: '取消', style: 'cancel'},
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            const next = messagesRef.current.filter(item => item.id !== message.id);
            commitMessages(next);
            ignorePromise(deleteMessageById(message.id));
          },
        },
      ],
    );
  }

  function commitMessages(nextMessages: ChatMessage[]): void {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <TopBar leftLabel="←" onLeftPress={onBack} />
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, statusDotStyle(remoteStatus)]} />
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.volumeText}>第一卷</Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.dateDivider}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>2026年6月13日</Text>
            <View style={styles.dateLine} />
          </View>

          {messages.map((message, index) => {
            if (message.type === 'text') {
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showSender={shouldShowSender(messages, index)}
                  onLongPress={() => handleDeleteRequest(message)}
                />
              );
            }

            if (message.type === 'attachment') {
              return (
                <AttachmentMessageCard
                  key={message.id}
                  message={message}
                  showSender={shouldShowSender(messages, index)}
                  onLongPress={() => handleDeleteRequest(message)}
                />
              );
            }

            return (
              <PermissionCard
                key={message.id}
                message={message}
                onDecision={handlePermissionDecision}
                onLongPress={() => handleDeleteRequest(message)}
              />
            );
          })}
        </ScrollView>

        <InputBar onSend={handleSend} onAddPress={handleAddPress} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createInitialMessages(): ChatMessage[] {
  if (tinCanConfig.enabled) {
    return [];
  }

  return [
    {
      id: 'demo_a_1',
      chatId: PRIMARY_CHAT_ID,
      type: 'text',
      role: 'assistant',
      text: '早上好，凛。我先把三期拆成两步：先把消息协议和持久化打底，再把新的 thinking 展示接进聊天流里。',
      time: '10:28',
      createdAt: '2026-06-13T10:28:00.000+08:00',
      thinking: {
        id: 'demo_thinking_1',
        text: '先做协议和消息模型，后面 UI 才不会反复返工。',
        createdAt: '2026-06-13T10:28:00.000+08:00',
      },
    },
    {
      id: 'demo_u_1',
      chatId: PRIMARY_CHAT_ID,
      type: 'text',
      role: 'user',
      text: '好的，先把底层铺稳，再慢慢补前端细节。',
      time: '10:29',
      createdAt: '2026-06-13T10:29:00.000+08:00',
    },
    {
      id: 'demo_perm_1',
      chatId: PRIMARY_CHAT_ID,
      type: 'permission',
      toolName: 'Bash',
      summary: '需要执行构建命令，请示是否继续。',
      detail: 'npm run build --production --verbose',
      time: '10:31',
      createdAt: '2026-06-13T10:31:00.000+08:00',
      status: 'pending',
    },
  ];
}

function ignorePromise<T>(promise: Promise<T>): void {
  promise.catch(() => undefined);
}

function shouldShowSender(messages: ChatMessage[], index: number): boolean {
  if (shouldForceSenderLine(messages[index])) {
    return true;
  }

  const currentRole = roleOfMessage(messages[index]);
  if (!currentRole) {
    return false;
  }

  const previousRole = roleOfMessage(messages[index - 1]);
  return previousRole !== currentRole;
}

function roleOfMessage(
  message: ChatMessage | undefined,
): 'user' | 'assistant' | null {
  if (!message) {
    return null;
  }

  if (message.type === 'text' || message.type === 'attachment') {
    return message.role;
  }

  return null;
}

function shouldForceSenderLine(message: ChatMessage | undefined): boolean {
  if (!message || message.type === 'permission') {
    return false;
  }

  return message.role === 'assistant' && Boolean(message.thinking?.text);
}

function buildIncomingMessage(
  event: HubEvent,
  pendingThinking: Map<string, ChatThinking>,
): ChatTextMessage | ChatAttachmentMessage {
  if (event.type === 'reply' && event.kind === 'attachment') {
    return applyPendingThinking(
      {
        id: event.id,
        chatId: event.chat_id,
        type: 'attachment',
        role: 'assistant',
        attachment: {
          attachmentType: event.attachment.attachment_type,
          fileName: event.attachment.file_name,
          localPath: event.attachment.file_path,
          uri: event.attachment.file_uri,
          mimeType: event.attachment.mime_type,
          sizeBytes: event.attachment.size_bytes,
          durationMs: event.attachment.duration_ms,
        },
        caption: event.text,
        replyTo: event.reply_to,
        time: formatTime(event.ts),
        createdAt: event.ts,
      },
      pendingThinking,
    );
  }

  const reply = event as HubTextReply;
  return applyPendingThinking(
    {
      id: reply.id,
      chatId: reply.chat_id,
      type: 'text',
      role: 'assistant',
      text: reply.text,
      replyTo: reply.reply_to,
      time: formatTime(reply.ts),
      createdAt: reply.ts,
    },
    pendingThinking,
  );
}

function applyPendingThinking<T extends ChatTextMessage | ChatAttachmentMessage>(
  message: T,
  pendingThinking: Map<string, ChatThinking>,
): T {
  const pendingKey =
    (message.replyTo && pendingThinking.has(message.replyTo)
      ? message.replyTo
      : undefined) ??
    (pendingThinking.has(message.id) ? message.id : undefined);

  if (!pendingKey) {
    return message;
  }

  const pending = pendingThinking.get(pendingKey);
  if (!pending) {
    return message;
  }

  pendingThinking.delete(pendingKey);
  return {
    ...message,
    thinking: pending,
  };
}

function upsertChatMessage(
  current: ChatMessage[],
  incoming: ChatTextMessage | ChatAttachmentMessage,
): ChatMessage[] {
  const existingIndex = current.findIndex(message => message.id === incoming.id);
  if (existingIndex === -1) {
    return [...current, incoming];
  }

  return current.map(message =>
    message.id === incoming.id ? incoming : message,
  );
}

function upsertPermissionMessage(
  current: ChatMessage[],
  incoming: ChatPermissionMessage,
): ChatMessage[] {
  const existingIndex = current.findIndex(message => message.id === incoming.id);
  if (existingIndex !== -1) {
    return current.map(message =>
      message.id === incoming.id && message.type === 'permission'
        ? {...message, ...incoming}
        : message,
    );
  }

  const pendingMatchIndex = current.findIndex(
    message =>
      message.type === 'permission' &&
      message.status !== 'resolved' &&
      normalizePermissionKey(message) === normalizePermissionKey(incoming),
  );

  if (pendingMatchIndex === -1) {
    return [...current, incoming];
  }

  return current.map((message, index) =>
    index === pendingMatchIndex && message.type === 'permission'
      ? {
          ...message,
          ...incoming,
          status: 'pending',
        }
      : message,
  );
}

function resolvePermissionMessage(
  current: ChatMessage[],
  messageId: string,
  decision: PermissionOutcome,
  resolvedAt: string,
): {messages: ChatMessage[]; updated?: ChatPermissionMessage} {
  let updated: ChatPermissionMessage | undefined;

  const nextMessages = current.map(message => {
    if (message.id !== messageId || message.type !== 'permission') {
      return message;
    }

    updated = {
      ...message,
      status: 'resolved',
      decision,
      resolvedAt: formatTime(resolvedAt),
    };
    return updated;
  });

  return {messages: nextMessages, updated};
}

function markPermissionSubmitting(
  current: ChatMessage[],
  messageId: string,
): {messages: ChatMessage[]; updated?: ChatPermissionMessage} {
  let updated: ChatPermissionMessage | undefined;

  const nextMessages = current.map(message => {
    if (message.id !== messageId || message.type !== 'permission') {
      return message;
    }

    updated = {
      ...message,
      status: 'submitting',
    };
    return updated;
  });

  return {messages: nextMessages, updated};
}

function attachThinkingToReply(
  current: ChatMessage[],
  replyToMessageId: string,
  thinking: ChatThinking,
): {
  messages: ChatMessage[];
  updated?: ChatTextMessage | ChatAttachmentMessage;
} {
  const targetIndex = findThinkingTargetIndex(current, replyToMessageId);
  if (targetIndex === -1) {
    return {messages: current};
  }

  let updated: ChatTextMessage | ChatAttachmentMessage | undefined;
  const nextMessages = current.map((message, index) => {
    if (
      index !== targetIndex ||
      (message.type !== 'text' && message.type !== 'attachment')
    ) {
      return message;
    }

    updated = {
      ...message,
      thinking,
    };
    return updated;
  });

  return {messages: nextMessages, updated};
}

function findThinkingTargetIndex(
  messages: ChatMessage[],
  replyToMessageId: string,
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'text' && message.type !== 'attachment') {
      continue;
    }

    if (message.role !== 'assistant') {
      continue;
    }

    if (message.replyTo === replyToMessageId || message.id === replyToMessageId) {
      return index;
    }
  }

  return -1;
}

function normalizePermissionKey(
  message: Pick<ChatPermissionMessage, 'toolName' | 'summary' | 'detail'>,
): string {
  const stableDetail =
    message.detail
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) ?? '';

  return [message.toolName, message.summary ?? '', stableDetail]
    .join('\n')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function permissionResolutionLabel(decision: PermissionOutcome): string {
  if (decision === 'deny') {
    return '审批已拒绝';
  }

  if (decision === 'external') {
    return '审批已在终端处理';
  }

  return '审批已允许';
}

function statusMessage(state: TinCanStatus, message?: string): string {
  if (!message) {
    return statusLabel(state);
  }

  switch (message) {
    case 'tmux session is offline':
      return 'tmux 会话离线';
    case 'Waiting for permission approval':
      return '等待审批';
    case 'Message delivered to CC':
      return '等待 Ciel 回复';
    case 'CC is ready':
      return 'CC 已就绪';
    case 'MCP bridge disconnected':
      return 'Hub Bridge 已断开';
    default:
      return message;
  }
}

function statusLabel(state: TinCanStatus): string {
  switch (state) {
    case 'idle':
      return 'Hub 空闲';
    case 'thinking':
      return 'Ciel 思考中';
    case 'busy':
      return '等待处理';
    case 'offline':
      return 'Hub 离线';
    case 'error':
      return '连接异常';
  }
}

function statusDotStyle(state: TinCanStatus): {backgroundColor: string} {
  if (state === 'idle') {
    return {backgroundColor: colors.blueMain};
  }

  if (state === 'thinking' || state === 'busy') {
    return {backgroundColor: colors.terracotta};
  }

  return {backgroundColor: colors.inkSoft};
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  statusBar: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.headerBg,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.terracotta,
  },
  statusText: {
    flex: 1,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 13,
    lineHeight: 19,
  },
  volumeText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 18,
  },
  messages: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  dateDivider: {
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  dateText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 18,
  },
});
