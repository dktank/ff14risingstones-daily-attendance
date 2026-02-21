# 轻量迭代：自动领奖说明与稳定领取顺序

## 目标
- 明确支持“可领则自动领取签到档位奖励”（需要显式开启）。
- 领取多个档位奖励时按档位天数排序，保证行为稳定可预期。

## 任务清单
- [√] `tasks/attendance.ts`：领奖列表按 `rule` 升序排序后依次领取
- [√] `scripts/run-attendance.mjs`：领奖列表按 `rule` 升序排序后依次领取
- [√] `README.md`：补充 `FF14RS_AUTO_CLAIM` 说明与常见问题
- [√] `helloagents/wiki/api.md`：补充自动领奖触发机制说明
- [√] 本地语法检查与无 Cookie 执行校验
