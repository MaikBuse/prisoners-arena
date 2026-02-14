'use client';
import { useState, useMemo } from 'react';
import { Nav } from '@/components/Nav';

// Mirror the on-chain adaptive K logic from v1.5
function effectiveK(configK: number, n: number): number {
  if (n <= 1) return 0;
  if (n <= 200) return n - 1; // full round-robin
  // n > 200: clamp configK to [49, 99]
  const clamped = Math.max(49, Math.min(99, configK));
  return Math.min(clamped, n - 1);
}

// Round tier parameters from v1.5
function roundTierParams(n: number): { tier: string; minRounds: number; maxRounds: number; endProb: number } {
  if (n <= 1000) {
    return { tier: 'Standard', minRounds: 20, maxRounds: 50, endProb: 0.05 };
  }
  return { tier: 'Compressed', minRounds: 10, maxRounds: 30, endProb: 0.07 };
}

// Expected rounds per match given min, max, endProb
function expectedRounds(minR: number, maxR: number, endProb: number): number {
  // After minR, each round has endProb chance of ending, hard cap at maxR
  // E[rounds] = minR + sum_{i=0}^{maxR-minR-1} (1-endProb)^i * 1
  // = minR + (1 - (1-endProb)^(maxR-minR)) / endProb
  const extra = maxR - minR;
  if (extra <= 0) return minR;
  let expected = 0;
  let survivalProb = 1;
  for (let i = 0; i < extra; i++) {
    expected += survivalProb;
    survivalProb *= (1 - endProb);
  }
  return minR + expected;
}

// Total matches in tournament
function totalMatches(n: number, k: number): number {
  return Math.floor(n * k / 2);
}

