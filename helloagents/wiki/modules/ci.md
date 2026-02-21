# ci

## 目的
维护 GitHub Actions 工作流，提供定时签到与手动触发能力。

## 模块概述
- **职责:** `schedule` + `workflow_dispatch` 触发；注入 Secrets；运行 Node 直跑脚本执行签到与通知推送
- **状态:** ✅稳定
- **最后更新:** 2026-02-13

## 规范

### 需求: Secrets 管理
**模块:** ci
使用 GitHub Secrets 保存 Cookie 与推送 URL，禁止在仓库明文存储。

#### 场景: 多账号 Cookie
- 预期结果: 支持逗号或换行分隔的多账号 Cookie

#### 场景: 双站点签到（可选）
- `FF14RS_COOKIES`: 石之家签到 Cookie（必填）
- `FF14RS_QU_COOKIES`: 盛趣商城积分签到 Cookie（可选）
- `FF14RS_QU_MERCHANT_ID`: 盛趣商城 merchantId（可选，默认 1）

## 相关文件
- `.github/workflows/schedule.yml`
- `scripts/run-attendance.mjs`
