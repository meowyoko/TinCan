import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {
  ChatPermissionMessage,
  PermissionDecision,
} from '../types/chat';
import {colors, typography} from '../theme/colors';

type PermissionCardProps = {
  messages: ChatPermissionMessage[];
  onDecision?: (id: string, decision: PermissionDecision) => void;
  onLongPress?: () => void;
};

export function PermissionCard({
  messages,
  onDecision,
  onLongPress,
}: PermissionCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>(
    {},
  );
  const primary = messages[0];

  const isPendingCard =
    messages.length === 1 && primary && primary.status !== 'resolved';

  const summaryLabel = useMemo(
    () => messages.map(message => message.toolName).join(' · '),
    [messages],
  );

  if (!primary) {
    return <View />;
  }

  if (isPendingCard) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{expanded}}
        onLongPress={onLongPress}
        onPress={() => setExpanded(current => !current)}
        style={styles.pendingWrap}>
        <View style={styles.pendingLine}>
          <View style={styles.leadDash} />
          <Text numberOfLines={1} style={styles.toolName}>
            {primary.toolName}
          </Text>
          <View
            style={styles.actions}
            onStartShouldSetResponder={() => true}
            onResponderRelease={event => event.stopPropagation()}>
            <Pressable
              accessibilityRole="button"
              disabled={primary.status === 'submitting'}
              onPress={() => onDecision?.(primary.id, 'allow')}
              style={styles.actionButton}>
              <Text style={styles.allowText}>✓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={primary.status === 'submitting'}
              onPress={() => onDecision?.(primary.id, 'deny')}
              style={styles.actionButton}>
              <Text style={styles.denyText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {expanded ? (
          <View style={styles.pendingDetailWrap}>
            {primary.summary ? (
              <Text style={styles.pendingSummary}>{primary.summary}</Text>
            ) : null}
            <Text style={styles.pendingDetail}>{primary.detail}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{expanded}}
      onLongPress={onLongPress}
      onPress={() => setExpanded(current => !current)}
      style={styles.groupWrap}>
      <View style={styles.groupSummary}>
        <View style={styles.leadDash} />
        <Text style={styles.groupStatus}>{resolvedGlyph(messages)}</Text>
        <Text numberOfLines={1} style={styles.groupNames}>
          {summaryLabel}
        </Text>
      </View>

      {expanded ? (
        <View style={styles.groupItems}>
          {messages.map((message, index) => {
            const itemExpanded = Boolean(expandedItemIds[message.id]);
            return (
              <Pressable
                key={message.id}
                accessibilityRole="button"
                accessibilityState={{expanded: itemExpanded}}
                onPress={() =>
                  setExpandedItemIds(current => ({
                    ...current,
                    [message.id]: !current[message.id],
                  }))
                }
                style={[
                  styles.groupItem,
                  index === messages.length - 1 && styles.groupItemLast,
                ]}>
                <View style={styles.groupItemBranch} />
                <View style={styles.groupItemHeader}>
                  <Text style={styles.groupItemName}>{message.toolName}</Text>
                  <Text style={styles.groupItemStatus}>
                    {resolvedGlyph([message])} {message.resolvedAt ?? message.time}
                  </Text>
                </View>

                {itemExpanded ? (
                  <View style={styles.groupItemDetailWrap}>
                    {message.summary ? (
                      <Text style={styles.groupItemSummary}>{message.summary}</Text>
                    ) : null}
                    <Text style={styles.groupItemDetail}>{message.detail}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}

function resolvedGlyph(messages: ChatPermissionMessage[]): string {
  if (messages.some(message => message.decision === 'deny')) {
    return '✕';
  }

  if (messages.some(message => message.decision === 'external')) {
    return '·';
  }

  return '✓';
}

const styles = StyleSheet.create({
  pendingWrap: {
    width: '60%',
    marginBottom: 8,
    marginLeft: 2,
  },
  pendingLine: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadDash: {
    width: 12,
    height: 1,
    backgroundColor: colors.inkSoft,
    opacity: 0.72,
  },
  toolName: {
    width: 48,
    marginLeft: 6,
    color: colors.ink,
    fontFamily: typography.serifSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowText: {
    color: colors.blueMain,
    fontFamily: typography.serifSemiBold,
    fontSize: 12,
    lineHeight: 12,
  },
  denyText: {
    color: colors.terracotta,
    fontFamily: typography.serifSemiBold,
    fontSize: 12,
    lineHeight: 12,
  },
  pendingDetailWrap: {
    marginLeft: 12,
    paddingLeft: 10,
    paddingTop: 4,
    paddingBottom: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.inkSoft,
  },
  pendingSummary: {
    marginBottom: 4,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  pendingDetail: {
    color: colors.inkSoft,
    fontFamily: 'Courier',
    fontSize: 11,
    lineHeight: 15,
  },
  groupWrap: {
    width: '60%',
    marginBottom: 6,
    marginLeft: 2,
  },
  groupSummary: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStatus: {
    marginLeft: 5,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  groupNames: {
    flex: 1,
    marginLeft: 5,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  groupItems: {
    marginLeft: 6,
    paddingBottom: 2,
  },
  groupItem: {
    marginLeft: 8,
    paddingLeft: 16,
    paddingTop: 3,
    paddingBottom: 3,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(93, 81, 72, 0.3)',
  },
  groupItemLast: {
    borderLeftColor: 'transparent',
  },
  groupItemBranch: {
    position: 'absolute',
    left: -1,
    top: 0,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(93, 81, 72, 0.3)',
    borderBottomLeftRadius: 4,
  },
  groupItemHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  groupItemName: {
    width: 36,
    color: colors.ink,
    fontFamily: typography.serifSemiBold,
    fontSize: 11,
    lineHeight: 15,
  },
  groupItemStatus: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 10,
    lineHeight: 14,
  },
  groupItemDetailWrap: {
    marginTop: 3,
    marginLeft: 4,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: colors.inkSoft,
  },
  groupItemSummary: {
    marginBottom: 3,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 10,
    lineHeight: 14,
  },
  groupItemDetail: {
    color: colors.inkSoft,
    fontFamily: 'Courier',
    fontSize: 10,
    lineHeight: 14,
    opacity: 0.76,
  },
});
