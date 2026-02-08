import React from "react";
import { STRATEGIES } from "../types";

export function Guide() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold">How to Play</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-purple-400">Tournament Flow</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
          <li><strong>Registration</strong> — Connect wallet, choose a strategy, pay the stake to enter.</li>
          <li><strong>Running</strong> — The operator runs matches. Each player faces K opponents in iterated Prisoner's Dilemma.</li>
          <li><strong>Payout</strong> — Top 25% of players (by score) split the prize pool equally. Claim your payout within 30 days.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-purple-400">Payoff Matrix</h2>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-gray-400">
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2">Cooperate</th>
                <th className="px-4 py-2">Defect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-300">Cooperate</td>
                <td className="px-4 py-2 text-green-400">3, 3</td>
                <td className="px-4 py-2 text-red-400">0, 5</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-300">Defect</td>
                <td className="px-4 py-2 text-red-400">5, 0</td>
                <td className="px-4 py-2 text-yellow-400">1, 1</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          Each match consists of multiple rounds. Your total score across all matches determines your rank.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-purple-400">Strategies</h2>
        <div className="grid gap-3">
          {STRATEGIES.map((s) => (
            <div key={s.key} className="bg-gray-900 rounded-lg p-4">
              <h3 className="font-bold text-sm">{s.label}</h3>
              <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-purple-400">Rules</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
          <li>Fixed stake for all players — equal risk.</li>
          <li>Top 25% of players are winners (ties included).</li>
          <li>Winners split the prize pool (after house fee) equally.</li>
          <li>You can withdraw and get a refund anytime during Registration.</li>
          <li>Payouts must be claimed within 30 days.</li>
          <li>Matches are paired randomly using on-chain randomness.</li>
        </ul>
      </section>
    </div>
  );
}
