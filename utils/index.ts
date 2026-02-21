import { sha256Hex } from './hash'

export * from './cookie'
export * from './ff14risingstones/index'
export * from './hash'
export * from './message'
export * from './retry'
export * from './split'

export async function generateAttendanceKey(cookie: string): Promise<string> {
  const hashHex = await sha256Hex(cookie)

  const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  return `kv:attendance:${hashHex}:${shanghaiDate}`
}

export function getShanghaiMonth(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
}
