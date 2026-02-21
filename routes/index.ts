import { defineEventHandler } from 'nitro/h3'

export default defineEventHandler(() => {
  return new Response('OK', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
})
