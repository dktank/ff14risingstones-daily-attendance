# utils

## 目的
封装 HTTP 请求、重试、结果格式化与通知汇总，降低 tasks 的复杂度。

## 模块概述
- **职责:** 调用 `sign/signIn` 等接口；解析 code/msg；构建通知内容；避免敏感信息泄露
- **状态:** ✅稳定
- **最后更新:** 2026-02-13

## 规范

### 需求: 安全处理 Cookie
**模块:** utils
Cookie 仅作为请求认证材料使用，不写入日志与通知内容。

#### 场景: 生成账号标识
对 Cookie 做 SHA256 得到短标识用于日志输出。
- 预期结果: 不泄露 Cookie 原文

## 相关文件
- `utils/ff14risingstones/client.ts`
- `utils/message.ts`
