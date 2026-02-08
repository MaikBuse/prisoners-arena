# Changelog

All notable changes to Dilemma Arena.

## [1.1.0] - 2026-02-08

### Added
- `close_tournament` instruction — recovers rent lamports from expired tournament accounts (30 days after payout)
- Operator automation for `close_tournament` after all expired entries cleaned up
- Repeated round-robin pairings for small tournaments (N ≤ K+1)
- Frontend production build commands (`just build-web`, `just start-web`)
- New error codes: `EntriesRemaining` (6019), `TournamentNotCloseable` (6020)

### Changed
- `registration_duration` now snapshotted to Tournament struct at creation (consistent with stake, house_fee_bps, matches_per_player)
- Registration deadline extensions use snapshotted duration instead of live config value
- Small tournament pairing: N=2 K=15 now produces 15 matches (was 1), each with unique game seed

### Fixed
- **Critical:** `finalize_tournament` now transfers fee lamports from tournament PDA to config PDA (was only incrementing counter without moving SOL)
- **Critical:** `close_expired_entry` now transfers unclaimed prize lamports from tournament to config (same root cause)
- Operator retry-on-conflict: catches `InvalidState` errors from stale RPC reads, waits 3s, re-fetches state
- **Critical:** `run_matches` batch loop double-counted match indices (`match_index = matches_completed + batch_idx` where `matches_completed` was mutated in-loop). Caused index skipping and `InvalidMatch` errors on batch 2+. Fixed by snapshotting `start_index` before the loop.

## [Unreleased]

### Added
- Complete smart contract implementation matching locked architecture spec
- Match logic crate with all 9 base strategies
- WASM bindings for client-side match replay
- Circular pairing algorithm (O(n·K) deterministic generation)
- 30-day claim expiry with `close_expired_entry` cleanup
- Admin/Operator key separation
- Config snapshotting to Tournament at creation
- Batch match execution (5 matches per transaction)

### Changed
- **Dependencies:** Upgraded to Anchor 0.32 + Solana SDK 2.0 (from 0.30 + 1.18)
  - Required due to edition2024 incompatibility in transitive deps (blake3, time-core, wit-bindgen)
  - Solana platform-tools bundled cargo 1.84.0 couldn't parse newer crates
- **Strategy:** Simplified to enum only (removed StrategyParams, deferred to v2 per architecture)
- **Pairing algorithm:** Replaced retry-based random sampling with circular offset method
  - Old: O(n²) worst case with HashSet collision checks
  - New: O(n·K) deterministic using modular arithmetic
  - Each offset d pairs player i with (i+d) mod n; K/2 offsets → K matches per player
- **Gradual strategy:** Simplified to match architecture spec
  - After N opponent defections, player should have made N(N+1)/2 total defections
  - Removed complex retaliation/forgiveness phase tracking
- Registration extends indefinitely if minimum not met (never cancels)
- Players can withdraw anytime during Registration (no stake lock)

### Fixed
- Cargo.toml feature syntax for optional WASM dependencies
- Missing `calculate_match_count` export from match-logic crate
- Missing `Debug` derive on `StrategyBase` enum

## [0.1.0] - 2026-02-07

### Added
- Initial project structure
- Architecture specification
- Requirements documentation
