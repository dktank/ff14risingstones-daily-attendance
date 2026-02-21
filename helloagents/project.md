# 项目技术约定

## 技术栈
- **核心:** Node.js（建议 22+）/ TypeScript / Nitro

## 开发约定
- **包管理器:** pnpm
- **代码规范:** ESLint（可选，后续补齐）
- **命名约定:** camelCase / PascalCase
- **Windows 注意:** 若项目所在磁盘为 exFAT（不支持 symlink），需使用 `node-linker=hoisted`（本仓库已在 `.npmrc` 固化）。

## 错误与日志
- **策略:** 对外输出简明错误信息；内部保留原始错误用于排查。
- **日志:** 以“账号维度”的摘要日志为主，避免输出 Cookie 等敏感信息。

## 测试与流程
- **测试:** 以 GitHub Actions 运行结果与手动验证为准（后续可补充轻量测试）。
- **提交:** 遵循 Conventional Commits（可选）。
