import { Metadata } from 'next';
import { STRATEGIES } from '@/lib/solana';

export const metadata: Metadata = {
  title: 'How to Play — Dilemma Arena',
  description: 'Game theory guide: payoff matrix, tournament flow, strategies, and winner determination in Dilemma Arena.',
};

export default function GuidePage() {
  return (
    <article className="prose prose-invert max-w-3xl mx-auto">
      <h1>How to Play</h1>
      <p>Dilemma Arena runs <strong>Iterated Prisoner&apos;s Dilemma</strong> tournaments on Solana. Players choose a strategy, stake SOL, and compete in automated matches. Top 25% win.</p>

      <h2>Payoff Matrix</h2>
      <p>Each round, two players simultaneously choose to <strong>Cooperate (C)</strong> or <strong>Defect (D)</strong>:</p>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border border-zinc-700">
          <thead>
            <tr className="bg-zinc-800"><th className="p-3 border border-zinc-700"></th><th className="p-3 border border-zinc-700">Opponent: C</th><th className="p-3 border border-zinc-700">Opponent: D</th></tr>
          </thead>
          <tbody>
            <tr><td className="p-3 border border-zinc-700 font-bold bg-zinc-800">You: C</td><td className="p-3 border border-zinc-700 text-green-400">3, 3 (mutual cooperation)</td><td className="p-3 border border-zinc-700 text-red-400">0, 5 (sucker&apos;s payoff)</td></tr>
            <tr><td className="p-3 border border-zinc-700 font-bold bg-zinc-800">You: D</td><td className="p-3 border border-zinc-700 text-amber-400">5, 0 (temptation)</td><td className="p-3 border border-zinc-700 text-zinc-400">1, 1 (mutual defection)</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Tournament Flow</h2>
      <ol>
        <li><strong>Registration:</strong> Players stake SOL and choose a strategy. Open for a fixed duration.</li>
        <li><strong>Running:</strong> Operator cranks matches. Each player plays K matches against random opponents (10 rounds per match).</li>
        <li><strong>Payout:</strong> Top 25% (by score, ties included) split the prize pool equally. 30-day claim window.</li>
      </ol>

      <h2>Strategies</h2>
      <div className="not-prose space-y-3">
        {[
          { s: STRATEGIES[0], desc: 'Start cooperating, then copy opponent\'s last move. Classic and effective.' },
          { s: STRATEGIES[1], desc: 'Always defect. Maximizes short-term gain but triggers retaliation.' },
          { s: STRATEGIES[2], desc: 'Always cooperate. Vulnerable to exploitation but great with cooperators.' },
          { s: STRATEGIES[3], desc: 'Cooperate until opponent defects, then defect forever. Punishes betrayal.' },
          { s: STRATEGIES[4], desc: 'Start cooperating. If payoffs match expectations, repeat; otherwise switch.' },
          { s: STRATEGIES[5], desc: 'Like Tit for Tat but starts with defection. Tests opponent first.' },
          { s: STRATEGIES[6], desc: 'Randomly cooperate or defect each round. Unpredictable.' },
          { s: STRATEGIES[7], desc: 'Like Tit for Tat but forgives one defection. More tolerant.' },
          { s: STRATEGIES[8], desc: 'Cooperate, then punish proportionally to number of opponent defections.' },
        ].map(({ s, desc }) => (
          <div key={s.index} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="font-bold text-zinc-200">{s.name}</div>
            <div className="text-sm text-zinc-400 mt-1">{desc}</div>
          </div>
        ))}
      </div>

      <h2>Winner Determination</h2>
      <ul>
        <li>Winners = top 25% of players by score: <code>ceil(participant_count × 0.25)</code></li>
        <li>Ties at the threshold are included</li>
        <li>Prize pool = total stakes minus house fee</li>
        <li>Payout per winner = <code>winner_pool / winner_count</code></li>
        <li>30-day claim window from payout start</li>
        <li>Unclaimed funds return to the program after expiry</li>
      </ul>
    </article>
  );
}
