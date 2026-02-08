import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConfig, useTournament, useEntry, usePolling } from "../hooks/useTournament";
import { useTransactions } from "../hooks/useTransactions";
import { CountdownTimer } from "../components/CountdownTimer";
import { ScoresTable } from "../components/ScoresTable";
import { ConfigPanel } from "../components/ConfigPanel";
import { StrategyPicker } from "../components/StrategyPicker";
import { getStateName, lamportsToSol } from "../types";
import type { StrategyType } from "../types";

export function Dashboard() {
  const { publicKey } = useWallet();
  const { config, loading: configLoading, refetch: refetchConfig } = useConfig();
  const tournamentId = config?.currentTournamentId ?? null;
  const { tournament, loading: tourLoading, refetch: refetchTournament } = useTournament(tournamentId);
  const { entry } = useEntry(tournamentId, publicKey);
  const { enterTournament, claimRefund, claimPayout } = useTransactions(tournamentId);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  usePolling(refetchConfig, refetchTournament, tournament);

  if (configLoading || tourLoading) {
    return <div className="text-center py-20 text-gray-500">Loading...</div>;
  }

  if (!config || !tournament) {
    return <div className="text-center py-20 text-gray-500">No tournament data found. Is the program initialized?</div>;
  }

  const state = tournament.state;
  const stateName = getStateName(state);
  const isRegistration = "registration" in state;
  const isRunning = "running" in state;
  const isPayout = "payout" in state;

  const handleEnter = async () => {
    if (!selectedStrategy) return;
    setEntering(true);
    try {
      const strat = { [selectedStrategy]: {} } as unknown as StrategyType;
      await enterTournament(strat);
    } catch {}
    setEntering(false);
  };

  const stateColors: Record<string, string> = {
    Registration: "bg-blue-600/30 text-blue-400 border-blue-600",
    Running: "bg-yellow-600/30 text-yellow-400 border-yellow-600",
    Payout: "bg-green-600/30 text-green-400 border-green-600",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Tournament Header */}
      <div className="bg-gray-900 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">Tournament #{tournament.id}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${stateColors[stateName] ?? ""}`}>
            {stateName}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="Prize Pool" value={`${lamportsToSol(tournament.pool)} SOL`} />
          <Stat label="Stake" value={`${lamportsToSol(tournament.stake)} SOL`} />
          <Stat label="Participants" value={String(tournament.participantCount)} />
          <Stat label="House Fee" value={`${tournament.houseFeeBps} bps`} />
        </div>

        {/* State-specific content */}
        {isRegistration && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Registration ends in</p>
              <CountdownTimer deadline={tournament.registrationEnds.toNumber()} />
            </div>

            {!entry && publicKey && (
              <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <StrategyPicker value={selectedStrategy} onChange={setSelectedStrategy} />
                <button
                  onClick={handleEnter}
                  disabled={!selectedStrategy || entering}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-2 font-medium"
                >
                  {entering ? "Entering..." : "Enter Tournament"}
                </button>
              </div>
            )}

            {entry && (
              <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                <span className="text-green-400">✓ You're entered!</span>
                <button onClick={claimRefund} className="text-sm text-red-400 hover:text-red-300">
                  Withdraw & Refund
                </button>
              </div>
            )}

            {!publicKey && (
              <p className="text-sm text-gray-500">Connect wallet to enter</p>
            )}
          </div>
        )}

        {isRunning && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Match Progress</p>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all"
                  style={{ width: `${tournament.matchesTotal > 0 ? (tournament.matchesCompleted / tournament.matchesTotal) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {tournament.matchesCompleted} / {tournament.matchesTotal} matches
              </p>
            </div>
          </div>
        )}

        {isPayout && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Stat label="Winners" value={String(tournament.winnerCount)} />
              <Stat label="Winner Pool" value={`${lamportsToSol(tournament.winnerPool)} SOL`} />
              <Stat label="Min Winning Score" value={String(tournament.minWinningScore)} />
              <Stat label="Claims Processed" value={`${tournament.claimsProcessed} / ${tournament.winnerCount}`} />
            </div>
            {entry && !entry.paidOut && entry.score >= tournament.minWinningScore && (
              <button onClick={claimPayout} className="w-full bg-green-600 hover:bg-green-500 rounded-lg py-2 font-medium">
                Claim Payout 🎉
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scores Table */}
      {(isRunning || isPayout) && tournament.players.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Scores</h2>
          <ScoresTable tournament={tournament} walletKey={publicKey} />
        </div>
      )}

      {/* Config Panel */}
      <ConfigPanel config={config} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
