import type { ApiResponse, MySignLogData, SignInData, SignReward } from './types'

const BASE_URL = 'https://apiff14risingstones.web.sdo.com/api/home/'
const ORIGIN = 'https://ff14risingstones.web.sdo.com'
const REFERER = 'https://ff14risingstones.web.sdo.com/'

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, BASE_URL)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

function defaultHeaders(cookie: string): HeadersInit {
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'origin': ORIGIN,
    'referer': REFERER,
    cookie,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  }
}

async function request<T>(cookie: string, input: {
  path: string
  method: 'GET' | 'POST'
  params?: Record<string, string>
  data?: Record<string, string | number>
}, options: {
  timeoutMs?: number
} = {}): Promise<ApiResponse<T>> {
  const tempsuid = crypto.randomUUID()
  const params = { ...(input.params || {}), tempsuid }
  const url = buildUrl(input.path, params)

  const headers: Record<string, string> = {
    ...defaultHeaders(cookie),
  } as Record<string, string>

  let body: string | undefined
  if (input.method === 'POST') {
    headers['content-type'] = 'application/x-www-form-urlencoded'
    const form = new URLSearchParams()
    form.set('tempsuid', tempsuid)
    Object.entries(input.data || {}).forEach(([k, v]) => form.set(k, String(v)))
    body = form.toString()
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 20000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  let res: Response
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

export async function signIn(cookie: string, timeoutMs?: number): Promise<ApiResponse<SignInData | []>> {
  return await request(cookie, { path: 'sign/signIn', method: 'POST' }, { timeoutMs })
}

export async function mySignLog(cookie: string, month: string, timeoutMs?: number): Promise<ApiResponse<MySignLogData>> {
  return await request(cookie, { path: 'sign/mySignLog', method: 'GET', params: { month } }, { timeoutMs })
}

export async function signRewardList(cookie: string, month: string, timeoutMs?: number): Promise<ApiResponse<SignReward[]>> {
  return await request(cookie, { path: 'sign/signRewardList', method: 'GET', params: { month } }, { timeoutMs })
}

export async function getSignReward(cookie: string, month: string, id: number, timeoutMs?: number): Promise<ApiResponse<unknown>> {
  return await request(cookie, { path: 'sign/getSignReward', method: 'POST', data: { month, id } }, { timeoutMs })
}
