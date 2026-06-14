export type HubConfig = {
  clientPort: number;
  bridgePort: number;
  pin: string;
  tmuxSession: string;
  channelUser: string;
  uploadDir: string;
  sendTimeoutMs: number;
  busyTimeoutMs: number;
  approvalPollMs: number;
  approvalTailLines: number;
};

function intFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config: HubConfig = {
  clientPort: intFromEnv("TINCAN_PORT", 3100),
  bridgePort: intFromEnv("TINCAN_BRIDGE_PORT", 3101),
  pin: process.env.TINCAN_PIN ?? "",
  tmuxSession: process.env.TINCAN_TMUX ?? "cc",
  channelUser: process.env.TINCAN_USER ?? "rin",
  uploadDir: process.env.TINCAN_UPLOAD_DIR ?? "/tmp/tin-can-uploads",
  sendTimeoutMs: intFromEnv("TINCAN_SEND_TIMEOUT_MS", 3000),
  busyTimeoutMs: intFromEnv("TINCAN_BUSY_TIMEOUT_MS", 120000),
  approvalPollMs: intFromEnv("TINCAN_APPROVAL_POLL_MS", 800),
  approvalTailLines: intFromEnv("TINCAN_APPROVAL_TAIL_LINES", 40)
};
