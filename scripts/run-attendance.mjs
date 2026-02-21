import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createSender } from 'statocysts'

const BASE_URL = 'https://apiff14risingstones.web.sdo.com/api/home/'
const ORIGIN = 'https://ff14risingstones.web.sdo.com'
const REFERER = 'https://ff14risingstones.web.sdo.com/'

const QU_BASE_URL = 'https://sqmallservice.u.sdo.com/api/'
const QU_ORIGIN = 'https://qu.sdo.com'
const QU_REFERER = 'https://qu.sdo.com/'
const QU_WEB_HOST = 'qu.sdo.com'

function normalizeMultiline(value) {
  if (!value)
    return ''

  return String(value)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
}

function stripWrappingQuotes(value) {
  const s = String(value || '').trim()
  if (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    if ((first === '\'' && last === '\'') || (first === '"' && last === '"'))
      return s.slice(1, -1).trim()
  }
  return s
}

function splitByCommaOrNewline(value) {
  const s = normalizeMultiline(value)
  if (!s)
    return []

  return s
    .split(/\r?\n|,/g)
    .map(s => s.trim())
    .filter(Boolean)
}

function normalizeCookieSeparators(value) {
  return String(value || '')
    .replace(/\r?\n+/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCookieInput(value) {
  const raw = stripWrappingQuotes(normalizeMultiline(value))
  if (!raw)
    return ''

  const lines = raw.split(/\r?\n/)

  const startsWithCookieHeader = (line) => {
    const s = String(line || '').trimStart()
    if (s.length < 7)
      return false
    if (s.slice(0, 6).toLowerCase() !== 'cookie')
      return false
    let i = 6
    while (i < s.length && /\s/.test(s[i]))
      i++
    return s[i] === ':'
  }

  const extractCookieValueFromHeaderLine = (line) => {
    const s = String(line || '').trimStart()
    let i = 6
    while (i < s.length && /\s/.test(s[i]))
      i++
    // s[i] is ':'
    return s.slice(i + 1).trim()
  }

  const looksLikeHeaderLine = (line) => {
    const s = String(line || '').trimStart()
    return /^[a-z0-9-]+\s*:/i.test(s) || /^:[a-z0-9-]+\s*:/i.test(s)
  }

  const cookieHeaderIndex = lines.findIndex(startsWithCookieHeader)

  let cookieValue = ''
  if (cookieHeaderIndex >= 0) {
    const parts = []
    const first = extractCookieValueFromHeaderLine(lines[cookieHeaderIndex])
    if (first)
      parts.push(first)

    // DevTools 有时会把超长 cookie 在展示/复制时折行，后续行不再带 "cookie:"，但仍属于 cookie 值
    for (let i = cookieHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line)
        continue
      if (looksLikeHeaderLine(line))
        break
      const trimmed = String(line).trim()
      if (trimmed)
        parts.push(trimmed)
    }

    // 这里不能用空格拼接，否则可能破坏签名/编码值（例如 s%3A... 的签名 cookie）
    cookieValue = parts.join('').trim()
  }

  const picked = cookieValue || raw

  // 兼容把 cookies 按行粘贴（每行一个 name=value）
  const nonEmptyLines = String(picked).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  const allLookLikePairs = nonEmptyLines.length > 1
    && nonEmptyLines.every(s => /^[^=\s;]+=.*/.test(s))

  if (allLookLikePairs)
    return normalizeCookieSeparators(nonEmptyLines.join('; '))

  return normalizeCookieSeparators(picked)
}

function splitCookies(value) {
  const raw = stripWrappingQuotes(normalizeMultiline(value))
  if (!raw)
    return []

  const lines = raw.split(/\r?\n/)
  const hasCookieHeader = lines.some((line) => {
    const s = String(line || '').trimStart()
    if (s.length < 7)
      return false
    if (s.slice(0, 6).toLowerCase() !== 'cookie')
      return false
    let i = 6
    while (i < s.length && /\s/.test(s[i]))
      i++
    return s[i] === ':'
  })

  // 如果粘贴的是完整 Request Headers（含 cookie:），不要先按换行拆分账号
  if (hasCookieHeader) {
    const normalized = normalizeCookieInput(raw)
    return normalized ? [normalized] : []
  }

  // 多账号：支持换行或逗号分隔（每段再做一次 cookie 归一化）
  return raw
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .split(/\r?\n|,/g)
    .map(s => normalizeCookieInput(s))
    .filter(Boolean)
}

function asBool(value, defaultValue = false) {
  if (!value)
    return defaultValue
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toArray(value) {
  return Array.isArray(value) ? value : [value]
}

function createMessageCollector({ notificationUrls } = {}) {
  const messages = []
  const briefMessages = []
  let hasError = false

  const log = (message) => {
    console.log(message)
  }

  const error = (message) => {
    console.error(message)
    hasError = true
  }

  const notify = (message) => {
    messages.push(message)
  }

  const notifyError = (message) => {
    messages.push(message)
    hasError = true
  }

  const info = (message) => {
    console.log(message)
    messages.push(message)
  }

  const infoError = (message) => {
    console.error(message)
    messages.push(message)
    hasError = true
  }

  const brief = (message) => {
    briefMessages.push(message)
  }

  const briefError = (message) => {
    briefMessages.push(message)
    hasError = true
  }

  const push = async (title = '【FF14 石之家每日签到】') => {
    const urls = notificationUrls ? toArray(notificationUrls) : []
    if (urls.length === 0)
      return
    const sender = createSender(urls)
    const content = briefMessages.length > 0 ? briefMessages.join('\n') : messages.join('\n\n')
    await sender.send(title, content)
  }

  return {
    log,
    error,
    notify,
    notifyError,
    info,
    infoError,
    brief,
    briefError,
    push,
    hasError: () => hasError,
  }
}

function buildUrl(url, params = {}) {
  const u = new URL(url, BASE_URL)
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  return u.toString()
}

function defaultHeaders(cookie) {
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'origin': ORIGIN,
    'referer': REFERER,
    'cookie': cookie,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  }
}

async function request(cookie, input, options = {}) {
  const tempsuid = crypto.randomUUID()
  const params = { ...(input.params || {}), tempsuid }
  const url = buildUrl(input.path, params)

  const headers = {
    ...defaultHeaders(cookie),
  }

  let body
  if (input.method === 'POST') {
    headers['content-type'] = 'application/x-www-form-urlencoded'
    const form = new URLSearchParams()
    form.set('tempsuid', tempsuid)
    Object.entries(input.data || {}).forEach(([k, v]) => form.set(k, String(v)))
    body = form.toString()
  }

  const timeoutMs = Number(options.timeoutMs || 20000)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  let res
  try {
    res = await fetch(url, {
      method: input.method,
      headers,
      body,
      signal: controller.signal,
    })
  }
  catch (error) {
    const elapsed = Date.now() - startedAt
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`请求失败（${elapsed}ms）：${message}`)
  }
  finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 200)}`)
  }

  return await res.json()
}

async function signIn(cookie, timeoutMs) {
  return await request(cookie, { path: 'sign/signIn', method: 'POST' }, { timeoutMs })
}

async function mySignLog(cookie, month, timeoutMs) {
  return await request(cookie, { path: 'sign/mySignLog', method: 'GET', params: { month } }, { timeoutMs })
}

async function signRewardList(cookie, month, timeoutMs) {
  return await request(cookie, { path: 'sign/signRewardList', method: 'GET', params: { month } }, { timeoutMs })
}

async function getSignReward(cookie, month, id, timeoutMs) {
  return await request(cookie, { path: 'sign/getSignReward', method: 'POST', data: { month, id } }, { timeoutMs })
}

function quBuildUrl(pathname, params = {}) {
  const u = new URL(pathname, QU_BASE_URL)
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  return u.toString()
}

function quDefaultHeaders(cookie, merchantId) {
  return {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'zh-CN,zh;q=0.9',
    'origin': QU_ORIGIN,
    'referer': QU_REFERER,
    'cookie': cookie,
    'qu-merchant-id': String(merchantId),
    'qu-hardware-platform': '3',
    'qu-software-platform': '1',
    'qu-deploy-platform': '1',
    'qu-web-host': QU_WEB_HOST,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  }
}

async function quRequest(cookie, input, options = {}) {
  const url = quBuildUrl(input.path, input.params || {})
  const headers = {
    ...quDefaultHeaders(cookie, input.merchantId),
    ...(input.headers || {}),
  }

  const timeoutMs = Number(options.timeoutMs || 20000)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  let res
  try {
    res = await fetch(url, {
      method: input.method,
      headers,
      body: input.body,
      signal: controller.signal,
    })
  }
  catch (error) {
    const elapsed = Date.now() - startedAt
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`请求失败（${elapsed}ms）：${message}`)
  }
  finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 200)}`)
  }

  return await res.json()
}

