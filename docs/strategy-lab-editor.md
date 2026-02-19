# Bytecode Editor + Validator for Strategy Lab

Design for adding an interactive assembly editor with WASM-powered validation and match preview to the Strategy Lab (`/configure`).

---

## Context

The Custom Strategy VM (25-opcode bytecode interpreter, max 64 bytes) is fully implemented in Rust (`contract/crates/match-logic/src/vm.rs`) and integrated into the contract, WASM bindings, and frontend data layer. However, the Strategy Lab has no tooling for authoring or testing custom bytecode — selecting "Custom" just shows a description. This plan adds an interactive assembly editor with WASM-powered validation and match preview.

---

## Architecture Decisions

- **WASM for validation and simulation** — expose `validate_bytecode` from the match-logic WASM module; use existing `replay_match` with `{"Custom": [bytes]}` for preview matches. Guarantees exact parity with on-chain behavior.
- **StrategyPreview converted to async** — uses `useEffect` + loading state for WASM-based custom strategy simulation. Built-in strategies (0-8) keep the fast synchronous JS path; custom (9) uses WASM.
- **Assembly-first editing** — users type mnemonics (`OPP_LAST RETURN`), matching the format on the docs page. Hex dump shown as read-only output.
- **Bytecode state lifted to page level** — `configure/page.tsx` holds `bytecode: number[] | null`, passes down to editor, preview, and config output.

---

## Files

### 1. `contract/crates/match-logic/src/wasm.rs` — Add WASM Export

Add `validate_custom_bytecode` binding:

```rust
#[wasm_bindgen]
pub fn validate_custom_bytecode(bytecode: &[u8]) -> Result<JsValue, JsError> {
    match crate::validate_bytecode(bytecode) {
        Ok(()) => serde_wasm_bindgen::to_value(&serde_json::json!({"valid": true}))
            .map_err(|e| JsError::new(&format!("{}", e))),
        Err(e) => serde_wasm_bindgen::to_value(&serde_json::json!({
            "valid": false,
            "error": format!("{}", e)
        })).map_err(|e| JsError::new(&format!("{}", e))),
    }
}
```

Then rebuild WASM and copy to web: `just build-wasm`

### 2. `web/src/lib/bytecodeAssembler.ts` — Assembler + Disassembler + Constants (new file)

Pure TypeScript, no WASM dependency. Contains:

- **Opcode constants** — `OP` object mirroring Rust `op` module (`COOP=0x00` through `RETURN=0x18`)
- **Mnemonic maps** — bidirectional `MNEMONIC_TO_OP` / `OP_TO_MNEMONIC`
- **`HAS_IMMEDIATE`** — Set of opcodes that take an operand byte (`PUSH`, `JMP_FWD`, `JMP_FWD_IF`)
- **`assemble(source: string): AssemblyResult`** — parse assembly text line by line, strip `;` comments, resolve mnemonics + operands. `PUSH`/`JMP_FWD`/`JMP_FWD_IF` take a numeric operand (decimal or `0x` hex). Returns per-line byte info + full bytecode + errors.
- **`disassemble(bytecode: number[]): string`** — convert bytes back to assembly text (for loading examples)
- **`bytecodeIsStochastic(bytecode: number[]): boolean`** — scan for `RAND` opcode (`0x09`)
- **`EXAMPLE_PROGRAMS`** — array of `{ name, description, bytecode }` from docs page examples (TitForTat 2B, AlwaysDefect 1B, GrimTrigger 8B, Pavlov 10B, TitForTwoTats 10B, Forgiving Detective 25B)

Types:

```typescript
interface AssemblyLine {
  lineNumber: number;
  text: string;
  bytes: number[];       // assembled bytes for this line (0, 1, or 2)
  byteOffset: number;    // offset of first byte in full program
  error?: string;        // parse error on this specific line
}

interface AssemblyResult {
  lines: AssemblyLine[];
  bytecode: number[];    // full assembled bytecode
  errors: string[];      // line-level parse errors
}
```

### 3. `web/src/components/BytecodeEditor.tsx` — Editor UI (new file)

Props: `{ bytecode: number[] | null; onChange: (bytecode: number[] | null) => void }`

Layout:
- **Assembly textarea** (monospace, `min-h-[200px]`) with line-by-line mnemonics
- **Hex gutter** alongside textarea showing per-line assembled bytes (aligned via matching `line-height`)
- **Status bar**: byte counter `N / 64` (green/yellow/red), WASM validation status (checkmark, loading spinner, or error message)
- **Hex dump** (collapsible): read-only `[0x02, 0x18, ...]` with copy button
- **Example loader**: row of small buttons (TitForTat, AlwaysDefect, GrimTrigger, Pavlov, TitForTwoTats, Forgiving Detective) that call `disassemble()` on their bytecode and populate the textarea

