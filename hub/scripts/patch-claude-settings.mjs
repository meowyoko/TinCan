import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const settingsPath = process.argv[2] ?? "/home/deploy/.claude/settings.json";
const hookCommand = process.argv[3] ?? "/home/deploy/tin-can/hub/scripts/tincan-stop-hook.sh";

const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

settings.permissions ??= {};
settings.permissions.allow ??= [];
for (const item of [
  "mcp__tin-can__tincan_reply",
  "mcp__tin-can__tincan_report_thinking",
]) {
  if (!settings.permissions.allow.includes(item)) {
    settings.permissions.allow.push(item);
  }
}

settings.hooks ??= {};
settings.hooks.Stop ??= [];
const hasHook = settings.hooks.Stop.some(
  entry =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some(
      hook =>
        hook &&
        typeof hook === "object" &&
        hook.type === "command" &&
        hook.command === hookCommand,
    ),
);

if (!hasHook) {
  settings.hooks.Stop.push({
    hooks: [
      {
        type: "command",
        command: hookCommand,
        async: true,
      },
    ],
  });
}

copyFileSync(settingsPath, `${settingsPath}.bak-tincan-phase3`);
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
