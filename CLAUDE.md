# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prisoner's Arena is a competitive AI tournament platform on Solana implementing the Iterated Prisoner's Dilemma. Players stake SOL, select strategies (built-in or custom bytecode), compete in automated matches, and split prizes. Uses commit-reveal for strategy anonymity.

## Monorepo Structure

- `contract/` — **Git submodule** ([makoto-kusanagi/prisoners-arena-program](https://github.com/makoto-kusanagi/prisoners-arena-program)) — publicly verifiable
  - `contract/crates/match-logic/` — Core game logic (Rust, compiles to native + WASM)
  - `contract/programs/prisoners-arena/` — Solana smart contract (Anchor 0.32)
- `operator/` — Tournament automation bot (Rust)
- `cli/` — Admin CLI tool (Rust, binary name: `arena`)
- `web/` — Next.js 16 frontend (React 19, TypeScript, Tailwind CSS 4)
- `tests/` — Anchor integration tests (TypeScript/Mocha)

**Submodule workflow:**
```bash
git clone --recurse-submodules <repo-url>   # or: git submodule update --init
```
Changes to contract/match-logic: commit inside `contract/`, push, then `git add contract` in monorepo root.

## Build & Test Commands

All commands use `just` (command runner):

```bash
just build                 # Build everything
just test                  # Run all tests
just test-match-logic      # cargo test -p match-logic
just test-contract         # anchor test --provider.cluster localnet -- --features testing
just fmt                   # cargo fmt
just lint                  # cargo clippy
just dev-frontend          # Next.js dev server (port 3000)
just dev-operator          # Run operator bot
just deploy-devnet         # Deploy contract to devnet
```

Web-specific:
```bash
cd web && npm run dev      # Next.js dev server
cd web && npm run build    # Production build
cd web && npm run lint     # ESLint
```

Single Rust test: `cargo test -p match-logic <test_name>`

## Architecture

### Tournament Lifecycle (State Machine)
`Registration → Reveal → Running → Payout`

Players enter during Registration with a commitment hash. During Reveal, they disclose their strategy. The operator bot runs matches in batches, then finalizes. Winners (top 25%) claim payouts within 30 days.

### On-Chain Accounts (3 PDA types)
- **Config**: `seed=["config"]` — Global parameters (admin, fees, stake, timing)
- **Tournament**: `seed=["tournament", id_as_u32_le]` — State, participants, scores
- **Entry**: `seed=["entry", tournament_pubkey, player_pubkey]` — Per-player per-tournament

### Commit-Reveal Flow
Players submit `SHA256(strategy_u8 || salt_16_bytes)` at entry (or `SHA256(9u8 || SHA256(bytecode) || salt_16_bytes)` for custom strategies). Strategies hidden until Reveal phase closes.

### Match Logic Crate (`contract/crates/match-logic/`)
Shared game engine used by the contract, operator, and optionally frontend (via WASM). Contains strategy implementations, match execution, pairing generation, and seeded RNG. The `wasm` feature enables browser compilation.

9 built-in strategies (indices 0–8): TitForTat, AlwaysDefect, AlwaysCooperate, GrimTrigger, Pavlov, SuspiciousTitForTat, Random, TitForTwoTats, Gradual. Index 9 is Custom (bytecode VM).

### Frontend API
All API routes under `web/src/app/api/` return `{ ok, data?, error?, network, timestamp }`. Rate limited at 60 req/min per IP. Account data is manually deserialized from raw buffers (no Anchor client-side). Discriminators for filtering:
- Config: `[155, 12, 170, 224, 30, 250, 204, 130]`
- Tournament: `[175, 139, 119, 242, 115, 194, 57, 92]`
- Entry: `[63, 18, 152, 113, 215, 246, 221, 250]`

### Operator Bot
Autonomous loop that drives tournament lifecycle: closes registration, closes reveal, runs matches in batches of 5, finalizes, and cleans up expired entries.

## Configuration

- `arena.toml` — Production config (RPC URL, program ID, wallets, defaults)
- `arena-local.toml` — Local testing config
- `web/.env.local` — Frontend env vars (`NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_NETWORK`)
- `Anchor.toml` — Anchor framework config

Program ID (devnet): `2j8FBKuXsBsHRjfVLWCdPtZbPDLKzM3jXG7JSAy4jtga`

## Contract Test Setup (Important)

Integration tests require the BPF binary at `target/deploy/prisoners_arena.so` compiled with the `testing` feature flag. This flag lowers `CLAIM_EXPIRY_SECONDS` and `TOURNAMENT_CLOSURE_SECONDS` from 30 days to 2 seconds.

**Stale binary pitfall:** `anchor test` caches the binary. If `target/deploy/prisoners_arena.so` was built without `--features testing`, tests will silently use 30-day timeouts and timing-dependent tests will fail (e.g. `ClaimExpired` never fires, wrong error codes). Symptoms: tests pass for non-timing checks but fail on expiry-related assertions.

**Clean rebuild when timing tests fail:**
```bash
cargo clean --manifest-path contract/Cargo.toml
anchor build -- --features testing
cp contract/target/deploy/prisoners_arena.so target/deploy/
just test-contract
```

The copy step is needed because the contract is a git submodule — Cargo outputs to `contract/target/deploy/` but the test validator reads from `target/deploy/`.

**Test suite is stateful:** Tests in `tests/prisoners-arena.ts` are sequential — each describe block depends on state from the previous one. You cannot run individual tests in isolation.

## Key Dependencies

- Anchor 0.32, Solana SDK 2.0
- Next.js 16.1, React 19.2, Solana Web3.js 1.98
- Tailwind CSS 4, TypeScript 5
- `testing` feature flag: sets claim/closure expiry to 2 seconds for tests
