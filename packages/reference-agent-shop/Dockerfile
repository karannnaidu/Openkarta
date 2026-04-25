# Multi-stage build for @openkarta/reference-agent-shop.
# Built from the repo root: docker build -f packages/reference-agent-shop/Dockerfile .

FROM node:22-alpine AS builder
WORKDIR /repo

RUN npm install -g pnpm@9.12.0

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @openkarta/reference-agent-shop... build

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app

RUN npm install -g pnpm@9.12.0 && \
    addgroup -S openkarta && adduser -S openkarta -G openkarta

COPY --from=builder /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=builder /repo/packages/spec ./packages/spec
COPY --from=builder /repo/packages/sdk-node ./packages/sdk-node
COPY --from=builder /repo/packages/reference-agent-shop ./packages/reference-agent-shop

RUN pnpm install --frozen-lockfile --prod

USER openkarta
ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

CMD ["node", "packages/reference-agent-shop/dist/bin.js"]
