import type { TournamentAccount } from './solana';

/** Derive a user-facing display state from raw on-chain tournament state. */
export function displayState(t: TournamentAccount & { accountClosed?: boolean }): string {
  if (t.accountClosed) {
    return 'Completed';
  }
  if (t.state === 'Payout' && t.winnerCount > 0 && t.claimsProcessed >= t.winnerCount) {
    return 'Completed';
  }
  return t.state;
}
