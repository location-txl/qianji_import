# ---- deps ----
FROM node:22-alpine AS deps
RUN npm i -g pnpm@10
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder ----
FROM deps AS builder
COPY . .
RUN pnpm build

# ---- runner ----
FROM node:22-alpine AS runner
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

WORKDIR /app

# 拷贝 standalone 产物
COPY --from=builder /app/.next/standalone ./
# 拷贝静态资源（standalone 不含）
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 配置持久化目录
RUN mkdir -p data && chown nextjs:nextjs data

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
