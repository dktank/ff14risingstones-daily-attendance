# Build stage
FROM node:24-alpine AS builder

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile=false

COPY . .

RUN pnpm run build

# Production stage
FROM node:24-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/.output /app/.output

RUN mkdir -p /app/.data/kv && chown -R appuser:appgroup /app

EXPOSE 3000

ENV NODE_ENV=production

USER appuser

CMD ["node", ".output/server/index.mjs"]

