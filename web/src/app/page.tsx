'use client';
import { useEffect, useState, useCallback } from 'react';
import type { TournamentAccount, EntryAccount } from '@/lib/solana';
import { STRATEGIES, STRATEGY_COLORS, STRATEGY_BAR_COLORS, formatLamports, truncateAddress, explorerLink } from '@/lib/solana';
import { CountdownTimer } from '@/components/CountdownTimer';
import { StrategyBadge } from '@/components/StrategyBadge';
import { SolAmount } from '@/components/SolAmount';
import { CopyButton } from '@/components/CopyButton';
import { SkeletonCard, SkeletonTable } from '@/components/SkeletonLoader';
import Link from 'next/link';

interface TournamentData {
  tournament: TournamentAccount;
  entries: EntryAccount[];
}

export default function Dashboard() {
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'score' | 'strategy' | 'player'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tournament');
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => clearInterval(i);
  }, [fetchData]);

  if (loading) return <div className="space-y-6"><SkeletonCard /><SkeletonTable /></div>;

  if (!data) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-zinc-400">No Tournament Found</h2>
      <p className="text-zinc-600 mt-2">The program may not be initialized yet on devnet.</p>
    </div>
  );

  const { tournament: t, entries } = data;

  const sorted = [...entries].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'score') return (a.score - b.score) * dir;
    if (sortField === 'strategy') return (a.strategy - b.strategy) * dir;
    return a.player.localeCompare(b.player) * dir;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Strategy distribution
  const stratDist = new Map<number, number>();
  entries.forEach(e => stratDist.set(e.strategy, (stratDist.get(e.strategy) || 0) + 1));
  const maxCount = Math.max(...stratDist.values(), 1);

  return (
    <div className="space-y-8">
      {/* Hero Tournament Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Tournament #{t.id}</h1>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              t.state === 'Registration' ? 'bg-green-500/20 text-green-400' :
              t.state === 'Running' ? 'bg-blue-500/20 text-blue-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>{t.state}</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Prize Pool</div>
            <SolAmount lamports={t.pool} className="text-lg font-bold text-white" />
          </div>
        </div>

        {/* State-specific widget */}
        {t.state === 'Registration' && (
          <div className="grid grid-cols-2 gap-6 mt-6">
            <CountdownTimer targetTimestamp={Number(t.registrationEnds)} label="Registration Ends" />
            <div className="text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Participants</div>
              <div className="text-2xl font-bold text-white">{t.participantCount}</div>
            </div>
          </div>
        )}

        {t.state === 'Running' && (
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="flex flex-col items-center relative">
              <svg width={120} height={120} className="-rotate-90">
                <circle cx={60} cy={60} r={52} fill="none" stroke="rgb(63 63 70)" strokeWidth={8} />
                <circle cx={60} cy={60} r={52} fill="none" stroke="rgb(59 130 246)" strokeWidth={8}
                  strokeDasharray={326.7} strokeDashoffset={326.7 - (t.matchesTotal > 0 ? (t.matchesCompleted / t.matchesTotal) : 0) * 326.7}
                  strokeLinecap="round" className="transition-all duration-500" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center" style={{ height: 120 }}>
                <span className="text-lg font-bold">{t.matchesTotal > 0 ? Math.round(t.matchesCompleted / t.matchesTotal * 100) : 0}%</span>
              </div>
              <span className="text-xs text-zinc-500 mt-2">Match Progress</span>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Matches</div>
              <div className="text-2xl font-bold text-white">{t.matchesCompleted} / {t.matchesTotal}</div>
              <div className="text-xs text-zinc-500 mt-1">{t.participantCount} players</div>
            </div>
          </div>
        )}

        {t.state === 'Payout' && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">🏆 Winners</div>
              <div className="text-2xl font-bold text-white">{t.winnerCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Per Winner</div>
              <div className="text-lg font-bold text-white">
                {t.winnerCount > 0 ? formatLamports((BigInt(t.winnerPool) / BigInt(t.winnerCount)).toString()) : '0'} SOL
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Claims</div>
              <div className="text-2xl font-bold text-white">{t.claimsProcessed} / {t.winnerCount}</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-xs text-zinc-500">
          <span>Stake: <SolAmount lamports={t.stake} className="text-zinc-400" /></span>
          <span>Fee: {t.houseFeeBps / 100}%</span>
          <span>Matches/player: {t.matchesPerPlayer}</span>
          <Link href={`/tournament/${t.id}`} className="text-blue-400 hover:text-blue-300 ml-auto">View Details →</Link>
        </div>
      </div>

      {/* Strategy Distribution */}
      {entries.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Strategy Distribution</h2>
          <div className="space-y-2">
            {STRATEGIES.map(s => {
              const count = stratDist.get(s.index) || 0;
              if (count === 0) return null;
              return (
                <div key={s.index} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-32 truncate">{s.name}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                    <div className={`h-full rounded-full ${STRATEGY_BAR_COLORS[s.color]} transition-all duration-500`}
                      style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scores Table */}
      {entries.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-bold">Leaderboard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('player')}>
                    Player {sortField === 'player' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('strategy')}>
                    Strategy {sortField === 'strategy' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('score')}>
                    Score {sortField === 'score' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-4 py-3 text-right">Matches</th>
                  <th className="px-4 py-3 text-right">Explorer</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
                  <tr key={e.address} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {truncateAddress(e.player)}
                      <CopyButton text={e.player} />
                    </td>
                    <td className="px-4 py-3"><StrategyBadge strategy={e.strategy} /></td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{e.score}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{e.matchesPlayed}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={explorerLink(e.player)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">↗</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
