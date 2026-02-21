import { createSender } from 'statocysts'

export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export interface CreateMessageCollectorOptions {
  notificationUrls?: string | string[]
  onError?: () => void
}

export interface CollectOptions {
  output?: boolean
  isError?: boolean
}

export interface MessageCollector {
  log: (message: string) => void
  error: (message: string) => void

  notify: (message: string) => void
  notifyError: (message: string) => void

  info: (message: string) => void
  infoError: (message: string) => void

  brief: (message: string) => void
  briefError: (message: string) => void

  push: (title?: string) => Promise<void>
  hasError: () => boolean

  /** @deprecated */
  collect: (message: string, options?: CollectOptions) => void
}

export function createMessageCollector(options: CreateMessageCollectorOptions): MessageCollector {
  const messages: string[] = []
  const briefMessages: string[] = []
  let hasError = false

  const log = (message: string) => {
    console.log(message)
  }

  const error = (message: string) => {
    console.error(message)
    hasError = true
  }

  const notify = (message: string) => {
    messages.push(message)
  }

  const notifyError = (message: string) => {
    messages.push(message)
    hasError = true
  }

  const info = (message: string) => {
    console.log(message)
    messages.push(message)
  }

  const infoError = (message: string) => {
    console.error(message)
    messages.push(message)
    hasError = true
  }

  const brief = (message: string) => {
    briefMessages.push(message)
  }

  const briefError = (message: string) => {
    briefMessages.push(message)
    hasError = true
  }

  const collect = (message: string, opts: CollectOptions = {}) => {
    const { output = false, isError = false } = opts
    messages.push(message)
    if (output)
      console[isError ? 'error' : 'log'](message)
    if (isError)
      hasError = true
  }

  const push = async (title = '【FF14 石之家每日签到】') => {
    const content = briefMessages.length > 0 ? briefMessages.join('\n') : messages.join('\n\n')
    const urls = options.notificationUrls ? toArray(options.notificationUrls) : []
    if (urls.length === 0)
      return
    const sender = createSender(urls)
    await sender.send(title, content)
    if (hasError && options.onError)
      options.onError()
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
    collect,
    push,
    hasError: () => hasError,
  } as const
}
