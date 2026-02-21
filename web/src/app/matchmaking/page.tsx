'use client';
import { useState, useEffect, useMemo } from 'react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { getWasm } from '@/lib/matchReplay';

type WasmModule = Awaited<ReturnType<typeof getWasm>>;

interface MatchmakingStats {
  effective_k: number;
  tier: string;
  min_rounds: number;
  max_rounds: number;
  end_probability: number;
  avg_rounds: number;
  total_matches: number;
}

export default function MatchmakingPage() {
  const [playerCount, setPlayerCount] = useState(20);
  const [configK, setConfigK] = useState(6);
  const [wasm, setWasm] = useState<WasmModule | null>(null);

  useEffect(() => { getWasm().then(setWasm); }, []);

  const calc = useMemo(() => {
    if (!wasm) return null;
    const stats: MatchmakingStats = wasm.get_matchmaking_stats(playerCount, configK);
    const endProb = stats.end_probability / 100;
    const maxPossibleScore = stats.max_rounds * 5; // 5 = temptation payoff per round
    const avgCoopScore = Math.round(stats.avg_rounds * 3); // mutual cooperation
    return {
      n: playerCount,
      k: stats.effective_k,
      tier: stats.tier,
      minRounds: stats.min_rounds,
      maxRounds: stats.max_rounds,
      endProb,
      avgRounds: stats.avg_rounds,
      matches: stats.total_matches,
      maxPossibleScore,
      avgCoopScore,
    };
  }, [wasm, playerCount, configK]);

  return (
    <div className="min-h-screen">
      <Nav />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <a href="/" className="text-sm text-accent hover:text-accent-hover mb-6 inline-block">← Back to Arena</a>
        <h1 className="text-3xl font-bold mb-2">Matchmaking Calculator</h1>
        <p className="text-muted mb-8">
          Explore how tournament size affects matches per player, rounds per match, and total games.
        </p>

        {/* Controls */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="neon-card rounded-2xl p-6">
            <label className="block text-sm font-bold mb-3">Players in Tournament</label>
            <input
              type="range"
              min={2} max={5000} step={1}
              value={playerCount}
              onChange={e => setPlayerCount(Number(e.target.value))}
              className="w-full accent-accent mb-2"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2} max={5000}
                value={playerCount}
                onChange={e => setPlayerCount(Math.min(5000, Math.max(2, Number(e.target.value) || 2)))}
                className="w-24 px-3 py-1.5 rounded-lg border border-card-border text-sm font-mono text-center"
              />
              <span className="text-sm text-muted">players</span>
            </div>
          </div>

          <div className="neon-card rounded-2xl p-6">
            <label className="block text-sm font-bold mb-3">Configured K (matches/player)</label>
            <input
              type="range"
              min={1} max={200} step={1}
              value={configK}
              onChange={e => setConfigK(Number(e.target.value))}
              className="w-full accent-accent mb-2"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1} max={1000}
                value={configK}
                onChange={e => setConfigK(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-3 py-1.5 rounded-lg border border-card-border text-sm font-mono text-center"
              />
              <span className="text-sm text-muted">configured K</span>
            </div>
            {playerCount <= 200 && (
              <p className="text-xs text-warning mt-2">
                ⚠️ With n≤200, adaptive K overrides to full round-robin (K={playerCount - 1})
              </p>
            )}
            {calc && playerCount > 200 && configK !== calc.k && (
              <p className="text-xs text-warning mt-2">
                ⚠️ K clamped to [{Math.max(49, Math.min(99, configK) === configK ? configK : 49)}, 99] → effective K={calc.k}
              </p>
            )}
          </div>
        </div>

        {!calc ? (
          <div className="text-center py-16 text-muted">Loading match engine…</div>
        ) : (<>
        {/* Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <ResultCard label="Effective K" value={String(calc.k)} subtitle="matches per player" />
          <ResultCard label="Round Tier" value={calc.tier} subtitle={`n ${playerCount <= 1000 ? '≤' : '>'} 1000`} />
          <ResultCard label="Rounds/Match" value={`${calc.minRounds}–${calc.maxRounds}`} subtitle={`avg ≈ ${calc.avgRounds.toFixed(1)}`} />
          <ResultCard label="Total Matches" value={calc.matches.toLocaleString()} subtitle="in tournament" />
        </div>

        {/* Detailed breakdown */}
        <div className="neon-card rounded-2xl p-6 mb-8">
          <h2 className="font-bold mb-4">Breakdown</h2>
          <div className="space-y-3 text-sm">
            <Row label="Players (n)" value={playerCount.toLocaleString()} />
            <Row label="Configured K" value={String(configK)} />
            <Row label="Effective K" value={String(calc.k)} highlight />
            <div className="border-t border-card-border my-2" />
            <Row label="Pairing mode" value={playerCount <= 200 ? 'Full round-robin' : 'Feistel permutation'} />
            <Row label="Round tier" value={`${calc.tier} (${calc.endProb * 100}% end probability after min)`} />
            <Row label="Rounds per match" value={`${calc.minRounds}–${calc.maxRounds} (avg ≈ ${calc.avgRounds.toFixed(1)})`} />
            <div className="border-t border-card-border my-2" />
            <Row label="Matches per player" value={String(calc.k)} highlight />
            <Row label="Total matches" value={calc.matches.toLocaleString()} highlight />
            <Row label="Total rounds (est.)" value={`≈ ${Math.round(calc.matches * calc.avgRounds).toLocaleString()}`} />
            <div className="border-t border-card-border my-2" />
            <Row label="Max score per match" value={`${calc.maxPossibleScore} pts (all rounds: temptation)`} />
            <Row label="Avg mutual coop score" value={`≈ ${calc.avgCoopScore} pts/match`} />
            <Row label="Est. total score range" value={`${calc.k * calc.minRounds}–${calc.k * calc.maxPossibleScore} pts`} />
          </div>
        </div>
        </>)}

        {/* Adaptive K explanation */}
        <div className="neon-card rounded-2xl p-6">
          <h2 className="font-bold mb-4">How Adaptive K Works</h2>
          <div className="space-y-4 text-sm text-muted">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Small tournaments (n ≤ 200)</h3>
              <p>Full round-robin — every player faces every other player exactly once. K = n − 1. The configured K value is ignored.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Large tournaments (n &gt; 200)</h3>
              <p>The configured K is clamped to [49, 99] and used directly. Players are paired using a Feistel-network permutation (deterministic, no duplicates, O(1) memory per match).</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Round Tiers</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm border border-card-border rounded overflow-hidden">
                  <thead>
                    <tr className="bg-surface text-xs">
                      <th className="px-4 py-2 text-left border-b border-card-border">Tier</th>
                      <th className="px-4 py-2 text-left border-b border-card-border">Players</th>
                      <th className="px-4 py-2 text-left border-b border-card-border">Min Rounds</th>
                      <th className="px-4 py-2 text-left border-b border-card-border">Max Rounds</th>
                      <th className="px-4 py-2 text-left border-b border-card-border">End Prob</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={playerCount <= 1000 ? 'bg-accent/10' : ''}>
                      <td className="px-4 py-2 font-medium border-b border-card-border">Standard</td>
                      <td className="px-4 py-2 border-b border-card-border">≤ 1000</td>
                      <td className="px-4 py-2 font-mono border-b border-card-border">20</td>
                      <td className="px-4 py-2 font-mono border-b border-card-border">50</td>
                      <td className="px-4 py-2 font-mono border-b border-card-border">5%</td>
                    </tr>
                    <tr className={playerCount > 1000 ? 'bg-accent/10' : ''}>
                      <td className="px-4 py-2 font-medium">Compressed</td>
                      <td className="px-4 py-2">&gt; 1000</td>
                      <td className="px-4 py-2 font-mono">10</td>
                      <td className="px-4 py-2 font-mono">30</td>
                      <td className="px-4 py-2 font-mono">7%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function ResultCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="neon-card rounded-2xl p-5 text-center">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted mt-1">{subtitle}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-mono ${highlight ? 'font-bold text-foreground' : ''}`}>{value}</span>
    </div>
  );
}
