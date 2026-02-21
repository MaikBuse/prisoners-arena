'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { TournamentAccount } from '@/lib/solana';
import { truncateAddress, explorerLink } from '@/lib/solana';
import { StrategyBadge } from '@/components/StrategyBadge';
import type { PlayerMatchInfo, MatchReplayResult, PlayerStats } from '@/lib/matchReplay';

interface MatchHistoryProps {
  tournament: TournamentAccount;
  playerIndex: number;
}

export function MatchHistory({ tournament, playerIndex }: MatchHistoryProps) {
  const [matches, setMatches] = useState<PlayerMatchInfo[] | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [replay, setReplay] = useState<MatchReplayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMatches(null);
    setStats(null);
    setExpandedMatch(null);
    setReplay(null);
    setError(null);
    (async () => {
      try {
        const t = tournamentRef.current;
        const { getPlayerMatches, getPlayerStats } = await import('@/lib/matchReplay');
        const [m, s] = await Promise.all([
          getPlayerMatches(t, playerIndex),
          getPlayerStats(t, playerIndex),
        ]);
        if (!cancelled) {
          setMatches(m);
          setStats(s);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load match history');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tournament.address, playerIndex]);

  const handleExpandMatch = useCallback(async (matchIndex: number) => {
    if (expandedMatch === matchIndex) {
      setExpandedMatch(null);
      setReplay(null);
      return;
    }
    setExpandedMatch(matchIndex);
    setReplay(null);
    try {
      const { replayMatch } = await import('@/lib/matchReplay');
      const r = await replayMatch(tournamentRef.current, matchIndex, playerIndex);
      setReplay(r);
    } catch {
      // Silently fail — user can try again
    }
  }, [expandedMatch, playerIndex]);

  if (loading) {
    return <div className="text-xs text-muted animate-pulse">Loading match history...</div>;
  }

  if (error) {
    return <div className="text-xs text-error">Failed to load match history</div>;
  }

  if (!matches || matches.length === 0) {
    return <div className="text-xs text-muted">No matches found</div>;
  }

  return (
    <div>
      {/* Stats summary */}
      {stats && (
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted mb-3 sm:mb-4">
          <span>Coop: {Math.round(stats.cooperationRate * 100)}%</span>
          <span className="text-success font-bold">W {stats.wins}</span>
          <span className="text-error font-bold">L {stats.losses}</span>
          {stats.draws > 0 && <span className="font-bold">D {stats.draws}</span>}
        </div>
      )}

      {/* Match list */}
      <div className="space-y-1 sm:space-y-1.5">
        {matches.map(m => {
          const isExpanded = expandedMatch === m.matchIndex;
          const won = m.playerScore > m.opponentScore;
          const lost = m.playerScore < m.opponentScore;

          return (
            <div key={m.matchIndex}>
              <button
                onClick={() => handleExpandMatch(m.matchIndex)}
                className="w-full flex items-center gap-2 sm:gap-3 py-2 px-2.5 sm:py-2.5 sm:px-3 text-left hover:bg-white/5 rounded transition-colors cursor-pointer"
              >
                <span className="text-[11px] sm:text-xs text-muted font-mono w-6 sm:w-8 shrink-0 whitespace-nowrap">#{m.matchIndex}</span>
                <span className="text-[10px] text-muted hidden sm:inline w-6 shrink-0">vs</span>
                <a
                  href={explorerLink(m.opponentAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-mono text-accent hover:text-accent-hover shrink-0 whitespace-nowrap"
                  onClick={e => e.stopPropagation()}
                >
                  {truncateAddress(m.opponentAddress, 4)}
                </a>
                <span className="shrink-0">
                  <StrategyBadge strategy={m.opponentStrategy} />
                </span>
                <span className="flex-1" />
                <span className={`text-xs sm:text-sm font-bold shrink-0 w-4 text-center ${won ? 'text-success' : lost ? 'text-error' : 'text-muted'}`}>
                  {won ? 'W' : lost ? 'L' : 'D'}
                </span>
                <span className="text-xs sm:text-sm font-mono shrink-0 w-16 text-right whitespace-nowrap">
                  {m.playerScore} - {m.opponentScore}
                </span>
                <span className="text-[11px] sm:text-xs text-muted shrink-0 w-14 text-right hidden sm:inline whitespace-nowrap">
                  {m.roundCount} rds
                </span>
                <span className="text-[10px] text-muted w-3 shrink-0 text-right">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {isExpanded && (
                <MatchDetail
                  replay={replay}
                  matchInfo={m}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Match Detail (round-by-round view) ────────────────────────────

function MatchDetail({
  replay,
  matchInfo,
}: {
  replay: MatchReplayResult | null;
  matchInfo: PlayerMatchInfo;
}) {
  if (!replay) {
    return (
      <div className="ml-2 pl-3 border-l-2 border-card-border py-2">
        <div className="text-[10px] text-muted animate-pulse">Loading rounds...</div>
      </div>
    );
  }

  const playerLabel = truncateAddress(matchInfo.playerAddress, 4);
  const opponentLabel = truncateAddress(matchInfo.opponentAddress, 4);

  return (
    <div className="ml-2 pl-3 sm:pl-4 border-l-2 border-card-border py-3 space-y-3 sm:py-4 sm:space-y-4">
      {/* Match header */}
      <div className="text-xs sm:text-sm text-muted">
        {matchInfo.playerStrategyName} vs {matchInfo.opponentStrategyName} &middot; {replay.roundCount} rounds &middot; Score: {replay.totalPlayerScore} - {replay.totalOpponentScore}
      </div>

      {/* Move sequences */}
      <div>
        <div className="text-xs text-muted mb-0.5">{playerLabel}:</div>
        <MoveBoxes moves={replay.rounds.map(r => r.playerMove)} />
      </div>
      <div>
        <div className="text-xs text-muted mb-0.5">{opponentLabel}:</div>
        <MoveBoxes moves={replay.rounds.map(r => r.opponentMove)} />
      </div>

      {/* Cumulative score chart */}
      <ScoreChart replay={replay} playerLabel={playerLabel} opponentLabel={opponentLabel} />
    </div>
  );
}

// ── Move Boxes ──────────────────────────────────────────────────────

function MoveBoxes({ moves }: { moves: ('C' | 'D')[] }) {
  return (
    <div className="flex flex-wrap gap-0.5 sm:gap-1">
      {moves.map((move, i) => (
        <div
          key={i}
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded text-[9px] sm:text-[11px] font-bold flex items-center justify-center
            ${move === 'C' ? 'bg-cooperate/15 text-cooperate' : 'bg-defect/15 text-defect'}`}
        >
          {move}
        </div>
      ))}
    </div>
  );
}

// ── Cumulative Score Chart (simple SVG) ─────────────────────────────

function ScoreChart({ replay, playerLabel, opponentLabel }: { replay: MatchReplayResult; playerLabel: string; opponentLabel: string }) {
  const { rounds } = replay;
  if (rounds.length === 0) return null;

  const width = 600;
  const height = 100;
  const pad = { top: 8, right: 40, bottom: 20, left: 8 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxScore = Math.max(
    rounds[rounds.length - 1].cumulativePlayer,
    rounds[rounds.length - 1].cumulativeOpponent,
    1,
  );
  const maxRound = rounds.length - 1 || 1;

  const toX = (i: number) => pad.left + (i / maxRound) * chartW;
  const toY = (score: number) => pad.top + chartH - (score / maxScore) * chartH;

  const playerPath = rounds.map((r, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(r.cumulativePlayer).toFixed(1)}`).join('');
  const opponentPath = rounds.map((r, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(r.cumulativeOpponent).toFixed(1)}`).join('');

  const labelX = width - pad.right + 4;
  let playerLabelY = toY(rounds[rounds.length - 1].cumulativePlayer) - 4;
  let opponentLabelY = toY(rounds[rounds.length - 1].cumulativeOpponent) + 14;
  const minGap = 14;
  if (Math.abs(playerLabelY - opponentLabelY) < minGap) {
    const mid = (playerLabelY + opponentLabelY) / 2;
    playerLabelY = mid - minGap / 2;
    opponentLabelY = mid + minGap / 2;
  }
  // Clamp labels within viewBox (12 = fontSize, keeps ascenders visible)
  playerLabelY = Math.max(12, Math.min(height - pad.bottom, playerLabelY));
  opponentLabelY = Math.max(12, Math.min(height - pad.bottom, opponentLabelY));

  return (
    <div>
      <div className="text-xs text-muted mb-0.5">Cumulative Score</div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" preserveAspectRatio="xMidYMid meet" className="block">
        {/* Grid line at midpoint */}
        <line
          x1={pad.left} y1={toY(maxScore / 2)}
          x2={width - pad.right} y2={toY(maxScore / 2)}
          stroke="var(--color-card-border)" strokeWidth={1}
        />
        {/* Opponent line */}
        <path d={opponentPath} fill="none" stroke="var(--color-defect)" strokeWidth={2.5} opacity={0.6} />
        {/* Player line */}
        <path d={playerPath} fill="none" stroke="var(--color-info)" strokeWidth={2.5} />
        {/* End labels */}
        <text
          x={labelX}
          y={playerLabelY}
          textAnchor="start"
          className="fill-info font-mono"
          fontSize={12}
          stroke="var(--color-background)" strokeWidth={3} paintOrder="stroke"
        >
          {replay.totalPlayerScore}
        </text>
        <text
          x={labelX}
          y={opponentLabelY}
          textAnchor="start"
          className="fill-error font-mono"
          fontSize={12}
          stroke="var(--color-background)" strokeWidth={3} paintOrder="stroke"
        >
          {replay.totalOpponentScore}
        </text>
        {/* X-axis label */}
        <text x={width / 2} y={height - 2} textAnchor="middle" className="fill-muted" fontSize={10}>
          Rounds (1–{rounds.length})
        </text>
      </svg>
      <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted mt-0.5">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 sm:w-4 sm:h-1 bg-info rounded" /> {playerLabel}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 sm:w-4 sm:h-1 bg-error rounded" /> {opponentLabel}</span>
      </div>
    </div>
  );
}
