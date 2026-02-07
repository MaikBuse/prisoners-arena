# Concept

Core game design acceptance criteria. See `docs/architecture.md` for technical details.

---

## Acceptance Criteria

### Tournament Lifecycle
- [x] Players can enter during Registration by paying fixed stake
- [x] Players can withdraw anytime during Registration (full refund)
- [x] Registration extends automatically if minimum not met at deadline
- [x] Tournament starts immediately when minimum reached after deadline
- [x] Each player plays exactly K matches (deduplicated — each match counted once)
- [x] Matches execute on-chain with deterministic outcomes
- [x] Top 25% of players by score win (all ties at threshold included)
- [x] Winners split pool equally (same ROI%)
- [x] Winners can claim within 30 days (hardcoded constant)
- [x] Unclaimed prizes after 30 days go to accumulated fees
- [x] Next tournament starts immediately after finalization

### Fairness
- [x] One entry per wallet
- [x] Anonymous pairings (players identified by index)
- [x] Randomized round counts (5-15, unknown to players)
- [x] Randomized opponent sampling
- [x] All match outcomes verifiable on-chain
- [x] Indices assigned in registration order (immutable)
- [x] Config values snapshotted at tournament creation
- [x] Strategy cannot be changed after entry
- [x] Strategies visible on-chain (v1 simplification; commit-reveal planned for v2)

### Economics
- [x] Fixed stake for all players (snapshotted per tournament)
- [x] House fee adjustable (starts at 0%, snapshotted per tournament)
- [x] All funds held by contract until payout/refund

---

## Notes

*2026-02-07*: Core mechanics finalized. Matches deduplicated (A vs B = B vs A). Indices assigned at entry. Config snapshotted to tournament. Frontend deferred — v1 is contract-as-API.

*2026-02-07*: Contract implementation complete, compiles successfully. All acceptance criteria implemented in code. Awaiting tests and localnet deployment validation.
