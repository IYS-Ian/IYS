# 上云部署指南（Render + GitHub）

这份文档对应仓库根目录的 `Dockerfile` 和 `render.yaml`。
本地代码已经提交到 git，剩下两步需要你在浏览器/客户端里点：

1. 用 GitHub Desktop 发布仓库；
2. 用 GitHub 登录 Render，创建服务。

不需要把密码或 token 发给任何人。

---

## 第 1 步：发布到 GitHub（约 1 分钟）

你电脑上已经装了 GitHub Desktop。

1. 打开 GitHub Desktop，登录 GitHub 账号（如果还没登录）；
2. 菜单 **File → Add Local Repository…**，选择：
   `/Users/ianyan/Desktop/Desktop Folder/编程/VS Code/HTML/IYS`
3. 点 **Publish repository**；
4. 名称建议 `iys-website`，可以勾选 **Keep this code private**（私有仓库 Render 也能用）；
5. 点 **Publish repository**。

完成后仓库地址形如 `https://github.com/你的用户名/iys-website`。

## 第 2 步：在 Render 部署（约 2 分钟）

1. 打开 <https://render.com>，点 **Get Started**，选 **GitHub** 登录并授权；
2. 控制台点 **New +** → **Blueprint**；
3. 选择刚发布的 `iys-website` 仓库 → **Connect** → **Apply**；
   Render 会自动读取 `render.yaml`（Docker 构建、免费套餐、健康检查都配好了）。
4. 如果找不到 Blueprint 入口，就手动建：
   **New + → Web Service** → 选仓库 → Language 选 **Docker** → Instance Type 选 **Free**
   → Health Check Path 填 `/api/health` → **Deploy Web Service**。
5. 等状态变成 **Live**，记下地址（形如 `https://iys-xxxx.onrender.com`）。

> 如果 Render 要求绑定银行卡，先停下来告诉我——免费档通常不需要卡。

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
2. 你在 GitHub Desktop 点 **Push origin**；
3. Render 检测到 `main` 分支更新后自动重新部署。

## 常见问题

**构建失败 `npm ci` 报错**：确认 `server/package-lock.json` 一起提交了（本仓库已包含）。

**部署成功但页面 502**：看 Render 的 Logs，多半是 `PORT` 或 `HOST` 问题；`render.yaml` 里已设 `HOST=0.0.0.0`，`PORT` 由 Render 自动注入。

**注册后刷新就退出**：检查是否通过 `https://` 访问、`COOKIE_SECURE=true`（`render.yaml` 已配置）。

**国内访问慢**：Render 新加坡节点通常比美国快；再慢就只能考虑国内服务器（绑定域名需要备案）。
