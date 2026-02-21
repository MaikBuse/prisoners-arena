# Build from repo root: docker build -f simulator/Dockerfile .
# No git submodule needed (simulator does not depend on match-logic)

# -- Builder ------------------------------------------------------------------
FROM rust:1.88-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# 1. Copy real Cargo.lock
COPY Cargo.lock .

# 2. Copy per-crate Cargo.toml
COPY simulator/Cargo.toml simulator/Cargo.toml

# 3. Write a trimmed workspace Cargo.toml (only simulator)
RUN echo '[workspace]\n\
members = [\n\
    "simulator",\n\
]\n\
resolver = "2"\n\
\n\
[workspace.package]\n\
version = "0.1.0"\n\
edition = "2021"\n\
license = "MIT"\n\
repository = "https://github.com/MaikBuse/prisoners-arena"\n\
\n\
[workspace.dependencies]\n\
solana-sdk = "3.0"\n\
tokio = { version = "1.0", features = ["full"] }\n\
serde = { version = "1.0", features = ["derive"] }\n\
serde_json = "1.0"\n\
tracing = "0.1"\n\
tracing-subscriber = "0.3"' > Cargo.toml

# 4. Create dummy source file for dependency caching
RUN mkdir -p simulator/src && echo 'fn main() {}' > simulator/src/main.rs

# 5. Build dependencies only (cached until Cargo.toml/Cargo.lock change)
RUN cargo build --release -p prisoners-simulator

# 6. Copy real source code
COPY simulator/src simulator/src

# 7. Touch source files to invalidate the cached binary (not the deps)
RUN touch simulator/src/main.rs

# 8. Build the real binary
RUN cargo build --release -p prisoners-simulator

# -- Runner -------------------------------------------------------------------
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -u 1001 -m -s /bin/false appuser

COPY --from=builder /build/target/release/simulator /app/simulator

RUN mkdir -p /app/wallets && chown appuser:appuser /app/wallets

USER appuser
WORKDIR /app

ENTRYPOINT ["/app/simulator"]
CMD ["-c", "/app/config/arena.toml"]
