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

  return `<channel ${attrs}>\n${envelope.text}\n</channel>`;
}
