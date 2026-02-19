# Custom Strategy VM: On-Chain Bytecode DSL

Design for letting players author custom Prisoner's Dilemma strategies as compact bytecode programs, interpreted on-chain within the existing match execution pipeline.

---

## Motivation

The 9 hardcoded strategies with 5 tunable parameters create ~10 trillion configurations, but the strategic _structure_ is fixed. A player who wants "cooperate for 5 rounds, then play Tit-for-Tat, but always defect if the opponent has defected more than 60% of the time" cannot express that today. A bytecode VM lets players compose arbitrary decision logic while keeping everything deterministic, verifiable, and fully on-chain.

---

## Architecture Overview

```
Player writes bytecode program (max 64 bytes)
        │
        ▼
  ┌──────────────┐    commit phase
  │ SHA256(hash) │ ──────────────► on-chain commitment
  └──────────────┘
        │
        ▼                reveal phase
  ┌──────────────┐
  │  validate()  │ ──────────────► bytecode stored in Entry account
  └──────────────┘
        │
        ▼                match execution
  ┌──────────────┐
  │ execute_bytecode() │ ───────► called per round (20-50× per match)
  └────────────────────┘
```

- **Custom** is strategy variant index `9`, alongside the existing 9 builtin strategies
- Builtins remain as native optimized code paths — zero performance regression
- The VM lives in the `match-logic` crate, compiles to both native (contract) and WASM (frontend replay)

---

## VM Specification

### Machine Model

| Property | Value |
|---|---|
| Stack depth | 8 elements |
| Value type | u8 (0-255) |
| Max program size | 64 bytes |
| Fuel limit | 128 instructions per round |
| Default on error | Cooperate |
| Jump model | Forward-only (guarantees termination) |

### Inputs Available Per Round

| Input | Source |
|---|---|
| Opponent's move history | `&[Move]` slice, grows each round |
| Own move history | `&[Move]` slice, grows each round |
| Round number | `u8`, 0-indexed |
| Deterministic RNG | `SeededRng`, unique per player per round |

### Error Handling

The VM never panics. Every anomalous condition falls back to Cooperate:
- **Stack underflow** → missing values read as 0
- **Stack overflow** → excess pushes silently dropped
- **Out-of-bounds history** → returns 0 (Cooperate)
- **Unknown opcode** → immediate halt, Cooperate
- **Fuel exhaustion** → Cooperate
- **Program falls off end** → Cooperate

This "fail-safe to cooperation" penalizes broken programs without crashing the match.

---

## Instruction Set (25 opcodes)

### Terminals

| Hex | Mnemonic | Bytes | Stack | Description |
|-----|----------|-------|-------|-------------|
| `00` | `COOP` | 1 | → halt | Return Cooperate immediately |
| `16` | `DEFECT` | 1 | → halt | Return Defect immediately |
| `18` | `RETURN` | 1 | [v] → halt | Pop top; 0 = Cooperate, nonzero = Defect |

### Literals & Input

| Hex | Mnemonic | Bytes | Stack | Description |
|-----|----------|-------|-------|-------------|
| `01` | `PUSH imm8` | 2 | → [imm] | Push literal byte |
| `02` | `OPP_LAST` | 1 | → [0\|1] | Opponent's last move (0 = C, 1 = D; 0 if round 0) |
| `03` | `MY_LAST` | 1 | → [0\|1] | My last move (0 if round 0) |
| `04` | `OPP_N` | 1 | [n] → [0\|1] | Opponent's move n rounds ago (0 if out of range) |
| `05` | `MY_N` | 1 | [n] → [0\|1] | My move n rounds ago |
| `06` | `OPP_DEFECTS` | 1 | → [count] | Total opponent defections (capped 255) |
| `07` | `MY_DEFECTS` | 1 | → [count] | Total my defections (capped 255) |
| `08` | `ROUND` | 1 | → [n] | Current round number (0-indexed) |
| `09` | `RAND` | 1 | → [0..99] | Deterministic random 0-99 via per-round SeededRng |
| `17` | `SCORE_LAST` | 1 | → [0..5] | My payoff from last round (3 if round 0) |

### Arithmetic (saturating)

| Hex | Mnemonic | Stack | Description |
|-----|----------|-------|-------------|
| `0A` | `ADD` | [a, b] → [a+b] | Capped at 255 |
| `0B` | `SUB` | [a, b] → [a−b] | Floored at 0 |
| `0C` | `MUL` | [a, b] → [a×b] | Capped at 255 |

### Comparison & Logic

| Hex | Mnemonic | Stack | Description |
|-----|----------|-------|-------------|
| `0D` | `GT` | [a, b] → [0\|1] | 1 if a > b |
| `0E` | `LT` | [a, b] → [0\|1] | 1 if a < b |
| `0F` | `EQ` | [a, b] → [0\|1] | 1 if a == b |
| `10` | `NOT` | [a] → [0\|1] | 0 → 1, nonzero → 0 |
| `11` | `AND` | [a, b] → [0\|1] | Both nonzero → 1 |
| `12` | `OR` | [a, b] → [0\|1] | Either nonzero → 1 |

