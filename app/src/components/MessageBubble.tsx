import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, radii, typography} from '../theme/colors';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({message}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser && styles.userRow]}>
      <View style={[styles.avatar, isUser ? styles.userAvatar : styles.aiAvatar]}>
        <Text style={[styles.avatarText, isUser ? styles.userAvatarText : styles.aiAvatarText]}>
          {isUser ? '凛' : 'C'}
        </Text>
      </View>
      <View style={[styles.content, isUser && styles.userContent]}>
        <Text style={[styles.sender, isUser && styles.userSender]}>{isUser ? '凛' : 'Ciel'}</Text>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={styles.body}>{message.text}</Text>
          <Text style={styles.time}>{message.time}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  userRow: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 30,
    height: 30,
    marginTop: 20,
    borderRadius: radii.sm,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatar: {
    borderColor: colors.blueMain,
  },
  userAvatar: {
    borderColor: colors.inkSoft,
  },
  avatarText: {
    fontFamily: typography.serif,
    fontSize: 12,
    fontWeight: '600',
  },
  aiAvatarText: {
    color: colors.blueMain,
  },
  userAvatarText: {
    color: colors.inkSoft,
  },
  content: {
    maxWidth: '75%',
    minWidth: '60%',
  },
  userContent: {
    alignItems: 'flex-end',
  },
  sender: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  userSender: {
    textAlign: 'right',
  },
  bubble: {
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiBubble: {
    backgroundColor: colors.blueMain,
    borderTopLeftRadius: 3,
  },
  userBubble: {
    backgroundColor: colors.terracotta,
    borderTopRightRadius: 3,
  },
  body: {
    color: colors.white,
    fontFamily: typography.serif,
    fontSize: 14,
    lineHeight: 23,
  },
  time: {
    color: 'rgba(255,250,242,0.7)',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
    marginTop: 4,
  },
});
