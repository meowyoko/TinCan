# Tin-Can

一个基于 React Native 的移动端 AI Agent 交互客户端，通过 WebSocket 与后端 Hub 服务通信，支持实时对话、多媒体消息、权限审批等功能。

## 功能

- 实时通信 — WebSocket 双向连接，消息即时收发
- 富文本渲染 — 支持 Markdown（加粗、斜体、行内代码、代码块、可点击链接）
- 多媒体消息 — 图片与文件的发送和接收，图片内联预览，文件附件卡片
- 权限审批 — 工具调用审批卡片，支持展开详情、批准/拒绝操作，已处理卡片自动折叠
- 思维过程展示 — 可展开查看 AI 的推理过程
- 本地持久化 — SQLite 存储聊天记录，支持离线查看
- 消息管理 — 连续消息合并显示发送者，行内时间戳，消息删除14:19

## 技术栈

客户端：React Native (bare workflow)
服务端：Node.js + Express
通信协议：WebSocket
本地存储：SQLite
AI 集成：MCP (Model Context Protocol)
字体：Noto Serif SC（本地打包）

## 架构

App (React Native) ↔ WebSocket ↔ Hub (Node.js) ↔ MCP Bridge ↔ AI Agent

App 负责界面渲染、用户输入、媒体上传与权限审批交互
Hub 是中间层服务，负责连接管理、消息转发与 AI Agent 桥接 

## 贡献者

- **Ciel** - Hub debugging, thinking pipeline fixes, and VPS-side integration.
- **Gio** - App/Hub implementation, debugging, and integration support.
- **凛** - Project owner, product direction, testing, and iteration planning.

