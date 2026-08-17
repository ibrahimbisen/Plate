# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.23.2-slim

# ---------------------------------------------------------------------------
# deps
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# better-sqlite3 and sharp ship prebuilds for glibc. This is why the image is
# node:slim (Debian) and not alpine (musl), which would compile from source.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# NEXT_PUBLIC_* values would be inlined into the bundle here, which is why this
# app deliberately has none — one published image has to work for every host.
RUN npm run build

# Fail loudly if the Turbopack standalone bug (vercel/next.js#88844) has crept
# back in. Without this the image builds fine and dies at boot with
# "Cannot find module 'better-sqlite3'".
RUN test -d .next/standalone/node_modules/better-sqlite3 \
 && test -d .next/standalone/node_modules/sharp \
 || (echo "FATAL: native modules missing from standalone output" && exit 1)

# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    # Without this the standalone server binds localhost and is unreachable
    # from outside the container.
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/db/app.db \
    UPLOAD_DIR=/data/uploads

# A fresh named volume is owned by root, while the image runs as uid 1000.
# Creating and chowning the tree here is what prevents SQLITE_CANTOPEN on the
# very first boot.
RUN mkdir -p /data/db /data/uploads && chown -R node:node /data

# .next/static and public/ are NOT inside .next/standalone — they are separate
# copies, and omitting them yields an app with no CSS or JS.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
