# Smart Contract

Acceptance criteria for Anchor contract. See `docs/architecture.md` for account structures and instruction details.

---

## Instructions

### Admin
- [ ] `initialize_config` — Create config + Tournament #0
- [ ] `update_config` — Modify settings (admin only)
- [ ] `withdraw_fees` — Collect accumulated fees (admin only)

### Player
- [ ] `enter_tournament` — Pay stake, submit strategy, create Entry
- [ ] `claim_refund` — Withdraw during Registration (full refund)
- [ ] `claim_payout` — Winner collects prize share (within 30 days)

### Operator
- [ ] `close_registration` — Lock entries, seed randomness, start tournament
- [ ] `run_matches` — Execute batch of 5 matches
- [ ] `finalize_tournament` — Calculate winners, create next tournament
- [ ] `close_expired_entry` — Cleanup entries after 30 days

---

## Acceptance Criteria

### Config Initialization
- [ ] Creates Config PDA with admin + operator keys
- [ ] Creates Tournament #0 with snapshotted config values
- [ ] Tournament #0 starts in Registration state

### Entry
- [ ] Rejects duplicate entry (one per wallet)
- [ ] Rejects entry after Registration state
- [ ] Rejects entry when max_participants reached
- [ ] Transfers exact stake from tournament snapshot
- [ ] Assigns index = tournament.players.len()
- [ ] Appends player pubkey to tournament.players

### Refund
- [ ] Only allowed during Registration state
- [ ] Returns snapshotted stake to player
- [ ] Sets tournament.players[index] = default pubkey
- [ ] Decrements participant count and pool
- [ ] Closes Entry account

### Registration Close
- [ ] Only callable by operator
- [ ] Extends deadline if minimum not met
- [ ] Refunds last registrant if participant_count is odd (and above minimum)
- [ ] Sets randomness seed from slot hash
- [ ] Calculates total matches = participant_count × K / 2 (deduplicated, guaranteed integer)
- [ ] Transitions to Running state

### Match Execution
- [ ] Only callable by operator
- [ ] Derives pairings from seed + players vec (skips default pubkeys)
- [ ] Validates Entry PDAs via remaining_accounts (mismatch returns InvalidEntryAccount)
- [ ] Updates both tournament.scores[] and Entry.score atomically
- [ ] Enforces sequential batch ordering

### Finalization
- [ ] Only callable by operator
- [ ] Calculates top 25% threshold correctly
- [ ] Includes all ties at threshold
- [ ] Deducts snapshotted house fee correctly
- [ ] Adds remainder (dust) to accumulated_fees
- [ ] Creates next tournament with snapshotted config values

### Payout
- [ ] Verifies winner status on-chain
- [ ] Enforces 30-day claim deadline (constant)
- [ ] Calculates equal share correctly
- [ ] Prevents double-claim
- [ ] Closes Entry account

### Expired Entry Cleanup
- [ ] Only callable by operator
- [ ] Only after 30 days past payout_started_at
- [ ] Winners: adds unclaimed share to accumulated_fees
- [ ] Non-winners: just closes account
- [ ] Adds account rent to accumulated_fees

---

## Error Codes

| Code | Name | Conditions |
|------|------|------------|
| 6000 | InvalidState | Wrong tournament state for instruction |
| 6001 | RegistrationClosed | Entering after Registration |
| 6002 | AlreadyEntered | Duplicate entry |
| 6003 | NotWinner | Claiming payout when not eligible |
| 6004 | AlreadyPaid | Double claim attempt |
| 6005 | Unauthorized | Wrong caller (admin/operator check) |
| 6006 | InsufficientFunds | Pool drained (shouldn't happen) |
| 6007 | MatchesIncomplete | Finalizing before all matches done |
| 6008 | NoFeesToWithdraw | Empty accumulated_fees |
| 6009 | ClaimExpired | Claiming after 30 days |
| 6010 | NotExpired | Closing entry before 30 days |
| 6011 | SlotHashUnavailable | SlotHashes sysvar empty |
| 6012 | TournamentFull | Max participants reached |
| 6013 | InvalidEntryAccount | remaining_accounts PDA mismatch |
| 6014 | InvalidMinParticipants | min_participants must be even and >= 2 |

---

## Testing

- [ ] Unit tests for each instruction
- [ ] Integration test: full tournament lifecycle
- [ ] Edge cases: 2 players, ties at boundary, max size, refund gaps
- [ ] Invariants: no SOL lost, scores sum correctly
