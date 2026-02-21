import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import http from 'node:http'
import process from 'node:process'
import * as core from '@actions/core'
import waitOn from 'wait-on'

const PORT = process.env.NITRO_PORT || 3000
// 避免部分环境 localhost 解析到 IPv6 导致连接异常
const HOST = process.env.NITRO_HOST || '127.0.0.1'
const BASE_URL = `http://${HOST}:${PORT}`
const WAIT_ON_RESOURCE = `tcp:${HOST}:${PORT}`

core.info('🚀 准备执行签到任务...')

function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: `${u.pathname}${u.search}`,
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })

    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)))
    req.end()
  })
}

let server

function killServer() {
  return new Promise((resolve) => {
    if (!server) {
      resolve()
      return
    }

    const timeout = setTimeout(() => {
      core.warning('⚠️  强制终止服务...')
      server.kill('SIGKILL')
    }, 3000)

    server.on('exit', (code) => {
      clearTimeout(timeout)
      core.info(`🛑 服务已停止 (退出码: ${code})`)
      resolve()
    })

    core.info('🛑 停止服务...')
    server.kill('SIGTERM')
  })
}

let exitCode = 0

try {
  core.info('🚀 启动 Nitro 开发服务...')
  server = spawn('node', [
    'node_modules/nitro/dist/cli/index.mjs',
    'dev',
    '--host',
    String(HOST),
    '--port',
    String(PORT),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NITRO_PORT: String(PORT),
      NITRO_HOST: String(HOST),
    },
  })

  server.on('error', (error) => {
    core.error(`❌ 启动服务失败: ${error.message}`)
    exitCode = 1
  })

  await core.group('等待服务启动', async () => {
    core.info(`服务地址: ${BASE_URL}`)
    core.info('超时时间: 60 秒')
    await waitOn({
      // 使用 tcp: 仅检测端口监听，避免部分环境下 HTTP 探测返回非 2XX 导致超时
      resources: [WAIT_ON_RESOURCE],
      timeout: 60000,
      interval: 1000,
    })
    core.info('✅ 服务已启动')
  })

  await core.group('健康检查', async () => {
    const url = `${BASE_URL}/`
    try {
      const res = await httpGet(url, 5000)
      core.info(`GET / => ${res.status}`)
    }
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      core.warning(`GET / 探测失败（不一定影响 tasks）：${msg}`)
    }
  })

  await core.group('执行 attendance 任务', async () => {
    const taskUrl = `${BASE_URL}/_nitro/tasks/attendance`
    core.info(`任务 URL: ${taskUrl}`)

    const response = await httpGet(taskUrl, 180000)
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`请求失败: ${response.status}`)
    }

    const data = JSON.parse(response.body)
    core.info('📊 任务响应:')
    core.info(JSON.stringify(data, null, 2))

    exitCode = data.result === 'success' ? 0 : 1
  })
}
catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error)
  core.error(`❌ 执行失败: ${errorMsg}`)
  core.setFailed(errorMsg)
  exitCode = 1
}
finally {
  await killServer()
}

process.exit(exitCode)
