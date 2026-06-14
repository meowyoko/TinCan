import React, {useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors, radii, typography} from '../theme/colors';
import type {ChatAttachmentMessage} from '../types/chat';

type AttachmentMessageCardProps = {
  message: ChatAttachmentMessage;
  showSender: boolean;
  onLongPress?: () => void;
};

export function AttachmentMessageCard({
  message,
  showSender,
  onLongPress,
}: AttachmentMessageCardProps): React.JSX.Element {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isUser = message.role === 'user';
  const senderName = isUser ? '凛' : 'Ciel';
  const previewUri = useMemo(
    () => resolvePreviewUri(message.attachment.uri, message.attachment.localPath),
    [message.attachment.localPath, message.attachment.uri],
  );
  const canShowThinking = !isUser && Boolean(message.thinking?.text);

  return (
    <View style={[styles.wrap, isUser && styles.userWrap]}>
      {showSender ? (
        <View style={[styles.senderLine, isUser && styles.userSenderLine]}>
          <Text style={[styles.sender, isUser && styles.userSender]}>
            {senderName}
          </Text>
          {canShowThinking ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setThinkingOpen(current => !current)}>
              <Text style={styles.thinkingTag}>在想…</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {thinkingOpen && message.thinking ? (
        <View style={styles.thinkingBlock}>
          <Text style={styles.thinkingText}>{message.thinking.text}</Text>
        </View>
      ) : null}

      <Pressable onLongPress={onLongPress}>
        {message.attachment.attachmentType === 'voice' ? (
          <View
            style={[
              styles.voiceCard,
              isUser ? styles.voiceCardUser : styles.voiceCardAi,
            ]}>
            <View style={styles.playPill}>
              <Text style={styles.playText}>▶</Text>
            </View>
            <View style={styles.voiceMeta}>
              <Text style={styles.voiceLabel}>语音记录</Text>
              <View style={styles.waveRow}>
                {WAVE_SIZES.map((height, index) => (
                  <View key={index} style={[styles.waveBar, {height}]} />
                ))}
              </View>
            </View>
            <Text style={styles.voiceTime}>
              {formatDuration(message.attachment.durationMs)}
            </Text>
          </View>
        ) : message.attachment.attachmentType === 'image' ? (
          <View style={styles.imageCard}>
            {previewUri ? (
              <Image source={{uri: previewUri}} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>图像预览</Text>
              </View>
            )}
            <Text style={styles.imageLabel}>
              {message.caption ?? message.attachment.fileName}
            </Text>
          </View>
        ) : (
          <View style={styles.fileCard}>
            <Text style={styles.fileLabel}>
              附件：{message.attachment.fileName}
            </Text>
            {message.caption ? (
              <Text style={styles.fileCaption}>{message.caption}</Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const WAVE_SIZES = [4, 8, 12, 6, 14, 10, 5, 9, 13, 7, 11, 5];

function resolvePreviewUri(
  uri: string | undefined,
  localPath: string | undefined,
): string | undefined {
  if (uri) {
    return uri;
  }

  if (!localPath) {
    return undefined;
  }

  if (/^[a-z]+:\/\//i.test(localPath)) {
    return localPath;
  }

  return `file://${localPath}`;
}

function formatDuration(durationMs: number | undefined): string {
  if (!durationMs || durationMs <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  senderLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  userSenderLine: {
    justifyContent: 'flex-end',
  },
  sender: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  userSender: {
    textAlign: 'right',
  },
  thinkingTag: {
    color: '#c5b29e',
    fontFamily: typography.serif,
    fontSize: 10,
    lineHeight: 14,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  thinkingBlock: {
    marginBottom: 6,
    marginLeft: 2,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: '#c5b29e',
    maxWidth: '84%',
  },
  thinkingText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '82%',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceCardAi: {
    backgroundColor: colors.blueMain,
  },
  voiceCardUser: {
    backgroundColor: colors.terracotta,
  },
  playPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 250, 242, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 12,
    marginLeft: 2,
  },
  voiceMeta: {
    flex: 1,
    gap: 4,
  },
  voiceLabel: {
    color: colors.white,
    fontFamily: typography.serifSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
  },
  waveBar: {
    width: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 250, 242, 0.62)',
  },
  voiceTime: {
    color: 'rgba(255, 250, 242, 0.78)',
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  imageCard: {
    width: 210,
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: colors.thinkingBg,
    overflow: 'hidden',
    transform: [{rotate: '-2deg'}],
  },
  imagePreview: {
    width: '100%',
    height: 112,
    backgroundColor: '#d8d3c8',
  },
  imagePlaceholder: {
    width: '100%',
    height: 112,
    backgroundColor: '#d8d3c8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 16,
  },
  imageLabel: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
  },
  fileCard: {
    maxWidth: '82%',
    borderRadius: radii.sm,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: colors.thinkingBg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    transform: [{rotate: '-2deg'}],
  },
  fileLabel: {
    color: colors.ink,
    fontFamily: typography.serifMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  fileCaption: {
    marginTop: 4,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 16,
  },
});
