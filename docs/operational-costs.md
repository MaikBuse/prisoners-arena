# Operational Costs & Scaling Analysis

Budget requirements, on-chain rent, and technical limits for running Prisoner's Arena tournaments.

All estimates use Phase 1 config from [configuration-strategy.md](configuration-strategy.md): 0.1 SOL stake, 12 tournaments/day, `operator_tx_fee = 5,000 lamports`, `house_fee = 0%`.

---

## Wallet Budgets

### Admin Wallet

One-time costs only. Net positive after launch via `accumulated_fees`.

| Cost | Amount | Notes |
|---|---|---|
| Program deployment (mainnet) | ~3.5 SOL | 493 KB binary, program data account |
| `initialize_config` (Config + Tournament #0 PDAs) | ~0.005 SOL | 177 + 249 bytes rent |
| Buffer for config updates, fee withdrawals | 0.5 SOL | |
| **Total** | **~4 SOL** | |

Revenue sources (via `withdraw_fees`):
- Tournament account rent recovered at `close_tournament`
- House fees (0% at launch, configurable)
- Unclaimed winner prizes (after 30-day expiry)
- Rounding dust

### Operator Wallet

The operator's main ongoing cost is **tournament rent that is not returned to it** — at `close_tournament`, rent flows to `config.accumulated_fees` (admin), not back to the operator.

| Cost | Per Tournament | Monthly (360 tournaments) | Reimbursed? |
|---|---|---|---|
| Tournament PDA rent (~249 bytes base) | ~0.00262 SOL | ~0.94 SOL | No — goes to admin at close |
| Transaction fees (~61 txs at 20 players) | ~0.000305 SOL | ~0.11 SOL | Yes — from prize pool at `finalize_tournament` |
| Failed/retried transactions | varies | ~0.1 SOL estimate | No |
| **Net monthly burn** | | **~1 SOL** | |

Starter balance: **~1.2 SOL** (first month's rent + tx float + buffer).

### Reimbursement Mechanism

Each operator instruction adds `config.operator_tx_fee` to `tournament.operator_costs`. At `finalize_tournament`:

1. Pre-calculates remaining costs (`close_entry` × N + `close_tournament` × 1)
2. Transfers total `operator_costs` from the prize pool to the operator wallet in a single lump sum

The operator fronts transaction fees and gets reimbursed in bulk at finalization.

### Self-Sustaining Loop

The operator's rent payments (~0.94 SOL/month) flow to `accumulated_fees`. The admin can `withdraw_fees` and top up the operator — SOL circulates between wallets rather than being lost.

---

## On-Chain Rent

### Account Sizes

| Account | Size | Rent-Exempt Minimum |
|---|---|---|
| Config PDA | 177 bytes | ~0.00212 SOL |
| Tournament PDA (empty) | 249 bytes (BASE_SPACE) | ~0.00262 SOL |
| Tournament PDA (20 players) | 249 + (20 × 37) = 989 bytes | ~0.00777 SOL |
| Tournament PDA (50 players) | 249 + (50 × 37) = 2,099 bytes | ~0.01550 SOL |
| Tournament PDA (5000 players) | 249 + (5000 × 37) = 185,249 bytes | ~1.29 SOL |
| Entry PDA (per player) | 207 bytes | ~0.00233 SOL |

`BYTES_PER_PLAYER = 37` (32-byte pubkey + 4-byte score + 1-byte strategy).

Tournament accounts grow via `realloc` as players join; each player pays their own incremental rent. Entry account rent is paid by the player and returned to them at `close_entry` (`close = player`).

### Retaining Tournament History

Cost of keeping the N most recent tournament accounts on-chain (not calling `close_tournament`):

| Retained | 4 players each | 20 players each | 50 players each | 5000 players each |
|---|---|---|---|---|
| 10 tournaments | 0.037 SOL | 0.078 SOL | 0.155 SOL | 12.9 SOL |
| 50 tournaments | 0.183 SOL | 0.389 SOL | 0.775 SOL | 64.5 SOL |

At typical early adoption (20 players), 10 retained tournaments cost ~0.08 SOL — negligible. At max capacity (5000 players), the same costs ~12.9 SOL.

---

## Scaling to 5000 Players

`MAX_PARTICIPANTS = 5000` is an explicit constant in the contract. All hard constraints are satisfied:

| Constraint | At 5000 Players | Limit | Status |
|---|---|---|---|
| `max_participants` field (`u16`) | 5,000 | 65,535 | OK |
| Account size | 181 KB | 10 MB | OK |
| Realloc per entry | 37 bytes | 10,240 bytes/tx | OK |
| Max score (99 × 30 × 5 = 14,850) | `u32` | 4,294,967,295 | OK |
| Compute per `run_matches` tx | ~170K CU | 200K CU default | OK |

### Pairing at Scale

Full round-robin becomes infeasible above 200 players. The pairing logic adapts:

```
n ≤ 200  →  full round-robin, K = n - 1
n > 200  →  K = clamp(config.matches_per_player, 49, 99)
```

At 5000 players with K clamped to 49:

| Metric | Value |
|---|---|
| Total matches | 5,000 × 49 / 2 = 122,500 |
| `run_matches` transactions | 24,500 |
| `close_entry` transactions | 5,000 |
| Total operator transactions | ~29,500 |
| Match phase duration (~400ms/tx) | ~2.7 hours |
| Full tournament cycle | ~3-4 hours |

### Tradeoff

Below 200 players, every agent plays every other agent — the fairest possible evaluation with no "bad draw" excuses. Above 200, players face a random subset of opponents (49-99 matches via seeded RNG). The leaderboard is statistically representative but no longer exhaustive.

---

## Operator Transaction Breakdown

Per-tournament operator transactions for a 20-player tournament:

| Instruction | Count | Notes |
|---|---|---|
| `close_registration` | 1 | Registration → Reveal |
| `close_reveal` | 1 | Reveal → Running (refunds 1 player if odd count) |
| `forfeit_unrevealed` | 0-N | One per unrevealed player (best case: 0) |
| `run_matches` | ceil(matches / 5) | 5 matches per tx (`MATCHES_PER_TX = 5`) |
| `finalize_tournament` | 1 | Creates next tournament PDA, reimburses operator |
| `close_entry` | N | One per player (entry rent → player) |
| `close_tournament` | 1 | All remaining lamports → `accumulated_fees` |

**20 players:** 190 matches → 38 match txs → **61 total txs**
**50 players:** 1,225 matches → 245 match txs → **298 total txs**
**5000 players:** 122,500 matches → 24,500 match txs → **~29,500 total txs**
