# Tin-Can

Tin-Can is a React Native Android chat client plus a small VPS Hub for talking to an already-running Claude Code instance.

一期目标很小：App 能把消息发到 Hub，Hub 用 `<channel source="tin-can">` 纯文本标签注入 tmux 里的 CC，CC 再通过 MCP 工具 `tincan_reply` 把回复推回 App。

## Project Layout

```text
tin-can/
├── app/      # React Native bare app
├── hub/      # WebSocket hub + MCP bridge
└── uiResources/
```

## Hub

```powershell
cd hub
npm install
npm run typecheck
npm run build
npm run dev
```

Environment variables:

```text
TINCAN_PORT=3100
TINCAN_BRIDGE_PORT=3101
TINCAN_PIN=1234
TINCAN_TMUX=cc
TINCAN_USER=rin
```

MCP config example for Claude Code:

```json
{
  "mcpServers": {
    "tin-can": {
      "command": "node",
      "args": ["/home/deploy/tin-can/hub/dist/mcp-bridge.js"],
      "env": {
        "TINCAN_BRIDGE_PORT": "3101"
      }
    }
  }
}
```

## App

```powershell
cd app
npm install
npx tsc --noEmit
npm run lint
npm run android
```

The current app skeleton uses local state for screen navigation. The chat UI is wired to the WebSocket service, but live Hub mode is disabled by default.

To test the live phone-to-Hub path, edit `app/src/services/tincanConfig.ts` before running Metro:

```ts
export const tinCanConfig = {
  enabled: true,
  hubUrl: 'ws://64.188.26.146:3100',
  pin: 'your-pin',
};
```

Keep the PIN local while testing. Do not commit a real PIN.

## Current Verification

- Hub: `npm run typecheck`
- Hub: `npm run build`
- App: `npx tsc --noEmit`
- App: `npm run lint`

## Notes

- `tmux_alive`, `bridge_alive`, `busy`, and `ready` are separated in Hub status.
- Hub uses a single FIFO queue for tmux injection.
- Chat text bubbles are the first real dynamic surface.
- Thinking/tool/memory/attachment/sketch cards are display shells for一期.
- Noto Serif SC font binaries still need to be added under `app/src/assets/fonts/` before release.

## Contributors

- **凛** - Project owner, product direction, testing, and iteration planning.