### Stack & Control Flow

| Hex | Mnemonic | Bytes | Stack | Description |
|-----|----------|-------|-------|-------------|
| `13` | `DUP` | 1 | [a] → [a, a] | Duplicate top |
| `14` | `JMP_FWD off` | 2 | — | Jump forward `off` bytes (unconditional) |
| `15` | `JMP_FWD_IF off` | 2 | [cond] → — | Pop; if nonzero, jump forward `off` bytes |

---

## Example Programs

### TitForTat (2 bytes)

```
02 18       OPP_LAST RETURN
```
Copy opponent's last move. Round 0: opponent history empty → 0 → Cooperate.

### AlwaysDefect (1 byte)

```
16          DEFECT
```

### GrimTrigger (8 bytes)

```
06          OPP_DEFECTS         ; [count]
01 00       PUSH 0              ; [count, 0]
0D          GT                  ; [count > 0]
15 01       JMP_FWD_IF 1        ; if true, skip to DEFECT
00          COOP
16          DEFECT
```

### Pavlov (10 bytes)

Win-stay, lose-switch: repeat last move if payoff ≥ 3, otherwise switch.

```
17          SCORE_LAST          ; [score]
01 03       PUSH 3              ; [score, 3]
0E          LT                  ; [bad?]  1 if score < 3
03          MY_LAST             ; [bad?, my_d]
0F          EQ                  ; [should_coop]  bad==my_d → cooperate
15 01       JMP_FWD_IF 1        ; if true → COOP
16          DEFECT
00          COOP
```

Trace: CC→score=3, bad=0, my_d=0, EQ=1→COOP (stay). CD→score=0, bad=1, my_d=0, EQ=0→DEFECT (switch). DC→score=5, bad=0, my_d=1, EQ=0→DEFECT (stay). DD→score=1, bad=1, my_d=1, EQ=1→COOP (switch).

### TitForTwoTats (10 bytes)

Only retaliate after two consecutive opponent defections.

```
02          OPP_LAST            ; [last]
01 01       PUSH 1              ; [last, 1]
04          OPP_N               ; [last, second_last]
11          AND                 ; [both_defected]
15 01       JMP_FWD_IF 1        ; if true → DEFECT
00          COOP
16          DEFECT
```

### Forgiving Detective (~25 bytes)

Cooperate rounds 0-2, defect round 3 (probe). After: if opponent never defected, exploit (AlwaysDefect); otherwise play TitForTat.

```
08          ROUND               ; [round]
01 03       PUSH 3              ; [round, 3]
0D          GT                  ; [past_opening?]
15 06       JMP_FWD_IF 6        ; if past opening, jump to analysis
08          ROUND               ; [round]
01 03       PUSH 3              ; [round, 3]
0F          EQ                  ; [is_round_3?]
15 01       JMP_FWD_IF 1        ; if round 3 → defect
00          COOP                ; rounds 0-2: cooperate
16          DEFECT              ; round 3: probe defect
; -- analysis (round > 3) --
06          OPP_DEFECTS         ; [opp_d]
01 00       PUSH 0              ; [opp_d, 0]
0F          EQ                  ; [naive?]
15 02       JMP_FWD_IF 2        ; if never defected → exploit
02          OPP_LAST            ; [opp_last]
18          RETURN              ; TFT: cooperate if they did, defect if they did
16          DEFECT              ; exploit naive opponent
```

25 bytes. A novel strategy impossible to express with the current 9 builtin strategies.

---

## On-Chain State Changes

### Entry Account (+65 bytes)

```rust
pub struct Entry {
    // ... existing fields unchanged ...
    pub bytecode_len: u8,       // NEW: 0 for builtin strategies
    pub bytecode: [u8; 64],     // NEW: program bytes (only used when strategy == Custom)
}

// Entry::LEN: 147 → 212 bytes
// Extra rent cost: ~0.000452 SOL per entry (~$0.07)
```

### Strategy Enum

```rust
pub enum Strategy {
    TitForTat,            // 0
    AlwaysDefect,         // 1
    AlwaysCooperate,      // 2
    GrimTrigger,          // 3
    Pavlov,               // 4
    SuspiciousTitForTat,  // 5
    Random,               // 6
    TitForTwoTats,        // 7
    Gradual,              // 8
    Custom,               // 9 — NEW
}
```

### Tournament Account — No Change

Bytecode is NOT stored in the tournament's per-player vectors. The tournament stores `strategy: 9` for custom players, and `run_matches` reads bytecode from the Entry account (already loaded via `remaining_accounts`). This keeps `BYTES_PER_PLAYER` at 42 bytes.

### Commit-Reveal

| Strategy | Commitment hash |
|---|---|
| Builtin (unchanged) | `SHA256(strategy_u8 \|\| params[5] \|\| salt[16])` — 22-byte preimage |
| Custom (new) | `SHA256(9u8 \|\| SHA256(bytecode[0..len]) \|\| salt[16])` — 49-byte preimage |

Two-level hashing for Custom keeps the preimage fixed-length and lets the bytecode hash be displayed independently.

