import { formatLamports } from '@/lib/solana';

export function SolAmount({ lamports, className = '' }: { lamports: string; className?: string }) {
  return <span className={`font-mono ${className}`}>{formatLamports(lamports)} SOL</span>;
}
