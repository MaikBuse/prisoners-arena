import { describe, it, expect } from 'vitest';
import {
  assemble,
  disassemble,
  bytecodeIsStochastic,
  OP,
  OP_TO_MNEMONIC,
  MNEMONIC_TO_OP,
  EXAMPLE_PROGRAMS,
} from '../bytecodeAssembler';

describe('assembler', () => {
  it('assembles single-byte instructions', () => {
    const result = assemble('COOP');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.COOP]);
  });

  it('assembles instructions with immediates', () => {
    const result = assemble('PUSH 42');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.PUSH, 42]);
  });

  it('assembles hex operands', () => {
    const result = assemble('PUSH 0xFF');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.PUSH, 255]);
  });

  it('assembles multi-line programs', () => {
    const result = assemble('OPP_LAST\nRETURN');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.OPP_LAST, OP.RETURN]);
  });

  it('assembles multiple instructions on same line', () => {
    const result = assemble('OPP_LAST RETURN');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.OPP_LAST, OP.RETURN]);
  });

  it('strips comments', () => {
    const result = assemble('OPP_LAST  ; get opponent last move\nRETURN');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.OPP_LAST, OP.RETURN]);
  });

  it('ignores empty lines', () => {
    const result = assemble('\nCOOP\n\n');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.COOP]);
  });

  it('is case-insensitive', () => {
    const result = assemble('opp_last\nreturn');
    expect(result.errors).toEqual([]);
    expect(result.bytecode).toEqual([OP.OPP_LAST, OP.RETURN]);
  });

  it('tracks byte offsets per line', () => {
    const result = assemble('PUSH 5\nOPP_LAST\nRETURN');
    expect(result.lines[0].byteOffset).toBe(0);
    expect(result.lines[0].bytes).toEqual([OP.PUSH, 5]);
    expect(result.lines[1].byteOffset).toBe(2);
    expect(result.lines[2].byteOffset).toBe(3);
  });
});

describe('assembler errors', () => {
  it('rejects unknown mnemonics', () => {
    const result = assemble('FOOBAR');
    expect(result.bytecode).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Unknown mnemonic');
  });

  it('rejects missing operand for PUSH', () => {
    const result = assemble('PUSH');
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('requires an operand');
  });

  it('rejects missing operand for JMP_FWD', () => {
    const result = assemble('JMP_FWD');
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('requires an operand');
  });

  it('rejects missing operand for JMP_FWD_IF', () => {
    const result = assemble('JMP_FWD_IF');
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('requires an operand');
  });

  it('rejects out-of-range operands', () => {
    const result = assemble('PUSH 256');
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('Invalid operand');
  });

  it('rejects negative operands', () => {
    const result = assemble('PUSH -1');
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('Invalid operand');
  });

  it('rejects empty programs', () => {
    const result = assemble('');
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('empty');
  });

  it('rejects programs over 64 bytes', () => {
    // 33 PUSH instructions = 66 bytes
    const lines = Array.from({ length: 33 }, (_, i) => `PUSH ${i}`).join('\n');
    const result = assemble(lines);
    expect(result.bytecode).toBeNull();
    expect(result.errors[0]).toContain('max 64');
  });
});

describe('disassembler', () => {
  it('disassembles all 25 opcodes', () => {
    for (const [name, value] of Object.entries(MNEMONIC_TO_OP)) {
      const mnemonic = OP_TO_MNEMONIC[value];
      expect(mnemonic).toBe(name);
    }
  });

  it('disassembles single-byte opcodes', () => {
    expect(disassemble([OP.COOP])).toBe('COOP');
    expect(disassemble([OP.DEFECT])).toBe('DEFECT');
    expect(disassemble([OP.RETURN])).toBe('RETURN');
  });

  it('disassembles instructions with immediates', () => {
    expect(disassemble([OP.PUSH, 42])).toBe('PUSH 42');
    expect(disassemble([OP.JMP_FWD, 3])).toBe('JMP_FWD 3');
    expect(disassemble([OP.JMP_FWD_IF, 1])).toBe('JMP_FWD_IF 1');
  });

  it('disassembles multi-instruction programs', () => {
    const asm = disassemble([OP.OPP_LAST, OP.RETURN]);
    expect(asm).toBe('OPP_LAST\nRETURN');
  });

  it('handles unknown opcodes gracefully', () => {
    const asm = disassemble([0xff]);
    expect(asm).toContain('???');
  });
});

describe('round-trip: assemble → disassemble → assemble', () => {
  for (const example of EXAMPLE_PROGRAMS) {
    it(`round-trips ${example.name}`, () => {
      const asm = disassemble(example.bytecode);
      const result = assemble(asm);
      expect(result.errors).toEqual([]);
      expect(result.bytecode).toEqual(example.bytecode);
    });
  }
});

describe('bytecodeIsStochastic', () => {
  it('detects RAND opcode', () => {
    expect(bytecodeIsStochastic([OP.RAND, OP.RETURN])).toBe(true);
  });

  it('returns false for programs without RAND', () => {
    expect(bytecodeIsStochastic([OP.OPP_LAST, OP.RETURN])).toBe(false);
  });

  it('does not confuse immediate 0x09 with RAND opcode', () => {
    // PUSH 9 — the 0x09 is an operand, not the RAND opcode
    expect(bytecodeIsStochastic([OP.PUSH, 0x09, OP.RETURN])).toBe(false);
  });

  it('detects RAND within complex program', () => {
    expect(bytecodeIsStochastic([
      OP.PUSH, 50, OP.RAND, OP.LT, OP.RETURN,
    ])).toBe(true);
  });
});
