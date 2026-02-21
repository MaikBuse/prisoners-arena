# Build from repo root: docker build -f web/Dockerfile .
# Requires git submodule to be initialized (contract/crates/match-logic)

# --- wasm builder ---
FROM rust:1.88-slim-bookworm AS wasm-builder
RUN rustup target add wasm32-unknown-unknown \
    && cargo install wasm-pack
WORKDIR /build
COPY contract/crates/match-logic/ contract/crates/match-logic/
RUN cd contract/crates/match-logic && wasm-pack build --target web --features wasm

# --- base ---
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# --- deps ---
FROM base AS deps
WORKDIR /app

# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY web/package.json web/package-lock.json ./
RUN npm ci

# --- builder ---
FROM base AS builder
WORKDIR /app

# Native build tools needed for better-sqlite3 rebuild during next build
RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
COPY --from=wasm-builder /build/contract/crates/match-logic/pkg/ ./src/wasm/

RUN npm run build

# --- runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# better-sqlite3 native module (serverExternalPackages excludes it from bundle)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install
COPY --from=builder /app/node_modules/node-gyp-build ./node_modules/node-gyp-build

# SQLite data directory (mount as volume in K8s)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
