import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {InputBar} from '../components/InputBar';
import {MessageBubble, type ChatMessage} from '../components/MessageBubble';
import {
  AttachmentCard,
  MemoryCard,
  SketchCard,
  ThinkingIndicator,
  ToolCallCard,
} from '../components/ShowcaseCards';
import {TopBar} from '../components/TopBar';
import {tinCanConfig} from '../services/tincanConfig';
import {TinCanSocket, type HubEvent, type TinCanStatus} from '../services/websocket';
import {colors, typography} from '../theme/colors';

type ChatScreenProps = {
  onBack: () => void;
};

const initialMessages: ChatMessage[] = [
  {
    id: 'a_1',
    role: 'assistant',
    text: '早上好，凛。我已整理 Tin-Can 一期的通信链路，Hub 会负责队列和状态判断。',
    time: '10:28',
  },
  {
    id: 'u_1',
    role: 'user',
    text: '先把 Android 壳和正文气泡跑通，其它卡片展示即可。',
    time: '10:29',
  },
];

export function ChatScreen({onBack}: ChatScreenProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [connectionLabel, setConnectionLabel] = useState(
    tinCanConfig.enabled ? '连接中：Tin-Can Hub' : '展示模式：未连接 Hub',
  );
  const [remoteStatus, setRemoteStatus] = useState<TinCanStatus>('offline');
  const socketRef = useRef<TinCanSocket | null>(null);

  const statusText = useMemo(() => {
    if (!tinCanConfig.enabled) return connectionLabel;
    return `正在对话：Ciel · ${connectionLabel}`;
  }, [connectionLabel]);

  useEffect(() => {
    if (!tinCanConfig.enabled) return;

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
      setConnectionLabel(event.message ?? statusLabel(event.state));
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar leftLabel="‹" onLeftPress={onBack} />
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, statusDotStyle(remoteStatus)]} />
        <Text style={styles.statusText}>{statusText}</Text>
        <Text style={styles.volumeText}>第一卷</Text>
      </View>

      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        <View style={styles.dateDivider}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>2026年6月13日</Text>
          <View style={styles.dateLine} />
        </View>

        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <ThinkingIndicator />
        <ToolCallCard />
        <AttachmentCard />
        <SketchCard />
        <MemoryCard />
      </ScrollView>

      <InputBar onSend={handleSend} />
    </SafeAreaView>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
}

function statusLabel(state: TinCanStatus): string {
  switch (state) {
    case 'idle':
      return 'Hub 空闲';
    case 'thinking':
      return 'Ciel 思考中';
    case 'busy':
      return '消息队列中';
    case 'offline':
      return 'Hub 离线';
    case 'error':
      return '连接异常';
  }
}

function statusDotStyle(state: TinCanStatus): {backgroundColor: string} {
  if (state === 'idle') return {backgroundColor: colors.blueMain};
  if (state === 'thinking' || state === 'busy') return {backgroundColor: colors.terracotta};
  return {backgroundColor: colors.inkSoft};
}

const styles = StyleSheet.create({
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
    paddingBottom: 20,
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
