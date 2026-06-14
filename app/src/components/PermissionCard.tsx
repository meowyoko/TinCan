import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {
  ChatPermissionMessage,
  PermissionDecision,
} from '../types/chat';
import {colors, radii, typography} from '../theme/colors';

type PermissionCardProps = {
  message: ChatPermissionMessage;
  onDecision?: (id: string, decision: PermissionDecision) => void;
  onLongPress?: () => void;
};

export function PermissionCard({
  message,
  onDecision,
  onLongPress,
}: PermissionCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isResolved = message.status === 'resolved';
  const isSubmitting = message.status === 'submitting';
  const hasDetail = Boolean(message.summary || message.detail);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{expanded}}
      disabled={!hasDetail}
      onLongPress={onLongPress}
      onPress={() => setExpanded(current => !current)}
      style={[
        styles.card,
        expanded && styles.cardExpanded,
        isResolved && styles.cardResolved,
      ]}>
      <View style={styles.headerRow}>
        <View style={styles.requestLabelWrap}>
          <Text style={styles.requestLabel}>请示</Text>
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.toolName}>{message.toolName}</Text>
        </View>

        {isResolved ? (
          <Text style={[styles.resolvedLabel, resolvedTone(message.decision)]}>
            {resolvedGlyph(message)} {message.resolvedAt ?? message.time}
          </Text>
        ) : (
          <View
            style={styles.actions}
            onStartShouldSetResponder={() => true}
            onResponderRelease={event => {
              event.stopPropagation();
            }}>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => onDecision?.(message.id, 'allow')}
              style={[
                styles.actionButton,
                styles.allowButton,
                isSubmitting && styles.actionButtonDisabled,
              ]}>
              <Text style={styles.allowText}>✓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => onDecision?.(message.id, 'deny')}
              style={[
                styles.actionButton,
                styles.denyButton,
                isSubmitting && styles.actionButtonDisabled,
              ]}>
              <Text style={styles.denyText}>✗</Text>
            </Pressable>
          </View>
        )}
      </View>

      {expanded && hasDetail ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={styles.detailPanel}
          contentContainerStyle={styles.detailPanelContent}>
          {message.summary ? (
            <Text style={styles.summaryText}>{message.summary}</Text>
          ) : null}
          {message.detail ? (
            <Text style={styles.detailText}>{message.detail}</Text>
          ) : null}
        </ScrollView>
      ) : null}
    </Pressable>
  );
}

function resolvedGlyph(message: ChatPermissionMessage): string {
  if (message.decision === 'deny') {
    return '✗';
  }

  if (message.decision === 'external') {
    return '·';
  }

  return '✓';
}

function resolvedTone(
  decision: ChatPermissionMessage['decision'],
): {color: string} {
  if (decision === 'deny') {
    return {color: 'rgba(255, 255, 255, 0.44)'};
  }

  if (decision === 'external') {
    return {color: 'rgba(255, 255, 255, 0.4)'};
  }

  return {color: 'rgba(255, 255, 255, 0.52)'};
}

const styles = StyleSheet.create({
  card: {
    width: '60%',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.ink,
    borderRadius: radii.sm,
    gap: 6,
  },
  cardExpanded: {
    width: '82%',
  },
  cardResolved: {
    opacity: 0.45,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestLabelWrap: {
    flexShrink: 0,
  },
  requestLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 14,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
    marginLeft: 2,
  },
  toolName: {
    color: colors.white,
    fontFamily: typography.serifSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  detailPanel: {
    width: '100%',
    maxHeight: 88,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailPanelContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  summaryText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  detailText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Courier',
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.72,
  },
  allowButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  denyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  allowText: {
    color: colors.white,
    fontFamily: typography.serifSemiBold,
    fontSize: 13,
    lineHeight: 13,
  },
  denyText: {
    color: 'rgba(255, 255, 255, 0.56)',
    fontFamily: typography.serifSemiBold,
    fontSize: 12,
    lineHeight: 12,
  },
  resolvedLabel: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 14,
  },
});
