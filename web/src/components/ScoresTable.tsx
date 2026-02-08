import React, { useState, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import type { TournamentAccount } from "../types";

interface Props {
  tournament: TournamentAccount;
  walletKey?: PublicKey | null;
}

type SortField = "rank" | "score" | "player";

export function ScoresTable({ tournament, walletKey }: Props) {
  const [sortBy, setSortBy] = useState<SortField>("rank");
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const entries = tournament.players
      .map((p, i) => ({
        player: p,
        score: tournament.scores[i] ?? 0,
        index: i,
        isDefault: p.equals(PublicKey.default),
      }))
      .filter((e) => !e.isDefault);

    // Sort by score desc to get ranks
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    return sorted.map((e, rank) => ({ ...e, rank: rank + 1 }));
  }, [tournament]);

  const displayed = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "rank") cmp = a.rank - b.rank;
      else if (sortBy === "score") cmp = a.score - b.score;
      else cmp = a.player.toBase58().localeCompare(b.player.toBase58());
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortBy, sortAsc]);

  const toggleSort = (f: SortField) => {
    if (sortBy === f) setSortAsc(!sortAsc);
    else { setSortBy(f); setSortAsc(f === "rank"); }
  };

  const isPayout = "payout" in tournament.state;
  const truncate = (pk: PublicKey) => {
    const s = pk.toBase58();
    return s.slice(0, 4) + "..." + s.slice(-4);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            <th className="px-3 py-2 text-left cursor-pointer" onClick={() => toggleSort("rank")}>#</th>
            <th className="px-3 py-2 text-left cursor-pointer" onClick={() => toggleSort("player")}>Player</th>
            <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("score")}>Score</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((r) => {
            const isMe = walletKey && r.player.equals(walletKey);
            const isWinner = isPayout && r.score >= tournament.minWinningScore;
            return (
              <tr
                key={r.player.toBase58()}
                className={`border-b border-gray-900 ${isMe ? "bg-purple-900/30" : ""} ${isWinner ? "text-yellow-300" : ""}`}
              >
                <td className="px-3 py-2">{r.rank}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {truncate(r.player)} {isMe && <span className="text-purple-400 ml-1">(you)</span>}
                  {isWinner && <span className="ml-1">🏆</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.score}</td>
              </tr>
            );
          })}
          {displayed.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No participants yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
