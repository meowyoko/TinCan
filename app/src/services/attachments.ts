import DocumentPicker, {
  type DocumentPickerResponse,
} from 'react-native-document-picker';
import type {ChatAttachmentMessage, ChatAttachment} from '../types/chat';
import {PRIMARY_CHAT_ID} from '../types/chat';
import type {OutboundAttachment} from './websocket';

export type PickedAttachment = {
  localMessage: ChatAttachmentMessage;
  outbound: OutboundAttachment;
};

export async function pickAttachmentForUpload(): Promise<PickedAttachment | null> {
  try {
    const file = await DocumentPicker.pickSingle({
      type: [DocumentPicker.types.allFiles],
      copyTo: 'cachesDirectory',
      mode: 'import',
    });

    const readableUri = file.fileCopyUri ?? file.uri;
    const base64 = await readDocumentAsBase64(file);
    const createdAt = new Date().toISOString();
    const attachment = buildAttachmentPayload(file, readableUri);

    return {
      localMessage: {
        id: `local_attachment_${Date.now()}`,
        chatId: PRIMARY_CHAT_ID,
        type: 'attachment',
        role: 'user',
        attachment: {
          ...attachment,
          uri: readableUri,
          localPath: normalizeLocalPath(readableUri),
        },
        time: formatTime(createdAt),
        createdAt,
      },
      outbound: {
        attachment_type: attachment.attachmentType,
        file_name: attachment.fileName,
        file_path: normalizeLocalPath(readableUri),
        file_uri: readableUri,
        mime_type: attachment.mimeType,
        size_bytes: attachment.sizeBytes,
        duration_ms: attachment.durationMs,
        data_base64: base64,
      },
    };
  } catch (error) {
    if (DocumentPicker.isCancel(error)) {
      return null;
    }

    throw error;
  }
}

function buildAttachmentPayload(
  file: DocumentPickerResponse,
  normalizedPath: string,
): ChatAttachment {
  const attachmentType = resolveAttachmentType(file.type, file.name);

  return {
    attachmentType,
    fileName: file.name ?? normalizedPath.split(/[\\/]/).pop() ?? 'attachment',
    mimeType: file.type ?? undefined,
    sizeBytes: file.size ?? undefined,
  };
}

function resolveAttachmentType(
  mimeType: string | null,
  fileName: string | null,
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

async function readDocumentAsBase64(
  file: DocumentPickerResponse,
): Promise<string> {
  const candidateUris = [file.fileCopyUri, file.uri].filter(
    (value): value is string => !!value,
  );

  let lastError: unknown;
  for (const uri of candidateUris) {
    try {
      return await readUriAsBase64(uri);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `无法读取附件内容：${lastError.message}`
      : '无法读取附件内容',
  );
}

async function readUriAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`读取失败（${response.status}）`);
  }

  const blob = await response.blob();
  return blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('读取附件二进制失败'));
    };

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('附件编码结果无效'));
        return;
      }

      const commaIndex = reader.result.indexOf(',');
      resolve(
        commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result,
      );
    };

    reader.readAsDataURL(blob);
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
