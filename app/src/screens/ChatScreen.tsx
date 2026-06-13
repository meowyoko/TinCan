import React, {useMemo, useState} from 'react';
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
  const statusText = useMemo(() => '正在对话：Ciel', []);

  function handleSend(text: string): void {
    const now = new Date();
    setMessages(current => [
      ...current,
      {
        id: `local_${now.getTime()}`,
        role: 'user',
        text,
        time: now.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar leftLabel="‹" onLeftPress={onBack} />
      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
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
