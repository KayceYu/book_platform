# 凑个局 · GOOD TIMES CLUB

面向手机的六人小队活动协作网站。视觉依据 [DESIGN.md](./DESIGN.md)：森林绿、白色轻量界面、动漫场景插画与清晰的操作层级。

固定成员：肠炎宁、查老师、404、夏洛、烤鱼、红裙子。小队信息为 4 位男生、2 位女生；未指定每个人的性别，成员资料不做性别映射。

## 已实现

- 约饭、游戏局、桌游、逛街、户外、自定义模板；支持组合、增删和排序环节，追加环节自动留出交通时间并延长整体行程。
- 六人身份选择、邀请名单、分环节报名、待定/不参加、同行者、到达与最晚离开时间、交通及到场状态。
- 地点与分店、集合点、地图、路线/距离/爬升/休息及退出点、预约与现场排队，环节负责人可更新进度。
- 全员评论、回复、本人编辑与删除、组织者管理建议；讨论不直接改变正式安排。
- 活动版本、变更记录、重要变更重新确认；单纯更新排队进度不打断已确认的行程。
- 按环节记录费用、同行者加权分摊、精确到分、个人结算登记。
- 小队日程、成员页、个人活动、站内消息、分享链接；草稿仅对当前组织者身份可见。
- SQLite 本地持久化；发布版使用 Cloudflare D1，共享记录不依赖浏览器存储。浏览器只保存消息已读偏好。

## 本地运行

需要 Node.js 24（使用内置 `node:sqlite`）。

```sh
npm ci
npm run dev
```

打开 `http://localhost:5173`。默认数据库为 `.local/data.sqlite`；可用 `PORT` 和 `TEST_DB` 设置端口和独立数据库路径。首次运行提供四个明确标记的示例活动，实际活动由成员创建。示例与真实活动均可按权限删除。

```sh
npm test
npm run build
npm start
```

浏览器验收需要系统 Chromium，默认路径为 `/usr/bin/chromium`；可通过 `CHROMIUM_PATH` 指定。先使用独立测试数据库启动服务，再执行：

```sh
TEST_DB=.local/qa.sqlite npm run dev
# 另一个终端
node tests/browser.mjs
```

验收涵盖两个浏览器会话协作，以及 360、768、1440px 视口。截图保存在忽略的 `test-results/`。

## 代码与部署

- `src/main.jsx`：活动广场、详情、创建、报名、讨论、费用、日程与成员界面。
- `src/domain.mjs`：固定名单、模板、人数计算、费用计算与版本确认规则。
- `server/api.mjs`：共享业务接口与当前所选身份的操作范围校验。
- `server/dev.mjs`：开发服务、SQLite 适配和本地生产预览。
- `db/schema.js` / `drizzle/`：D1 数据结构及 schema-only 迁移。
- `scripts/build-worker.mjs`：Vite 前端与 API 打包为 Worker ESM，生成 `dist/server/index.js`、托管配置与迁移。

身份采用小队昵称选择，用于轻量协作，不是六个独立账号的实名验证。能访问站点的人可以切换身份；站点访问范围由托管权限管理。个人需求字段会在 API 返回时按当前选择的身份隐藏。

预约结果由负责人手动维护；费用结清由成员登记。外部商家订位、支付和短信推送未接入。所有时间以 Asia/Shanghai 显示。

运行 `npm run package` 生成部署包。包内保留 `.openai/hosting.json`、`dist/server/index.js` 和 `drizzle/` 的完整相对路径；D1 绑定为 `DB`。托管身份记录于 `.openai/hosting.json`。

## GitHub Pages

自动部署配置见 [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)，独立共享后端及首次启用步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。静态前端使用 `npm run build:pages` 构建到 `dist/client`，子路径为 `/book_platform/`；后端地址配置于 `config/pages.json`。
