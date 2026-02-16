# Build from repo root: docker build -f operator/Dockerfile .
# Requires git submodule to be initialized (contract/crates/match-logic)

# ── Builder ──────────────────────────────────────────────────────────
FROM rust:1.88-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# 1. Copy real Cargo.lock
COPY Cargo.lock .

# 2. Copy per-crate Cargo.toml files
COPY operator/Cargo.toml operator/Cargo.toml
COPY contract/crates/match-logic/Cargo.toml contract/crates/match-logic/Cargo.toml

# 3. Write a trimmed workspace Cargo.toml (only operator + match-logic)
#    Excludes contract/programs/prisoners-arena and cli to avoid pulling
#    in Anchor/BPF toolchain dependencies.
RUN echo '[workspace]\n\
members = [\n\
    "contract/crates/match-logic",\n\
    "operator",\n\
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
tracing-subscriber = "0.3"\n\
\n\
[profile.release]\n\
overflow-checks = true' > Cargo.toml

# 4. Create dummy source files for dependency caching
RUN mkdir -p operator/src && echo 'fn main() {}' > operator/src/main.rs \
    && mkdir -p contract/crates/match-logic/src && echo '' > contract/crates/match-logic/src/lib.rs

# 5. Build dependencies only (cached until Cargo.toml/Cargo.lock change)
RUN cargo build --release -p prisoners-operator

# 6. Copy real source code
COPY operator/src operator/src
COPY contract/crates/match-logic/src contract/crates/match-logic/src

# 7. Touch source files to invalidate the cached binary (not the deps)
RUN touch operator/src/main.rs contract/crates/match-logic/src/lib.rs

# 8. Build the real binary
RUN cargo build --release -p prisoners-operator

# ── Runner ───────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -u 1001 -m -s /bin/false appuser

COPY --from=builder /build/target/release/operator /app/operator

RUN mkdir -p /app/data && chown appuser:appuser /app/data

USER appuser
WORKDIR /app

ENTRYPOINT ["/app/operator"]
CMD ["-c", "/app/config/arena.toml"]