Data flow on each input change:
1. `assemble(source)` → get bytes (synchronous, instant)
2. If assembly has errors → show inline errors, `onChange(null)`
3. If assembly succeeds → call WASM `validate_custom_bytecode(bytes)` (async, debounced ~150ms)
4. If WASM validates → show green checkmark, `onChange(bytecode)`
5. If WASM rejects → show error message, `onChange(null)`

Uses `matchReplay.ts`'s `getWasm()` pattern for lazy WASM loading.

### 4. `web/src/components/StrategyPreview.tsx` — Async WASM Preview (modify)

Current state: synchronous `useMemo` calling `simulateVsAll()` from `simulate.ts`.

Changes:
- Expand Props: `{ strategy: number; bytecode?: number[] | null }`
- **Built-in strategies (0-8)**: keep existing synchronous `useMemo` path unchanged
- **Custom strategy (9)**: use `useEffect` + `useState` with WASM `replay_match`:
  - When `strategy === 9` and `bytecode` is valid:
    - Show loading spinner while WASM loads
    - Call `replay_match(customJson, opponentJson, seed, matchIndex, participantCount)` for each of the 9 built-in opponents
    - Use a fixed seed (e.g., `new Uint8Array(32)`) and reasonable defaults (`matchIndex=0..8`, `participantCount=10`)
    - Map `WasmMatchResult` to the same display format as the JS simulation results
    - If bytecode contains `RAND` opcode: run multiple iterations with varying seeds and show avg±stddev
  - When `strategy === 9` and bytecode is null: show placeholder "Write a bytecode program above to preview performance"
- Add `bytecode` to dependency arrays

Reuse `getWasm()` and `makeStrategyJson()` from `web/src/lib/matchReplay.ts`.

### 5. `web/src/components/ConfigOutput.tsx` — Two-Level Commitment (modify)

- Expand Props: `{ strategy: number; bytecode?: number[] | null }`
- When `strategy === 9` and valid bytecode: generate two-level SHA256 output
  - Commitment tab: `SHA256(9 || SHA256(bytecode) || salt[16])` — 49-byte preimage
  - Reveal tab: `strategy: 9, bytecode: [hex], salt: <your 16-byte salt>`
  - TypeScript tab:
    ```typescript
    const strategy = 9;
    const bytecode = Buffer.from([0x02, 0x18]);
    const salt = randomBytes(16);
    const bytecodeHash = createHash('sha256').update(bytecode).digest();
    const preimage = Buffer.from([strategy, ...bytecodeHash, ...salt]);
    const commitment = createHash('sha256').update(preimage).digest();
    ```
- When `strategy === 9` and no valid bytecode: prompt user to write bytecode first

### 6. `web/src/lib/strategyConfig.ts` — One-line addition (modify)

Add `9: 'custom'` to `CLI_KEYS` map (prevents `undefined` in ConfigOutput).

### 7. `web/src/app/configure/page.tsx` — Wire Together (modify)

- Add state: `const [bytecode, setBytecode] = useState<number[] | null>(null)`
- When `strategy === 9`: render `<BytecodeEditor>` section between StrategyInfo and StrategyPreview
- Pass `bytecode` prop to `StrategyPreview` and `ConfigOutput`

### 8. `web/src/lib/__tests__/bytecodeAssembler.test.ts` — Tests (new file)

Use vitest. Groups:
- **Assembler**: round-trip assembly/disassembly for all example programs, single-line and multi-line parsing, comment stripping, hex operand parsing, error cases (unknown mnemonic, missing operand, operand out of range)
- **Disassembler**: all 25 opcodes produce correct mnemonic text, 2-byte instructions show operand
- **Stochasticity detection**: programs with/without `RAND` opcode

---

## Implementation Order

1. `wasm.rs` + `just build-wasm` (add validate export, rebuild WASM module)
2. `bytecodeAssembler.ts` (pure library, no WASM dependency)
3. `bytecodeAssembler.test.ts` (validate assembler correctness)
4. `strategyConfig.ts` (one-line addition)
5. `BytecodeEditor.tsx` (new component, depends on assembler + WASM validate)
6. `StrategyPreview.tsx` (add async WASM path for custom strategy)
7. `ConfigOutput.tsx` (add bytecode prop + two-level commitment)
8. `configure/page.tsx` (wire state + conditional rendering)

---

## Verification

1. `just test-match-logic` — existing VM tests still pass after adding WASM export
2. `cd web && npx vitest run src/lib/__tests__/bytecodeAssembler.test.ts` — assembler tests pass
3. `cd web && npm run build` — no type errors
4. Manual testing in browser:
   - Select Custom → editor appears with example loader buttons
   - Load TitForTat example → assembles to `02 18`, WASM validates green, preview shows matches via WASM replay
   - Load Forgiving Detective → 25 bytes, preview shows distinct behavior vs built-in strategies
   - Type invalid assembly → inline parse error shown, preview shows placeholder
   - Type valid assembly with bad bytecode (e.g., `JMP_FWD 255`) → WASM validation error shown
   - Switch to built-in strategy → preview reverts to synchronous JS path
   - ConfigOutput shows correct two-level SHA256 TypeScript snippet for custom
