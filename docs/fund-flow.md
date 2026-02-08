# Dilemma Arena — Fund Flow

## Accounts (Wallets, PDAs)

| Account | Type | Seeds | Role |
|---------|------|-------|------|
| **Admin Wallet** | EOA | — | Deploys, updates config, withdraws fees |
| **Operator Wallet** | EOA | — | Runs tournament lifecycle (close_registration, run_matches, finalize, close_expired_entry, close_tournament) |
| **Player Wallet** | EOA | — | Enters tournaments, claims refunds/payouts |
| **Config PDA** | PDA | `["config"]` | Global config + fee accumulator (holds fee lamports) |
| **Tournament PDA** | PDA | `["tournament", id_le_bytes]` | Holds prize pool lamports during lifecycle |
| **Entry PDA** | PDA | `["entry", tournament_key, player_key]` | Per-player entry; rent-funded by player |

## Fund Flow Diagram

```
                        ┌─────────────┐
                        │ Admin Wallet│
                        └──────▲──────┘
                               │ withdraw_fees
                               │ (accumulated_fees → admin)
                               │
┌──────────────┐        ┌──────┴──────┐        ┌─────────────────┐
│Player Wallet │──────►│  Config PDA  │◄───────│ Tournament PDA  │
│              │  init  │             │  fees   │   (per tourney) │
│              │ (rent) │ holds:      │ ───────►│                 │
│              │        │ accumulated │         │ holds:          │
│              │        │ _fees       │         │ prize pool      │
└──┬───▲───▲──┘        └─────────────┘         └──┬──▲───────────┘
   │   │   │                                      │  │
   │   │   │            ┌─────────────┐           │  │
   │   │   │            │  Entry PDA  │           │  │
   │   │   │            │ (per player)│           │  │
   │   │   │            └─────────────┘           │  │
   │   │   │                                      │  │
   │   │   └──────────────────────────────────────┘  │
   │   │          claim_payout / claim_refund        │
   │   │                                             │
   │   └──── (entry rent returned on close) ─────────┘
   │                                                 
   └──── enter_tournament (stake transfer) ──────────►
```

## Detailed Transfers by Instruction

### 1. `initialize_config` (Admin)
- **Admin → Config PDA**: rent for Config account
- **Admin → Tournament PDA #0**: rent for Tournament account
- No stake movement.

### 2. `enter_tournament` (Player)
- **Player → Tournament PDA**: `stake` lamports (CPI system_program::transfer)
- **Player → Entry PDA**: rent (Anchor `init`, payer = player)
- **Player → Tournament PDA**: realloc rent increase (36 bytes/player)
- Tournament: `pool += stake`, `entries_remaining += 1`

### 3. `claim_refund` (Player, during Registration only)
- **Tournament PDA → Player**: `stake` lamports (direct lamport manipulation)
- **Entry PDA → Player**: rent returned (Anchor `close = player`)
- Tournament: `pool -= stake`, `entries_remaining -= 1`

### 4. `close_registration` (Operator)
- If **under min_participants**: deadline extended, no transfers.
- If **odd participant count**: **Tournament PDA → last player**: `stake` refund (lamport manipulation). That player's entry remains open but slot zeroed.
- Transitions to `Running` state.

### 5. `run_matches` (Operator, batches of 5)
- **No fund transfers.** Only score updates on Entry PDAs + Tournament scores vec.

### 6. `finalize_tournament` (Operator)
- **Tournament PDA → Config PDA**: `house_fee + dust` lamports
  - `house_fee = pool × house_fee_bps / 10000`
  - `dust = winner_pool_raw - (per_winner × winner_count)` (rounding remainder)
  - `config.accumulated_fees += fee_total`
- **Operator → Next Tournament PDA**: rent for new tournament account
- Sets `winner_pool = per_winner × winner_count`
- Transitions to `Payout` state; creates Tournament N+1 in `Registration`.

### 7. `claim_payout` (Player, within 30 days)
- **Tournament PDA → Player**: `winner_pool / winner_count` lamports
- **Entry PDA → Player**: rent returned (Anchor `close = player`)
- `entries_remaining -= 1`

### 8. `close_expired_entry` (Operator, after 30-day claim expiry)
- If **unclaimed winner**: **Tournament PDA → Config PDA**: their share (capped at tournament surplus above rent-exempt min)
  - `config.accumulated_fees += transfer_amount`
- **Entry PDA → Operator**: rent returned (Anchor `close = operator`)
- `entries_remaining -= 1`

### 9. `close_tournament` (Operator/Admin, after 30 days + all entries closed)
- **Tournament PDA → Config PDA**: ALL remaining lamports (rent + any surplus)
  - `config.accumulated_fees += total_lamports`
  - Tournament account zeroed → GC'd by Solana runtime.

### 10. `withdraw_fees` (Admin)
- **Config PDA → Admin Wallet**: `accumulated_fees` lamports
- `config.accumulated_fees = 0`

## Lifecycle Summary

```
Player stakes ──► Tournament Pool
                      │
              ┌───────┴────────┐
              │                │
         house fee         winner pool
         + dust               │
              │          ┌────┴────┐
              ▼          │         │
         Config PDA   claimed   unclaimed
         (fees)       by winners  (30d expiry)
              │          │         │
              │          ▼         ▼
              │     Player     Config PDA
              │     Wallets    (fees)
              │
              ▼
         Admin Wallet
         (withdraw_fees)
```

All SOL eventually flows to either **winners** or **admin** (via fees). Tournament PDA rent is recovered to Config PDA fees on close. Entry PDA rent returns to player (on claim/refund) or operator (on expired close).
