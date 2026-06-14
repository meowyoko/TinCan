#!/usr/bin/env bash
set -euo pipefail

LOG_PATH="${HOME}/.claude/tin-can-stop-hook.log"

HOOK_INPUT="$(cat)"
printf '[%s] hook fired, input bytes=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${#HOOK_INPUT}" >>"$LOG_PATH"
if [[ -z "$HOOK_INPUT" ]]; then
  printf '[%s] empty hook input, skipping\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >>"$LOG_PATH"
  exit 0
fi

TRANSCRIPT_PATH="$(
  printf '%s' "$HOOK_INPUT" | node -e '
    const fs = require("node:fs");
    try {
      const input = JSON.parse(fs.readFileSync(0, "utf8"));
      if (input.hook_event_name !== "Stop" || input.stop_hook_active || !input.transcript_path) {
        process.stderr.write(`skip event=${String(input.hook_event_name ?? "")} active=${String(Boolean(input.stop_hook_active))} transcript=${String(Boolean(input.transcript_path))}\n`);
        process.exit(1);
      }
      process.stdout.write(String(input.transcript_path));
    } catch (error) {
      process.stderr.write(`parse error=${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  '
)" 2>>"$LOG_PATH" || exit 0

if [[ -z "$TRANSCRIPT_PATH" ]]; then
  printf '[%s] transcript path missing, skipping\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >>"$LOG_PATH"
  exit 0
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
HUB_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

cd "$HUB_DIR"
printf '[%s] transcript=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$TRANSCRIPT_PATH" >>"$LOG_PATH"
if ./node_modules/.bin/tsx src/thinking-hook.ts \
  --transcript "$TRANSCRIPT_PATH" \
  --hub-url "ws://127.0.0.1:${TINCAN_PORT:-3100}" \
  --pin "${TINCAN_PIN:-1234}" \
  --chat-id main \
  >>"$LOG_PATH" 2>&1; then
  printf '[%s] thinking hook completed\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >>"$LOG_PATH"
else
  printf '[%s] thinking hook failed\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >>"$LOG_PATH"
fi
