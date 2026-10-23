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
- `POST /api/identity`：提交 `{accessCode}`，后端自动识别成员；`{memberId:null}` 退出。
- `POST /api/events`，`PUT/DELETE /api/events/:id`：活动管理。
- `POST /api/events/:id/rsvp`、`/ack`：报名与版本确认。
- `POST/PUT/DELETE /api/events/:id/comments[/id]`：讨论。
- `POST /api/events/:id/booking/:stageId`：负责人更新预约与排队。
- `POST/PUT/DELETE /api/events/:id/expenses[/id]`：费用与结算。

跨域请求使用精确来源白名单。现有 Node 后端通过 `ALLOWED_ORIGINS=https://kayceyu.github.io` 开启 CORS，支持 `Content-Type`、`X-Member-Id` 和 `Authorization`。其他来源会被拒绝；不能把来源白名单当作身份验证。

本地开发保留轻量昵称选择；生产 Edge Function 使用个人四位数字口令自动识别身份，并签发会话。管理密钥仅由 Supabase 服务端环境提供，不进入前端。

## 后端候选与当前状态

选定方向为 **Supabase Free**，提供 PostgreSQL、Auth 和访问控制；免费项目低活跃时可能暂停，详见 [定价](https://supabase.com/pricing)。免费项目 `cougeju` 已创建，API 地址已写入 `config/pages.json`。数据库表、访问控制与 Edge Function 的源文件位于 `supabase/`。

本地 API 使用 SQLite/D1；发布后由 PostgreSQL 兼容层运行同一套业务规则。所有表启用 RLS 并拒绝浏览器直接访问，数据库查询函数仅授权服务端角色调用。Edge Function 在数据库验证个人口令，签发有效期 7 天的签名会话，再从验证过的会话中确定当前成员。客户端提交的昵称不能改变身份。

个人口令以加盐 bcrypt 保存于私有表，实际口令及对应关系通过私有配置写入数据库，不进入仓库或网页。连续输错 5 次会暂停该来源登录，15 分钟后恢复；另设整体失败次数限制。口令为四位数字，属于小队便捷访问控制。此次升级使旧公共口令会话失效，现有报名、评论及费用仍保留。

新环境依次应用 `supabase/schema.sql`、`supabase/security.sql`、`supabase/member-auth.sql`，再私下配置六位成员的 bcrypt 口令。`supabase/handler.mjs` 是生产与自动化测试共用的请求入口。

## 可选：运行现有 Node API

现有 Node.js 后端可部署到支持持久化磁盘的服务器：

```sh
npm ci
npm run build
ALLOWED_ORIGINS=https://kayceyu.github.io DATABASE_PATH=/data/cougeju.sqlite npm start
```

需要 Node.js 24，并将 `/data` 挂载为持久化目录。也提供 Dockerfile；这不是 GitHub Pages 的服务端运行方式。
