# Changelog

本文件记录项目所有重要变更。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 增加盛趣游戏商城（qu.sdo.com）积分签到（可选启用，支持多账号与推送）。

### 修复
- GitHub Actions 改为使用直跑脚本执行签到，避免 Nitro dev 在 CI 环境中出现“端口已监听但 HTTP 不响应”导致超时。
- 调整 Actions 依赖版本与 Node 版本（22）以提高执行稳定性。
- Cookie 解析增强：支持直接粘贴整段 Request Headers，自动抽取 `cookie:` 行并兼容 DevTools 折行（避免把折行误当作多账号拆分、或拼接时插入空格导致签名失效）。

### 变更
- 自动领奖逻辑按档位天数排序领取，并补充使用说明。
- `FF14RS_AUTO_CLAIM` 默认值调整为启用，并完整重写 README。
- 多账号请求加入节流与“操作太快(10301)”重试；新增 `FF14RS_FAIL_ON_ERROR` 控制工作流失败策略（默认失败）。

## [0.1.0] - 2026-02-13

### 新增
- 初始化 Nitro + TypeScript 项目骨架与定时任务框架。
- 增加石之家签到 HTTP 客户端（签到/查询/领奖）。
- 增加多账号 Cookie 支持与推送通知（statocysts）。
- 增加 GitHub Actions 定时执行工作流与使用文档。
