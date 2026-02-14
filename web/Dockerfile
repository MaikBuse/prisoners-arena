# --- base ---
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# --- deps ---
FROM base AS deps
WORKDIR /app

# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# --- builder ---
FROM base AS builder
WORKDIR /app

# Native build tools needed for better-sqlite3 rebuild during next build
RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time placeholders — replaced at runtime by entrypoint.sh
# Must be valid base58 — PublicKey() is called at build time
ENV NEXT_PUBLIC_PROGRAM_ID=8kiAR1C8vaGF9Xny1YX3HC7mh4knZoh2EjArk2vQKQxo
# Must be valid URLs / values — Connection() and other code runs at build time
ENV NEXT_PUBLIC_RPC_URL=https://placeholder-rpc.prisoners-arena.com
ENV NEXT_PUBLIC_NETWORK=devnet
ENV NEXT_PUBLIC_BASE_URL=https://placeholder.prisoners-arena.com

RUN npm run build

# --- runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output (copy from nested app/ dir — Next.js mirrors WORKDIR structure)
COPY --from=builder /app/.next/standalone/app ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# better-sqlite3 native module (serverExternalPackages excludes it from bundle)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install
COPY --from=builder /app/node_modules/node-gyp-build ./node_modules/node-gyp-build

# Entrypoint for runtime env var replacement
COPY entrypoint.sh ./entrypoint.sh

# SQLite data directory (mount as volume in K8s)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
