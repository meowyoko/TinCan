import {NativeModules, Platform} from 'react-native';

export type AttachmentPickerKind = 'image' | 'file';

export type NativePickedAttachment = {
  uri: string;
  name?: string;
  type?: string | null;
  size?: number;
  base64: string;
};

type NativeAttachmentPickerModule = {
  pick: (kind?: AttachmentPickerKind) => Promise<NativePickedAttachment>;
};

const nativeModule = NativeModules
  .NativeAttachmentPicker as NativeAttachmentPickerModule | undefined;

export async function pickNativeAttachment(
  kind: AttachmentPickerKind,
): Promise<NativePickedAttachment | null> {
  if (Platform.OS !== 'android') {
    throw new Error('当前附件选择器只支持 Android 真机调试。');
  }

  if (!nativeModule?.pick) {
    throw new Error('附件原生模块未加载，请重新编译并安装 Android App。');
  }

  try {
    return await nativeModule.pick(kind);
  } catch (error) {
    const code = extractErrorCode(error);
    if (code === 'E_PICKER_CANCELLED') {
      return null;
    }

    throw error;
  }
}

function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const maybeCode = (error as {code?: unknown}).code;
  return typeof maybeCode === 'string' ? maybeCode : undefined;
}
