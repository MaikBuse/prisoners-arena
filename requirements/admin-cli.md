# Admin CLI

Command-line tool for managing Dilemma Arena: admin operations, operator lifecycle, and testing.

## Overview

Single binary (`arena`) with subcommands covering all on-chain interactions. Replaces ad-hoc scripts for initialization, configuration, and playtesting.

**Language:** Rust (same workspace as operator bot)
**Config:** TOML file for network, wallets, and program settings.

---

## Configuration

File: `arena.toml` (or `--config <path>`)

```toml
[network]
rpc_url = "https://api.devnet.solana.com"
program_id = "Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7"

[wallets]
admin = "~/.config/solana/id.json"        # Admin keypair (config owner)
operator = "~/.config/solana/operator.json" # Operator keypair (lifecycle bot)

[defaults]
stake = 100_000_000           # lamports (0.1 SOL)
min_participants = 2
max_participants = 100
registration_duration = 300   # seconds
matches_per_player = 15
house_fee_bps = 0
```

All wallet paths support `~` expansion. CLI flags override config values.

---

## Commands

### Admin

```
arena init
```
Initialize config and Tournament #0. Uses `[wallets.admin]` as signer, sets `[wallets.operator]` as operator. Tournament parameters from `[defaults]`. Fails if config already exists.

```
arena config show
```
Fetch and display current on-chain config (admin, operator, stake, fees, current tournament ID, all parameters).

```
arena config update [--stake <lamports>] [--min-participants <n>] [--max-participants <n>]
                    [--registration-duration <secs>] [--matches-per-player <n>]
                    [--house-fee-bps <n>] [--operator <pubkey>]
```
Update config parameters. Only changed fields are sent (rest are `None`). Admin-only.

```
arena withdraw-fees
```
Withdraw accumulated house fees to admin wallet. Admin-only.

### Tournament Info

```
arena status
```
Show current tournament state: ID, state (Registration/Running/Payout), participant count, deadline/progress, prize pool, time remaining.

```
arena tournament <id>
```
Show details for a specific tournament: all fields, player list, scores (if available), winners.

```
arena entries [--tournament <id>]
```
List all entries for a tournament (default: current). Shows player pubkey, strategy, score, index, payout status.

### Player Actions (Testing)

```
arena enter [--wallet <path>] [--strategy <name>]
```
Enter the current tournament. Wallet defaults to `[wallets.admin]`. Strategy is one of:
`tit-for-tat`, `always-defect`, `always-cooperate`, `grim-trigger`, `pavlov`, `suspicious-tit-for-tat`, `random`, `tit-for-two-tats`, `gradual`

Default strategy: `tit-for-tat`.

```
arena refund [--wallet <path>]
```
Claim refund for current tournament entry. Only valid during Registration.

```
arena claim [--wallet <path>] [--tournament <id>]
```
Claim payout for a won tournament. Only valid during Payout state, within 30-day window.

### Utility

```
arena balance [--wallet <path>]
```
Show SOL balance for a wallet. Defaults to admin wallet. Accepts `admin`, `operator`, or a path.

```
arena airdrop [--wallet <path>] [--amount <sol>]
```
Request devnet airdrop. Default: 1 SOL to admin wallet. Devnet only.

---

## Playtest Workflow

Typical two-wallet playtest session:

```bash
# 1. Initialize (first time only)
arena init

# 2. Check status
arena status

# 3. Enter with both wallets
arena enter --wallet admin --strategy tit-for-tat
arena enter --wallet operator --strategy always-defect

# 4. Wait for registration deadline, then step the operator bot
operator --manual   # closes registration

# 5. Run all matches (repeat until exit code 1 = nothing to do)
operator --manual   # runs one match batch
operator --manual   # runs next batch
# ... repeat ...

# 6. Finalize (operator bot detects all matches complete)
operator --manual   # finalizes tournament

# 7. Check results
arena status
arena entries

# 8. Winner claims
arena claim --wallet admin   # if admin won
```

---

## Acceptance Criteria

- [ ] All admin and player contract instructions callable via CLI (operator actions handled by operator bot)
- [ ] TOML config with sensible defaults
- [ ] Wallet shorthand (`admin`, `operator`) resolves from config
- [ ] Strategy names are case-insensitive, accept kebab-case
- [ ] Clear error messages for common failures (insufficient SOL, wrong state, unauthorized)
- [ ] `--dry-run` flag on all write operations (prints transaction without sending)
- [ ] Works on devnet and localnet (mainnet with `--mainnet` confirmation prompt)

## Dependencies

- `clap` — CLI argument parsing
- `solana-client`, `solana-sdk` — Solana interaction
- `anchor-client` or raw instruction building (same approach as operator bot)
- `toml` + `serde` — config parsing
- `match-logic` crate — for pairing computation in `run-matches`
