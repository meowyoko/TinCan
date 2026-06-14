import React, {useMemo, useState} from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {MarkdownText} from './MarkdownText';
import {tinCanConfig} from '../services/tincanConfig';
import {colors, radii, typography} from '../theme/colors';
import type {ChatAttachmentMessage} from '../types/chat';

type AttachmentMessageCardProps = {
  message: ChatAttachmentMessage;
  showSender: boolean;
  onLongPress?: () => void;
};

const IMAGE_BG = colors.thinkingBg;
const IMAGE_BLEED = 2;

export function AttachmentMessageCard({
  message,
  showSender,
  onLongPress,
}: AttachmentMessageCardProps): React.JSX.Element {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const isUser = message.role === 'user';
  const senderName = isUser ? '凛' : 'Ciel';
  const previewUri = useMemo(
    () =>
      resolvePreviewUri(
        message.role,
        message.attachment.uri,
        message.attachment.localPath,
        message.attachment.fileName,
      ),
    [
      message.attachment.fileName,
      message.attachment.localPath,
      message.attachment.uri,
      message.role,
    ],
  );
  const canShowThinking = !isUser && Boolean(message.thinking?.text);
  const showCaptionBubble =
    message.attachment.attachmentType === 'image' && Boolean(message.caption);

  function handleAttachmentPress(): void {
    if (message.attachment.attachmentType === 'image') {
      if (previewUri) {
        setImageOpen(true);
      }
      return;
    }

    if (previewUri) {
      Linking.openURL(previewUri).catch(() => undefined);
    }
  }

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

      <Pressable onLongPress={onLongPress} onPress={handleAttachmentPress}>
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
            <View
              renderToHardwareTextureAndroid
              shouldRasterizeIOS
              style={styles.imageClipper}>
              {previewUri ? (
                <Image
                  source={{uri: previewUri}}
                  resizeMode="cover"
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>图片预览</Text>
                </View>
              )}
            </View>
            <View pointerEvents="none" style={styles.imageBorderOverlay} />
          </View>
        ) : (
          <View style={styles.fileCard}>
            <View style={styles.fileIcon}>
              <Text style={styles.fileIconText}>#</Text>
            </View>
            <View style={styles.fileMeta}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.fileLabel}>
                {message.attachment.fileName}
              </Text>
              {message.caption ? (
                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={styles.fileCaption}>
                  {message.caption}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>

      {showCaptionBubble && message.caption ? (
        <Pressable onLongPress={onLongPress}>
          <View
            style={[
              styles.captionBubble,
              isUser ? styles.userCaptionBubble : styles.aiCaptionBubble,
            ]}>
            <MarkdownText
              content={message.caption}
              tone="light"
              compact
              tailPlaceholderChars={8}
            />
            <Text style={styles.captionTime}>{message.time}</Text>
          </View>
        </Pressable>
      ) : null}

      {message.attachment.attachmentType === 'image' && previewUri ? (
        <Modal
          animationType="fade"
          transparent
          visible={imageOpen}
          onRequestClose={() => setImageOpen(false)}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setImageOpen(false)}>
            <Image
              source={{uri: previewUri}}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const WAVE_SIZES = [4, 8, 12, 6, 14, 10, 5, 9, 13, 7, 11, 5];

function resolvePreviewUri(
  role: ChatAttachmentMessage['role'],
  uri: string | undefined,
  localPath: string | undefined,
  fileName: string,
): string | undefined {
  if (uri) {
    return normalizeAttachmentUri(uri);
  }

  if (!localPath) {
    return undefined;
  }

  if (role === 'assistant') {
    return buildHubAttachmentUrl(localPath, fileName);
  }

  if (/^[a-z]+:\/\//i.test(localPath)) {
    return localPath;
  }

  return `file://${localPath}`;
}

function normalizeAttachmentUri(uri: string): string {
  if (
    /^https?:\/\//i.test(uri) ||
    /^file:\/\//i.test(uri) ||
    /^content:\/\//i.test(uri)
  ) {
    return uri;
  }

  if (uri.startsWith('/')) {
    return withHubPin(`${hubHttpOrigin()}${uri}`);
  }

  return uri;
}

function buildHubAttachmentUrl(filePath: string, fileName: string): string {
  const encodedPath = encodeURIComponent(filePath);
  return withHubPin(
    `${hubHttpOrigin()}/attachments/by-path/${encodedPath}/${encodeURIComponent(
      fileName,
    )}`,
  );
}

function hubHttpOrigin(): string {
  return tinCanConfig.hubUrl.replace(/^ws/i, 'http').replace(/\/$/, '');
}

function withHubPin(url: string): string {
  if (!tinCanConfig.pin) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}pin=${encodeURIComponent(tinCanConfig.pin)}`;
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
    width: 214,
    height: 134,
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
    transform: [{rotate: '-2deg'}],
  },
  imageClipper: {
    width: '100%',
    height: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: IMAGE_BG,
  },
  imagePreview: {
    position: 'absolute',
    left: -IMAGE_BLEED,
    top: -IMAGE_BLEED,
    right: -IMAGE_BLEED,
    bottom: -IMAGE_BLEED,
    backgroundColor: '#d8d3c8',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
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
  imageBorderOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: colors.ink,
  },
  fileCard: {
    width: 214,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: colors.thinkingBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    transform: [{rotate: '-2deg'}],
  },
  fileIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 35, 32, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    color: colors.inkSoft,
    fontFamily: typography.serifSemiBold,
    fontSize: 11,
    lineHeight: 12,
  },
  fileMeta: {
    flex: 1,
    minWidth: 0,
  },
  fileLabel: {
    color: colors.ink,
    fontFamily: typography.serifMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  fileCaption: {
    marginTop: 3,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 16,
  },
  captionBubble: {
    position: 'relative',
    maxWidth: '86%',
    minWidth: '38%',
    marginTop: 6,
    borderRadius: radii.md,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 5,
    paddingBottom: 6,
  },
  aiCaptionBubble: {
    backgroundColor: colors.blueMain,
    borderTopLeftRadius: 3,
  },
  userCaptionBubble: {
    backgroundColor: colors.terracotta,
    borderTopRightRadius: 3,
  },
  captionTime: {
    position: 'absolute',
    right: 8,
    bottom: 5,
    color: 'rgba(255, 250, 242, 0.74)',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: typography.serif,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 18, 16, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fullscreenImage: {
    width: '100%',
    height: '82%',
  },
});
