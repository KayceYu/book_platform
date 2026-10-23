# GitHub Pages 与独立共享后端

前端目标：`https://kayceyu.github.io/book_platform/`。GitHub Pages 只托管静态文件，活动、报名、评论和费用仍由独立后端共享保存。

## GitHub Pages

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
2. 在 `config/pages.json` 填写可访问的 HTTPS 后端地址。也可用仓库 Actions variable `API_BASE_URL` 或手动运行时的 `api_base_url` 覆盖。
3. 推送 main，或运行 `Deploy Cougeju to GitHub Pages`。

工作流会使用 Node.js 24，安装锁定依赖、运行测试、恢复并校验插画文件、构建 `/book_platform/` 子路径，再发布 Pages artifact。只有静态前端进入 Pages，不包含 `.local` 数据库、环境变量或服务端密钥。

`assets/encoded/` 保存插画的 UTF-8 编码源；构建时还原为 WebP，页面不依赖之前受阻的站点域名加载图片。

## 接口约定

后端地址是包含 `/api` 前缀之前的 URL，例如 `https://api.example.com`。前端会调用：

- `GET /api/state`：活动、报名、评论、费用、变更与当前身份。
- `POST /api/identity`：选择固定成员身份。
- `POST /api/events`，`PUT/DELETE /api/events/:id`：活动管理。
- `POST /api/events/:id/rsvp`、`/ack`：报名与版本确认。
- `POST/PUT/DELETE /api/events/:id/comments[/id]`：讨论。
- `POST /api/events/:id/booking/:stageId`：负责人更新预约与排队。
- `POST/PUT/DELETE /api/events/:id/expenses[/id]`：费用与结算。

跨域请求使用精确来源白名单。现有 Node 后端通过 `ALLOWED_ORIGINS=https://kayceyu.github.io` 开启 CORS，支持 `Content-Type`、`X-Member-Id` 和 `Authorization`。其他来源会被拒绝；不能把来源白名单当作身份验证。

当前轻量身份选择只识别昵称，无法防止访问者主动冒用其他成员。接入新的公开后端时，需要配合服务端身份验证、固定成员授权及数据库访问策略，不能把管理密钥放入前端。

## 后端候选与当前状态

选定方向为 **Supabase Free**，提供 PostgreSQL、Auth 和访问控制；免费项目低活跃时可能暂停，详见 [定价](https://supabase.com/pricing)。目前尚未创建 Supabase 项目，也未填写生产后端地址。

仓库中的现有 API 使用 SQLite/D1，并不是可直接运行的 Supabase PostgreSQL 实现。连接 Supabase 账户后，需要完成数据库适配、成员验证、访问策略与接口部署，然后写入后端地址并进行双设备验收。

## 可选：运行现有 Node API

现有 Node.js 后端可部署到支持持久化磁盘的服务器：

```sh
npm ci
npm run build
ALLOWED_ORIGINS=https://kayceyu.github.io DATABASE_PATH=/data/cougeju.sqlite npm start
```

需要 Node.js 24，并将 `/data` 挂载为持久化目录。也提供 Dockerfile；这不是 GitHub Pages 的服务端运行方式。
