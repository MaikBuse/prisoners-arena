# Prisoner's Arena

Competitive AI tournament on Solana — Iterated Prisoner's Dilemma for SOL prizes.

## Getting Started

This project uses [just](https://github.com/casey/just) as a command runner.

```bash
just --list   # see all available commands
just build    # build everything
just test     # run all tests
```

## Operator Configuration

The operator bot drives the tournament lifecycle (registration close, reveal close, match execution, finalize, cleanup). It reads configuration from a TOML file and CLI flags. CLI flags override TOML values.

The operator creates an `operator.db` (SQLite) file next to the config file for internal state tracking.

### Config file (`arena.toml`)

| Section | Key | Description | Default |
|---------|-----|-------------|---------|
| `[network]` | `rpc_url` | Solana RPC endpoint | `http://localhost:8899` |
| `[network]` | `program_id` | On-chain program ID | *(required)* |
| `[wallets]` | `operator` | Path to operator keypair JSON | `~/.config/solana/id.json` |
| `[web]` | `url` | Frontend URL for pre-caching | *(optional)* |

### CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config` | Config file path | `arena.toml` |
| `-r, --rpc-url` | RPC endpoint (overrides TOML) | — |
| `-k, --keypair` | Operator keypair (overrides TOML) | — |
| `-p, --program-id` | Program ID (overrides TOML) | — |
| `--poll-interval` | Seconds between cycles | `5` |
| `--dry-run` | Log only, no transactions | `false` |
| `--manual` | Single cycle then exit | `false` |
| `--web-url` | Frontend URL (overrides TOML) | — |

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level filter | `operator=info` |

## Simulator Configuration

The simulator populates tournaments with synthetic players for testing. Configuration uses a 3-layer precedence: **env vars > TOML `[simulator]` section > built-in defaults**.

### Env vars / TOML keys

| Env Var | TOML key | Description | Default |
|---------|----------|-------------|---------|
| `RPC_URL` | `network.rpc_url` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `PROGRAM_ID` | `network.program_id` | On-chain program ID | `2j8FBKuXsBsHRjfVLWCdPtZbPDLKzM3jXG7JSAy4jtga` |
| `FUNDER` | `simulator.funder` | Path to funder keypair | `~/.config/solana/id.json` |
| `PLAYER_COUNT_MIN` | `simulator.player_count_min` | Min players per tournament | `4` |
| `PLAYER_COUNT_MAX` | `simulator.player_count_max` | Max players per tournament | `4` |
| `REFUND_COUNT_MIN` | `simulator.refund_count_min` | Min players that refund | `0` |
| `REFUND_COUNT_MAX` | `simulator.refund_count_max` | Max players that refund | `0` |
| `NO_REVEAL_COUNT_MIN` | `simulator.no_reveal_count_min` | Min players skipping reveal | `0` |
| `NO_REVEAL_COUNT_MAX` | `simulator.no_reveal_count_max` | Max players skipping reveal | `0` |
| `WALLET_DIR` | `simulator.wallet_dir` | Dir for player keypair files | `./simulator-wallets` |
| `STRATEGIES` | `simulator.strategies` | Comma-separated strategy indices | all (0-8) |
| `MIN_PLAYER_BALANCE` | `simulator.min_player_balance` | Top-up threshold (lamports) | `100000000` |
| `TOPUP_AMOUNT` | `simulator.topup_amount` | Fund players to (lamports) | `500000000` |
| `TX_DELAY_MS` | `simulator.tx_delay_ms` | Delay between txns (ms) | `500` |
| `RUST_LOG` | — | Log level filter | `simulator=info` |

### CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config` | Config file path | `arena.toml` |
| `--dry-run` | Log only, no transactions | `false` |
| `--poll-interval` | Seconds between cycles | `10` |
