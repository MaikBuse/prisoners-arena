# PLAN.md - Dilemma Arena

## Status: 🟡 In Progress — Admin CLI + Operator Manual Mode + Frontend

**Program ID:** `Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7`
**Deployer Wallet:** `ConzeWMHRnFE7QLjokjA8QF1nBxjpbUSipYUSkuXuhgu`
**Required SOL:** ~2 SOL (434KB program + rent + tx fees)
**Faucet:** https://faucet.solana.com (rate limited)

---

## Architecture

Single source of truth: `docs/architecture.md`

Requirements files (`requirements/*.md`) contain acceptance criteria only.

---

## Components

| Component | Tech | Status |
|-----------|------|--------|
| Match Logic | Rust crate + WASM | 🟢 complete |
| Smart Contract | Anchor 0.32 | 🟢 complete (dynamic sizing) |
| Operator Bot | Rust | 🟡 needs manual mode |
| Admin CLI | Rust | 🟢 complete |
| Frontend | Next.js + TypeScript + Tailwind | 🟡 not started |

---

## Implementation Tasks

### Match Logic (`crates/match-logic`)
- [x] Core types (Move, StrategyBase, MatchResult)
- [x] All 9 base strategies
- [x] Match execution with history
- [x] Seeded PRNG (deterministic)
- [x] Pairing generation (deduplicated, circular method)
- [x] WASM bindings (feature-gated)
- [x] Fix Gradual strategy to match architecture spec
- [ ] WASM vs native determinism test
- [ ] npm package build config

### Smart Contract (`programs/dilemma-arena`)

#### Account Structure Fixes
- [x] Add `operator` key to Config (admin ≠ operator)
- [x] Add `max_participants` to Config (default 5000)
- [x] Remove `stake_lock_hours` from Config (players can refund anytime)
- [x] Add `players: Vec<Pubkey>` to Tournament (for index assignment)
- [x] Add `payout_started_at: i64` to Tournament (for claim expiry)
- [x] Snapshot `stake`, `house_fee_bps`, `matches_per_player` to Tournament at creation
- [x] Rename `opponents_per_agent` to `matches_per_player` for consistency
- [x] Remove `lock_until` from Entry (no stake lock)

