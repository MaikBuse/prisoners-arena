# Operator Bot

Acceptance criteria for tournament automation. See `docs/architecture.md` for design details.

---

## Responsibilities

1. Monitor tournament state
2. Call `close_registration` when deadline passes
3. Execute matches in batches of 5
4. Call `finalize_tournament` when complete
5. Call `close_expired_entry` for unclaimed entries after 30 days

---

## Acceptance Criteria

### Lifecycle
- [ ] Polls tournament state at configured interval
- [ ] Triggers `close_registration` at deadline
- [ ] Builds index→pubkey map from tournament.players
- [ ] Generates pairings using match-logic crate
- [ ] Derives Entry PDAs for each match batch
- [ ] Executes all matches in sequential batches
- [ ] Triggers `finalize_tournament` when all matches complete

### Reliability
- [ ] Retries failed transactions (configurable max retries)
- [ ] Resumes from current state on restart
- [ ] Handles network errors gracefully
- [ ] Structured logging for all actions

### Maintenance
- [ ] Detects expired entries (30 days after payout) → `close_expired_entry`
- [ ] Monitors operator wallet balance
- [ ] Alerts when balance below threshold

---

## Configuration

```rust
struct OperatorConfig {
    rpc_endpoint: String,
    program_id: Pubkey,
    operator_keypair: PathBuf,
    poll_interval_ms: u64,      // e.g., 5000
    max_retries: u32,           // e.g., 3
    retry_delay_ms: u64,        // e.g., 1000
    min_balance_alert: u64,     // e.g., 100_000_000 (0.1 SOL)
}
```

---

## Testing

- [ ] Unit tests for pairing algorithm (uses match-logic)
- [ ] Unit tests for PDA derivation
- [ ] Mock contract for integration testing
- [ ] Localnet end-to-end test