export default function MatchmakingPage() {
  const [playerCount, setPlayerCount] = useState(20);
  const [configK, setConfigK] = useState(6);

  const calc = useMemo(() => {
    const n = playerCount;
    const k = effectiveK(configK, n);
    const rt = roundTierParams(n);
    const avgRounds = expectedRounds(rt.minRounds, rt.maxRounds, rt.endProb);
    const matches = totalMatches(n, k);
    const maxPossibleScore = rt.maxRounds * 5; // 5 = temptation payoff per round
    const avgCoopScore = Math.round(avgRounds * 3); // mutual cooperation
    return { n, k, ...rt, avgRounds, matches, maxPossibleScore, avgCoopScore };
  }, [playerCount, configK]);

  return (
    <div className="min-h-screen">
      <Nav />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Matchmaking Calculator</h1>
        <p className="text-[var(--muted)] mb-8">
          Explore how tournament size affects matches per player, rounds per match, and total games.
        </p>

        {/* Controls */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="neon-card rounded-2xl p-6">
            <label className="block text-sm font-bold mb-3">Players in Tournament</label>
            <input
              type="range"
              min={2} max={2000} step={1}
              value={playerCount}
              onChange={e => setPlayerCount(Number(e.target.value))}
              className="w-full accent-[var(--accent)] mb-2"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2} max={10000}
                value={playerCount}
                onChange={e => setPlayerCount(Math.max(2, Number(e.target.value) || 2))}
                className="w-24 px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-sm font-mono text-center"
              />
              <span className="text-sm text-[var(--muted)]">players</span>
            </div>
          </div>

          <div className="neon-card rounded-2xl p-6">
            <label className="block text-sm font-bold mb-3">Configured K (matches/player)</label>
            <input
              type="range"
              min={1} max={200} step={1}
              value={configK}
              onChange={e => setConfigK(Number(e.target.value))}
              className="w-full accent-[var(--accent)] mb-2"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1} max={1000}
                value={configK}
                onChange={e => setConfigK(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-sm font-mono text-center"
              />
              <span className="text-sm text-[var(--muted)]">configured K</span>
            </div>
            {playerCount <= 200 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ With n≤200, adaptive K overrides to full round-robin (K={playerCount - 1})
              </p>
            )}
            {playerCount > 200 && configK !== calc.k && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ K clamped to [{Math.max(49, Math.min(99, configK) === configK ? configK : 49)}, 99] → effective K={calc.k}
              </p>
            )}
          </div>
        </div>

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
            <div className="border-t border-[var(--card-border)] my-2" />
            <Row label="Pairing mode" value={playerCount <= 200 ? 'Full round-robin' : 'Offset pairing'} />
            <Row label="Round tier" value={`${calc.tier} (${calc.endProb * 100}% end probability after min)`} />
            <Row label="Rounds per match" value={`${calc.minRounds}–${calc.maxRounds} (avg ≈ ${calc.avgRounds.toFixed(1)})`} />
            <div className="border-t border-[var(--card-border)] my-2" />
            <Row label="Matches per player" value={String(calc.k)} highlight />
            <Row label="Total matches" value={calc.matches.toLocaleString()} highlight />
            <Row label="Total rounds (est.)" value={`≈ ${Math.round(calc.matches * calc.avgRounds).toLocaleString()}`} />
            <div className="border-t border-[var(--card-border)] my-2" />
            <Row label="Max score per match" value={`${calc.maxPossibleScore} pts (all rounds: temptation)`} />
            <Row label="Avg mutual coop score" value={`≈ ${calc.avgCoopScore} pts/match`} />
            <Row label="Est. total score range" value={`${calc.k * calc.minRounds}–${calc.k * calc.maxPossibleScore} pts`} />
          </div>
        </div>

        {/* Adaptive K explanation */}
        <div className="neon-card rounded-2xl p-6">
          <h2 className="font-bold mb-4">How Adaptive K Works</h2>
          <div className="space-y-4 text-sm text-[var(--muted)]">
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">Small tournaments (n ≤ 200)</h3>
              <p>Full round-robin — every player faces every other player exactly once. K = n − 1. The configured K value is ignored.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">Large tournaments (n &gt; 200)</h3>
              <p>The configured K is clamped to [49, 99] and used directly. Players are paired using offset pairing (deterministic, no duplicates).</p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">Round Tiers</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm border border-[var(--card-border)] rounded overflow-hidden">
                  <thead>
                    <tr className="bg-neutral-50 text-xs">
                      <th className="px-4 py-2 text-left border-b border-[var(--card-border)]">Tier</th>
                      <th className="px-4 py-2 text-left border-b border-[var(--card-border)]">Players</th>
                      <th className="px-4 py-2 text-left border-b border-[var(--card-border)]">Min Rounds</th>
                      <th className="px-4 py-2 text-left border-b border-[var(--card-border)]">Max Rounds</th>
                      <th className="px-4 py-2 text-left border-b border-[var(--card-border)]">End Prob</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={playerCount <= 1000 ? 'bg-emerald-50/50' : ''}>
                      <td className="px-4 py-2 font-medium border-b border-[var(--card-border)]">Standard</td>
                      <td className="px-4 py-2 border-b border-[var(--card-border)]">≤ 1000</td>
                      <td className="px-4 py-2 font-mono border-b border-[var(--card-border)]">20</td>
                      <td className="px-4 py-2 font-mono border-b border-[var(--card-border)]">50</td>
                      <td className="px-4 py-2 font-mono border-b border-[var(--card-border)]">5%</td>
                    </tr>
                    <tr className={playerCount > 1000 ? 'bg-emerald-50/50' : ''}>
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

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)] bg-white py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Prisoner's Arena — On-chain game theory on Solana</span>
          <div className="flex items-center gap-4">
            <a href="/" className="hover:text-[var(--foreground)] transition-colors">Home</a>
            <a href="/participate.md" className="hover:text-[var(--foreground)] transition-colors">Participate</a>
            <a href="/docs" className="hover:text-[var(--foreground)] transition-colors">API Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ResultCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="neon-card rounded-2xl p-5 text-center">
      <div className="text-xs text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-1">{subtitle}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`font-mono ${highlight ? 'font-bold text-[var(--foreground)]' : ''}`}>{value}</span>
    </div>
  );
}
