import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, radii} from '../theme/colors';

type IconSketchProps = {
  label: string;
  active?: boolean;
  badge?: string;
};

export function IconSketch({label, active, badge}: IconSketchProps): React.JSX.Element {
  return (
    <View style={[styles.frame, active && styles.activeFrame]}>
      <Text style={[styles.mark, active && styles.activeMark]}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 30,
    height: 30,
    borderWidth: 1.4,
    borderColor: colors.ink,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeFrame: {
    borderColor: colors.terracotta,
  },
  mark: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 16,
  },
  activeMark: {
    color: colors.terracotta,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
});
