'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { assemble, disassemble, EXAMPLE_PROGRAMS, type AssemblyResult } from '@/lib/bytecodeAssembler';
import { getWasm } from '@/lib/matchReplay';
import { CopyButton } from './CopyButton';

interface Props {
  bytecode: number[] | null;
  onChange: (bytecode: number[] | null) => void;
}

interface ValidationState {
  valid: boolean;
  error?: string;
  loading: boolean;
}

/** Extract validation result from WASM return value (plain object from struct). */
function parseValidationResult(res: unknown): { valid: boolean; error?: string } | null {
  if (res && typeof res === 'object' && 'valid' in res) {
    return res as { valid: boolean; error?: string };
  }
  return null;
}

async function validateBytecodeWasm(bytes: number[]): Promise<{ valid: boolean; error?: string }> {
  try {
    const wasm = await getWasm();
    const res = wasm.validate_custom_bytecode(new Uint8Array(bytes));
    return parseValidationResult(res) ?? { valid: true };
  } catch {
    // WASM unavailable — trust the local assembler
    return { valid: true };
  }
}

export function BytecodeEditor({ bytecode, onChange }: Props) {
  const [source, setSource] = useState('');
  const [assemblyResult, setAssemblyResult] = useState<AssemblyResult | null>(null);
  const [validation, setValidation] = useState<ValidationState>({ valid: false, loading: false });
  const [hexOpen, setHexOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextEffect = useRef(false);

  // Load example by replacing source
  const loadExample = useCallback((exampleBytecode: number[]) => {
    const asm = disassemble(exampleBytecode);
    setSource(asm);
    skipNextEffect.current = true;
    const result = assemble(asm);
    setAssemblyResult(result);
    if (result.bytecode) {
      setValidation({ valid: false, loading: true });
      validateBytecodeWasm(result.bytecode).then(v => {
        setValidation({ valid: v.valid, loading: false, error: v.error });
        onChange(v.valid ? result.bytecode : null);
      });
    } else {
      setValidation({ valid: false, loading: false });
      onChange(null);
    }
  }, [onChange]);

  // Process source changes
  useEffect(() => {
    if (skipNextEffect.current) {
      skipNextEffect.current = false;
      return;
    }

    const result = assemble(source);
    setAssemblyResult(result);

    if (!result.bytecode) {
      setValidation({ valid: false, loading: false });
      onChange(null);
      return;
    }

    // Debounce WASM validation
    setValidation(prev => ({ ...prev, loading: true }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const capturedBytecode = result.bytecode;
    debounceRef.current = setTimeout(() => {
      validateBytecodeWasm(capturedBytecode).then(v => {
        setValidation({ valid: v.valid, loading: false, error: v.error });
        onChange(v.valid ? capturedBytecode : null);
      });
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [source, onChange]);

  const byteCount = assemblyResult?.bytecode?.length ?? 0;
  const byteColor = byteCount === 0 ? 'text-[var(--muted)]'
    : byteCount <= 48 ? 'text-green-600'
    : byteCount <= 64 ? 'text-amber-600'
    : 'text-red-600';

  const hexDump = assemblyResult?.bytecode
    ? `[${assemblyResult.bytecode.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`
    : '';

  const hasErrors = (assemblyResult?.errors.length ?? 0) > 0;
  const hasWasmError = !validation.loading && !validation.valid && validation.error;

  return (
    <div className="space-y-3">
      {/* Example loader */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-[var(--muted)] self-center mr-1">Examples:</span>
        {EXAMPLE_PROGRAMS.map(ex => (
          <button
            key={ex.name}
            onClick={() => loadExample(ex.bytecode)}
            className="px-2 py-0.5 text-[11px] rounded border border-[var(--card-border)] text-[var(--muted)] hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            {ex.name}
          </button>
        ))}
      </div>

      {/* Assembly textarea */}
      <textarea
        value={source}
        onChange={e => setSource(e.target.value)}
        placeholder={`; Write assembly here\n; Example: OPP_LAST RETURN\n;\n; Use examples above to get started`}
        className="w-full min-h-[200px] font-mono text-sm bg-neutral-50 border border-[var(--card-border)] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 whitespace-pre overflow-x-auto"
        spellCheck={false}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className={`font-mono ${byteColor}`}>
            {byteCount} / 64 bytes
          </span>
          {validation.loading && (
            <span className="text-[var(--muted)]">Validating...</span>
          )}
          {!validation.loading && assemblyResult?.bytecode && validation.valid && (
            <span className="text-green-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Valid
            </span>
          )}
          {hasWasmError && (
            <span className="text-red-600">{validation.error}</span>
          )}
        </div>
      </div>

      {/* Assembly errors */}
      {hasErrors && (
        <div className="text-xs text-red-600 space-y-0.5">
          {assemblyResult!.errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* Hex dump (collapsible) */}
      {assemblyResult?.bytecode && (
        <div>
          <button
            onClick={() => setHexOpen(!hexOpen)}
            className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>{hexOpen ? '▾' : '▸'}</span>
            Hex dump
          </button>
          {hexOpen && (
            <div className="relative mt-1">
              <pre className="text-[11px] font-mono bg-neutral-50 border border-[var(--card-border)] rounded p-2 overflow-x-auto">
                {hexDump}
              </pre>
              <div className="absolute top-1 right-1">
                <CopyButton text={hexDump} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
