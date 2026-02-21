'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import type { TournamentAccount, EntryAccount } from '@/lib/solana';
import type { ScoreboardEntry } from '@/lib/api';
import { formatLamports, truncateAddress, explorerLink, getProgramId } from '@/lib/solana';
import { SegmentedCountdown } from '@/components/SegmentedCountdown';
import { Nav } from '@/components/Nav';
import { PlayerDetailModal } from '@/components/PlayerDetailModal';
import { displayState } from '@/lib/tournament-utils';
import { effectiveK } from '@/lib/matchmaking';
import { LightRays } from '@/components/LightRays';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { MatchProgressRing } from '@/components/MatchProgressRing';
import { StrategyDistributionChart } from '@/components/StrategyDistributionChart';
import { ScoreboardTable } from '@/components/ScoreboardTable';

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const PHASE_COLORS: Record<string, string> = {
  Registration: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
  Reveal: 'rgba(245, 158, 11, 0.15)',
  Running: 'rgba(59, 130, 246, 0.15)',
  Payout: 'rgba(168, 85, 247, 0.15)',
};

interface SidebarTournament {
  id: number;
  state: string;
  pool: string;
  participantCount: number;
  winnerCount: number;
  accountClosed?: boolean;
}

function ExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sidebarTournaments, setSidebarTournaments] = useState<SidebarTournament[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Detail state
  const [tournament, setTournament] = useState<TournamentAccount | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [entries, setEntries] = useState<EntryAccount[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'score' | 'strategy' | 'player'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [minParticipants, setMinParticipants] = useState<number>(2);
  const initializedRef = useRef(false);

  // Fetch sidebar list
  useEffect(() => {
    fetch('/api/tournaments?limit=50')
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setSidebarTournaments(json.data.tournaments);
          // Set initial selection from URL or default to first
          if (!initializedRef.current) {
            initializedRef.current = true;
            const urlId = searchParams.get('t');
            if (urlId) {
              setSelectedId(parseInt(urlId, 10));
            } else if (json.data.tournaments.length > 0) {
              const firstId = json.data.tournaments[0].id;
              setSelectedId(firstId);
              router.replace(`/explorer?t=${firstId}`, { scroll: false });
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setSidebarLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch detail when selectedId changes
  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
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
        setDetailError(null);
      } else {
        setDetailError(json.error || 'Failed to fetch tournament');
        setTournament(null);
      }
      const cfgJson = await cfgRes.json();
      if (cfgJson.ok) setMinParticipants(cfgJson.data.minParticipants);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Network error');
      setTournament(null);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    fetchDetail(selectedId);
    const i = setInterval(() => fetchDetail(selectedId), 10000);
    return () => clearInterval(i);
  }, [selectedId, fetchDetail]);

  const selectTournament = (id: number) => {
    setSelectedId(id);
    setExpandedPlayer(null);
    setSortField('score');
    setSortDir('desc');
    router.replace(`/explorer?t=${id}`, { scroll: false });
    setDrawerOpen(false);
  };

  const t = tournament;

  const displayBoard = scoreboard.length > 0 ? scoreboard : entries.map(e => ({
    player: e.player,
    score: e.score,
    strategy: e.strategy,
    strategyName: e.strategyName,
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

  // Sidebar component (shared between desktop and mobile drawer)
  const sidebarContent = (
    <div className="p-3 space-y-1">
      <h2 className="text-sm font-bold text-muted uppercase tracking-wider px-2 mb-3">Tournaments</h2>
      {sidebarLoading ? (
        <div className="space-y-2 px-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-skeleton rounded-lg" />
            </div>
          ))}
        </div>
      ) : sidebarTournaments.length === 0 ? (
        <div className="text-sm text-muted px-2">No tournaments found.</div>
      ) : (
        sidebarTournaments.map(st => {
          const isSelected = st.id === selectedId;
          const dState = displayState(st as TournamentAccount);
          return (
            <button
              key={st.id}
              onClick={() => selectTournament(st.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-accent/10 border-l-2 border-l-accent'
                  : 'hover:bg-white/5 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted'}`}>
                  #{st.id}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  dState === 'Registration' ? 'badge-registration' :
                  dState === 'Reveal' ? 'badge-reveal' :
                  dState === 'Running' ? 'badge-running' :
                  dState === 'Completed' ? 'badge-completed' : 'badge-payout'
                }`}>{dState}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                <span>{formatLamports(st.pool)} SOL</span>
                <span>{st.participantCount} players</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* Mobile drawer toggle */}
      <div className="lg:hidden border-b border-card-border bg-card/80 backdrop-blur-sm sticky top-14 z-40">
        <button
          onClick={() => setDrawerOpen(o => !o)}
          className="w-full px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Tournaments
          {selectedId !== null && <span className="text-accent font-medium">#{selectedId}</span>}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="fixed top-0 left-0 bottom-0 w-64 bg-card border-r border-card-border z-50 lg:hidden overflow-y-auto"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="p-3 border-b border-card-border flex items-center justify-between">
                <span className="text-sm font-bold">Browse</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-muted hover:text-foreground transition-colors p-1"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-card-border sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          {sidebarContent}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-4 py-8">
            {(sidebarLoading || detailLoading) && !t ? (
              <div className="space-y-6">
                <div className="neon-card rounded-2xl p-8 animate-pulse">
                  <div className="h-8 bg-skeleton rounded w-1/3 mb-4" />
                  <div className="h-24 bg-skeleton rounded" />
                </div>
              </div>
            ) : detailError && !t ? (
              <div className="neon-card rounded-2xl p-8 text-center">
                <p className="text-error font-medium mb-3">{detailError}</p>
                <button
                  onClick={() => selectedId !== null && fetchDetail(selectedId)}
                  className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Retry
                </button>
              </div>
            ) : selectedId !== null && !t && !detailLoading ? (
              <div className="neon-card rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h2 className="text-xl font-bold mb-2">Tournament Not Found</h2>
                <p className="text-muted">Tournament #{selectedId} doesn&apos;t exist or hasn&apos;t been created yet.</p>
              </div>
            ) : !t ? (
              <div className="neon-card rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <h2 className="text-xl font-bold mb-2">Select a Tournament</h2>
                <p className="text-muted">Choose a tournament from the sidebar to view its details.</p>
              </div>
            ) : (
              <motion.div
                key={t.id}
                className="space-y-6"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {/* Hero / Header */}
                <motion.div variants={fadeInUp} className="neon-card rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 overflow-hidden rounded-2xl" style={{ mask: 'linear-gradient(to bottom, black 50%, transparent)', WebkitMask: 'linear-gradient(to bottom, black 50%, transparent)' }}>
                    <LightRays
                      color={PHASE_COLORS[t.state] || PHASE_COLORS.Registration}
                      count={5}
                      speed={18}
                      length="50vh"
                    />
                  </div>

                  <div className="relative z-10 p-6">
                    {/* Title + badge */}
                    <motion.div
                      className="flex items-center justify-between mb-6"
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
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
                         className="text-xs text-muted hover:text-foreground transition-colors">
                        Explorer ↗
                      </a>
                    </motion.div>

                    {/* Stats grid */}
                    <motion.div
                      className="grid grid-cols-2 md:grid-cols-4 gap-4"
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                    >
                      <StatCard label="Prize Pool" value={formatLamports(t.pool)} suffix=" SOL" numeric />
                      <StatCard label="Stake" value={formatLamports(t.stake)} suffix=" SOL" numeric />
                      <StatCard label="Players" value={String(t.participantCount)} numeric />
                      <StatCard label="House Fee" value={`${t.houseFeeBps / 100}%`} />
                    </motion.div>

                    {/* Phase Widgets */}
                    {t.state === 'Registration' && (() => {
                      const nowSec = Math.floor(Date.now() / 1000);
                      const deadlinePassed = nowSec >= Number(t.registrationEnds);
                      const needed = Math.max(0, minParticipants - t.participantCount);
                      return (
                        <div className="mt-6 pt-6 border-t border-card-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {deadlinePassed && needed > 0 ? (
                              <div className="text-center">
                                <div className="text-xs text-muted uppercase tracking-wider mb-1">Registration Open</div>
                                <motion.div
                                  className="text-2xl font-bold font-mono text-warning"
                                  animate={{ opacity: [1, 0.6, 1] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  Waiting for {needed} more player{needed !== 1 ? 's' : ''}
                                </motion.div>
                              </div>
                            ) : (
                              <SegmentedCountdown
                                targetTimestamp={Number(t.registrationEnds)}
                                label="Registration Ends"
                                expiredText="Starting soon"
                                expiredClassName="text-accent"
                              />
                            )}
                            <div className="flex flex-col items-center justify-center">
                              <AnimatedCounter
                                value={t.participantCount}
                                className="text-4xl font-bold"
                              />
                              <div className="text-sm text-muted mt-1">participants registered</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {t.state === 'Reveal' && (
                      <div className="mt-6 pt-6 border-t border-card-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <SegmentedCountdown
                            targetTimestamp={Number(t.revealEnds)}
                            label="Reveal Ends"
                            expiredText="Closing soon"
                            expiredClassName="text-warning"
                          />
                          <div className="flex flex-col items-center justify-center">
                            <div className="text-4xl font-bold">
                              <AnimatedCounter value={t.revealsCompleted} /> / {t.participantCount}
                            </div>
                            <div className="text-sm text-muted mt-1">strategies revealed</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {t.state === 'Running' && (
                      <div className="mt-6 pt-6 border-t border-card-border">
                        <div className="flex flex-col items-center">
                          <MatchProgressRing completed={t.matchesCompleted} total={t.matchesTotal} />
                          <div className="text-xs text-muted mt-2">K={effectiveK(t.matchesPerPlayer, t.participantCount)} matches per player</div>
                        </div>
                      </div>
                    )}

                    {t.state === 'Payout' && (
                      <div className="mt-6 pt-6 border-t border-card-border">
                        <motion.div
                          className="grid grid-cols-2 md:grid-cols-4 gap-4"
                          variants={staggerContainer}
                          initial="hidden"
                          animate="show"
                        >
                          <StatCard label="Winners" value={String(t.winnerCount)} numeric />
                          <StatCard
                            label="Per Winner"
                            value={t.winnerCount > 0 ? formatLamports((BigInt(t.winnerPool) / BigInt(t.winnerCount)).toString()) : '—'}
                            suffix={t.winnerCount > 0 ? ' SOL' : ''}
                            numeric={t.winnerCount > 0}
                          />
                          <StatCard label="Min Score" value={String(t.minWinningScore)} numeric />
                          <StatCard label="Claimed" value={`${t.claimsProcessed} / ${t.winnerCount}`} />
                        </motion.div>
                        {displayState(t) === 'Completed' ? (
                          <motion.div
                            className="mt-4 flex items-center justify-center gap-2 text-sm text-success"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            <span className="glow-accent">&#10003;</span>
                            Tournament completed. All prizes distributed.
                          </motion.div>
                        ) : t.payoutStartedAt !== '0' && (
                          <div className="mt-4">
                            <SegmentedCountdown
                              targetTimestamp={Number(t.payoutStartedAt) + 30 * 86400}
                              label="Claim Deadline"
                              expiredText="Claims expired"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="mt-4 pt-4 border-t border-card-border flex flex-wrap gap-4 text-xs text-muted">
                      <span>Program: <a href={explorerLink(getProgramId().toBase58())} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">{truncateAddress(getProgramId().toBase58(), 6)}</a></span>
                      <span>Account: <a href={explorerLink(t.address)} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">{truncateAddress(t.address, 6)}</a></span>
                      <span>Matches/player: {effectiveK(t.matchesPerPlayer, t.participantCount)}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Strategy Distribution */}
                {displayBoard.length > 0 && (
                  <motion.div variants={fadeInUp} className="neon-card rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-4">Strategy Distribution</h2>
                    <StrategyDistributionChart entries={displayBoard} />
                  </motion.div>
                )}

                {/* Scoreboard */}
                {displayBoard.length > 0 && (
                  <motion.div variants={fadeInUp}>
                    <ScoreboardTable
                      sorted={sorted}
                      tournament={t}
                      expandedPlayer={expandedPlayer}
                      setExpandedPlayer={setExpandedPlayer}
                      toggleSort={toggleSort}
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </motion.div>
                )}

                {/* Player Detail Modal */}
                <AnimatePresence mode="wait">
                  {expandedPlayer && (() => {
                    const entry = sorted.find(e => e.player === expandedPlayer);
                    if (!entry || entry.revealed === false) return null;
                    const pIdx = t.players.indexOf(expandedPlayer);
                    if (pIdx < 0) return null;
                    const rank = sorted.indexOf(entry) + 1;
                    const isWinner = t.state === 'Payout' && entry.score >= t.minWinningScore;
                    return (
                      <PlayerDetailModal
                        key={expandedPlayer}
                        tournament={t}
                        entry={entry}
                        playerIndex={pIdx}
                        rank={rank}
                        isWinner={isWinner}
                        onClose={() => setExpandedPlayer(null)}
                      />
                    );
                  })()}
                </AnimatePresence>

                {/* Empty state */}
                {entries.length === 0 && t.state === 'Registration' && (
                  <motion.div variants={fadeInUp} className="neon-card rounded-2xl p-8 text-center">
                    <div className="text-4xl mb-3">🎯</div>
                    <h3 className="font-bold text-lg mb-2">No participants yet</h3>
                    <p className="text-muted text-sm">Be the first to enter! Read the <a href="/participate.md" className="text-accent hover:text-accent-hover">participation guide</a>.</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, numeric }: {
  label: string;
  value: string;
  suffix?: string;
  numeric?: boolean;
}) {
  const num = numeric ? parseFloat(value) : NaN;

  return (
    <motion.div variants={fadeInUp} className="bg-surface rounded-xl px-4 py-3 border border-card-border hover:border-accent/30 transition-colors">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-bold mt-0.5 text-lg">
        {numeric && !isNaN(num) ? (
          <AnimatedCounter value={num} suffix={suffix} decimals={value.includes('.') ? value.split('.')[1].length : 0} />
        ) : (
          value
        )}
      </div>
    </motion.div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      </div>
    }>
      <ExplorerContent />
    </Suspense>
  );
}
