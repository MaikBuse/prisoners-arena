/**
 * Bytecode assembler and disassembler for the Custom Strategy VM.
 *
 * Pure TypeScript — no WASM dependency. Mirrors the opcode constants
 * from contract/crates/match-logic/src/vm.rs.
 */

// ── Opcodes (must match vm.rs op module) ────────────────────────────

export const OP = {
  COOP: 0x00,
  PUSH: 0x01,
  OPP_LAST: 0x02,
  MY_LAST: 0x03,
  OPP_N: 0x04,
  MY_N: 0x05,
  OPP_DEFECTS: 0x06,
  MY_DEFECTS: 0x07,
  ROUND: 0x08,
  RAND: 0x09,
  ADD: 0x0a,
  SUB: 0x0b,
  MUL: 0x0c,
  GT: 0x0d,
  LT: 0x0e,
  EQ: 0x0f,
  NOT: 0x10,
  AND: 0x11,
  OR: 0x12,
  DUP: 0x13,
  JMP_FWD: 0x14,
  JMP_FWD_IF: 0x15,
  DEFECT: 0x16,
  SCORE_LAST: 0x17,
  RETURN: 0x18,
} as const;

// ── Bidirectional mnemonic maps ─────────────────────────────────────

export const MNEMONIC_TO_OP: Record<string, number> = {
  COOP: OP.COOP,
  PUSH: OP.PUSH,
  OPP_LAST: OP.OPP_LAST,
  MY_LAST: OP.MY_LAST,
  OPP_N: OP.OPP_N,
  MY_N: OP.MY_N,
  OPP_DEFECTS: OP.OPP_DEFECTS,
  MY_DEFECTS: OP.MY_DEFECTS,
  ROUND: OP.ROUND,
  RAND: OP.RAND,
  ADD: OP.ADD,
  SUB: OP.SUB,
  MUL: OP.MUL,
  GT: OP.GT,
  LT: OP.LT,
  EQ: OP.EQ,
  NOT: OP.NOT,
  AND: OP.AND,
  OR: OP.OR,
  DUP: OP.DUP,
  JMP_FWD: OP.JMP_FWD,
  JMP_FWD_IF: OP.JMP_FWD_IF,
  DEFECT: OP.DEFECT,
  SCORE_LAST: OP.SCORE_LAST,
  RETURN: OP.RETURN,
};

export const OP_TO_MNEMONIC: Record<number, string> = Object.fromEntries(
  Object.entries(MNEMONIC_TO_OP).map(([k, v]) => [v, k]),
);

/** Opcodes that consume a 1-byte immediate operand. */
const HAS_IMMEDIATE: Set<number> = new Set([OP.PUSH, OP.JMP_FWD, OP.JMP_FWD_IF]);

const MAX_BYTECODE_LEN = 64;

// ── Types ───────────────────────────────────────────────────────────

export interface AssemblyLine {
  lineNumber: number;
  text: string;
  bytes: number[];
  byteOffset: number;
  error?: string;
}

export interface AssemblyResult {
  lines: AssemblyLine[];
  bytecode: number[] | null; // null if any errors
  errors: string[];
}

// ── Assembler ───────────────────────────────────────────────────────

