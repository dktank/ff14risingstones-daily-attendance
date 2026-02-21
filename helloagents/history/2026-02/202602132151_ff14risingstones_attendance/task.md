# 任务清单: FF14 石之家每日签到（多账号 + 推送）

目录: `helloagents/history/2026-02/202602132151_ff14risingstones_attendance/`

---

## 1. 项目骨架
- [√] 1.1 初始化 Nitro + TypeScript 项目结构（参考 `D:\\skland-daily-attendance`），验证 why.md#需求-多账号每日签到-场景-github-actions-定时执行
- [√] 1.2 添加环境变量解析（支持逗号/换行分隔 Cookie），验证 why.md#需求-多账号每日签到-场景-cookie-失效

## 2. HTTP 客户端（石之家）
- [√] 2.1 在 `utils/ff14risingstones/client.ts` 中实现 `signIn(cookie)`，验证 why.md#需求-多账号每日签到-场景-github-actions-定时执行
- [√] 2.2 在 `utils/ff14risingstones/client.ts` 中实现 `mySignLog(cookie, month)` / `signRewardList(cookie, month)` / `getSignReward(cookie, id, month)`，验证 why.md#变更内容

## 3. 任务实现
- [√] 3.1 在 `tasks/attendance.ts` 中实现多账号循环、错误码映射与摘要统计，验证 why.md#需求-多账号每日签到-场景-github-actions-定时执行
- [√] 3.2 集成通知推送（statocysts），验证 why.md#需求-结果推送通知-场景-成功部分失败
- [√] 3.3 可选实现自动领奖（默认关闭），验证 why.md#变更内容

## 4. CI 与使用文档
- [√] 4.1 添加 GitHub Actions 工作流（schedule + workflow_dispatch），验证 why.md#需求-多账号每日签到-场景-github-actions-定时执行
- [√] 4.2 编写 README（Cookie 获取/配置/通知渠道/常见错误码），验证 why.md#需求-多账号每日签到-场景-cookie-失效

## 5. 安全检查
- [√] 5.1 执行安全检查（按G9: 不落地 Cookie、Secrets 使用、避免敏感日志），并在实现中落实

## 6. 知识库同步
- [√] 6.1 在开发实施完成后同步更新 `helloagents/wiki/*` 与 `helloagents/CHANGELOG.md`
