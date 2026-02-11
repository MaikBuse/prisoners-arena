'use client';
import { useEffect, useState, useCallback, use, Fragment } from 'react';
import type { TournamentAccount, EntryAccount } from '@/lib/solana';
import type { ScoreboardEntry, StrategyParams } from '@/lib/api';
import { STRATEGIES, STRATEGY_BAR_COLORS, formatLamports, truncateAddress, explorerLink, PROGRAM_ID } from '@/lib/solana';
import { CountdownTimer } from '@/components/CountdownTimer';
import { StrategyBadge, ParamPills, ParamsDetail } from '@/components/StrategyBadge';
import { CopyButton } from '@/components/CopyButton';
import { LogoSmall } from '@/components/Logo';

const BAR_COLORS: Record<string, string> = {
  blue: 'bar-blue', red: 'bar-red', green: 'bar-green', purple: 'bar-purple',
  amber: 'bar-amber', orange: 'bar-orange', gray: 'bar-gray', cyan: 'bar-cyan', pink: 'bar-pink',
};

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<TournamentAccount | null>(null);
  const [entries, setEntries] = useState<EntryAccount[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'score' | 'strategy' | 'player'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournament/${id}`);
      const json = await res.json();
      if (json.ok) {
        setTournament(json.data.tournament);
        setEntries(json.data.entries);
        setScoreboard(json.data.scoreboard || []);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch tournament');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error — API unreachable');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => clearInterval(i);
  }, [fetchData]);

  const t = tournament;

  const displayBoard = scoreboard.length > 0 ? scoreboard : entries.map(e => ({
    player: e.player,
    score: e.score,
    strategy: e.strategy,
    strategyName: e.strategyName,
    strategyParams: e.strategyParams as StrategyParams | null,
    matchesPlayed: e.matchesPlayed,
    paidOut: e.paidOut,
    entryExists: true,
  }));

  const sorted = [...displayBoard].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'score') return (a.score - b.score) * dir;
    if (sortField === 'strategy') return (a.strategy - b.strategy) * dir;
    return a.player.localeCompare(b.player) * dir;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (field: typeof sortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[var(--card-border)] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <LogoSmall />
              <span className="font-bold text-lg">Dilemma Arena</span>
            </a>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <a href="/" className="hover:text-[var(--foreground)] transition-colors">← Dashboard</a>
            <span className="network-badge text-xs px-2 py-0.5 rounded-full font-mono">
              {process.env.NEXT_PUBLIC_NETWORK || 'devnet'}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-6">
            <div className="neon-card rounded-2xl p-8 animate-pulse">
              <div className="h-8 bg-neutral-200 rounded w-1/3 mb-4" />
              <div className="h-24 bg-neutral-200 rounded" />
            </div>
          </div>
        ) : error && !t ? (
          <div className="neon-card rounded-2xl p-8 text-center">
            <p className="text-red-600 font-medium mb-3">⚠️ {error}</p>
            <button
              onClick={() => { setLoading(true); setError(null); fetchData(); }}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        ) : !t ? (
          <div className="neon-card rounded-2xl p-12 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-bold mb-2">Tournament Not Found</h2>
            <p className="text-[var(--muted)]">Tournament #{id} doesn&apos;t exist or hasn&apos;t been created yet.</p>
            <a href="/" className="inline-block mt-4 text-[var(--accent)] hover:text-[var(--accent-hover)]">← Back to Dashboard</a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tournament Header */}
            <div className="neon-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">Tournament #{t.id}</h1>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    t.state === 'Registration' ? 'badge-registration' :
                    t.state === 'Running' ? 'badge-running' : 'badge-payout'
                  }`}>{t.state}</span>
                </div>
                <a href={explorerLink(t.address)} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Explorer ↗
                </a>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Prize Pool" value={`${formatLamports(t.pool)} SOL`} />
                <StatCard label="Stake" value={`${formatLamports(t.stake)} SOL`} />
                <StatCard label="Players" value={String(t.participantCount)} />
                <StatCard label="House Fee" value={`${t.houseFeeBps / 100}%`} />
              </div>

              {/* State-specific widget */}
              {t.state === 'Registration' && (
                <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CountdownTimer
                      targetTimestamp={Number(t.registrationEnds)}
                      label="Registration Ends"
                      expiredText={t.participantCount < 2 ? 'Waiting for players' : 'Starting soon'}
                      expiredClassName={t.participantCount < 2 ? 'text-amber-500' : 'text-emerald-500'}
                    />
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold">{t.participantCount}</div>
                      <div className="text-sm text-[var(--muted)] mt-1">participants registered</div>
                    </div>
                  </div>
                </div>
              )}

              {t.state === 'Running' && (
                <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                  <div className="flex items-center justify-between text-sm text-[var(--muted)] mb-2">
                    <span>Match Progress</span>
                    <span className="font-mono">{t.matchesCompleted} / {t.matchesTotal} ({t.matchesTotal > 0 ? Math.round(t.matchesCompleted / t.matchesTotal * 100) : 0}%)</span>
                  </div>
                  <div className="bg-neutral-100 rounded-full h-4 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                      style={{ width: `${t.matchesTotal > 0 ? (t.matchesCompleted / t.matchesTotal * 100) : 0}%` }} />
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-2">K={t.matchesPerPlayer} matches per player</div>
                </div>
              )}

              {t.state === 'Payout' && (
                <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="🏆 Winners" value={String(t.winnerCount)} />
                    <StatCard label="Per Winner" value={t.winnerCount > 0 ? `${formatLamports((BigInt(t.winnerPool) / BigInt(t.winnerCount)).toString())} SOL` : '—'} />
                    <StatCard label="Min Score" value={String(t.minWinningScore)} />
                    <StatCard label="Claimed" value={`${t.claimsProcessed} / ${t.winnerCount}`} />
                  </div>
                  {t.payoutStartedAt !== '0' && (
                    <div className="text-xs text-[var(--muted)] mt-3">
                      Claim deadline: {new Date((Number(t.payoutStartedAt) + 30 * 86400) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                <span>Program: <a href={explorerLink(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">{truncateAddress(PROGRAM_ID.toBase58(), 6)}</a></span>
                <span>Account: <a href={explorerLink(t.address)} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">{truncateAddress(t.address, 6)}</a></span>
                <span>Matches/player: {t.matchesPerPlayer}</span>
              </div>
            </div>

            {/* Strategy Distribution */}
            {displayBoard.length > 0 && (
              <div className="neon-card rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Strategy Distribution</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                  {(() => {
                    const dist = new Map<number, { count: number; totalScore: number }>();
                    displayBoard.filter(e => e.strategy >= 0).forEach(e => {
                      const d = dist.get(e.strategy) || { count: 0, totalScore: 0 };
                      d.count++;
                      d.totalScore += e.score;
                      dist.set(e.strategy, d);
                    });
                    const maxCount = Math.max(...Array.from(dist.values()).map(d => d.count), 1);
                    return STRATEGIES.map(s => {
                      const d = dist.get(s.index);
                      if (!d) return null;
                      const avgScore = d.count > 0 ? (d.totalScore / d.count).toFixed(1) : '—';
                      return (
                        <div key={s.index} className="flex items-center gap-3">
                          <span className="text-xs text-[var(--muted)] w-28 truncate">{s.name}</span>
                          <div className="flex-1 bg-neutral-100 rounded-full h-3 overflow-hidden">
                            <div className={`h-full rounded-full ${BAR_COLORS[s.color]} transition-all duration-500`}
                              style={{ width: `${(d.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-xs text-[var(--muted)] w-6 text-right">{d.count}</span>
                          <span className="text-xs text-[var(--muted)] w-16 text-right font-mono" title="Avg score">avg {avgScore}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Scoreboard */}
            {displayBoard.length > 0 && (
              <div className="neon-card rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-[var(--card-border)] flex items-center justify-between">
                  <h2 className="text-lg font-bold">Scoreboard</h2>
                  <span className="text-xs text-[var(--muted)]">{displayBoard.length} players</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--muted)] text-xs border-b border-[var(--card-border)]">
                        <th className="px-5 py-3 text-left w-12">#</th>
                        <th className="px-5 py-3 text-left cursor-pointer hover:text-[var(--foreground)] select-none" onClick={() => toggleSort('player')}>
                          Player{sortIcon('player')}
                        </th>
                        <th className="px-5 py-3 text-left cursor-pointer hover:text-[var(--foreground)] select-none" onClick={() => toggleSort('strategy')}>
                          Strategy{sortIcon('strategy')}
                        </th>
                        <th className="px-5 py-3 text-right cursor-pointer hover:text-[var(--foreground)] select-none" onClick={() => toggleSort('score')}>
                          Score{sortIcon('score')}
                        </th>
                        <th className="px-5 py-3 text-right">Matches</th>
                        {t.state === 'Payout' && <th className="px-5 py-3 text-center">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((e, i) => {
                        const isWinner = t.state === 'Payout' && e.score >= t.minWinningScore;
                        const isExpanded = expandedPlayer === e.player;
                        const colCount = t.state === 'Payout' ? 6 : 5;
                        return (
                          <Fragment key={e.player}>
                            <tr
                              className={`border-b border-[var(--card-border)] hover:bg-neutral-50 transition-colors cursor-pointer ${
                                isWinner ? 'bg-amber-50/50' : ''
                              } ${isExpanded ? 'bg-neutral-50' : ''}`}
                              onClick={() => setExpandedPlayer(isExpanded ? null : e.player)}
                            >
                              <td className="px-5 py-3 text-[var(--muted)] whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">{i + 1}{isWinner && ' 🏆'}</span>
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                <a href={explorerLink(e.player)} target="_blank" rel="noopener noreferrer"
                                   className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                                   onClick={(ev) => ev.stopPropagation()}>{truncateAddress(e.player, 6)}</a>
                                <CopyButton text={e.player} />
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center flex-wrap gap-y-1">
                                  {e.strategy >= 0 ? <StrategyBadge strategy={e.strategy} /> : <span className="text-xs text-[var(--muted)]">—</span>}
                                  <ParamPills params={e.strategyParams} />
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right font-mono font-bold">{e.score}</td>
                              <td className="px-5 py-3 text-right text-[var(--muted)]">
                                {e.matchesPlayed > 0 ? `${e.matchesPlayed} / ${t.matchesPerPlayer}` : '—'}
                              </td>
                              {t.state === 'Payout' && (
                                <td className="px-5 py-3 text-center text-sm">
                                  {e.paidOut ? '✅ Claimed' : isWinner ? '⏳ Unclaimed' : '—'}
                                </td>
                              )}
                            </tr>
                            {isExpanded && e.strategyParams && (
                              <tr className="border-b border-[var(--card-border)] bg-neutral-50/80">
                                <td colSpan={colCount} className="px-5 py-4">
                                  <div className="text-xs font-bold text-[var(--muted)] mb-2">⚙️ Strategy Parameters</div>
                                  <ParamsDetail params={e.strategyParams} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {entries.length === 0 && t.state === 'Registration' && (
              <div className="neon-card rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-bold text-lg mb-2">No participants yet</h3>
                <p className="text-[var(--muted)] text-sm">Be the first to enter! Read the <a href="/participate" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">participation guide</a>.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--card-border)]">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="font-bold mt-0.5">{value}</div>
    </div>
  );
}

/* ParamsPopup removed — replaced by inline ParamPills + expandable ParamsDetail */
