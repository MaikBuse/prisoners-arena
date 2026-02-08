import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Link } from "react-router-dom";
import { useConfig, useTournament, useEntry } from "../hooks/useTournament";
import { useTransactions } from "../hooks/useTransactions";
import { getStateName, getStrategyName, lamportsToSol } from "../types";

export function EntryView() {
  const { publicKey } = useWallet();
  const { config } = useConfig();
  const tournamentId = config?.currentTournamentId ?? null;
  const { tournament } = useTournament(tournamentId);
  const { entry, loading } = useEntry(tournamentId, publicKey);
  const { claimRefund, claimPayout } = useTransactions(tournamentId);

  if (!publicKey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">
        Connect your wallet to view your entry.
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading...</div>;
  }

  if (!entry || !tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-gray-400">You haven't entered the current tournament.</p>
        <Link to="/" className="inline-block bg-purple-600 hover:bg-purple-500 rounded-lg px-6 py-2">
          Enter Tournament →
        </Link>
      </div>
    );
  }

  const isRegistration = "registration" in tournament.state;
  const isPayout = "payout" in tournament.state;
  const isWinner = entry.score >= tournament.minWinningScore;

  // Calculate rank
  const scores = [...tournament.scores].sort((a, b) => b - a);
  const rank = scores.indexOf(entry.score) + 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-gray-900 rounded-xl p-6 space-y-6">
        <h1 className="text-xl font-bold">Your Entry — Tournament #{tournament.id}</h1>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Strategy</p>
            <p className="font-medium">{getStrategyName(entry.strategy)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Score</p>
            <p className="font-medium font-mono">{entry.score}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Matches Played</p>
            <p className="font-medium">{entry.matchesPlayed}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Rank</p>
            <p className="font-medium">#{rank} / {tournament.participantCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tournament State</p>
            <p className="font-medium">{getStateName(tournament.state)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Stake</p>
            <p className="font-medium">{lamportsToSol(tournament.stake)} SOL</p>
          </div>
        </div>

        {isRegistration && (
          <button onClick={claimRefund} className="w-full bg-red-600/80 hover:bg-red-600 rounded-lg py-2 font-medium">
            Claim Refund
          </button>
        )}

        {isPayout && isWinner && !entry.paidOut && (
          <button onClick={claimPayout} className="w-full bg-green-600 hover:bg-green-500 rounded-lg py-2 font-medium">
            Claim Payout 🎉
          </button>
        )}

        {isPayout && entry.paidOut && (
          <p className="text-center text-green-400">✓ Payout claimed</p>
        )}
      </div>
    </div>
  );
}