#### Instruction Fixes
- [x] `initialize_config`: Create Tournament #0 on init
- [x] `enter_tournament`: Index = `tournament.players.len()`, push to players vec
- [x] `claim_refund`: Allowed anytime during Registration (no lock), set players[index] = default
- [x] `close_registration`: Extend deadline if min not met (don't cancel); refund last if odd count
- [x] `run_matches`: Batch 5 matches per tx using remaining_accounts
- [x] `finalize_tournament`: Create next tournament with snapshotted config
- [x] `claim_payout`: Add 30-day expiry check (CLAIM_EXPIRY_SECONDS = 2,592,000)
- [x] `close_expired_entry`: New instruction for cleanup after 30-day expiry

#### Error Codes (per architecture)
- [x] 6000 InvalidState
- [x] 6001 RegistrationClosed
- [x] 6002 AlreadyEntered
- [x] 6003 NotWinner
- [x] 6004 AlreadyPaid
- [x] 6005 Unauthorized
- [x] 6006 InsufficientFunds
- [x] 6007 MatchesIncomplete
- [x] 6008 NoFeesToWithdraw
- [x] 6009 ClaimExpired
- [x] 6010 NotExpired
- [x] 6011 SlotHashUnavailable
- [x] 6012 TournamentFull
- [x] 6013 InvalidEntryAccount
- [x] 6014 InvalidMinParticipants

#### Validation
- [x] min_participants must be even and >= 2
- [x] Operator-only constraints on lifecycle instructions

#### Tests
- [x] Test infrastructure setup (TypeScript/Mocha)
- [x] Unit tests for each instruction (13 tests passing)
- [x] Integration tests
- [x] Localnet deployment test

#### Dynamic Account Sizing (Realloc) ✅

Tournament accounts now grow incrementally as players join.

**Contract changes:**
- [x] `initialize_config`: Create Tournament #0 with base size only (~121 bytes)
- [x] `enter_tournament`: Add `realloc` to grow account by 36 bytes per player
- [x] `enter_tournament`: Player pays rent delta (in addition to stake)
- [x] `finalize_tournament`: Create next tournament with base size only
- [x] Remove hardcoded `Tournament::space(100)` from account constraints
- [x] Add `Tournament::BASE_SPACE` constant and `BYTES_PER_PLAYER` for allocation

**Test changes:**
- [x] Existing tests pass (balance checks still valid — rent delta is small)
- [ ] Add test for max_participants limit with realloc (optional)
- [ ] Add test for many players (optional, verify at scale)

**Operator changes:**
- [x] Tournament deserialization handles variable-size vecs (already supported)

### Admin CLI (`cli/`)
- [x] Project structure (Rust, clap)
- [x] TOML config loading (`arena.toml`)
- [x] `arena init` — initialize config + Tournament #0
- [x] `arena config show` — display on-chain config
- [x] `arena config update` — update config parameters
- [x] `arena withdraw-fees` — withdraw house fees
- [x] `arena status` — current tournament state
- [x] `arena tournament <id>` — specific tournament details
- [x] `arena entries` — list entries for a tournament
- [x] `arena enter` — enter tournament with wallet/strategy
- [x] `arena refund` — claim refund
- [x] `arena claim` — claim payout
- [x] `arena balance` — check wallet balance
- [x] `arena airdrop` — devnet airdrop
- [x] `--dry-run` flag on write operations

### Operator Bot (`operator/`)
- [x] Project structure
- [x] State monitoring (fetch Config, Tournament, Entry)
- [x] Lifecycle automation (main loop with state machine)
- [x] Transaction building with remaining_accounts
- [x] Retry logic (via send_and_confirm)
- [x] Wallet balance monitoring
- [x] Build verification
- [x] `--manual` mode (single cycle, exit)
- [x] `--dry-run` support
- [x] Exit codes (0 = action taken, 1 = nothing to do, 2 = error)
- [ ] Localnet testing (requires AVX-capable CPU)

### Frontend (`web/`) — dilemma-arena.com
- [ ] Project setup (Next.js App Router + TypeScript + Tailwind)
- [ ] Server-side Solana data fetching (Config, Tournament, Entry deserialization)
- [ ] Dashboard page — tournament state, countdown, progress, scores table
- [ ] Scores table with Solana Explorer links for pubkeys
- [ ] Tournament history page
- [ ] How to Play / strategy guide page
- [ ] Participate page — full programmatic instructions for agents
- [ ] `/participate.md` plain markdown endpoint (machine-readable)
- [ ] About / Trust page — verification links, reproducible build info
- [ ] Network badge (devnet/mainnet) prominent throughout
- [ ] SEO: meta tags, Open Graph, server-side rendering
- [ ] Solana Explorer links throughout (program, accounts)
- [ ] Responsive layout (desktop + mobile)

### Transparency & Auditability
- [ ] Open-source contract repository (public GitHub)
- [ ] Verified program on Solana Explorer (source upload)
- [ ] Reproducible builds (documented build steps, deterministic output)
- [ ] Published IDL (accessible from site + repo)
- [ ] Trust page documenting all verification methods

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Fixed stake, equal split | Same ROI for all winners |
| Top 25% wins, ties included | All at/above threshold win |
| K=15 matches per player | Statistical robustness vs cost |
| Matches deduplicated | A vs B = B vs A (halves tx count) |
| Max 5,000 participants | Execution time < 1 hour |
| Dynamic account sizing | Realloc on entry; players pay rent delta; avoids upfront waste |
| Min 2 participants | Allow small tournaments |
| Registration extends if min not met | Never cancel |
| No stake lock | Players can withdraw anytime during Registration |
| 5 matches per tx | ~600k CU with 10 Entry accounts |
| Strategy params deferred to v2 | Base strategies sufficient |
| Random pairing only | Simpler than Swiss-style |
| Admin ≠ Operator | Separate keys for config vs execution |
| Indices at entry time | Registration order, stored in tournament.players |
| Config snapshotted to Tournament | Prevents mid-tournament rule changes |
| 30-day claim expiry (constant) | Prevents indefinite rent burden |
| Informational frontend | No wallet integration; agents build own transactions |
| Target audience: AI agents | Via Moltbook + OpenClaw; site optimized for agent readability |
| Next.js over React SPA | SEO for discoverability by agents doing web research |
| `/participate.md` endpoint | Machine-readable instructions for agents to web_fetch |
| Open-source + reproducible builds | Trust-first approach for human approval |

---

## Milestones

| Milestone | Status |
|-----------|--------|
| Architecture finalized | 🟢 Complete |
| Match Logic impl | 🟢 Complete (40 tests pass) |
| Contract impl | 🟢 Complete (dynamic sizing) |
| Contract tests | 🟢 Complete (13 tests pass) |
| Operator impl | 🟢 Complete |
| Operator manual mode | 🟢 Complete |
| Admin CLI | 🟢 Complete |
| Localnet demo | 🟢 Complete |
| Dynamic account sizing | 🟢 Complete |
| WASM integration | ⚪ Planned |
| Devnet deploy | 🟢 Complete (program + config initialized) |
| Frontend (dilemma-arena.com) | 🟡 Not started |
| Transparency & auditability | 🟡 Not started |
| Devnet playtest | 🔴 Blocked on Admin CLI + Frontend |
| Mainnet launch | ⚪ Planned |

---

## Deployment Readiness

### Build Artifacts
- [x] Contract compiled (434KB .so)
- [x] Program keypair generated
- [x] Program ID set in lib.rs and Anchor.toml
- [x] All 13 tests passing on localnet
- [x] Anchor.toml configured for devnet

### Deployment Steps
1. Fund wallet with ~2 SOL: `solana airdrop 2` or https://faucet.solana.com
2. Deploy: `anchor deploy --provider.cluster devnet`
3. Initialize config (creates Tournament #0)
4. Start operator bot

### Completed
- Wallet funded, program deployed, config initialized (2026-02-08)

---

## Current Focus

Admin CLI ✅, Operator manual mode ✅. Next: build Frontend (dilemma-arena.com) + transparency tasks, then devnet playtest.

### Deployment Info (Devnet)
- Program deployed: `Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7`
- Config initialized, Tournament #0 in Registration
- Admin wallet: `ConzeWMHRnFE7QLjokjA8QF1nBxjpbUSipYUSkuXuhgu`
- Operator wallet: `2o7jVMvtjWQrnGP8f8RQ1k3AK4aB5chVj1QniDPP7KYc` (`~/.config/solana/operator.json`)
