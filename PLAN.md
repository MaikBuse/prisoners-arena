# PLAN.md - Dilemma Arena

## Status: 🟡 In Progress — v1.7 Commit-Reveal Strategies

**Program ID:** `5aUBgqYz8B3B7mogMqK4yk5n2gU2QNyTWiP8AB5iTtFW`
**Deployer Wallet:** `ConzeWMHRnFE7QLjokjA8QF1nBxjpbUSipYUSkuXuhgu`

---

## Architecture

Single source of truth: `docs/architecture.md`

Requirements files (`requirements/*.md`) contain acceptance criteria only.

---

## Components

| Component | Tech | Status |
|-----------|------|--------|
| Match Logic | Rust crate | 🟢 complete |
| Smart Contract | Anchor 0.32 | 🟢 complete (dynamic sizing) |
| Operator Bot | Rust | 🟢 complete |
| Admin CLI | Rust | 🟢 complete |
| Frontend | Next.js 16 + TypeScript + Tailwind | 🟡 in progress (v1.6) |

---

## Releases

| Release | Description | Status |
|---------|-------------|--------|
| v1.1 — Stability & Correctness | Bug fixes from devnet playtest | 🟢 Complete |
| v1.2 — Hardening & Polish | Error handling, edge cases | 🟢 Complete |
| v1.3 — Persist Strategy in Tournament | Store strategies on-chain | 🟢 Complete |
| v1.4 — Strategy Parameters | 5 tunable params per strategy | 🟢 Complete |
| v1.5 — Matchmaking Overhaul | Adaptive K, round tiers | 🟢 Complete |
| v1.6 — Strategy Configurator | Frontend interactive param UI | 🟡 In Progress |
| v1.7 — Commit-Reveal Strategies | Commitment scheme for strategies | 🟡 In Progress |

---

## v1.7 Progress — Commit-Reveal Strategies

New tournament phase (Reveal), commitment scheme, forfeit handling.

### Contract Changes
- [ ] Add `Reveal` to TournamentState enum
- [ ] Add commitment + revealed fields to Entry
- [ ] Add reveal fields to Tournament (reveal_ends, reveal_duration, reveals_completed, forfeits)
- [ ] Add reveal_duration to Config
- [ ] Update Entry::LEN, Tournament::BASE_SPACE, Config::LEN
- [ ] New error codes (CommitmentMismatch, AlreadyRevealed, RevealPeriodEnded, RevealPeriodNotEnded, UnprocessedForfeits, UnrevealedStrategy)
- [ ] Update enter_tournament (commitment arg instead of strategy+params)
- [ ] New reveal_strategy instruction
- [ ] Update close_registration (→ Reveal instead of Running)
- [ ] New forfeit_unrevealed instruction
- [ ] New close_reveal instruction
- [ ] Update claim_refund (allow during Reveal)
- [ ] Update run_matches guard (safety check for unrevealed)

### Tests
- [ ] Integration tests for full commit-reveal lifecycle
- [ ] Commitment verification tests
- [ ] Timing/phase tests
- [ ] Forfeit tests
- [ ] Refund during Reveal tests
- [ ] Edge cases (all forfeit, single reveal, etc.)

### Operator
- [ ] Add Reveal state handling
- [ ] forfeit_unrevealed loop
- [ ] close_reveal action
- [ ] Update state deserialization

### CLI
- [ ] Update enter command (commitment + salt)
- [ ] New reveal command
- [ ] Update info command (reveal status)

### Frontend
- [ ] Update TournamentState mapping
- [ ] Update Entry/Tournament deserialization
- [ ] Hidden strategies during Reveal phase
- [ ] Reveal countdown + progress
- [ ] Strategy Configurator commit-reveal output

See `releases/v1.7.md` for full spec.

---

## Deployment

### Devnet
- Program deployed: `5aUBgqYz8B3B7mogMqK4yk5n2gU2QNyTWiP8AB5iTtFW`
- Devnet deploy currently blocked: need ~3.3 SOL for program upgrade, only ~0.6 SOL available
- Admin wallet: `ConzeWMHRnFE7QLjokjA8QF1nBxjpbUSipYUSkuXuhgu`
- Operator wallet: `2o7jVMvtjWQrnGP8f8RQ1k3AK4aB5chVj1QniDPP7KYc`

### Local Testing
- `solana-test-validator --reset --bpf-program <ID> target/deploy/dilemma_arena.so` from `/tmp`
- `arena-local.toml` config (rpc=localhost, registration_duration=120s, stake=0.1 SOL)
- Frontend: `NODE_OPTIONS="--max-old-space-size=512" npx next dev -H 0.0.0.0 -p 3000`
- 68 integration tests passing via `anchor test -- --features testing`
- 57 match-logic unit tests passing

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Fixed stake, equal split | Same ROI for all winners |
| Top 25% wins, ties included | All at/above threshold win |
| Adaptive K (v1.5) | n≤200: full round-robin; n>200: clamp [49,99] |
| Round tiers (v1.5) | Standard 20-50 rounds (n≤1000), Compressed 10-30 (n>1000) |
| Strategy params (v1.4) | 5 tunable bytes: forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias |
| Dynamic account sizing | Realloc on entry; players pay rent delta |
| No wallet integration | Agents build own transactions |
| Environment-driven config | NEXT_PUBLIC_* env vars |
| Next.js memory cap | 512MB to prevent OOM on limited VM |
