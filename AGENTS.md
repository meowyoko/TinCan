# VPS 环境记录

更新时间：2026-05-02

## 基础信息

- VPS SSH alias：`my-vps`
- 当前远程用户：`deploy`
- 远程系统：`Ubuntu 24.04.3 LTS`
- 内核：`Linux racknerd-642ba97 6.8.0-106-generic x86_64`
- 当前公网 IP：`64.188.26.146`
- 域名：
  - 主域名：`riin.top`

## 已确认的软件与依赖

- `node`：`/usr/bin/node`
  - 版本：`v20.20.2`
- `npm`：`/usr/bin/npm`
  - 版本：`10.8.2`
- `pm2`：`/usr/bin/pm2`
  - 版本：`6.0.1`
- `docker`：`/usr/bin/docker`
  - 版本：`29.2.1`
- `systemctl`：`/usr/bin/systemctl`
  - 版本：`systemd 255`

## 用户与权限

- 当前部署用户：`deploy`
- `deploy` 所在组：
  - `sudo`
  - `docker`
- `/opt`：
  - 属主：`root:root`

## Docker / Nginx 现状

- Docker 可直接由 `deploy` 执行
- 当前可见容器：
  - `npm-app-1`
    - 镜像：`jc21/nginx-proxy-manager:latest`
    - 端口：`80`、`81`、`443`
  - `ombre-brain`
    - 端口：`127.0.0.1:8081 -> 8000`
- 说明：
  - 反向代理不是宿主机手写 nginx 配置，而是通过 `Nginx Proxy Manager` 管理
  - 后续域名转发、SSL、Location 配置优先在 NPM 面板里做

## 版本管理

- 本项目使用 Git 做版本管理，默认分支为 `main`
- 每完成一个独立功能点后，进行一次小而清晰的提交
- 提交信息优先使用：`feat:`、`fix:`、`chore:`
- 不要提交运行数据、本地依赖和敏感配置（如 `data/`、`node_modules/`、`.env` 等）