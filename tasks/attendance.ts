import type { Storage } from 'unstorage'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { defineTask } from 'nitro/task'
import {
  createMessageCollector,
  generateAttendanceKey,
  getShanghaiMonth,
  getSignReward,
  mySignLog,
  retry,
  shortHash,
  signIn,
  signRewardList,
  splitByCommaOrNewline,
  splitCookies,
} from '~/utils/index'

interface AccountStats {
  total: number
  successful: number
  skipped: number
  failed: number
  failedIndexes: number[]
}

interface ExecutionStats {
  accounts: AccountStats
}

function asBool(value: string | undefined, defaultValue = false) {
  if (!value)
    return defaultValue
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

async function processAccount(
  cookie: string,
  accountNumber: number,
  totalAccounts: number,
  storage: Storage,
  maxRetries: number,
  requestTimeoutMs: number,
  autoClaim: boolean,
  messageCollector: ReturnType<typeof createMessageCollector>,
): Promise<{ accountHasError: boolean, didWork: boolean }> {
  const attendanceKey = await generateAttendanceKey(cookie)
  const hasAttended = await storage.getItem(attendanceKey)

  messageCollector.notify(`\n--- 账号 ${accountNumber}/${totalAccounts} ---`)
  const accountId = await shortHash(cookie, 8)

  if (hasAttended) {
    messageCollector.info(`已处理过（账号ID: ${accountId}），跳过`)
    messageCollector.brief(`[石之家] 账号${accountNumber}: 跳过（已处理）`)
    return { accountHasError: false, didWork: false }
  }

  messageCollector.info(`开始处理（账号ID: ${accountId}）...`)

  let signOk = false
  let accountHasError = false
  let shouldPersist = false
  let signStatusText = '未知'
  let claimAttempted = false
  let claimSuccessCount = 0
  let claimFailCount = 0

  try {
    const res = await retry(async () => {
      const result = await signIn(cookie, requestTimeoutMs)
      // 10301: 操作太快，请稍后再试（常见于多账号连续请求）
      if (result && result.code === 10301)
        throw new Error(result.msg || '操作太快，请稍后再试')
      return result
    }, {
      retries: maxRetries,
      delay: 1800,
      onRetry: (retriesLeft) => {
        messageCollector.log(`请求失败，剩余重试次数: ${retriesLeft}`)
      },
    })

    if (res.code === 10000) {
      signOk = true
      shouldPersist = true
      signStatusText = '签到成功'
      const data = Array.isArray(res.data) ? null : res.data
      if (data) {
        messageCollector.info(
          `签到成功：${data.sqMsg}（连签${data.continuousDays}天 / 本月${data.totalDays}天，社区经验+${data.sqExp}，商城积分+${data.shopExp}）`,
        )
      }
      else {
        messageCollector.info('签到成功')
      }
    }
    else if (res.code === 10001) {
      signOk = true
      shouldPersist = true
      signStatusText = '今日已签到'
      messageCollector.info(`今天已签到：${res.msg}`)
    }
    else if (res.code === 10403) {
      signStatusText = '失败（需要登录）'
      messageCollector.infoError(`需要登录（Cookie 失效/缺失）：${res.msg}`)
      accountHasError = true
    }
    else {
      signStatusText = `失败（${res.code}）`
      messageCollector.infoError(`签到失败：${res.code} ${res.msg}`)
      accountHasError = true
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    signStatusText = '失败（请求异常）'
    messageCollector.infoError(`请求异常：${errorMessage}`)
    accountHasError = true
  }

  if (signOk && autoClaim) {
    const month = getShanghaiMonth()
    try {
      const [logRes, rewardRes] = await Promise.all([
        mySignLog(cookie, month, requestTimeoutMs),
        signRewardList(cookie, month, requestTimeoutMs),
      ])

      if (logRes.code !== 10000) {
        messageCollector.infoError(`获取签到记录失败：${logRes.code} ${logRes.msg}`)
        accountHasError = true
        shouldPersist = false
      }
      else if (rewardRes.code !== 10000) {
        messageCollector.infoError(`获取奖励列表失败：${rewardRes.code} ${rewardRes.msg}`)
        accountHasError = true
        shouldPersist = false
      }
      else {
        const signedCount = logRes.data.count
        const claimable = rewardRes.data
          .filter(r => signedCount >= r.rule && r.is_get !== 1)
          .sort((a, b) => a.rule - b.rule)

        if (claimable.length === 0) {
          messageCollector.info(`自动领奖：本月已签到${signedCount}天，无可领取档位奖励`)
        }
        else {
          claimAttempted = true
          messageCollector.info(`自动领奖：本月已签到${signedCount}天，准备领取${claimable.length}项奖励`)
          for (const reward of claimable) {
            const claim = await getSignReward(cookie, month, reward.id, requestTimeoutMs)
            if (claim.code === 10000) {
              claimSuccessCount++
              messageCollector.info(`奖励领取成功：${reward.item_name}（${reward.rule}天档）`)
            }
            else {
              claimFailCount++
              messageCollector.infoError(`奖励领取失败：${reward.item_name}（${reward.rule}天档）- ${claim.code} ${claim.msg}`)
              accountHasError = true
              shouldPersist = false
            }
          }
        }
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      messageCollector.infoError(`自动领奖异常：${errorMessage}`)
      accountHasError = true
      shouldPersist = false
    }
  }

  if (!accountHasError && shouldPersist) {
    await storage.setItem(attendanceKey, true)
  }

  {
    const claimSuffix = claimAttempted
      ? `；档位奖励：成功${claimSuccessCount} 失败${claimFailCount}`
      : ''
    const line = `[石之家] 账号${accountNumber}: ${signStatusText}${claimSuffix}`
    if (accountHasError)
      messageCollector.briefError(line)
    else
      messageCollector.brief(line)
  }

  return { accountHasError, didWork: true }
}

export default defineTask<'success' | 'failed'>({
  meta: {
    name: 'attendance',
    description: 'FF14 石之家每日签到',
  },
  async run() {
    const config = useRuntimeConfig()

    const cookies = splitCookies(config.cookies)
    const notificationUrls = splitByCommaOrNewline(config.notificationUrls)
    const maxRetries = Number(config.maxRetries || '3')
    const requestTimeoutMs = Number(config.requestTimeoutMs || '20000')
    const autoClaim = asBool(config.autoClaim, true)

    const messageCollector = createMessageCollector({
      notificationUrls,
    })

    if (cookies.length === 0) {
      messageCollector.log('未配置任何账号 Cookie，跳过签到任务')
      return { result: 'success' }
    }

    const storage = useStorage()

    messageCollector.notify('## FF14 石之家每日签到')
    messageCollector.notify(`- 自动领奖: ${autoClaim ? '开启' : '关闭'}`)

    const stats: ExecutionStats = {
      accounts: {
        total: cookies.length,
        successful: 0,
        skipped: 0,
        failed: 0,
        failedIndexes: [],
      },
    }

    let hasFailed = false
    let didAnyWork = false

    for (const [index, cookie] of cookies.entries()) {
      const accountNumber = index + 1
      try {
        const { accountHasError, didWork } = await processAccount(
          cookie,
          accountNumber,
          cookies.length,
          storage,
          maxRetries,
          requestTimeoutMs,
          autoClaim,
          messageCollector,
        )

        if (didWork)
          didAnyWork = true
        else
          stats.accounts.skipped++

        if (accountHasError) {
          hasFailed = true
          stats.accounts.failed++
          stats.accounts.failedIndexes.push(accountNumber)
        }
        else {
          stats.accounts.successful++
        }
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        messageCollector.notify(`\n--- 账号 ${accountNumber}/${cookies.length} ---`)
        messageCollector.infoError(`处理失败: ${errorMessage}`)
        messageCollector.briefError(`[石之家] 账号${accountNumber}: 失败（处理异常）`)
        hasFailed = true
        didAnyWork = true
        stats.accounts.failed++
        stats.accounts.failedIndexes.push(accountNumber)
      }
    }

    messageCollector.brief('---- 汇总 ----')
    messageCollector.brief(
      `[石之家] 总${stats.accounts.total} 成功${stats.accounts.successful} 跳过${stats.accounts.skipped} 失败${stats.accounts.failed}`,
    )

    messageCollector.notify('\n========== 执行摘要 ==========')
    messageCollector.notify('账号统计:')
    messageCollector.notify(`  • 总数: ${stats.accounts.total}`)
    messageCollector.notify(`  • 成功: ${stats.accounts.successful}`)
    messageCollector.notify(`  • 跳过: ${stats.accounts.skipped}`)
    if (stats.accounts.failed > 0) {
      messageCollector.notifyError(
        `  • 失败: ${stats.accounts.failed} (账号 #${stats.accounts.failedIndexes.join(', #')})`,
      )
    }

    if ((didAnyWork || stats.accounts.failed > 0) && (stats.accounts.successful > 0 || stats.accounts.failed > 0)) {
      await messageCollector.push()
    }

    return { result: hasFailed ? 'failed' : 'success' }
  },
})
