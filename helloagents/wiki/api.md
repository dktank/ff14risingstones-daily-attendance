# API 手册

## 概述
本项目通过调用石之家前端同源接口完成签到与可选领奖，所有请求必须携带用户提供的登录态 Cookie。

## 认证方式
- 使用 `Cookie`（由用户登录后从浏览器导出/复制）
- 不存储账号密码

## 配置（环境变量）
运行时配置使用 Nitro `runtimeConfig`，并以 `FF14RS_` 作为前缀：

- `FF14RS_COOKIES`: 多账号 Cookie（建议换行分隔）
- `FF14RS_QU_COOKIES`: 盛趣游戏商城（qu.sdo.com）多账号 Cookie（建议换行分隔，可选）
- `FF14RS_QU_MERCHANT_ID`: 盛趣游戏商城 merchantId（默认 1，可选）
- `FF14RS_NOTIFICATION_URLS`: 推送通道 URL（可选，多个用逗号分隔；支持 `json:`/`jsons:` 将 `{title, body}` POST 到自建 Webhook）
- `FF14RS_MAX_RETRIES`: 网络异常重试次数（默认 3）
- `FF14RS_AUTO_CLAIM`: 是否自动领取当月档位奖励（默认 true）
- `FF14RS_REQUEST_TIMEOUT_MS`: 单次外部接口请求超时（毫秒，默认 20000）
- `FF14RS_FAIL_ON_ERROR`: 任意账号失败时是否返回非 0（默认 true）

---

## 接口列表

### 石之家签到

#### [POST] `/api/home/sign/signIn`
**描述:** 执行每日签到。

**请求参数:**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| tempsuid | string | 是 | 追踪用 UUID（同时出现在 query 与 body） |

**响应:**
```json
{
  "code": 10000,
  "msg": "操作成功",
  "data": {
    "sqMsg": "石之家社区签到成功，商城签到成功",
    "continuousDays": 1,
    "totalDays": "1",
    "sqExp": 3,
    "shopExp": 100
  }
}
```

**错误码:**
| 错误码 | 说明 |
|--------|------|
| 10000 | 成功 |
| 10001 | 今天已签到 |
| 10403 | 请先登录（Cookie 失效/缺失） |

#### [GET] `/api/home/sign/mySignLog`
**描述:** 查询当月签到记录/天数（用于展示与领奖判定）。

#### [GET] `/api/home/sign/signRewardList`
**描述:** 查询当月签到档位奖励列表与领取状态。

#### [POST] `/api/home/sign/getSignReward`
**描述:** 领取当月签到档位奖励。

**说明:**
- 本项目在开启 `FF14RS_AUTO_CLAIM=true` 后，会先查询 `mySignLog`（本月签到天数）与 `signRewardList`（档位奖励与领取状态）。
- 当“本月已签到天数 >= 档位要求”且该档位未领取时，会自动调用本接口领取（失败会在日志/推送中提示）。

---

### 盛趣游戏商城（qu.sdo.com）积分签到

> 说明：接口域名为 `https://sqmallservice.u.sdo.com/api/`，请求需携带 Cookie，且需要附带 `qu-merchant-id` 等自定义 header（本项目已在脚本中自动补齐，无需用户手动提供）。

#### [GET] `/api/us/checkIn/getStatus`
**描述:** 查询当日是否已签到与最近签到记录。

**请求参数:**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| merchantId | number | 是 | merchantId（默认 1） |

#### [PUT] `/api/us/integration/checkIn`
**描述:** 执行每日签到。

**请求体:**
`application/x-www-form-urlencoded`
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| merchantId | number | 是 | merchantId（默认 1） |

**常见返回:**
| resultCode | 说明 |
|-----------:|------|
| 0 | 成功 |
| -10362346 | 今日已签到 |
| -10350174 | 未登录（Cookie 失效/缺失，可能） |

#### [GET] `/api/rs/member/integral/balance`
**描述:** 查询积分余额（用于展示签到前后变化）。
