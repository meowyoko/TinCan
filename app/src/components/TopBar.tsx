import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, typography} from '../theme/colors';

type TopBarProps = {
  leftLabel: string;
  onLeftPress?: () => void;
};

export function TopBar({leftLabel, onLeftPress}: TopBarProps): React.JSX.Element {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" onPress={onLeftPress} style={styles.iconButton}>
        <Text style={styles.iconText}>{leftLabel}</Text>
      </Pressable>
      <Text style={styles.title}>每日智能电讯</Text>
      <View style={styles.iconButton}>
        <Text style={styles.iconText}>⌕</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 76,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.pageBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 26,
  },
  title: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