async function quGetCheckInStatus(cookie, merchantId, timeoutMs) {
  return await quRequest(cookie, {
    merchantId,
    method: 'GET',
    path: 'us/checkIn/getStatus',
    params: { merchantId: String(merchantId), _: String(Date.now()) },
  }, { timeoutMs })
}

async function quCheckIn(cookie, merchantId, timeoutMs) {
  const body = new URLSearchParams({ merchantId: String(merchantId) }).toString()
  return await quRequest(cookie, {
    merchantId,
    method: 'PUT',
    path: 'us/integration/checkIn',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  }, { timeoutMs })
}

async function quIntegralBalance(cookie, merchantId, timeoutMs) {
  return await quRequest(cookie, {
    merchantId,
    method: 'GET',
    path: 'rs/member/integral/balance',
    params: { merchantId: String(merchantId), _: String(Date.now()) },
  }, { timeoutMs })
}

function getShanghaiDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getShanghaiMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}

async function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function shortHash(text, length = 8) {
  const hex = await sha256Hex(text)
  return hex.slice(0, length)
}

async function generateAttendanceKey(cookie) {
  const hashHex = await sha256Hex(cookie)
  const date = getShanghaiDate()
  return `kv:attendance:${hashHex}:${date}`
}

async function generateQuAttendanceKey(cookie, merchantId) {
  const hashHex = await sha256Hex(cookie)
  const date = getShanghaiDate()
  return `kv:qu:checkin:${merchantId}:${hashHex}:${date}`
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function readJson(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  }
  catch {
    return defaultValue
  }
}