export function assemble(source: string): AssemblyResult {
  const rawLines = source.split('\n');
  const lines: AssemblyLine[] = [];
  const allBytes: number[] = [];
  const errors: string[] = [];
  let byteOffset = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const raw = rawLines[i];
    // Strip comments
    const stripped = raw.split(';')[0].trim();

    if (stripped === '') {
      lines.push({ lineNumber, text: raw, bytes: [], byteOffset });
      continue;
    }

    const tokens = stripped.split(/\s+/);
    const lineBytes: number[] = [];
    let lineError: string | undefined;
    let t = 0;

    while (t < tokens.length) {
      const mnemonic = tokens[t].toUpperCase();
      const opcode = MNEMONIC_TO_OP[mnemonic];

      if (opcode === undefined) {
        lineError = `Unknown mnemonic: ${tokens[t]}`;
        break;
      }

      lineBytes.push(opcode);

      if (HAS_IMMEDIATE.has(opcode)) {
        t++;
        if (t >= tokens.length) {
          lineError = `${mnemonic} requires an operand`;
          break;
        }
        const operandStr = tokens[t];
        let value: number;
        if (operandStr.startsWith('0x') || operandStr.startsWith('0X')) {
          value = parseInt(operandStr, 16);
        } else {
          value = parseInt(operandStr, 10);
        }
        if (isNaN(value) || value < 0 || value > 255) {
          lineError = `Invalid operand: ${operandStr} (must be 0-255)`;
          break;
        }
        lineBytes.push(value);
      }

      t++;
    }

    const line: AssemblyLine = {
      lineNumber,
      text: raw,
      bytes: lineError ? [] : lineBytes,
      byteOffset,
      error: lineError,
    };

    if (lineError) {
      errors.push(`Line ${lineNumber}: ${lineError}`);
    } else {
      byteOffset += lineBytes.length;
      allBytes.push(...lineBytes);
    }

    lines.push(line);
  }

  if (errors.length > 0) {
    return { lines, bytecode: null, errors };
  }

  if (allBytes.length === 0) {
    errors.push('Program is empty');
    return { lines, bytecode: null, errors };
  }

  if (allBytes.length > MAX_BYTECODE_LEN) {
    errors.push(`Program is ${allBytes.length} bytes (max ${MAX_BYTECODE_LEN})`);
    return { lines, bytecode: null, errors };
  }

  return { lines, bytecode: allBytes, errors: [] };
}

// ── Disassembler ────────────────────────────────────────────────────

export function disassemble(bytecode: number[]): string {
  const lines: string[] = [];
  let pc = 0;

  while (pc < bytecode.length) {
    const opcode = bytecode[pc];
    const mnemonic = OP_TO_MNEMONIC[opcode];

    if (!mnemonic) {
      lines.push(`??? 0x${opcode.toString(16).padStart(2, '0')}`);
      pc++;
      continue;
    }

    if (HAS_IMMEDIATE.has(opcode)) {
      const operand = pc + 1 < bytecode.length ? bytecode[pc + 1] : 0;
      lines.push(`${mnemonic} ${operand}`);
      pc += 2;
    } else {
      lines.push(mnemonic);
      pc++;
    }
  }

  return lines.join('\n');
}

// ── Stochasticity detection ─────────────────────────────────────────

export function bytecodeIsStochastic(bytecode: number[]): boolean {
  for (let pc = 0; pc < bytecode.length; pc++) {
    if (bytecode[pc] === OP.RAND) return true;
    if (HAS_IMMEDIATE.has(bytecode[pc])) pc++; // skip operand byte
  }
  return false;
}

// ── Example programs ────────────────────────────────────────────────

export const EXAMPLE_PROGRAMS: { name: string; bytecode: number[] }[] = [
  {
    name: 'Tit for Tat',
    bytecode: [OP.OPP_LAST, OP.RETURN],
  },
  {
    name: 'Always Defect',
    bytecode: [OP.DEFECT],
  },
  {
    name: 'Grim Trigger',
    bytecode: [
      OP.OPP_DEFECTS, OP.PUSH, 0, OP.GT,
      OP.JMP_FWD_IF, 1, OP.COOP, OP.DEFECT,
    ],
  },
  {
    name: 'Pavlov',
    bytecode: [
      OP.SCORE_LAST, OP.PUSH, 3, OP.LT,
      OP.MY_LAST, OP.EQ, OP.JMP_FWD_IF, 1,
      OP.DEFECT, OP.COOP,
    ],
  },
  {
    name: 'Tit for Two Tats',
    bytecode: [
      OP.OPP_DEFECTS, OP.PUSH, 2, OP.LT,
      OP.JMP_FWD_IF, 1, OP.DEFECT, OP.OPP_LAST,
      OP.RETURN,
    ],
  },
  {
    name: 'Forgiving Detective',
    bytecode: [
      OP.ROUND, OP.PUSH, 3, OP.GT,
      OP.JMP_FWD_IF, 6,
      OP.ROUND, OP.PUSH, 3, OP.EQ,
      OP.JMP_FWD_IF, 1, OP.COOP, OP.DEFECT,
      // analysis (round > 3)
      OP.OPP_DEFECTS, OP.PUSH, 0, OP.EQ,
      OP.JMP_FWD_IF, 2, OP.OPP_LAST, OP.RETURN,
      OP.DEFECT,
    ],
  },
];
