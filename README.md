# Dilemma Arena

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
dilemma-arena/
├── crates/match-logic/    # Shared game logic (Rust)
├── programs/dilemma-arena/# Solana smart contract (Anchor)
├── operator/              # Tournament automation (Rust)
├── docs/                  # Technical specification
└── requirements/          # Acceptance criteria
```

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
just test-contract     # Test smart contract
```
