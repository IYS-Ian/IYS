# 上云部署指南（Render + 现有 GitHub 仓库）

本文对应仓库根目录的 `Dockerfile` 和 `render.yaml`。
本地代码已经合并了 `IYS-Ian/IYS` 的 GitHub 历史，目前有 5 个提交待推送
（站点、账号后端、部署配置、历史合并、导航调整）。

## 第 1 步：推送到 GitHub（你操作，约 1 分钟）

仓库已经存在（`https://github.com/IYS-Ian/IYS`），不需要新建，也不需要 Publish。

**用 GitHub Desktop：**

1. 打开 GitHub Desktop，登录你的 GitHub 账号；
2. 菜单 **File → Add Local Repository…**，选择：
   `/Users/ianyan/Desktop/Desktop Folder/编程/VS Code/HTML/IYS`
3. 顶部会出现 **Push origin**，点它；
4. 如果提示登录，按提示授权。

**或者用终端**（需要 Personal Access Token，权限勾 `repo`）：

```bash
cd "/Users/ianyan/Desktop/Desktop Folder/编程/VS Code/HTML/IYS"
git push -u origin main
```

用户名填 `IYS-Ian`，密码粘贴 PAT（不是 GitHub 登录密码）。

> 你的网络访问 `github.com` 时好时坏。如果卡住，换手机热点再试，或重试几次。

## 第 2 步：在 Render 部署（你操作，约 2 分钟）

**不要打开 `render.com`**——那个营销站被墙了。直接用管理后台：

1. 打开 <https://dashboard.render.com/register>；
2. 选 **GitHub** 注册/登录并授权；
   - 如果 GitHub 授权页打不开，选 **GitLab**（见下面“GitHub 一直不通”），Render 支持；
3. 登录后 **New +** → **Blueprint**；
4. 选择 `IYS-Ian/IYS` 仓库 → **Connect** → **Apply**；
   Render 会自动读取 `render.yaml`（Docker 构建、免费套餐、新加坡节点、健康检查）。
5. 如果找不到 Blueprint：**New + → Web Service** → 选仓库 → Runtime **Docker**
   → Plan **Free** → Health Check Path 填 `/api/health` → **Deploy**。
6. 等状态变成 **Live**，记下地址（形如 `https://iys-xxxx.onrender.com`）。

> 如果 Render 要求绑银行卡，先停下来告诉我——免费档通常不需要卡。

## 第 3 步：验收

把线上地址发给我，我可以直接帮你验证；你也可以自己检查：

- `https://你的地址/api/health` 返回 `{"status":"ok",...}`
- 打开首页，页面正常
- 打开 `/IYS Account Sign Up.html`，注册一个测试账号（按钮已经接上后端）
- 注册成功后应跳回首页；再打开 `/IYS Account Sign In.html` 用同一账号登录
- 浏览器控制台里也可以直接调 API：

```js
await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
}).then(r => r.json()).then(console.log);
```

## Render 打不开怎么办

- `render.com`（营销页）被墙是正常的，**后台 `dashboard.render.com` 可以打开**；
- 登录页支持 **GitHub / GitLab / Google**，GitHub 或 Google 打不开时用 GitLab；
- API（`api.render.com`）和部署后的 `*.onrender.com` 是另一套域名，通常能访问。

## GitHub 一直不通：用 GitLab 镜像

如果 GitHub 推送反复超时，可以改用 GitLab（国内可访问，Render 也支持）：

1. 注册 <https://gitlab.com>；
2. **New project → Create blank project**，名字填 `iys`（公开/私有都行）；
3. 把项目地址发我，我帮你加 remote；或者你自己在终端执行：

```bash
cd "/Users/ianyan/Desktop/Desktop Folder/编程/VS Code/HTML/IYS"
git remote add gitlab https://gitlab.com/你的用户名/iys.git
git push -u gitlab main
```

4. 在 Render 用 **GitLab** 注册/登录 → **New + → Blueprint** → 选 GitLab 里的 `iys`。

用 GitLab 部署后，GitHub Pages 可以继续保留，但正式网址请用 Render 的地址。

## 重要：请用 Render 的网址访问网站

你的 GitHub Pages 只能托管静态文件，没有后端。如果继续从 `*.github.io` 打开注册/登录页，
页面里的 `fetch('/api/auth/register')` 会请求 GitHub 的服务器并得到 404。

所以上线后请把 **Render 地址当作正式网址**；以后绑定自定义域名，也指向 Render。
如果你确实想保留 GitHub Pages 当主站、Render 只当 API，需要改 `account.js` 的请求地址
并配置跨域 Cookie，告诉我我再改。

## 免费档的三个限制（重要）

1. **会休眠**：15 分钟没人访问就暂停，下次打开要等 30~60 秒；
2. **数据不持久**：免费实例没有磁盘，重启或重新部署后 `server/data/iys.db` 被清空，账号会丢；
3. 每月 750 小时实例时间，一个服务够用。

所以免费档适合“先跑起来看看”。要让账号长期保存，三选一：

- Render 加持久磁盘（付费，约 $0.25/GB/月 + 实例费）；
- 换免费云数据库 Supabase / Turso（不用信用卡），我改后端；
- 用你自己的服务器 / VPS（如果已有，告诉我，我改成 Docker 或 systemd 部署）。

## 日常更新流程

1. 我改代码并在本地 `git commit`；
2. 你在 GitHub Desktop 点 **Push origin**（或推 GitLab）；
3. Render 检测到 `main` 分支更新后自动重新部署。

## 常见问题

**构建失败 `npm ci` 报错**：确认 `server/package-lock.json` 一起提交了（本仓库已包含）。

**部署成功但页面 502**：看 Render 的 Logs，多半是 `PORT` 或 `HOST` 问题；`render.yaml` 里已设 `HOST=0.0.0.0`，`PORT` 由 Render 自动注入。

**注册后刷新就退出**：检查是否通过 `https://` 访问、`COOKIE_SECURE=true`（`render.yaml` 已配置）。

**国内访问慢**：Render 新加坡节点通常比美国快；再慢就只能考虑国内服务器（绑定域名需要备案）。
