'use client';
import { useEffect, useState, useCallback, use } from 'react';
import type { TournamentAccount, EntryAccount } from '@/lib/solana';
import type { ScoreboardEntry, StrategyParams } from '@/lib/api';
import { STRATEGIES, STRATEGY_BAR_COLORS, formatLamports, truncateAddress, explorerLink, getProgramId } from '@/lib/solana';
import { CountdownTimer } from '@/components/CountdownTimer';
import { StrategyBadge, ParamPills } from '@/components/StrategyBadge';
import { CopyButton } from '@/components/CopyButton';
import { Nav } from '@/components/Nav';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { displayState } from '@/lib/tournament-utils';

function effectiveK(configK: number, n: number): number {
  if (n <= 1) return 0;
  if (n <= 200) return n - 1;
  return Math.min(Math.max(49, Math.min(99, configK)), n - 1);
}

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
  const [minParticipants, setMinParticipants] = useState<number>(2);

  const fetchData = useCallback(async () => {
    try {
      const [res, cfgRes] = await Promise.all([
        fetch(`/api/tournament/${id}`),
        fetch('/api/config'),
      ]);
      const json = await res.json();
      if (json.ok) {
        setTournament(json.data.tournament);
        setEntries(json.data.entries);
        setScoreboard(json.data.scoreboard || []);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch tournament');
      }
      const cfgJson = await cfgRes.json();
      if (cfgJson.ok) {
        setMinParticipants(cfgJson.data.minParticipants);
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
    revealed: e.revealed ?? true,
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
      <Nav />

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
                  {(() => {
                    const dState = displayState(t);
                    return (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        dState === 'Registration' ? 'badge-registration' :
                        dState === 'Reveal' ? 'badge-reveal' :
                        dState === 'Running' ? 'badge-running' :
                        dState === 'Completed' ? 'badge-completed' : 'badge-payout'
                      }`}>{dState}</span>
                    );
                  })()}
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
              {t.state === 'Registration' && (() => {
                const nowSec = Math.floor(Date.now() / 1000);
                const deadlinePassed = nowSec >= Number(t.registrationEnds);
                const needed = Math.max(0, minParticipants - t.participantCount);
                return (
                  <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {deadlinePassed && needed > 0 ? (
                        <div className="text-center">
                          <div className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Registration Open</div>
                          <div className="text-2xl font-bold font-mono text-amber-500">
                            Waiting for {needed} more player{needed !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <CountdownTimer
                          targetTimestamp={Number(t.registrationEnds)}
                          label="Registration Ends"
                          expiredText="Starting soon"
                          expiredClassName="text-emerald-500"
                        />
                      )}
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-4xl font-bold">{t.participantCount}</div>
                        <div className="text-sm text-[var(--muted)] mt-1">participants registered</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {t.state === 'Reveal' && (
                <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CountdownTimer
                      targetTimestamp={Number(t.revealEnds)}
                      label="Reveal Ends"
                      expiredText="Closing soon"
                      expiredClassName="text-amber-500"
                    />
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold">{t.revealsCompleted} / {t.participantCount}</div>
                      <div className="text-sm text-[var(--muted)] mt-1">strategies revealed</div>
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
                  <div className="text-xs text-[var(--muted)] mt-2">K={effectiveK(t.matchesPerPlayer, t.participantCount)} matches per player</div>
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
                  {displayState(t) === 'Completed' ? (
                    <div className="text-xs text-[var(--muted)] mt-3">
                      Tournament completed. All prizes distributed.
                    </div>
                  ) : t.payoutStartedAt !== '0' && (
                    <div className="mt-4">
                      <CountdownTimer
                        targetTimestamp={Number(t.payoutStartedAt) + 30 * 86400}
                        label="Claim Deadline"
                        expiredText="Claims expired"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                <span>Program: <a href={explorerLink(getProgramId().toBase58())} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">{truncateAddress(getProgramId().toBase58(), 6)}</a></span>
                <span>Account: <a href={explorerLink(t.address)} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">{truncateAddress(t.address, 6)}</a></span>
                <span>Matches/player: {effectiveK(t.matchesPerPlayer, t.participantCount)}</span>
              </div>
            </div>

            {/* Strategy Distribution */}
            {displayBoard.length > 0 && (
              <div className="neon-card rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Strategy Distribution</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                  {(() => {
                    const dist = new Map<number, { count: number; totalScore: number }>();
                    displayBoard.filter(e => e.revealed !== false && e.strategy >= 0).forEach(e => {
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
                        <th className="px-3 sm:px-5 py-3 text-left w-12">#</th>
                        <th className="px-3 sm:px-5 py-3 text-left cursor-pointer hover:text-[var(--foreground)] select-none" onClick={() => toggleSort('player')}>
                          Player{sortIcon('player')}
                        </th>
                        <th className="px-3 sm:px-5 py-3 text-left cursor-pointer hover:text-[var(--foreground)] select-none" onClick={() => toggleSort('strategy')}>
                          Strategy{sortIcon('strategy')}
                        </th>
                        <th className="px-3 sm:px-5 py-3 text-right cursor-pointer hover:text-[var(--foreground)] select-none" onClick={() => toggleSort('score')}>
                          Score{sortIcon('score')}
                        </th>
                        <th className="px-3 sm:px-5 py-3 text-right hidden sm:table-cell">Matches</th>
                        {t.state === 'Payout' && <th className="px-3 sm:px-5 py-3 text-center">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((e, i) => {
                        const isWinner = t.state === 'Payout' && e.score >= t.minWinningScore;
                        const isSelected = expandedPlayer === e.player;
                        return (
                          <tr
                            key={e.player}
                            className={`border-b border-[var(--card-border)] hover:bg-neutral-50 transition-colors cursor-pointer ${
                              isWinner ? 'bg-amber-50/50' : ''
                            } ${isSelected ? 'bg-neutral-50' : ''}`}
                            onClick={() => setExpandedPlayer(isSelected ? null : e.player)}
                          >
                            <td className="px-3 sm:px-5 py-2 sm:py-3 text-[var(--muted)] whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">{i + 1}{isWinner && ' 🏆'}</span>
                            </td>
                            <td className="px-3 sm:px-5 py-2 sm:py-3 font-mono text-sm">
                              <a href={explorerLink(e.player)} target="_blank" rel="noopener noreferrer"
                                 className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                                 onClick={(ev) => ev.stopPropagation()}>{truncateAddress(e.player, 6)}</a>
                              <CopyButton text={e.player} />
                            </td>
                            <td className="px-3 sm:px-5 py-2 sm:py-3">
                              <span className="inline-flex items-center flex-wrap gap-y-1">
                                {e.revealed === false ? (
                                  <span className="text-[var(--muted)]">🔒 Hidden</span>
                                ) : (
                                  <>{e.strategy >= 0 ? <StrategyBadge strategy={e.strategy} /> : <span className="text-xs text-[var(--muted)]">—</span>}
                                  <span className="hidden sm:inline-flex"><ParamPills params={e.strategyParams} /></span></>
                                )}
                              </span>
                            </td>
                            <td className="px-3 sm:px-5 py-2 sm:py-3 text-right font-mono font-bold">{e.score}</td>
                            <td className="px-3 sm:px-5 py-2 sm:py-3 text-right text-[var(--muted)] hidden sm:table-cell">
                              {`${e.matchesPlayed} / ${effectiveK(t.matchesPerPlayer, t.participantCount)}`}
                            </td>
                            {t.state === 'Payout' && (
                              <td className="px-3 sm:px-5 py-2 sm:py-3 text-center text-sm">
                                {e.paidOut ? '✅ Claimed' : isWinner ? '⏳ Unclaimed' : '—'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Player Detail Modal */}
            {expandedPlayer && (() => {
              const entry = sorted.find(e => e.player === expandedPlayer);
              if (!entry || entry.revealed === false) return null;
              const pIdx = t.players.indexOf(expandedPlayer);
              if (pIdx < 0) return null;
              const rank = sorted.indexOf(entry) + 1;
              const isWinner = t.state === 'Payout' && entry.score >= t.minWinningScore;
              return (
                <PlayerDetailModal
                  tournament={t}
                  entry={entry}
                  playerIndex={pIdx}
                  rank={rank}
                  isWinner={isWinner}
                  onClose={() => setExpandedPlayer(null)}
                />
              );
            })()}

            {/* Empty state */}
            {entries.length === 0 && t.state === 'Registration' && (
              <div className="neon-card rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-bold text-lg mb-2">No participants yet</h3>
                <p className="text-[var(--muted)] text-sm">Be the first to enter! Read the <a href="/participate.md" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">participation guide</a>.</p>
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
