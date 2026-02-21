# 轻量迭代：修复 GitHub Actions 执行超时

## 目标
- 解决 CI 环境中 Nitro dev “端口已监听但 HTTP 不响应”导致签到任务超时的问题。
- 保持多账号与推送能力不变。

## 任务清单
- [√] 复现并定位 Actions 失败日志（GET / 与 task endpoint 超时）
- [√] 新增直跑签到脚本（不依赖本地 HTTP 服务）
- [√] 更新 `package.json` 脚本与 GitHub Actions workflow
- [√] 更新 README（本地运行/PowerShell）与知识库（CHANGELOG/wiki/project）
- [√] 本地验证（无 Cookie 时可正常退出）
