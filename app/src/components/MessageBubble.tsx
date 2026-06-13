import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MarkdownText} from './MarkdownText';
import {colors, radii, typography} from '../theme/colors';
import type {ChatTextMessage} from '../types/chat';

type MessageBubbleProps = {
  message: ChatTextMessage;
  showSender: boolean;
};

export function MessageBubble({
  message,
  showSender,
}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user';
  const senderName = isUser ? '凛' : 'Ciel';

  return (
    <View style={[styles.wrap, isUser && styles.userWrap]}>
      {showSender ? (
        <Text style={[styles.sender, isUser && styles.userSender]}>
          {senderName}
        </Text>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <MarkdownText
          content={message.text}
          tone="light"
          compact
          tailPlaceholderChars={8}
        />
        <Text style={styles.time}>{message.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  sender: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  userSender: {
    textAlign: 'right',
  },
  bubble: {
    position: 'relative',
    maxWidth: '86%',
    minWidth: '38%',
    borderRadius: radii.md,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 5,
    paddingBottom: 6,
  },
  aiBubble: {
    backgroundColor: colors.blueMain,
    borderTopLeftRadius: 3,
  },
  userBubble: {
    backgroundColor: colors.terracotta,
    borderTopRightRadius: 3,
  },
  time: {
    position: 'absolute',
    right: 8,
    bottom: 5,
    color: 'rgba(255, 250, 242, 0.74)',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: typography.serif,
  },
});
