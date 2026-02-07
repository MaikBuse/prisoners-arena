# Match Logic Crate

Acceptance criteria for shared game library. See `docs/architecture.md` for implementation details.

---

## Crate Structure

```
crates/match-logic/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── strategy.rs    # Strategy execution
│   ├── game.rs        # Match execution
│   ├── pairing.rs     # Deterministic pairings
│   └── wasm.rs        # WASM bindings (feature-gated)
```

---

## Acceptance Criteria

### Strategies
- [ ] TitForTat: mirrors last move, starts cooperate
- [ ] AlwaysDefect: always defects
- [ ] AlwaysCooperate: always cooperates
- [ ] GrimTrigger: cooperates until first defection, then always defects
- [ ] Pavlov: win-stay lose-switch
- [ ] SuspiciousTitForTat: mirrors, starts defect
- [ ] Random: 50/50 each round
- [ ] TitForTwoTats: defects after two consecutive defections
- [ ] Gradual: cumulative escalating retaliation (N(N+1)/2 total defections after N opponent defections)

### Match Execution
- [ ] Payoff matrix: (C,C)=3,3 (C,D)=0,5 (D,C)=5,0 (D,D)=1,1
- [ ] Round count: 5-15, geometric distribution (~10 expected)
- [ ] Simultaneous moves (neither sees other's current move)
- [ ] Returns full round-by-round history

### Pairing
- [ ] Deterministic from seed + players vec
- [ ] Each player appears in exactly K matches
- [ ] Deduplicated: (A,B) = (B,A)
- [ ] Skips refunded players (default pubkeys)
- [ ] Shuffled execution order
- [ ] Assumes even participant_count (guaranteed by close_registration)

### Determinism
- [ ] No floating-point math (integers only)
- [ ] WASM output matches native output byte-for-byte
- [ ] Same seed + inputs = same outputs always

### WASM
- [ ] `replay_match()` export for visualization
- [ ] `get_strategy_description()` export for UI
- [ ] Builds with wasm-pack

---

## Testing

- [ ] Strategy behavior unit tests
- [ ] Payoff calculation tests
- [ ] Round distribution tests (statistical)
- [ ] Pairing determinism tests
- [ ] Pairing with gaps (refunded players) tests
- [ ] WASM vs native comparison test