async function writeJson(filePath, value) {
  const dir = path.dirname(filePath)
  await ensureDir(dir)
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function retry(fn, { retries = 3, delay = 1200, onRetry } = {}) {
  let lastError
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error
      const retriesLeft = retries - i
      if (retriesLeft <= 0)
        break
      if (onRetry)
        onRetry(retriesLeft, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

async function main() {
  const cookies = splitCookies(process.env.FF14RS_COOKIES || '')
  const quCookies = splitCookies(process.env.FF14RS_QU_COOKIES || '')
  const quMerchantId = Number(process.env.FF14RS_QU_MERCHANT_ID || '1')
  const notificationUrls = splitByCommaOrNewline(process.env.FF14RS_NOTIFICATION_URLS || '')
  const maxRetries = Number(process.env.FF14RS_MAX_RETRIES || '3')
  const requestTimeoutMs = Number(process.env.FF14RS_REQUEST_TIMEOUT_MS || '20000')
  const autoClaim = asBool(process.env.FF14RS_AUTO_CLAIM, true)
  const failOnError = asBool(process.env.FF14RS_FAIL_ON_ERROR, true)

  const messageCollector = createMessageCollector({ notificationUrls })

  const normalizedCookies = cookies.filter(Boolean)
  const normalizedQuCookies = quCookies.filter(Boolean)

  if (normalizedCookies.length === 0 && normalizedQuCookies.length === 0) {
    messageCollector.log('未配置任何账号 Cookie，跳过签到任务')
    return { result: 'success', exitCode: 0 }
  }

  const cacheFile = process.env.FF14RS_CACHE_FILE || '.data/attendance-cache.json'
  const cache = await readJson(cacheFile, { attended: {} })
  if (!cache.attended || typeof cache.attended !== 'object')
    cache.attended = {}

  const stats = {
    risingstones: {
      total: normalizedCookies.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      failedIndexes: [],
    },
    qu: {
      total: normalizedQuCookies.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      failedIndexes: [],
    },
  }

  let hasFailed = false
  let didAnyWork = false

  if (normalizedCookies.length > 0) {
    messageCollector.notify('## FF14 石之家每日签到')
    messageCollector.notify(`- 自动领奖: ${autoClaim ? '开启' : '关闭'}`)

    for (const [index, cookie] of normalizedCookies.entries()) {
      const accountNumber = index + 1
      const attendanceKey = await generateAttendanceKey(cookie)
      const accountId = await shortHash(cookie, 8)

      messageCollector.notify(`\n--- 账号 ${accountNumber}/${normalizedCookies.length} ---`)

      if (cache.attended[attendanceKey]) {
        messageCollector.info(`已处理过（账号ID: ${accountId}），跳过`)
        stats.risingstones.skipped++
        messageCollector.brief(`[石之家] 账号${accountNumber}: 跳过（已处理）`)
        continue
      }

      didAnyWork = true
      messageCollector.info(`开始处理（账号ID: ${accountId}）...`)

      let signOk = false
      let accountHasError = false
      let shouldPersist = false
      let signStatusText = '未知'
      let claimSuccessCount = 0
      let claimFailCount = 0
      let claimAttempted = false

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
        cache.attended[attendanceKey] = true
        await writeJson(cacheFile, cache)
      }

      if (accountHasError) {
        hasFailed = true
        stats.risingstones.failed++
        stats.risingstones.failedIndexes.push(accountNumber)
      }
      else {
        stats.risingstones.successful++
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

      // 降低触发“操作太快”的概率
      await sleep(500)
    }
  }

  if (normalizedQuCookies.length > 0) {
    messageCollector.notify('\n## 盛趣游戏商城积分签到（qu.sdo.com）')
    messageCollector.notify(`- merchantId: ${Number.isFinite(quMerchantId) ? quMerchantId : 1}`)

    const merchantId = Number.isFinite(quMerchantId) ? quMerchantId : 1

    for (const [index, cookie] of normalizedQuCookies.entries()) {
      const accountNumber = index + 1
      const attendanceKey = await generateQuAttendanceKey(cookie, merchantId)
      const accountId = await shortHash(cookie, 8)

      messageCollector.notify(`\n--- 账号 ${accountNumber}/${normalizedQuCookies.length} ---`)

      if (cache.attended[attendanceKey]) {
        messageCollector.info(`已处理过（账号ID: ${accountId}），跳过`)
        stats.qu.skipped++
        messageCollector.brief(`[盛趣商城] 账号${accountNumber}: 跳过（已处理）`)
        continue
      }

      didAnyWork = true
      messageCollector.info(`开始处理（账号ID: ${accountId}）...`)

      let accountHasError = false
      let shouldPersist = false
      let statusText = '未知'

      let balanceBefore
      try {
        const balanceRes = await quIntegralBalance(cookie, merchantId, requestTimeoutMs)
        if (balanceRes && balanceRes.resultCode === 0 && balanceRes.data && typeof balanceRes.data.balance === 'number')
          balanceBefore = balanceRes.data.balance
      }
      catch {
        // ignore
      }

      let statusRes
      try {
        statusRes = await quGetCheckInStatus(cookie, merchantId, requestTimeoutMs)
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        statusText = '失败（获取状态异常）'
        messageCollector.infoError(`获取签到状态失败：${errorMessage}`)
        accountHasError = true
      }

      const isCheckIn = statusRes && statusRes.resultCode === 0 && statusRes.data ? statusRes.data.isCheckIn : null

      if (!accountHasError && isCheckIn === 1) {
        shouldPersist = true
        statusText = '今日已签到'
        messageCollector.info('今天已签到：状态已为已签到')
      }
      else if (!accountHasError) {
        try {
          const res = await retry(() => quCheckIn(cookie, merchantId, requestTimeoutMs), {
            retries: maxRetries,
            delay: 1200,
            onRetry: (retriesLeft) => {
              messageCollector.log(`请求失败，剩余重试次数: ${retriesLeft}`)
            },
          })

          if (res.resultCode === 0) {
            shouldPersist = true
            statusText = '签到成功'
            messageCollector.info('签到成功')
          }
          else if (res.resultCode === -10362346) {
            shouldPersist = true
            statusText = '今日已签到'
            messageCollector.info(`今天已签到：${res.resultMsg}`)
          }
          else if (res.resultCode === -10350174) {
            statusText = '失败（需要登录）'
            messageCollector.infoError(`需要登录（Cookie 失效/缺失）：${res.resultMsg}`)
            accountHasError = true
          }
          else {
            statusText = `失败（${res.resultCode}）`
            messageCollector.infoError(`签到失败：${res.resultCode} ${res.resultMsg}`)
            accountHasError = true
          }
        }
        catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          statusText = '失败（请求异常）'
          messageCollector.infoError(`请求异常：${errorMessage}`)
          accountHasError = true
        }
      }

      let balanceAfter
      try {
        const balanceRes = await quIntegralBalance(cookie, merchantId, requestTimeoutMs)
        if (balanceRes && balanceRes.resultCode === 0 && balanceRes.data && typeof balanceRes.data.balance === 'number')
          balanceAfter = balanceRes.data.balance
      }
      catch {
        // ignore
      }

      if (typeof balanceBefore === 'number' || typeof balanceAfter === 'number') {
        const beforeText = typeof balanceBefore === 'number' ? String(balanceBefore) : '未知'
        const afterText = typeof balanceAfter === 'number' ? String(balanceAfter) : '未知'
        const delta = typeof balanceBefore === 'number' && typeof balanceAfter === 'number' ? (balanceAfter - balanceBefore) : null
        if (typeof delta === 'number')
          messageCollector.info(`积分余额：${beforeText} → ${afterText}（+${delta}）`)
        else
          messageCollector.info(`积分余额：${afterText}`)
      }

      if (!accountHasError && shouldPersist) {
        cache.attended[attendanceKey] = true
        await writeJson(cacheFile, cache)
      }

      if (accountHasError) {
        hasFailed = true
        stats.qu.failed++
        stats.qu.failedIndexes.push(accountNumber)
      }
      else {
        stats.qu.successful++
      }

      {
        const line = `[盛趣商城] 账号${accountNumber}: ${statusText}`
        if (accountHasError)
          messageCollector.briefError(line)
        else
          messageCollector.brief(line)
      }

      await sleep(500)
    }
  }

  messageCollector.brief('---- 汇总 ----')
  if (normalizedCookies.length > 0) {
    messageCollector.brief(
      `[石之家] 总${stats.risingstones.total} 成功${stats.risingstones.successful} 跳过${stats.risingstones.skipped} 失败${stats.risingstones.failed}`,
    )
  }
  if (normalizedQuCookies.length > 0) {
    messageCollector.brief(
      `[盛趣商城] 总${stats.qu.total} 成功${stats.qu.successful} 跳过${stats.qu.skipped} 失败${stats.qu.failed}`,
    )
  }

  const totalSuccessful = stats.risingstones.successful + stats.qu.successful
  const totalFailed = stats.risingstones.failed + stats.qu.failed
  const totalSkipped = stats.risingstones.skipped + stats.qu.skipped

  messageCollector.brief(`[全部] 成功${totalSuccessful} 跳过${totalSkipped} 失败${totalFailed}`)

  if ((didAnyWork || totalFailed > 0) && (totalSuccessful > 0 || totalFailed > 0 || totalSkipped > 0))
    await messageCollector.push()

  const exitCode = hasFailed && failOnError ? 1 : 0
  return { result: hasFailed ? 'failed' : 'success', exitCode }
}

main()
  .then(({ exitCode }) => process.exit(exitCode))
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`执行失败：${message}`)
    process.exit(1)
  })
