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
        <Text style={styles.add}>＋</Text>
      </Pressable>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="在此草拟您的质询…"
        placeholderTextColor="rgba(93,81,72,0.65)"
        style={styles.input}
      />
      <Pressable accessibilityRole="button" onPress={submit} style={styles.sendButton}>
        <Text style={styles.send}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(252,246,238,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pageBg,
  },
  add: {
    color: colors.inkSoft,
    fontSize: 21,
    lineHeight: 24,
  },
  input: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: colors.lineSoft,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 16,
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 13,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 30,
    marginTop: -2,
  },
});
