function normalizeMultiline(value: string): string {
  if (!value)
    return ''

  return String(value)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
}

function stripWrappingQuotes(value: string): string {
  const s = String(value || '').trim()
  if (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    if ((first === '\'' && last === '\'') || (first === '"' && last === '"'))
      return s.slice(1, -1).trim()
  }
  return s
}

function isCookieHeaderLine(line: string): boolean {
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

function extractCookieValueFromHeaderLine(line: string): string {
  const s = String(line || '').trimStart()
  let i = 6
  while (i < s.length && /\s/.test(s[i]))
    i++
  return s.slice(i + 1).trim()
}

function looksLikeHeaderLine(line: string): boolean {
  const s = String(line || '').trimStart()
  return /^[a-z0-9-]+\s*:/i.test(s) || /^:[a-z0-9-]+\s*:/i.test(s)
}

function normalizeCookieSeparators(value: string): string {
  return String(value || '')
    // 允许用户把 cookies “一行一个”的表格/文本粘贴进来：用 ; 连接
    .replace(/\r?\n+/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCookieInput(value: string): string {
  const raw = stripWrappingQuotes(normalizeMultiline(value))
  if (!raw)
    return ''

  const lines = raw.split(/\r?\n/)
  const cookieHeaderIndex = lines.findIndex(isCookieHeaderLine)

  if (cookieHeaderIndex >= 0) {
    const parts: string[] = []
    const first = extractCookieValueFromHeaderLine(lines[cookieHeaderIndex])
    if (first)
      parts.push(first)

    // DevTools 有时会把超长 cookie 在展示/复制时折行：
    // - 后续行不再带 "cookie:"
    // - 可能是 cookie 值的延续（不应插入空格，否则会破坏签名/编码值）
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

    return normalizeCookieSeparators(parts.join(''))
  }

  // 兼容把 cookies 按行粘贴（每行一个 name=value）
  // 若每行都像 cookie pair，则用 "; " 拼接为单个 cookie header value
  const nonEmptyLines = lines.map(s => s.trim()).filter(Boolean)
  const allLookLikePairs = nonEmptyLines.length > 1
    && nonEmptyLines.every(s => /^[^=\s;]+=.*/.test(s))

  if (allLookLikePairs)
    return normalizeCookieSeparators(nonEmptyLines.join('; '))

  return normalizeCookieSeparators(raw)
}

export function splitCookies(value: string): string[] {
  const raw = stripWrappingQuotes(normalizeMultiline(value))
  if (!raw)
    return []

  const lines = raw.split(/\r?\n/)
  const hasCookieHeaderLine = lines.some(isCookieHeaderLine)

  // 如果用户粘贴的是完整 Request Headers（含 cookie:），不要先按换行拆分账号
  if (hasCookieHeaderLine) {
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
