import { Buffer } from 'node:buffer'
import http from 'node:http'
import process from 'node:process'
import { URL } from 'node:url'

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      }
      catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data)
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(body)
}

function splitTargets(input) {
  if (!input)
    return []
  return String(input)
    .split(/[,\r\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function splitTokens(input) {
  return splitTargets(input)
}

function parseTokenQqMap(input) {
  const map = new Map()
  if (!input)
    return map

  const lines = String(input)
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)

  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0)
      continue
    const token = line.slice(0, idx).trim()
    const targets = splitTargets(line.slice(idx + 1))
    if (token && targets.length > 0)
      map.set(token, targets)
  }

  return map
}

async function sendPrivateMessage(onebotBaseUrl, onebotAccessToken, sendPath, userId, message) {
  const url = new URL(sendPath, onebotBaseUrl)

  const headers = {
    'content-type': 'application/json',
  }
  if (onebotAccessToken) {
    headers.authorization = `Bearer ${onebotAccessToken}`
    // 兼容部分 OneBot v11 实现使用 access-token 头
    headers['access-token'] = onebotAccessToken
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: Number(userId),
      message,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OneBot HTTP ${res.status} ${res.statusText} ${text.slice(0, 200)}`)
  }

  return await res.json().catch(() => ({}))
}

async function main() {
  const host = process.env.HOST || '0.0.0.0'
  const port = Number(process.env.PORT || '8787')

  const notifyToken = process.env.NOTIFY_TOKEN || ''
  const notifyTokens = splitTokens(process.env.NOTIFY_TOKENS || '')
  const tokenQqMap = parseTokenQqMap(process.env.TOKEN_QQ_MAP || '')
  const onebotBaseUrl = process.env.ONEBOT_BASE_URL || ''
  const onebotAccessToken = process.env.ONEBOT_ACCESS_TOKEN || ''
  const sendPath = process.env.ONEBOT_SEND_PRIVATE_MSG_PATH || '/send_private_msg'

  const defaultTargets = splitTargets(process.env.TARGET_QQ || process.env.TARGET_QQS || '')
  const webhookPath = process.env.WEBHOOK_PATH || '/ff14rs/webhook'

  const allowedTokens = notifyTokens.length > 0 ? notifyTokens : (notifyToken ? [notifyToken] : [])
  if (allowedTokens.length === 0)
    throw new Error('NOTIFY_TOKEN or NOTIFY_TOKENS is required')
  if (!onebotBaseUrl)
    throw new Error('ONEBOT_BASE_URL is required')
  if (!Number.isFinite(port) || port <= 0)
    throw new Error('PORT is invalid')

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

      if (req.method === 'GET' && url.pathname === '/healthz') {
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.method !== 'POST' || url.pathname !== webhookPath) {
        sendJson(res, 404, { ok: false, error: 'not_found' })
        return
      }

      const token = String(req.headers['x-notify-token'] || '')
      if (!allowedTokens.includes(token)) {
        sendJson(res, 401, { ok: false, error: 'unauthorized' })
        return
      }

      const payload = await readJson(req)
      const title = typeof payload.title === 'string' ? payload.title : '通知'
      const body = typeof payload.body === 'string' ? payload.body : ''

      const message = body ? `${title}\n\n${body}` : title

      const mappedTargets = tokenQqMap.get(token) || []
      const targetsFromPayload = splitTargets(payload.qq || payload.targets || payload.target || '')
      const targetsFromQuery = splitTargets(
        url.searchParams.get('qq')
        || url.searchParams.get('targets')
        || url.searchParams.get('target')
        || '',
      )
      const targetsFromHeader = splitTargets(
        req.headers['x-notify-qq']
        || req.headers['x-notify-qqs']
        || '',
      )

      const finalTargets = mappedTargets.length > 0
        ? mappedTargets
        : (targetsFromPayload.length > 0
            ? targetsFromPayload
            : (targetsFromQuery.length > 0 ? targetsFromQuery : (targetsFromHeader.length > 0 ? targetsFromHeader : defaultTargets)))

      if (finalTargets.length === 0) {
        sendJson(res, 400, { ok: false, error: 'no_targets' })
        return
      }

      const results = []
      for (const userId of finalTargets) {
        const r = await sendPrivateMessage(onebotBaseUrl, onebotAccessToken, sendPath, userId, message)
        results.push({ userId, result: r })
      }

      sendJson(res, 200, { ok: true, sent: results.length })
    }
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      sendJson(res, 500, { ok: false, error: msg })
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })

  console.log(`qqbot-webhook listening on http://${host}:${port}${webhookPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
