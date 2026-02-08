import React, { useState, useEffect } from "react";
import { useProgram, useProgramId, getTournamentPda } from "../hooks/useProgram";
import { useConfig } from "../hooks/useTournament";
import type { TournamentAccount } from "../types";
import { getStateName, lamportsToSol } from "../types";
import { PublicKey } from "@solana/web3.js";
import { ScoresTable } from "../components/ScoresTable";
import { useWallet } from "@solana/wallet-adapter-react";

export function History() {
  const { config } = useConfig();
  const program = useProgram();
  const programId = useProgramId();
  const { publicKey } = useWallet();
  const [tournaments, setTournaments] = useState<TournamentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!config) return;
    const load = async () => {
      const results: TournamentAccount[] = [];
      for (let i = config.currentTournamentId; i >= 0; i--) {
        try {
          const pda = getTournamentPda(programId, i);
          const acc = await (program.account as any).tournament.fetch(pda);
          results.push(acc as TournamentAccount);
        } catch { break; }
      }
      setTournaments(results);
      setLoading(false);
    };
    load();
  }, [config, program, programId]);

  if (loading) return <div className="text-center py-20 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">Tournament History</h1>
      {tournaments.length === 0 && <p className="text-gray-500">No tournaments found.</p>}
      {tournaments.map((t) => (
        <div key={t.id} className="bg-gray-900 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <span className="font-bold">#{t.id}</span>
              <span className="text-xs text-gray-400">{getStateName(t.state)}</span>
              <span className="text-xs text-gray-500">{t.participantCount} players</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>{lamportsToSol(t.pool)} SOL</span>
              {t.winnerCount > 0 && <span className="text-yellow-400">{t.winnerCount} winners</span>}
              <span className="text-gray-600">{expanded === t.id ? "▲" : "▼"}</span>
            </div>
          </button>
          {expanded === t.id && (
            <div className="px-6 pb-4">
              <ScoresTable tournament={t} walletKey={publicKey} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
