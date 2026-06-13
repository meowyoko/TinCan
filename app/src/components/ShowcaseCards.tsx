import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, radii, typography} from '../theme/colors';

export function ThinkingIndicator(): React.JSX.Element {
  return (
    <View style={styles.thinking}>
      <Text style={styles.thinkingText}>思考中…… 正在整理电讯脉络</Text>
      <Text style={styles.dots}>● ● ●</Text>
    </View>
  );
}

export function ToolCallCard(): React.JSX.Element {
  return (
    <View style={styles.tool}>
      <Text style={styles.toolText}>检索档案：tin-can · channel 通信</Text>
    </View>
  );
}

export function MemoryCard(): React.JSX.Element {
  return (
    <View style={styles.memory}>
      <Text style={styles.memoryTitle}>记忆召回</Text>
      <Text style={styles.memoryBody}>凛提到一期只需要正文气泡真实接入，其它卡片先做展示。</Text>
    </View>
  );
}

export function AttachmentCard(): React.JSX.Element {
  return (
    <View style={styles.attachment}>
      <Text style={styles.attachmentText}>附件：hub-protocol-notes.md</Text>
    </View>
  );
}

export function SketchCard(): React.JSX.Element {
  return (
    <View style={styles.sketch}>
      <View style={styles.sketchImage} />
      <Text style={styles.sketchText}>速写：每日智能电讯</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thinking: {
    marginLeft: 38,
    marginBottom: 12,
    minWidth: '60%',
    maxWidth: '76%',
    borderRadius: radii.md,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: '#c5b29e',
    backgroundColor: colors.thinkingBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingText: {
    flex: 1,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 13,
    lineHeight: 19,
  },
  dots: {
    color: colors.terracotta,
    fontSize: 8,
    letterSpacing: 2,
  },
  tool: {
    alignSelf: 'flex-start',
    marginLeft: 38,
    marginBottom: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  toolText: {
    color: colors.white,
    fontFamily: typography.serif,
    fontSize: 13,
    lineHeight: 18,
  },
  memory: {
    marginLeft: 38,
    marginBottom: 12,
    maxWidth: '72%',
    borderRadius: radii.sm,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: '#c68669',
    backgroundColor: colors.memoryBg,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  memoryTitle: {
    color: colors.terracotta,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  memoryBody: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 19,
  },
  attachment: {
    alignSelf: 'flex-start',
    marginLeft: 38,
    marginBottom: 12,
    borderRadius: radii.sm,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: colors.thinkingBg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    transform: [{rotate: '-2deg'}],
  },
  attachmentText: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 17,
  },
  sketch: {
    marginLeft: 38,
    marginBottom: 16,
    width: '55%',
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: colors.thinkingBg,
    overflow: 'hidden',
    transform: [{rotate: '-2deg'}],
  },
  sketchImage: {
    height: 86,
    backgroundColor: '#D8D3C8',
  },
  sketchText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 7,
  },
});
