'use client';
import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { StrategySelector } from '@/components/StrategySelector';
import { StrategyPreview } from '@/components/StrategyPreview';
import { ConfigOutput } from '@/components/ConfigOutput';
import { StrategyInfo } from '@/components/StrategyInfo';
import { BytecodeEditor } from '@/components/BytecodeEditor';

export default function ConfigurePage() {
  const [strategy, setStrategy] = useState(0);
  const [bytecode, setBytecode] = useState<number[] | null>(null);

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <a href="/" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] mb-6 inline-block">← Back to Arena</a>
        <div>
          <h1 className="text-2xl font-bold mb-1">Strategy Lab</h1>
          <p className="text-sm text-[var(--muted)]">
            Preview strategy performance before entering a tournament.
          </p>
        </div>

        {/* Strategy Selector */}
        <section className="neon-card rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Select Strategy</h2>
          <StrategySelector selected={strategy} onSelect={setStrategy} />
          <div className="mt-3">
            <StrategyInfo strategy={strategy} />
          </div>
        </section>

        {/* Bytecode Editor (Custom only) */}
        {strategy === 9 && (
          <section className="neon-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Bytecode Editor</h2>
            <BytecodeEditor bytecode={bytecode} onChange={setBytecode} />
          </section>
        )}

        {/* Preview */}
        <section className="neon-card rounded-xl p-4">
          <StrategyPreview strategy={strategy} bytecode={strategy === 9 ? bytecode : undefined} />
        </section>

        {/* Output */}
        <section className="neon-card rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Configuration Output</h2>
          <ConfigOutput strategy={strategy} bytecode={strategy === 9 ? bytecode : undefined} />
        </section>
      </main>
    </>
  );
}
