'use client';
import { useEffect, useState, useCallback } from 'react';
import type { TournamentAccount } from '@/lib/solana';
import { formatLamports } from '@/lib/solana';
import { SolAmount } from '@/components/SolAmount';
import { SkeletonCard } from '@/components/SkeletonLoader';
import Link from 'next/link';

export default function HistoryPage() {
  const [tournaments, setTournaments] = useState<TournamentAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tournaments?limit=20&offset=0');
      const json = await res.json();
      if (json.ok) setTournaments(json.data.tournaments);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tournament History</h1>
      {tournaments.length === 0 ? (
        <p className="text-zinc-500">No tournaments found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map(t => (
            <Link key={t.id} href={`/tournament/${t.id}`} className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-lg">Tournament #{t.id}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  t.state === 'Registration' ? 'bg-green-500/20 text-green-400' :
                  t.state === 'Running' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>{t.state}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-zinc-500">Pool</div>
                  <SolAmount lamports={t.pool} className="text-zinc-200" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Players</div>
                  <div className="text-zinc-200">{t.participantCount}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Matches</div>
                  <div className="text-zinc-200">{t.matchesCompleted}/{t.matchesTotal}</div>
                </div>
              </div>
              {t.state === 'Payout' && t.winnerCount > 0 && (
                <div className="mt-3 text-xs text-zinc-500">
                  🏆 {t.winnerCount} winners — {formatLamports((BigInt(t.winnerPool) / BigInt(t.winnerCount)).toString())} SOL each
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
