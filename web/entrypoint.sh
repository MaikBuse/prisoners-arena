#!/bin/sh
set -e

# Replace build-time placeholder env vars with runtime values in all JS files
# Next.js inlines NEXT_PUBLIC_* at build time — this lets us use a single image
# across environments by swapping values at container startup.

find /app/.next -name '*.js' -exec sed -i \
  -e "s|8kiAR1C8vaGF9Xny1YX3HC7mh4knZoh2EjArk2vQKQxo|${NEXT_PUBLIC_PROGRAM_ID}|g" \
  -e "s|https://placeholder-rpc.prisoners-arena.com|${NEXT_PUBLIC_RPC_URL}|g" \
  -e "s|https://placeholder.prisoners-arena.com|${NEXT_PUBLIC_BASE_URL}|g" \
  {} +

exec node server.js
