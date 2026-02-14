# Prisoner's Arena Operator

Automated tournament lifecycle manager for Prisoner's Arena.

## Build Requirements

- Rust 1.75+
- OpenSSL development libraries:
  - Ubuntu/Debian: `sudo apt install pkg-config libssl-dev`
  - Fedora: `sudo dnf install pkg-config openssl-devel`
  - macOS: `brew install openssl pkg-config`

## Build

```bash
cargo build -p prisoners-operator --release
```

## Usage

```bash
./target/release/operator \
  --rpc-url http://localhost:8899 \
  --keypair ~/.config/solana/operator.json \
  --program-id DiLEmmA1111111111111111111111111111111111111
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-r, --rpc-url` | `http://localhost:8899` | Solana RPC endpoint |
| `-k, --keypair` | `~/.config/solana/id.json` | Operator keypair path |
| `-p, --program-id` | (required) | Prisoner's Arena program ID |
| `--poll-interval` | `5` | Seconds between state checks |
| `--dry-run` | `false` | Log actions without sending transactions |

## Behavior

The operator runs a continuous loop:

1. **Registration state**: Waits for deadline, then calls `close_registration`
   - Extends deadline if minimum participants not met
   - Refunds last player if odd count

2. **Running state**: Executes matches in batches of 5
   - Calls `run_matches` until all complete
   - Then calls `finalize_tournament`

3. **Payout state**: Monitors claim progress
   - After 30-day expiry, calls `close_expired_entry` for cleanup

## Wallet Funding

The operator wallet needs SOL for transaction fees:
- ~0.000005 SOL per transaction
- ~0.001 SOL per 100-player tournament
- Alert logged when balance falls below 0.1 SOL

## Environment Variables

- `RUST_LOG=operator=debug` — Enable debug logging
