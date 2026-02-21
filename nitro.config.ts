import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './',
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    // 2 小时一次：提高当日成功率（成功后会写入 KV，后续执行将跳过且不推送）
    '30 0/2 * * *': ['attendance'],
  },
  runtimeConfig: {
    cookies: '',
    notificationUrls: '',
    maxRetries: '3',
    autoClaim: 'true',
    requestTimeoutMs: '20000',
    nitro: {
      envPrefix: 'FF14RS_',
    },
  },
  rolldownConfig: {
    output: {
      codeSplitting: {
        groups: [
          {
            name: 'unstorage',
            test: /node_modules\/unstorage\/dist\/drivers\/(?!redis)/,
          },
          {
            name: 'unstorage-drivers-redis',
            test: /node_modules\/unstorage\/dist\/drivers\/redis/,
          },
        ],
      },
    },
  },
})
