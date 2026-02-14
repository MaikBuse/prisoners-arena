# Prisoner's Arena - Development Commands

# Default: show available recipes
default:
    @just --list

# Install all dependencies (Rust, Solana, Anchor, wasm-pack)
setup:
    @echo "Installing Rust (if needed)..."
    @command -v rustc >/dev/null 2>&1 || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    @echo "Installing WASM target..."
    rustup target add wasm32-unknown-unknown
    @echo "Installing wasm-pack..."
    cargo install wasm-pack
    @echo "Installing Anchor..."
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
    avm install latest
    avm use latest
    @echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"
    @echo "Setup complete!"

# Run all tests
test: test-match-logic test-contract

# Test match-logic crate
test-match-logic:
    cd crates/match-logic && cargo test

# Test contract
test-contract:
    cd programs/prisoners-arena && anchor test --provider.cluster localnet -- --features testing

# Build everything
build: build-match-logic build-wasm build-contract build-operator

# Build match-logic native
build-match-logic:
    cd crates/match-logic && cargo build --release

# Build WASM for frontend
build-wasm:
    cd crates/match-logic && wasm-pack build --target web --features wasm --out-dir ../../web/src/wasm

# Build contract
build-contract:
    cd programs/prisoners-arena && anchor build

# Build operator
build-operator:
    cd operator && cargo build --release

# Clean all builds
clean:
    cd crates/match-logic && cargo clean
    cd programs/prisoners-arena && anchor clean || true
    cd operator && cargo clean || true
    rm -rf web/src/wasm

# Run frontend dev server
dev-frontend:
    cd web && npm run dev

# Build frontend for production
build-web:
    cd web && npm run build

# Run frontend in production mode
start-web:
    cd web && npm start

# Run CLI (pass args after --)
cli *ARGS:
    cargo run -p prisoners-cli -- {{ARGS}}

# Run operator
dev-operator:
    cargo run -p prisoners-operator

# Run operator in manual mode (single cycle then exit)
operator-manual:
    cargo run -p prisoners-operator -- --manual

# Deploy to devnet
deploy-devnet:
    cd programs/prisoners-arena && anchor deploy --provider.cluster devnet

# Deploy to mainnet (careful!)
deploy-mainnet:
    cd programs/prisoners-arena && anchor deploy --provider.cluster mainnet

# Format all code
fmt:
    cd crates/match-logic && cargo fmt
    cd programs/prisoners-arena && cargo fmt
    cd operator && cargo fmt

# Lint all code
lint:
    cd crates/match-logic && cargo clippy
    cd programs/prisoners-arena && cargo clippy
    cd operator && cargo clippy
