import type { InboundEnvelope } from "./protocol.js";

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatChannelMessage(envelope: InboundEnvelope): string {
  const attrs = [
    `source="tin-can"`,
    `chat_id="${escapeAttr(envelope.chat_id)}"`,
    `message_id="${escapeAttr(envelope.message_id)}"`,
    `user="${escapeAttr(envelope.user)}"`,
    `ts="${escapeAttr(envelope.ts)}"`
  ].join(" ");

  const attachmentAttrs = envelope.attachment
    ? [
        `attachment_type="${escapeAttr(envelope.attachment.attachment_type)}"`,
        `file_name="${escapeAttr(envelope.attachment.file_name)}"`,
        envelope.attachment.attachment_type === "image" && envelope.attachment.file_path
          ? `image_path="${escapeAttr(envelope.attachment.file_path)}"`
          : null,
        envelope.attachment.file_path
          ? `file_path="${escapeAttr(envelope.attachment.file_path)}"`
          : null,
        envelope.attachment.file_uri
          ? `file_uri="${escapeAttr(envelope.attachment.file_uri)}"`
          : null,
        envelope.attachment.mime_type
          ? `mime_type="${escapeAttr(envelope.attachment.mime_type)}"`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const openTag = attachmentAttrs.length > 0
    ? `<channel ${attrs} ${attachmentAttrs}>`
    : `<channel ${attrs}>`;

  return `${openTag}\n${envelope.text}\n</channel>`;
}
