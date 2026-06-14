import React, {useState} from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {PickedAttachment} from '../services/attachments';
import type {AttachmentPickerKind} from '../services/nativeAttachmentPicker';
import {colors, radii, typography} from '../theme/colors';

export type ComposerSubmitPayload = {
  text: string;
  attachment: PickedAttachment | null;
};

type InputBarProps = {
  onPickAttachment: (
    kind: AttachmentPickerKind,
  ) => Promise<PickedAttachment | null>;
  onSubmit: (payload: ComposerSubmitPayload) => void;
};

export function InputBar({
  onPickAttachment,
  onSubmit,
}: InputBarProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] =
    useState<PickedAttachment | null>(null);
  const [picking, setPicking] = useState(false);

  async function handlePick(kind: AttachmentPickerKind): Promise<void> {
    setMenuOpen(false);
    setPicking(true);

    try {
      const selected = await onPickAttachment(kind);
      if (selected) {
        setPendingAttachment(selected);
      }
    } finally {
      setPicking(false);
    }
  }

  function handleSubmit(): void {
    const text = value.trim();
    if (!text && !pendingAttachment) {
      return;
    }

    onSubmit({
      text,
      attachment: pendingAttachment,
    });
    setValue('');
    setPendingAttachment(null);
    setMenuOpen(false);
  }

  const showImagePreview =
    pendingAttachment?.attachment.attachmentType === 'image' &&
    Boolean(pendingAttachment.previewUri);

  return (
    <View style={styles.bar}>
      <View style={styles.inputWrap}>
        {pendingAttachment ? (
          <View style={styles.previewWrap}>
            {showImagePreview ? (
              <Image
                source={{uri: pendingAttachment.previewUri}}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.previewFile}>
                <Text style={styles.previewFileIcon}>[]</Text>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.previewFileName}>
                  {pendingAttachment.attachment.fileName}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setPendingAttachment(null)}
              style={styles.previewClose}>
              <Text style={styles.previewCloseText}>x</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <View style={styles.attachWrap}>
            <Pressable
              accessibilityRole="button"
              disabled={picking}
              onPress={() => setMenuOpen(current => !current)}
              style={styles.attachButton}>
              <View style={styles.paperclipOuter}>
                <View style={styles.paperclipInner} />
              </View>
            </Pressable>

            {menuOpen ? (
              <View style={styles.menu}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    handlePick('image').catch(() => undefined);
                  }}
                  style={styles.menuItem}>
                  <Text style={styles.menuIcon}>[]</Text>
                  <Text style={styles.menuLabel}>图片</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    handlePick('file').catch(() => undefined);
                  }}
                  style={styles.menuItem}>
                  <Text style={styles.menuIcon}>#</Text>
                  <Text style={styles.menuLabel}>文件</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

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
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleSubmit}
        style={styles.sendButton}>
        <Text style={styles.send}>↗</Text>
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
  inputWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.inkSoft,
    borderRadius: 20,
    backgroundColor: colors.pageBg,
  },
  previewWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    position: 'relative',
  },
  previewImage: {
    width: 62,
    height: 62,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: '#d8d3c8',
  },
  previewFile: {
    maxWidth: 188,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(42, 35, 32, 0.04)',
  },
  previewFileIcon: {
    color: colors.inkSoft,
    fontFamily: typography.serifSemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  previewFileName: {
    flex: 1,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 15,
  },
  previewClose: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42, 35, 32, 0.08)',
  },
  previewCloseText: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 11,
  },
  inputRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  attachWrap: {
    position: 'relative',
  },
  attachButton: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperclipOuter: {
    width: 12,
    height: 18,
    borderWidth: 1.4,
    borderColor: colors.inkSoft,
    borderRadius: 7,
    transform: [{rotate: '35deg'}],
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperclipInner: {
    width: 5,
    height: 11,
    borderWidth: 1.2,
    borderColor: colors.inkSoft,
    borderRadius: 5,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    left: 0,
    bottom: 46,
    minWidth: 128,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#c5b29e',
    borderRadius: 8,
    backgroundColor: colors.thinkingBg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menuIcon: {
    width: 16,
    color: colors.inkSoft,
    fontFamily: typography.serifSemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  menuLabel: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 96,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 21,
    marginTop: -1,
  },
});