### Forfeit

`forfeit_unrevealed` keeps `commitment[0] % 9` — forfeited players never receive Custom. No change needed.

---

## match-logic Crate Changes

### New `PlayerStrategy` Type

```rust
/// Unified strategy: builtin (native fast path) or custom (bytecode VM)
pub enum PlayerStrategy {
    Builtin(Strategy),
    Custom(Vec<u8>),
}
```

### Modified `run_match` Signature

```rust
// Before:
pub fn run_match(strategy_a: &Strategy, strategy_b: &Strategy, ...) -> MatchResult

// After:
pub fn run_match(strategy_a: &PlayerStrategy, strategy_b: &PlayerStrategy, ...) -> MatchResult
```

Internally dispatches to `execute_strategy` (native) or `execute_bytecode` (VM) per round.

### On-Chain `to_match_strategy` → `to_player_strategy`

```rust
pub fn to_player_strategy(
    strategy: Strategy,
    params: &StrategyParams,
    bytecode: Option<&[u8]>,  // None for builtins
) -> match_logic::PlayerStrategy
```

---

## Bytecode Validation (during reveal)

Checked on-chain to reject malformed programs before they enter the match pipeline:

1. **Non-empty**: `len > 0`
2. **Length limit**: `len <= 64`
3. **Valid opcodes**: every byte is a known opcode (0x00-0x18)
4. **Complete immediates**: PUSH/JMP_FWD/JMP_FWD_IF have their operand byte
5. **Jump bounds**: `pc + offset <= bytecode.len()` for all jumps
6. **Has terminal**: at least one COOP, DEFECT, or RETURN instruction

Stack depth is NOT validated statically — handled gracefully at runtime.

---

## Compute Budget

### Per-Opcode Cost Estimate

| Opcode class | ~CU per execution |
|---|---|
| Stack ops (PUSH, DUP, NOT) | 5 |
| Arithmetic/comparison | 8 |
| History access (OPP_LAST, MY_LAST) | 10 |
| Indexed history (OPP_N, MY_N) | 15 |
| Aggregate (OPP_DEFECTS) | 5 + 0.3 × round |
| Control flow (JMP_FWD, JMP_FWD_IF) | 5 |
| SCORE_LAST | 15 |

### Transaction Budget

| Scenario | Estimated CU | % of 1.4M limit |
|---|---|---|
| Current builtins (5 matches) | ~60K | 4% |
| All custom, worst case (5 × 50 rounds × 64-byte programs) | ~400K | 29% |
| Typical mixed (5 × 35 rounds × ~20-byte programs) | ~140K | 10% |

No need to reduce `MATCHES_PER_TX`. The fuel limit (128 instructions/round) is the hard backstop.

### Validation Cost (during reveal)

Single linear scan, O(n) for n-byte program: ~200-400 CU. Two-level SHA256: ~200 CU. Negligible.

---

## WASM & Frontend

The VM module uses only core Rust (no std, no heap beyond Vec in PlayerStrategy). It compiles to WASM unchanged.

### WASM Replay

`PlayerStrategy::Custom` serializes as JSON:
```json
{"Custom": [2, 24]}
```

Frontend `matchReplay.ts` checks `strategyIndex === 9` and passes the bytecode array to the WASM replay function.

### Strategy Display

`StrategyBadge.tsx` adds a "Custom" entry. The bytecode hex can be displayed as a tooltip or expandable detail.

---

## Implementation Order

### Phase 1: VM in match-logic (no on-chain changes, unit-testable)
1. Create `vm.rs` — interpreter, validator, opcode constants
2. Add `PlayerStrategy` enum to `strategy.rs`
3. Modify `run_match` to accept `PlayerStrategy`
4. Unit tests: every opcode, edge cases, encode all 9 builtins as bytecode and assert parity

### Phase 2: On-chain contract
5. Add `Custom` to `Strategy` enum in `state.rs`
6. Expand Entry with bytecode fields, update `Entry::LEN`
7. Update `to_player_strategy()` conversion
8. Modify `reveal_strategy` — accept bytecode, validate, verify two-level commitment
9. Modify `run_matches` — extract bytecode from Entry for custom players
10. Add `InvalidBytecode` error variant

### Phase 3: Operator & frontend
11. Update operator Entry deserialization
12. Update WASM bindings
13. Update frontend strategy list and match replay

### Phase 4: Testing
14. Integration test: full tournament lifecycle with custom strategy players
15. Parity tests: builtins encoded as bytecode produce identical match results
16. Fuzz: random bytecode programs never crash

---

## Open Questions

- **Bytecode authoring UX**: Should we build a visual editor, an assembly-like text format, or expect players to author hex directly? (Can be a follow-up.)
- **Program size limit**: 64 bytes allows ~30-40 instructions. Enough for creative strategies while staying compute-safe. Could increase to 128 later if demand warrants.
- **Future opcodes**: Reserved opcode space (0x19-0xFF) allows adding instructions without breaking existing programs. Candidates: `DIV`, `MOD`, `SWAP`, `OPP_COOP_COUNT`, `HIST_LEN`.
