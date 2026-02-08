'use client';
import { NETWORK } from '@/lib/solana';

export function NetworkBadge() {
  const isDevnet = NETWORK === 'devnet';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${isDevnet ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isDevnet ? 'bg-yellow-400' : 'bg-green-400'}`} />
      {NETWORK}
    </span>
  );
}
