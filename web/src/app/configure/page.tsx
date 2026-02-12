'use client';
import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { StrategySelector } from '@/components/StrategySelector';
import { ParamPanel } from '@/components/ParamPanel';
import { InitialMovesGrid } from '@/components/InitialMovesGrid';
import { StrategyPreview } from '@/components/StrategyPreview';
import { ConfigOutput } from '@/components/ConfigOutput';
import { StrategyInfo } from '@/components/StrategyInfo';
import { DEFAULT_PARAMS, type ParamValues } from '@/lib/strategyConfig';

export default function ConfigurePage() {
  const [strategy, setStrategy] = useState(0);
  const [params, setParams] = useState<ParamValues>({ ...DEFAULT_PARAMS });

  const handleStrategyChange = (index: number) => {
    setStrategy(index);
    setParams({ ...DEFAULT_PARAMS });
  };

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Strategy Lab</h1>
          <p className="text-sm text-[var(--muted)]">
            Configure strategy parameters and preview performance before entering a tournament.
          </p>
        </div>

        {/* Strategy Selector */}
        <section className="neon-card rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Select Strategy</h2>
          <StrategySelector selected={strategy} onSelect={handleStrategyChange} />
          <div className="mt-3">
            <StrategyInfo strategy={strategy} />
          </div>
        </section>

        {/* Params + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="neon-card rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold">Parameters</h2>
            <ParamPanel strategy={strategy} params={params} onChange={setParams} />
            <InitialMovesGrid
              value={params.initial_moves}
              onChange={(v) => setParams({ ...params, initial_moves: v })}
            />
          </section>

          <section className="neon-card rounded-xl p-4">
            <StrategyPreview strategy={strategy} params={params} />
          </section>
        </div>

        {/* Output */}
        <section className="neon-card rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Configuration Output</h2>
          <ConfigOutput strategy={strategy} params={params} />
        </section>
      </main>
    </>
  );
}
