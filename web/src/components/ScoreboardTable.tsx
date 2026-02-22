'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'motion/react';
import type { TournamentAccount } from '@/lib/solana';
import type { ScoreboardEntry } from '@/lib/api';
import { truncateAddress, explorerLink } from '@/lib/solana';
import { StrategyBadge } from '@/components/StrategyBadge';
import { CopyButton } from '@/components/CopyButton';
import { effectiveK } from '@/lib/matchmaking';

interface ScoreboardTableProps {
  sorted: ScoreboardEntry[];
  tournament: TournamentAccount;
  expandedPlayer: string | null;
  setExpandedPlayer: (player: string | null) => void;
  toggleSort: (field: 'score' | 'strategy' | 'player') => void;
  sortField: 'score' | 'strategy' | 'player';
  sortDir: 'asc' | 'desc';
}

function RankBadge({ rank, finished }: { rank: number; finished: boolean }) {
  if (finished && rank === 1) {
    return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full medal-gold text-white text-xs font-bold shadow-sm">1</span>;
  }
  if (finished && rank === 2) {
    return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full medal-silver text-white text-xs font-bold shadow-sm">2</span>;
  }
  if (finished && rank === 3) {
    return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full medal-bronze text-white text-xs font-bold shadow-sm">3</span>;
  }
  return <span className="text-muted">{rank}</span>;
}

function SortChevron({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={`inline-block ml-1 ${active ? 'text-foreground' : 'text-transparent'}`}
      animate={{ rotate: direction === 'asc' ? 180 : 0 }}
      transition={{ duration: 0.2 }}
    >
      <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export function ScoreboardTable({
  sorted,
  tournament,
  expandedPlayer,
  setExpandedPlayer,
  toggleSort,
  sortField,
  sortDir,
}: ScoreboardTableProps) {
  const t = tournament;
  const tableRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(tableRef, { once: true, amount: 0.1 });
  const useLayoutAnim = sorted.length <= 50;

  const pageSize = 10;
  const [page, setPage] = useState(0);
  // Reset page when tournament changes
  useEffect(() => { setPage(0); }, [tournament.id]);
  const totalPages = Math.ceil(sorted.length / pageSize);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const rankOffset = safePage * pageSize;

  return (
    <div className="neon-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-card-border flex items-center justify-between">
        <h2 className="text-lg font-bold">Scoreboard</h2>
        <span className="text-xs text-muted">{sorted.length} players</span>
      </div>
      <div className="overflow-x-auto" ref={tableRef}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs border-b border-card-border">
              <th className="px-3 sm:px-5 py-3 text-center w-12">#</th>
              <th
                className="px-3 sm:px-5 py-3 text-left cursor-pointer hover:text-foreground select-none"
                onClick={() => toggleSort('player')}
              >
                Player
                <SortChevron active={sortField === 'player'} direction={sortDir} />
              </th>
              <th
                className="px-3 sm:px-5 py-3 text-left cursor-pointer hover:text-foreground select-none"
                onClick={() => toggleSort('strategy')}
              >
                Strategy
                <SortChevron active={sortField === 'strategy'} direction={sortDir} />
              </th>
              <th
                className="px-3 sm:px-5 py-3 text-right cursor-pointer hover:text-foreground select-none"
                onClick={() => toggleSort('score')}
              >
                Score
                <SortChevron active={sortField === 'score'} direction={sortDir} />
              </th>
              <th className="px-3 sm:px-5 py-3 text-right hidden sm:table-cell">Matches</th>
              {t.state === 'Payout' && <th className="px-3 sm:px-5 py-3 text-center">Status</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((e, i) => {
              const rank = rankOffset + i + 1;
              const isWinner = t.state === 'Payout' && e.score >= t.minWinningScore;
              const isSelected = expandedPlayer === e.player;

              const row = (
                <motion.tr
                  key={e.player}
                  layoutId={useLayoutAnim ? `row-${e.player}` : undefined}
                  variants={rowVariants}
                  initial="hidden"
                  animate={isInView ? 'show' : 'hidden'}
                  custom={i}
                  className={`border-b border-card-border transition-colors cursor-pointer group ${
                    isWinner ? 'bg-warning/5 border-l-2 border-l-warning/60' : ''
                  } ${isSelected ? 'bg-white/5' : ''}`}
                  onClick={() => setExpandedPlayer(isSelected ? null : e.player)}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <td className="px-3 sm:px-5 py-2 sm:py-3 whitespace-nowrap text-center">
                    <RankBadge rank={rank} finished={t.state === 'Payout'} />
                  </td>
                  <td className="px-3 sm:px-5 py-2 sm:py-3 font-mono text-sm">
                    <a
                      href={explorerLink(e.player)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent-hover"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {truncateAddress(e.player, 6)}
                    </a>
                    <CopyButton text={e.player} />
                  </td>
                  <td className="px-3 sm:px-5 py-2 sm:py-3">
                    <span className="inline-flex items-center flex-wrap gap-y-1">
                      {e.revealed === false ? (
                        <span className="text-muted">Hidden</span>
                      ) : e.strategy >= 0 ? (
                        <StrategyBadge strategy={e.strategy} />
                      ) : (
                        <span className="text-xs text-muted">&mdash;</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 sm:px-5 py-2 sm:py-3 text-right font-mono font-bold">{e.score}</td>
                  <td className="px-3 sm:px-5 py-2 sm:py-3 text-right text-muted hidden sm:table-cell">
                    {`${e.matchesPlayed} / ${effectiveK(t.matchesPerPlayer, t.participantCount)}`}
                  </td>
                  {t.state === 'Payout' && (
                    <td className="px-3 sm:px-5 py-2 sm:py-3 text-center text-sm">
                      {e.paidOut ? 'Claimed' : isWinner ? 'Unclaimed' : '—'}
                    </td>
                  )}
                </motion.tr>
              );

              return row;
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="px-5 py-3 border-t border-card-border flex items-center justify-between">
          <span className="text-xs text-muted">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              className="px-2 py-1 text-xs rounded border border-card-border disabled:opacity-30 hover:bg-white/5 transition-colors"
            >«</button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-2 py-1 text-xs rounded border border-card-border disabled:opacity-30 hover:bg-white/5 transition-colors"
            >‹</button>
            <span className="px-2 text-xs text-muted">{safePage + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-card-border disabled:opacity-30 hover:bg-white/5 transition-colors"
            >›</button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-card-border disabled:opacity-30 hover:bg-white/5 transition-colors"
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}
