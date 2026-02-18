# Prisoner's Arena

Competitive AI tournament on Solana — Iterated Prisoner's Dilemma for SOL prizes.

> **Status:** Core implementation complete. Contract compiles, match logic tested. Awaiting integration tests and localnet deployment.

## The Game

Two players independently choose to **cooperate** or **defect**:

| You \ Them | Cooperate | Defect |
|------------|-----------|--------|
| **Cooperate** | 3, 3 | 0, 5 |
| **Defect** | 5, 0 | 1, 1 |

Over many rounds, strategy matters more than any single move.

## How It Works

1. **Enter** — Pay fixed stake, pick a strategy
2. **Wait** — Registration closes when deadline passes (extends if minimum not met)
3. **Compete** — Each player plays 15 matches, ~10 rounds each
4. **Win** — Top 25% split the prize pool equally (ties included)
5. **Claim** — Winners collect their share within 30 days

## Strategies

Nine base strategies available — see `requirements/match-logic.md` for the full list.

## Why It's Fair

- **Anonymous pairings** — You don't know who you're playing
- **Randomized rounds** — No endgame exploitation
- **Equal split** — All winners profit the same %
- **Trustless** — All outcomes verifiable on-chain
- **Open** — Build your own client, verify the contract

---

## Project Structure

```
prisoners-arena/
├── contract/                  # Git submodule (public repo)
│   ├── crates/match-logic/    # Shared game logic (Rust)
│   └── programs/prisoners-arena/ # Solana smart contract (Anchor)
├── operator/                  # Tournament automation (Rust)
├── cli/                       # Admin CLI tool (Rust)
├── web/                       # Next.js frontend
├── docs/                      # Technical specification
└── requirements/              # Acceptance criteria
```

> Clone with submodules: `git clone --recurse-submodules <repo-url>`

## Documentation

- **Architecture**: `docs/architecture.md` — comprehensive technical spec
- **Status**: `PLAN.md` — current progress and tasks
- **Requirements**: `requirements/*.md` — acceptance criteria per component

## Quick Start

```bash
# Install just (command runner)
cargo install just

# See all commands
just

# Run tests
just test

# Build everything
just build
```

## Development

### Prerequisites

- [just](https://github.com/casey/just)
- Rust (via rustup)
- Solana CLI 1.18+
- Anchor Framework
### Commands

```bash
just test-match-logic  # Test game logic
just test-contract     # Test smart contract (integration tests)
```

### Contract Test Setup

Integration tests (`just test-contract`) require the BPF binary at `target/deploy/prisoners_arena.so` to be compiled with the `testing` feature flag, which lowers timing constants (claim expiry, closure delay) from 30 days to 2 seconds.

`anchor test` caches the binary — if a stale binary exists from a previous build without the feature flag, tests will silently use wrong timing and fail. If you see timing-related test failures (e.g. `ClaimExpired` not triggering, `TournamentNotCloseable` vs `EntriesRemaining`), do a clean rebuild:

```bash
cargo clean --manifest-path contract/Cargo.toml
anchor build -- --features testing
cp contract/target/deploy/prisoners_arena.so target/deploy/
just test-contract
```

> **Why the copy?** The contract lives in a git submodule, so Cargo outputs to `contract/target/deploy/`. Anchor's test validator looks for the binary in the monorepo root's `target/deploy/`.
