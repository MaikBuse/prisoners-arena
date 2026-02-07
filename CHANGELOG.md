# Changelog

All notable changes to Dilemma Arena.

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
