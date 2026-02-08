# Further Developments

Identified during devnet playtest (2026-02-08). Not yet implemented.

---

## 1. Operator Retry-on-Conflict Logic

**Problem:** Devnet RPC returns stale data for ~5-10s after tx confirmation. The operator reads stale state, sends the wrong instruction, and gets `InvalidState` errors.

**Fix:** Catch `InvalidState` (error 6000) in the operator's cycle loop. On conflict, wait 3s, re-read state, and continue to the next action. Works for both manual and continuous mode without needing arbitrary sleeps.

---

## 2. K Matches for All Player Counts

**Problem:** With 2 players and K=15, only 1 match runs because there's only 1 unique pairing (A vs B). The K parameter becomes meaningless for small tournaments.

**Fix:** Change match count calculation to `(N × K) / 2`. Each pairing can repeat with different seeds so every iterated game plays out differently. For N=2, K=15: 15 matches of the same pair, each with a unique game seed. Update `match_logic::calculate_match_count` and `match_logic::get_pairing_for_match`.

---

## 3. Close Tournament Instruction

**Problem:** After payout, tournament accounts retain rent-exempt lamports (~0.002-0.003 SOL per tournament) permanently. No mechanism to reclaim them.

**Fix:** New `close_tournament` instruction:
- Only callable after claim expiry (30 days past payout start)
- Admin/operator-only
- Refund rent deltas to players from the house fee pool (`config.accumulated_fees`), since the house fee pool is the natural source for operational costs
- Return remaining lamports (base rent + any unclaimed pool) to admin/operator
- Zero the account data and close it
- Operator executes this automatically for expired tournaments
- Recovery per tournament (~0.002-0.003 SOL) is ~400-600× the tx cost (~0.000005 SOL)

---

## 4. Frontend Production Mode

**Problem:** `next dev` uses ~530MB RAM (Turbopack, hot reload, watchers) and gets OOM-killed on the 5.8GB VM.

**Fix:** Use `next build` + `next start` instead of `next dev` for the test environment. Production server uses ~100-200MB. Build can be done when nothing else heavy is running.
