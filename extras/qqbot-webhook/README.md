# qqbot-webhook（接收签到结果 → QQ 私聊通知）

本目录提供一个最小化的 Webhook 接收服务，用于配合本仓库的 `FF14RS_NOTIFICATION_URLS=json/jsons` 推送：

1. GitHub Actions 把签到结果以 JSON `POST` 到你的 Linux 服务器
2. 服务器调用 OneBot v11 HTTP API `send_private_msg` 私聊通知指定 QQ 用户

> 说明：本服务不包含 QQ Bot 本体，你需要自己在服务器上运行一个支持 OneBot v11 的机器人（例如 NapCat / Lagrange.OneBot / go-cqhttp 等），并开启 HTTP API。

---

## 运行方式

在服务器上进入仓库目录后：

```bash
node extras/qqbot-webhook/index.mjs
```

建议用 `systemd` 常驻运行（示意）：

```ini
[Unit]
Description=ff14rs qqbot webhook
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/ff14risingstones-daily-attendance
Environment=HOST=0.0.0.0
Environment=PORT=8787
Environment=WEBHOOK_PATH=/ff14rs/webhook
Environment=NOTIFY_TOKEN=REPLACE_ME
Environment=ONEBOT_BASE_URL=http://127.0.0.1:5700
Environment=ONEBOT_ACCESS_TOKEN=
Environment=ONEBOT_SEND_PRIVATE_MSG_PATH=/send_private_msg
Environment=TARGET_QQ=123456789
ExecStart=/usr/bin/node extras/qqbot-webhook/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

---

## 配置项（环境变量）

- `HOST`：监听地址，默认 `0.0.0.0`
- `PORT`：监听端口，默认 `8787`
- `WEBHOOK_PATH`：Webhook 路径，默认 `/ff14rs/webhook`
- `NOTIFY_TOKEN`：用于校验 `X-Notify-Token` 的共享密钥（单 token 模式，必填其一）
- `NOTIFY_TOKENS`：多个 token（逗号或换行分隔），用于“多人共用同一台 Webhook 服务器”（必填其一）
- `TOKEN_QQ_MAP`：可选，按 token 绑定可通知的 QQ（防止拿到 token 的人随意改 `qq=` 发给别人），格式为每行一个 `token=qq1,qq2`
- `ONEBOT_BASE_URL`：OneBot HTTP API 地址（必填），例如 `http://127.0.0.1:5700`
- `ONEBOT_ACCESS_TOKEN`：OneBot Access Token（可选，如你的 OneBot 开了鉴权）
- `ONEBOT_SEND_PRIVATE_MSG_PATH`：发送私聊的 API 路径（默认 `/send_private_msg`）
- `TARGET_QQ` / `TARGET_QQS`：默认私聊目标 QQ（逗号或换行分隔）

---

##（推荐）用 Nginx 反代到 HTTPS（避免额外开放端口）

如果你已经有域名 + HTTPS（例如通过 Let's Encrypt），可以只暴露 `443`，把 Webhook 反代到本机：

```nginx
location = /ff14rs/webhook {
  proxy_pass http://127.0.0.1:8787/ff14rs/webhook;
}
```

然后在 GitHub Secrets 里使用 `jsons://你的域名/ff14rs/webhook?...`。

---

## 在本仓库中如何配置推送

在 GitHub Secrets 中设置 `FF14RS_NOTIFICATION_URLS`（示例）：

```text
jsons://example.com/ff14rs/webhook?qq=123456789&%20X-Notify-Token=REPLACE_ME
```

如果你只提供 HTTP（无 TLS），使用：

```text
json://example.com:8787/ff14rs/webhook?qq=123456789&%20X-Notify-Token=REPLACE_ME
```

> `jsons:`/`json:` 会 POST JSON：`{ "title": "...", "body": "..." }`

### 如何配置“通知给哪个 QQ”

本服务支持 3 种方式指定接收者，优先级从高到低：

1. `TOKEN_QQ_MAP` 按 token 强绑定（启用后会忽略 `qq=`）
2. 请求 body（`qq`/`targets`/`target`）
3. URL query（`?qq=...`）← **最推荐：最容易在 GitHub Secrets 里配置**
4. 请求 header（`X-Notify-QQ` / `X-Notify-QQS`）
5. 服务端默认（环境变量 `TARGET_QQ` / `TARGET_QQS`）

如果你希望多个 QQ 同时收到私聊：在 `qq=` 里用英文逗号分隔，例如：

`qq=11111111,22222222`

---

## token 是什么？怎么获取？

这里的 token 指的是：**你自己设置的一段随机字符串**（共享密钥），用于校验 `X-Notify-Token`，不是 QQ 的 token，也不是 GitHub 的 token。

### 生成 token

在服务器上执行（示例）：

```bash
openssl rand -hex 16
```

会得到一段类似 `32` 位十六进制字符串，把它填到：

- Webhook 服务端：`NOTIFY_TOKEN=...`（或加入 `NOTIFY_TOKENS`）
- GitHub Secrets：`FF14RS_NOTIFICATION_URLS` 中的 `&%20X-Notify-Token=...`
