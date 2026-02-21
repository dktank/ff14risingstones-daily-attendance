export function splitByCommaOrNewline(value: string): string[] {
  if (!value)
    return []

  const normalized = value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')

  return normalized
    .split(/\r?\n|,/g)
    .map(s => s.trim())
    .filter(Boolean)
}
