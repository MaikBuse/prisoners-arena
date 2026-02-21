# Contract Edge Case & Logical Issue Analysis

Thorough audit of the Prisoner's Arena Solana smart contract for edge cases and logical issues that could disrupt production operations. Covers every instruction handler, the match-logic crate, state transitions, arithmetic safety, and operational liveness.

---

## CRITICAL Issues

---

## HIGH Issues

### 4. `close_reveal` odd-player refund doesn't decrement `entries_remaining` or close entry

**File:** `tournament.rs:165-177`

When an odd number of active players remain after reveal, the last player is refunded their stake. However:

- `entries_remaining` is NOT decremented (the entry still counts as open)
- The entry account is NOT closed (no `close = player` equivalent)

The player receives their stake back but their entry account persists through Running and Payout phases. The operator must call `close_entry` for this phantom entry during Payout.

In `close_entry`, the check `entry.score >= tournament.min_winning_score` would be `0 >= min_winning_score`. Since min_winning_score is always > 0 in practice (minimum match score is 20), no incorrect payout occurs. But if this assumption ever breaks (e.g., contract changes), it would pay the refunded player from the winner pool.

**Consequence:** Operational complexity for operator bot; potential for double payment if min_winning_score ever equals 0.

**Fix:** Decrement `entries_remaining` and close the entry account during the odd-player refund in `close_reveal`.

---

### 5. `forfeits` field is never incremented — dead code subtracted everywhere

**File:** `state.rs:142`, used in `tournament.rs:124,180,203,364,568`

`tournament.forfeits` is initialized to 0, never incremented anywhere in the codebase, yet is subtracted in every `active_count` calculation: `participant_count - forfeits`. The `forfeit_unrevealed` instruction marks players as revealed with a forced strategy but does NOT increment `forfeits` — correctly, since those players still participate.

**Consequence:** Not a bug today (forfeits is always 0, so subtracting it is a no-op). But any future developer might increment it in `forfeit_unrevealed` thinking that's what the field is for, which would break match count calculations and pairing indices.

**Fix:** Either remove the field and all `- forfeits` subtractions, or document clearly that forfeited players are active participants who just get a forced strategy.

---

### 8. Score accumulation without overflow check

**File:** `tournament.rs:426-427, 439-440`

```rust
entry_a_account.score += result.total_score_a;  // no checked_add
tournament.scores[idx_a as usize] += result.total_score_a;  // no checked_add
```

Score is `u32` (max 4,294,967,295). Per match: max ~250 points (50 rounds x 5 points). Per tournament: K matches x 250 = K x 250. For K=199: 49,750. Well within u32 range.

**Consequence:** Safe for current parameters, but a future parameter change could risk overflow. Defense-in-depth recommends `.checked_add()`.

---

### 10. `withdraw_fees` doesn't protect config account rent-exempt minimum

**File:** `admin.rs:235-249`

```rust
let amount = config.accumulated_fees;
config.accumulated_fees = 0;
**config.to_account_info().try_borrow_mut_lamports()? -= amount;
```

If `accumulated_fees` somehow exceeds `lamports - rent_exempt_minimum`, the subtraction would cause the Solana runtime to reject the transaction (account would fall below rent-exempt). The error message would be opaque.

**Consequence:** Transaction failure with unclear error. Not exploitable but confusing operationally.

**Fix:** Cap withdrawal at `lamports - rent_minimum` and leave any excess in `accumulated_fees`.

---

### 11. `accumulated_fees` addition without checked_add in `finalize_tournament`

**File:** `tournament.rs:646`

```rust
config.accumulated_fees += fee_total;
```

Uses `+=` instead of `.checked_add()`. If `accumulated_fees` is already near `u64::MAX`, this could silently overflow and wrap. All other additions to `accumulated_fees` use `checked_add` (e.g., `close_tournament:860`), making this an inconsistency.

---

## LOW Issues

### 14. `close_entry` within claim window pays player but doesn't set `entry.paid_out = true`

**File:** `tournament.rs:783-795`

The non-expired path in `close_entry` pays the player and increments `claims_processed`, but never sets `entry.paid_out = true`. Since the entry is immediately closed (`close = player`), this doesn't cause double payment. However, it means `entry.paid_out` is not a reliable audit trail if the account were ever inspected pre-closure.
