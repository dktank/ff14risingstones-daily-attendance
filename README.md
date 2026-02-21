# FF14 石之家 / 盛趣商城 每日自动签到

功能：

- 石之家每日签到 + 签到档位奖励自动领取（默认 `FF14RS_AUTO_CLAIM=true`）
- 盛趣商城积分签到（可选）
- 多账号（`FF14RS_COOKIES` / `FF14RS_QU_COOKIES` 支持换行或逗号分隔）
- 可选推送（`FF14RS_NOTIFICATION_URLS`，`statocysts`）

> 只使用浏览器登录态 `Cookie`，不支持账号密码自动登录。

---

## GitHub Actions（最常用）

1. 创建仓库副本（Public 可直接 Fork；Private 推荐用 Template，见文末）
2. 配置 Secrets：`Settings` → `Secrets and variables` → `Actions`
   - 必填：`FF14RS_COOKIES`
   - 可选：`FF14RS_QU_COOKIES`、`FF14RS_NOTIFICATION_URLS`
   - 可选：`FF14RS_AUTO_CLAIM`、`FF14RS_FAIL_ON_ERROR`、`FF14RS_MAX_RETRIES`、`FF14RS_REQUEST_TIMEOUT_MS`
3. 运行：`Actions` → `attendance` → `Run workflow`

---

## Cookie 怎么抓（只看这一节就够）

通用规则：复制 DevTools → `Network` → 某条接口请求 → `Headers` → `Request Headers` 的 `cookie:` **冒号后整段**（或整行 `cookie: ...` 也行）。

补充：

- `userinfo=userid=...&siteid=...` 这类看起来“像参数”的内容是正常的 Cookie 值（不要手动拆分/改写）。
- 如果你把 Cookie 粘贴到命令行或 YAML 等配置里，遇到 `&` 等特殊字符请务必用引号包裹（避免被解释为语法）。
- 本项目支持直接粘贴整段 `Request Headers`（会自动抽取其中的 `cookie:` 行并处理 DevTools 折行）。

石之家（推荐从日历页抓包，必有请求）：

1. 打开：`https://ff14risingstones.web.sdo.com/pc/index.html#/signcalendar`
2. `F12` → `Network` → 过滤 `Fetch/XHR` → 刷新
3. 搜索 `mySignLog` 或 `signRewardList` → 复制该请求的 `cookie:`

盛趣商城（可选）：

1. 打开：`https://qu.sdo.com/personal-center?merchantId=1#pointsindex-1`
2. `F12` → `Network` → 过滤 `Fetch/XHR` → 刷新
3. 搜索 `getStatus` / `checkIn` → 复制该请求的 `cookie:`

---

## 推送通知（可选）

配置 `FF14RS_NOTIFICATION_URLS`（示例）：

```text
jsons://YOUR_DOMAIN/ff14rs/webhook?qq=YOUR_QQ&%20X-Notify-Token=YOUR_NOTIFY_TOKEN
```

### 你需要手动修改的参数

- `YOUR_DOMAIN`：你的 Webhook 域名
- `YOUR_QQ`：接收通知的 QQ（多个用逗号分隔，如 `111,222`）
- `YOUR_NOTIFY_TOKEN`：你的 Webhook 鉴权 token（与服务端配置保持一致）

如果你的 Webhook 没有 HTTPS：把 `jsons://` 改成 `json://`。

### `YOUR_NOTIFY_TOKEN` 怎么获取？

`YOUR_NOTIFY_TOKEN` 是你自己生成的共享密钥（不是 QQ/GitHub 的 token）：

```bash
openssl rand -hex 16
```

Windows（PowerShell）没有 `openssl` 时：

```powershell
$bytes = New-Object byte[] 16
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

Webhook/OneBot 服务端示例见：`extras/qqbot-webhook/README.md`。

---

## Private 仓库：给指定用户“复制一份”使用（Template）

仓库拥有者：

1. 仓库保持 `Private`
2. 邀请朋友 `Read` 访问：`Settings` → `Collaborators / Manage access` → `Invite a collaborator`
3. 开启模板：`Settings` → `General` → `Template repository`

朋友开始使用：

1. 打开你的仓库首页 → 点击 `Use this template` → 在自己账号下创建一个新仓库
2. 在新仓库配置 Secrets：`Settings` → `Secrets and variables` → `Actions`
   - 必填：`FF14RS_COOKIES`（可多行：一行一个账号 Cookie）
   - 可选：`FF14RS_QU_COOKIES`、`FF14RS_NOTIFICATION_URLS`
3. 在新仓库运行：`Actions` → `attendance` → `Run workflow`

---

## 常见错误

- `10403 请先登录`：Cookie 失效/不完整 → 重新抓 `cookie:` 并更新 Secrets
- `10301 操作太快`：多账号限速 → 可调大 `FF14RS_MAX_RETRIES`
