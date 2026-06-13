import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, typography} from '../theme/colors';
import {IconSketch} from './IconSketch';

type BottomNavProps = {
  active: 'home' | 'chat';
  onOpenHome?: () => void;
  onOpenChat: () => void;
};

const items = [
  {key: 'home', label: '首页', mark: '⌂'},
  {key: 'chat', label: '聊天', mark: '☷'},
  {key: 'diary', label: '日记', mark: '□'},
  {key: 'archive', label: '档案', mark: '▤'},
  {key: 'me', label: '我的', mark: '○'},
] as const;

export function BottomNav({active, onOpenHome, onOpenChat}: BottomNavProps): React.JSX.Element {
  return (
    <View style={styles.nav}>
      {items.map(item => {
        const isActive = item.key === active;
        const onPress = item.key === 'chat' ? onOpenChat : item.key === 'home' ? onOpenHome : undefined;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            disabled={!onPress}
            onPress={onPress}
            style={styles.item}>
            <IconSketch label={item.mark} active={isActive} />
            <Text style={[styles.label, isActive && styles.activeLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 74,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.pageBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    width: 62,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 16,
  },
  activeLabel: {
    color: colors.terracotta,
  },
});
