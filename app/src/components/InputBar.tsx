import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors, typography} from '../theme/colors';

type InputBarProps = {
  onSend: (text: string) => void;
};

export function InputBar({onSend}: InputBarProps): React.JSX.Element {
  const [value, setValue] = useState('');

  function submit(): void {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  }

  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" style={styles.roundButton}>
        <Text style={styles.add}>+</Text>
      </Pressable>
      <TextInput
        multiline
        scrollEnabled={false}
        value={value}
        onChangeText={setValue}
        placeholder="在此输入消息"
        placeholderTextColor="rgba(93, 81, 72, 0.58)"
        style={styles.input}
        textAlignVertical="center"
      />
      <Pressable
        accessibilityRole="button"
        onPress={submit}
        style={styles.sendButton}>
        <Text style={styles.send}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.1,
    borderColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pageBg,
    shadowColor: 'rgba(37, 49, 67, 0.12)',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 1,
  },
  add: {
    color: colors.inkSoft,
    fontSize: 22,
    lineHeight: 24,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 22,
    borderWidth: 1.1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    shadowColor: 'rgba(37, 49, 67, 0.12)',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 1,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(158, 79, 54, 0.2)',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 1,
  },
  send: {
    color: colors.white,
    fontSize: 30,
    lineHeight: 30,
    marginTop: -1,
  },
});
