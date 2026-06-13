# Tin-Can · 一期需求文档

> React Native 原生聊天客户端，通过 channel 标签与 Claude Code 通信

最后更新：2026-06-13

---

## 这是什么

Tin-Can 是凛自建的移动端聊天 App，用来替代官方 claude.ai 客户端与我（Ciel / Claude Code）对话。核心思路：不 spawn CC 子进程、不解析 stream-json，而是复用已经跑着的 CC 实例，通过 tmux 注入消息、通过 MCP 工具回复。

**关于 "channel 标签"**：这里说的不是 CC 的实验性 channel notification 功能，而是利用 CC 本身就能识别的 `<channel>` XML 标签格式。Hub 把用户消息包装成这种标签，作为纯文本通过 tmux send-keys 注入 CC 的 stdin——CC 看到这个格式就会当作外部消息处理。出站方向则完全走 MCP 工具调用（tincan_reply），不依赖任何 channel 协议。需要在 CC 的 CLAUDE.md 中配置识别 `source="tin-can"` 的 channel 消息。

一期目标：**在手机上能跟 CC 发消息、收回复，通信链路跑通。**

---

## 整体架构

```
┌──────────────────┐
│  React Native App │
│  (手机原生客户端)  │
└────────┬─────────┘
         │ WebSocket
         │
┌────────▼─────────┐
│    Hub 服务       │
│  (Bun/Node.js)   │
│  部署在 VPS 上    │
└──┬───────────┬───┘
   │           │
   │ tmux      │ MCP Bridge
   │ send-keys │ (CC → Hub)
   │           │
┌──▼───────────▼───┐
│   Claude Code     │
│  (tmux session)   │
└──────────────────┘
```

### 通信流程

**入站（用户 → CC）：**
1. 用户在 App 输入消息，通过 WebSocket 发给 Hub
2. Hub 将消息包装成 `<channel>` 标签格式
3. Hub 通过 `tmux send-keys` 将包装后的消息注入 CC 所在的 tmux session
4. CC 看到 channel 标签，识别为外部消息并处理

**出站（CC → 用户）：**
1. CC 处理完消息后，调用 MCP reply 工具回复
2. MCP Bridge（Hub 内置的 MCP Server）接收到 reply 调用
3. Hub 通过 WebSocket 将回复推送给 App

---

## 一期范围

### 做什么

| 模块 | 内容 |
|------|------|
| App UI | 首页 + 聊天页，React Native 实现，视觉参照 design.md 和现有 HTML 原型 |
| Hub 服务 | WebSocket 服务 + tmux 注入 + MCP Bridge，部署在 VPS |
| 通信协议 | 定义 App ↔ Hub 的 WebSocket 消息格式 |
| 基础鉴权 | Hub 层 PIN 码验证，防止未授权连接 |

### 不做什么（留给二期）

- 网关层（记忆注入、上下文监控、token 统计）
- 多对话/session 管理
- 对话历史持久化（SQLite）
- 终端日志页、设置页
- 跨窗口上下文摘要
- 深色模式

---

## App UI 设计

### 技术选型

- **框架**：React Native（不是 Expo，用 bare workflow，保持轻量）
- **字体**：Noto Serif SC（宋体感，与 design.md 一致）
- **图标**：手绘线性 SVG，线宽 1.8px，react-native-svg 渲染
- **导航**：React Navigation（底部 Tab + Stack）

### 配色

```
page-bg:     #fcf6ee  (暖米白)
ink:         #2A2320  (深棕黑)
ink-soft:    #5D5148  (柔灰棕)
blue-main:   #6B8BA4  (灰蓝，AI 气泡)
terracotta:  #B8654A  (砖红，用户气泡/强调)
thinking-bg: #fcf4e7  (思考气泡背景)
memory-bg:   #fcefe1  (记忆卡片背景)
header-bg:   #f9efe3  (头部栏背景)
```

### 页面结构

**首页（HomeScreen）**

参照 `/home/deploy/work/daily-telegraph-ui/home.html` 实现，主要区块：
- 顶部栏：菜单图标 + "每日智能电讯" + 搜索图标
- 栏目标题："今日首页 · 第N期"
- 主视觉区：继续对话卡片（蓝灰色块，65%宽）+ 今日摘要（右栏 35%）
- 电讯速报横条
- 模块入口：横向图标索引，竖线分隔
- 精选速写：左文右图
- 底部：今日计划 + 记忆回顾双栏
- 底部导航：首页 / 聊天 / 日记 / 档案 / 我的

一期中，只有「继续对话」和「聊天」入口可点击跳转聊天页，其余模块显示 UI 但不响应交互。

**聊天页（ChatScreen）**

参照 `/home/deploy/work/daily-telegraph-ui/chat.html` 实现：
- 顶部栏：返回 + "每日智能电讯" + 搜索
- 对话状态栏：状态点 + "正在对话：Ciel"
- 消息列表：
  - AI 消息：蓝灰气泡，左侧头像（企鹅线稿）
  - 用户消息：砖红气泡，右侧头像
  - 思考指示器：虚线边框，淡黄背景，"思考中……"+ 跳动点
  - 工具调用卡片：深棕背景，折叠/展开
  - 记忆卡片：虚线砖红边框，淡粉背景
  - 语音消息：砖红背景，波形条 + 播放按钮
  - 附件卡片：细边框 + 文件图标
  - 速写卡片：微旋转 + 阴影，图文
- 输入栏（悬浮底部）：附件按钮 + 文本输入 + 发送按钮
- 日期分隔线

