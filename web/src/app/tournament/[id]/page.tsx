'use client';
import { useEffect, useState, useCallback, use } from 'react';
import type { TournamentAccount, EntryAccount } from '@/lib/solana';
import { formatLamports, truncateAddress, explorerLink, STRATEGIES, STRATEGY_BAR_COLORS } from '@/lib/solana';
import { CountdownTimer } from '@/components/CountdownTimer';
import { StrategyBadge } from '@/components/StrategyBadge';
import { SolAmount } from '@/components/SolAmount';
import { CopyButton } from '@/components/CopyButton';
import { ExplorerLink } from '@/components/ExplorerLink';
import { SkeletonCard, SkeletonTable } from '@/components/SkeletonLoader';

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<TournamentAccount | null>(null);
  const [entries, setEntries] = useState<EntryAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournament/${id}`);
      const json = await res.json();
      if (json.ok) {
        setTournament(json.data.tournament);
        setEntries(json.data.entries);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => clearInterval(i);
  }, [fetchData]);

  if (loading) return <div className="space-y-6"><SkeletonCard /><SkeletonTable /></div>;
  if (!tournament) return <div className="text-center py-20 text-zinc-500">Tournament not found.</div>;

  const t = tournament;
  const stratDist = new Map<number, number>();
  entries.forEach(e => stratDist.set(e.strategy, (stratDist.get(e.strategy) || 0) + 1));
  const maxCount = Math.max(...stratDist.values(), 1);

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Tournament #{t.id}</h1>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              t.state === 'Registration' ? 'bg-green-500/20 text-green-400' :
              t.state === 'Running' ? 'bg-blue-500/20 text-blue-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>{t.state}</span>
          </div>
          <ExplorerLink address={t.address} label="View on Explorer ↗" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div><div className="text-xs text-zinc-500">Pool</div><SolAmount lamports={t.pool} className="font-bold" /></div>
          <div><div className="text-xs text-zinc-500">Stake</div><SolAmount lamports={t.stake} /></div>
          <div><div className="text-xs text-zinc-500">Players</div><div className="font-bold">{t.participantCount}</div></div>
          <div><div className="text-xs text-zinc-500">Fee</div><div>{t.houseFeeBps / 100}%</div></div>
        </div>

        {t.state === 'Registration' && (
          <div className="mt-6">
            <CountdownTimer targetTimestamp={Number(t.registrationEnds)} label="Registration Ends" />
          </div>
        )}

        {t.state === 'Running' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Progress</span>
              <span>{t.matchesCompleted} / {t.matchesTotal}</span>
            </div>
            <div className="bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${t.matchesTotal > 0 ? (t.matchesCompleted / t.matchesTotal * 100) : 0}%` }} />
            </div>
          </div>
        )}

        {t.state === 'Payout' && (
          <div className="grid grid-cols-3 gap-4 mt-6 text-center">
            <div><div className="text-xs text-zinc-500">Winners</div><div className="text-xl font-bold">{t.winnerCount}</div></div>
            <div><div className="text-xs text-zinc-500">Per Winner</div><div className="font-bold">{t.winnerCount > 0 ? formatLamports((BigInt(t.winnerPool) / BigInt(t.winnerCount)).toString()) : '0'} SOL</div></div>
            <div><div className="text-xs text-zinc-500">Claims</div><div className="text-xl font-bold">{t.claimsProcessed}/{t.winnerCount}</div></div>
          </div>
        )}
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
                    <div className={`h-full rounded-full ${STRATEGY_BAR_COLORS[s.color]} transition-all`} style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {entries.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800"><h2 className="text-lg font-bold">Leaderboard</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Matches</th>
                  {t.state === 'Payout' && <th className="px-4 py-3 text-center">Paid</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.address} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${t.state === 'Payout' && e.score >= t.minWinningScore ? 'bg-yellow-500/5' : ''}`}>
                    <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm">
                      <a href={explorerLink(e.player)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{truncateAddress(e.player)}</a>
                      <CopyButton text={e.player} />
                    </td>
                    <td className="px-4 py-3"><StrategyBadge strategy={e.strategy} /></td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{e.score}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{e.matchesPlayed}</td>
                    {t.state === 'Payout' && <td className="px-4 py-3 text-center">{e.paidOut ? '✅' : e.score >= t.minWinningScore ? '⏳' : '—'}</td>}
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
