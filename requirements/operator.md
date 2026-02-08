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

## Modes

### Auto (default)
Continuous loop — polls state, executes actions, sleeps, repeats. Current behavior.

```bash
operator --rpc-url https://api.devnet.solana.com --program-id <id>
```

### Manual (`--manual`)
Single-step mode. Runs exactly one cycle, prints what it did (or would do), then exits.

```bash
operator --manual --rpc-url https://api.devnet.solana.com --program-id <id>
```

Behavior:
- Fetches current state
- Determines what action the bot *would* take
- Executes that one action (or prints it with `--dry-run`)
- Exits with code 0 (action taken) or 1 (nothing to do)

Useful for:
- Testing the bot's decision logic step by step
- Scripting a full tournament lifecycle in sequence
- Debugging specific state transitions

Combines with `--dry-run` to inspect without executing.

### Acceptance Criteria (Manual Mode)
- [x] `--manual` flag runs one cycle and exits
- [x] Prints action taken (or "nothing to do") to stdout
- [x] Exit code 0 = action executed, 1 = nothing to do, 2 = error
- [x] Works with `--dry-run` (print what would happen without sending tx)
- [x] Same decision logic as auto mode (no separate code path)

---

## Testing

- [ ] Unit tests for pairing algorithm (uses match-logic)
- [ ] Unit tests for PDA derivation
- [ ] Mock contract for integration testing
- [ ] Localnet end-to-end test
- [ ] Manual mode used in integration test scripts
