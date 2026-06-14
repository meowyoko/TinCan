import type {ChatAttachment} from '../types/chat';
import type {OutboundAttachment} from './websocket';
import {
  pickNativeAttachment,
  type AttachmentPickerKind,
} from './nativeAttachmentPicker';

export type PickedAttachment = {
  attachment: ChatAttachment;
  outbound: OutboundAttachment;
  previewUri?: string;
};

export async function pickAttachmentForUpload(
  kind: AttachmentPickerKind,
): Promise<PickedAttachment | null> {
  const file = await pickNativeAttachment(kind);
  if (!file) {
    return null;
  }

  const attachment = buildAttachmentPayload(file);
  const normalizedPath = normalizeLocalPath(file.uri);

  return {
    attachment: {
      ...attachment,
      uri: file.uri,
      localPath: normalizedPath,
    },
    outbound: {
      attachment_type: attachment.attachmentType,
      file_name: attachment.fileName,
      file_path: normalizedPath,
      file_uri: file.uri,
      mime_type: attachment.mimeType,
      size_bytes: attachment.sizeBytes,
      duration_ms: attachment.durationMs,
      data_base64: file.base64,
    },
    previewUri: file.uri,
  };
}

type NativePickedAttachment = {
  uri: string;
  name?: string;
  type?: string | null;
  size?: number;
  base64: string;
};

function buildAttachmentPayload(file: NativePickedAttachment): ChatAttachment {
  const attachmentType = resolveAttachmentType(file.type, file.name);

  return {
    attachmentType,
    fileName: file.name ?? file.uri.split(/[\\/]/).pop() ?? 'attachment',
    mimeType: file.type ?? undefined,
    sizeBytes: file.size,
  };
}

function resolveAttachmentType(
  mimeType: string | null | undefined,
  fileName: string | undefined,
): ChatAttachment['attachmentType'] {
  const lowerMime = mimeType?.toLowerCase() ?? '';
  const lowerName = fileName?.toLowerCase() ?? '';

  if (lowerMime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName)) {
    return 'image';
  }

  if (
    lowerMime.startsWith('audio/') ||
    /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(lowerName)
  ) {
    return 'voice';
  }

  return 'file';
}

function normalizeLocalPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice(7) : uri;
}
