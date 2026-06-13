import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {InputBar} from '../components/InputBar';
import {MessageBubble} from '../components/MessageBubble';
import {PermissionCard} from '../components/PermissionCard';
import {TopBar} from '../components/TopBar';
import {tinCanConfig} from '../services/tincanConfig';
import {
  TinCanSocket,
  type HubEvent,
  type TinCanStatus,
} from '../services/websocket';
import {colors, typography} from '../theme/colors';
import type {
  ChatMessage,
  ChatPermissionMessage,
  PermissionDecision,
  PermissionOutcome,
} from '../types/chat';

type ChatScreenProps = {
  onBack: () => void;
};

export function ChatScreen({onBack}: ChatScreenProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages());
  const [connectionLabel, setConnectionLabel] = useState(
    tinCanConfig.enabled ? '连接中：Tin-Can Hub' : '展示模式：未连接 Hub',
  );
  const [remoteStatus, setRemoteStatus] = useState<TinCanStatus>('offline');
  const socketRef = useRef<TinCanSocket | null>(null);

  const statusText = useMemo(() => {
    if (!tinCanConfig.enabled) {
      return connectionLabel;
    }
    return `正在对话：Ciel · ${connectionLabel}`;
  }, [connectionLabel]);

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
  }, []);

  function handleHubEvent(event: HubEvent): void {
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
      setMessages(current =>
        upsertPermissionMessage(current, {
          id: event.id,
          type: 'permission',
          toolName: event.tool,
          summary: event.summary,
          detail: event.detail,
          time: formatTime(event.ts),
          status: 'pending',
        }),
      );
      return;
    }

    if (event.type === 'permission_resolved') {
      setConnectionLabel(permissionResolutionLabel(event.decision));
      setRemoteStatus('idle');
      setMessages(current =>
        resolvePermissionMessage(
          current,
          event.id,
          event.decision,
          formatTime(event.resolved_at),
        ),
      );
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
      setMessages(current => [
        ...current,
        {
          id: event.id,
          type: 'text',
          role: 'assistant',
          text: event.text,
          time: formatTime(event.ts),
        },
      ]);
    }
  }

  function handleSend(text: string): void {
    const now = new Date();
    const remoteId = socketRef.current?.send(text);

    setMessages(current => [
      ...current,
      {
        id: remoteId ?? `local_${now.getTime()}`,
        type: 'text',
        role: 'user',
        text,
        time: formatTime(now.toISOString()),
      },
    ]);

    if (tinCanConfig.enabled) {
      setConnectionLabel(remoteId ? '正在投递到 Hub' : 'Hub 未连接，本地已记录');
      setRemoteStatus(remoteId ? 'busy' : 'offline');
    }
  }

  function handlePermissionDecision(
    messageId: string,
    decision: PermissionDecision,
  ): void {
    if (tinCanConfig.enabled) {
      const sent = socketRef.current?.resolvePermission(messageId, decision) ?? false;
      if (sent) {
        setMessages(current => markPermissionSubmitting(current, messageId));
        setConnectionLabel(decision === 'deny' ? '已提交拒绝' : '已提交允许');
        setRemoteStatus('busy');
      } else {
        setConnectionLabel('Hub 未连接，请示未送达');
        setRemoteStatus('error');
      }
      return;
    }

    setMessages(current =>
      resolvePermissionMessage(
        current,
        messageId,
        decision,
        formatTime(new Date().toISOString()),
      ),
    );
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

          {messages.map((message, index) =>
            message.type === 'text' ? (
              <MessageBubble
                key={message.id}
                message={message}
                showSender={shouldShowSender(messages, index)}
              />
            ) : (
              <PermissionCard
                key={message.id}
                message={message}
                onDecision={handlePermissionDecision}
              />
            ),
          )}
        </ScrollView>

        <InputBar onSend={handleSend} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createInitialMessages(): ChatMessage[] {
  const baseMessages: ChatMessage[] = [
    {
      id: 'a_1',
      type: 'text',
      role: 'assistant',
      text: '早上好，凛。我先把二期拆成两步：先走 **请示卡片**，再把正文接入 `Markdown` 渲染。',
      time: '10:28',
    },
    {
      id: 'u_1',
      type: 'text',
      role: 'user',
      text: '好的，先把卡片审批链路跑顺，再慢慢收拾其它细节。',
      time: '10:29',
    },
  ];

  if (tinCanConfig.enabled) {
    return baseMessages;
  }

  return [
    ...baseMessages,
    {
      id: 'perm_seed',
      type: 'permission',
      toolName: 'Bash',
      summary: '需要执行构建命令，请帮我决定是否继续。',
      detail: 'npm run build --production --verbose',
      time: '10:31',
      status: 'pending',
    },
  ];
}

function shouldShowSender(messages: ChatMessage[], index: number): boolean {
  const current = messages[index];
  if (!current || current.type !== 'text') {
    return false;
  }

  const previous = messages[index - 1];
  return previous?.type !== 'text' || previous.role !== current.role;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
): ChatMessage[] {
  return current.map(message => {
    if (message.id !== messageId || message.type !== 'permission') {
      return message;
    }

    return {
      ...message,
      status: 'resolved',
      decision,
      resolvedAt,
    };
  });
}

function markPermissionSubmitting(
  current: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  return current.map(message => {
    if (message.id !== messageId || message.type !== 'permission') {
      return message;
    }

    return {
      ...message,
      status: 'submitting',
    };
  });
}

function normalizePermissionKey(
  message: Pick<ChatPermissionMessage, 'toolName' | 'summary' | 'detail'>,
): string {
  return [message.toolName, message.summary ?? '', message.detail]
    .join('\n')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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