### 气泡渲染

- 支持 Markdown 渲染（react-native-markdown-display 或类似库）
- 代码块高亮
- 气泡最大宽度 75%，最小宽度 60%
- 时间戳右下角，半透明

---

## Hub 服务设计

### 技术选型

| 项 | 选型 |
|----|------|
| 运行时 | Bun（如 VPS 未装则用 Node.js） |
| WebSocket | ws 库 或 Bun 内置 |
| MCP Bridge | 独立 HTTP/stdio MCP Server |
| 进程管理 | pm2 |

### 核心职责

1. **WebSocket 服务**：接受 App 连接，转发消息
2. **tmux 注入**：将用户消息包装成 channel 标签，通过 `tmux send-keys` 注入 CC session
3. **MCP Bridge**：作为 MCP Server 挂载到 CC，接收 CC 的 reply 调用，转发给 App
4. **PIN 鉴权**：App 连接时需提供 PIN 码
5. **keepalive**：WebSocket 心跳保活

### Channel 标签格式

Hub 注入给 CC 的消息格式：

```
<channel source="tin-can" chat_id="default" message_id="{uuid}" user="rin" ts="{iso-timestamp}">
{用户消息原文}
</channel>
```

### MCP Bridge 工具定义

Hub 向 CC 暴露的 MCP 工具：

```json
{
  "name": "tincan_reply",
  "description": "Reply to Tin-Can app",
  "parameters": {
    "chat_id": { "type": "string" },
    "text": { "type": "string" },
    "reply_to": { "type": "string", "description": "optional message_id to thread under" }
  }
}
```

CC 调用 `tincan_reply` → Hub 收到 → 通过 WebSocket 推送给 App。

### WebSocket 消息协议

App ↔ Hub 之间的 JSON 消息格式：

**App → Hub（发送消息）：**
```json
{
  "type": "message",
  "id": "uuid",
  "text": "用户输入的文本",
  "ts": "2026-06-13T10:00:00.000Z"
}
```

**Hub → App（CC 回复）：**
```json
{
  "type": "reply",
  "id": "uuid",
  "text": "CC 的回复文本",
  "reply_to": "原消息uuid（可选）",
  "ts": "2026-06-13T10:00:05.000Z"
}
```

**Hub → App（状态更新）：**
```json
{
  "type": "status",
  "state": "thinking" | "idle" | "error",
  "message": "可选的状态描述"
}
```

**鉴权握手：**
```json
// App → Hub
{ "type": "auth", "pin": "1234" }
// Hub → App
{ "type": "auth_ok" }
// 或
{ "type": "auth_fail" }
```

---

## 部署环境

| 项 | 规格 |
|----|------|
| VPS | 美国圣何塞，2核 2.5GB RAM |
| CC | 已在 tmux session 中运行 |
| Hub 端口 | 可配置，默认 3100，nginx 反代 |
| App 打包 | Android APK（凛用安卓） |

---

## 文件结构建议

```
tin-can/
├── app/                    # React Native 项目
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   └── ChatScreen.tsx
│   │   ├── components/
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── MemoryCard.tsx
│   │   │   └── InputBar.tsx
│   │   ├── services/
│   │   │   └── websocket.ts
│   │   ├── theme/
│   │   │   └── colors.ts
│   │   └── App.tsx
│   └── package.json
├── hub/                    # Hub 服务
│   ├── hub.ts              # WebSocket + tmux 注入
│   ├── mcp-bridge.ts       # MCP Server（tincan_reply）
│   └── package.json
└── README.md
```

---

## 红线和坑

- **tmux session 名必须固定**：Hub 注入消息时需要知道 CC 跑在哪个 tmux session 里，配置文件中指定
- **channel source 标识**：用 `tin-can` 区分来源，CC 的 CLAUDE.md 需要配置识别此 source
- **MCP Bridge 注册**：Hub 的 MCP Server 需要在 CC 的 `.mcp.json` 中注册才能被 CC 调用
- **tmux 注入必须有队列**：tmux send-keys 不可靠，CC 可能正在处理上一条消息。一期至少做单队列 + busy 状态 + 超时释放，防止连续发送多条消息粘在一起或打断 CC 当前输入
- **CC 在线状态三级判断**：不能只检测 tmux session 是否存在。Hub 维护三个状态：`tmux_alive`（tmux session 在）、`bridge_alive`（MCP Bridge 已连接）、`ready`（两者都在线且 CC 空闲）。只有 ready 时才允许发送消息，否则向 App 返回对应的离线/忙碌状态
- **Android 打包**：凛用安卓手机，优先保证 Android 端体验，iOS 暂不管
- **字体本地打包**：RN 不能用 Google Fonts @import，Noto Serif SC 需要本地打包进 App
- **SVG 图标**：HTML 原型中的 SVG 需要转成 react-native-svg 组件，不能直接搬
- **尺寸以 design.md 为准**：HTML 原型的尺寸与 design.md 有出入（如顶部栏高度、底部导航高度），以 design.md 的规范为准，HTML 只参考视觉气质
- **先 git init**：开始写代码前先初始化 git 仓库，每个独立功能点后小提交

---

## 下一步和遗留

- 一期完成后，在 Hub 和 App 之间插入网关层，加记忆注入和上下文监控
- 对话持久化（SQLite）
- 多 session 管理
- 设置页（CLAUDE.md 编辑、MCP 配置）
- 离线推送通知（Web Push 或 Firebase）
