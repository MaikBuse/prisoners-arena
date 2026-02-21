'use client';

import { useEffect } from 'react';
import type { TournamentAccount } from '@/lib/solana';
import type { ScoreboardEntry } from '@/lib/api';
import { truncateAddress, explorerLink } from '@/lib/solana';
import { StrategyBadge } from '@/components/StrategyBadge';
import { CopyButton } from '@/components/CopyButton';
import { MatchHistory } from '@/components/MatchHistory';
import { effectiveK } from '@/lib/matchmaking';

interface PlayerDetailModalProps {
  tournament: TournamentAccount;
  entry: ScoreboardEntry;
  playerIndex: number;
  rank: number;
  isWinner: boolean;
  onClose: () => void;
}

export function PlayerDetailModal({ tournament, entry, playerIndex, rank, isWinner, onClose }: PlayerDetailModalProps) {
  // Escape key listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const t = tournament;
  const hasMatches = (t.state === 'Running' || t.state === 'Payout') && t.matchesCompleted > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-[calc(100%-1rem)] sm:w-full max-w-2xl lg:max-w-4xl mx-2 sm:mx-4 neon-card rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
      <div className="max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-card-border px-5 py-4 sm:px-6 sm:py-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-wrap gap-2 min-w-0">
              <span className="text-sm sm:text-base text-muted font-mono shrink-0">#{rank}{isWinner && ' 🏆'}</span>
              <a
                href={explorerLink(entry.player)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover font-mono text-sm sm:text-base truncate"
              >
                {truncateAddress(entry.player, 6)}
              </a>
              <CopyButton text={entry.player} />
              {entry.strategy >= 0 && <StrategyBadge strategy={entry.strategy} />}
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground transition-colors text-xl leading-none px-1 cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center flex-wrap gap-x-4 sm:gap-x-5 gap-y-1 mt-2 text-xs sm:text-sm text-muted">
            <span>Score: <span className="font-bold text-foreground">{entry.score}</span></span>
            <span>Matches: {entry.matchesPlayed} / {effectiveK(t.matchesPerPlayer, t.participantCount)}</span>
            {t.state === 'Payout' && (
              <span>{entry.paidOut ? '✅ Claimed' : isWinner ? '⏳ Unclaimed' : ''}</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-5">
          {/* Match History */}
          {hasMatches && (
            <div>
              <div className="border-t border-card-border pt-4">
                <div className="text-xs sm:text-sm font-bold text-muted mb-2">Match History</div>
                <MatchHistory tournament={t} playerIndex={playerIndex} />
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
