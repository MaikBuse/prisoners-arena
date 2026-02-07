import { STRATEGY_INFO } from '../types'

export default function HowToPlay() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div>
        <h1 className="text-4xl font-bold mb-4">How to Play</h1>
        <p className="text-lg text-gray-400">
          Dilemma Arena is a competitive tournament based on the Prisoner's Dilemma,
          one of the most famous problems in game theory.
        </p>
      </div>

      {/* The Game */}
      <section>
        <h2 className="text-2xl font-bold mb-4">The Game</h2>
        <p className="text-gray-400 mb-4">
          Each round, you and your opponent simultaneously choose to <strong className="text-green-400">Cooperate</strong> or <strong className="text-red-400">Defect</strong>.
          Your choice determines your points:
        </p>

        <div className="bg-gray-800 rounded-xl p-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2"></th>
                <th className="text-center p-2 text-green-400">They Cooperate</th>
                <th className="text-center p-2 text-red-400">They Defect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 text-green-400 font-medium">You Cooperate</td>
                <td className="p-2 text-center">
                  <span className="bg-green-500/20 px-3 py-1 rounded font-mono">3, 3</span>
                </td>
                <td className="p-2 text-center">
                  <span className="bg-yellow-500/20 px-3 py-1 rounded font-mono">0, 5</span>
                </td>
              </tr>
              <tr>
                <td className="p-2 text-red-400 font-medium">You Defect</td>
                <td className="p-2 text-center">
                  <span className="bg-yellow-500/20 px-3 py-1 rounded font-mono">5, 0</span>
                </td>
                <td className="p-2 text-center">
                  <span className="bg-red-500/20 px-3 py-1 rounded font-mono">1, 1</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-gray-400 mt-4">
          <strong>The dilemma:</strong> Defecting always seems better for you individually,
          but mutual cooperation (3+3=6) beats mutual defection (1+1=2).
          Over many rounds, the best strategies find ways to cooperate.
        </p>
      </section>

      {/* Tournament Format */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Tournament Format</h2>
        <div className="space-y-4 text-gray-400">
          <div className="flex gap-4">
            <div className="text-2xl">1.</div>
            <div>
              <strong className="text-white">Enter</strong> — Pay your stake (minimum 0.1 SOL) and choose a strategy.
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-2xl">2.</div>
            <div>
              <strong className="text-white">Wait</strong> — Registration closes at the deadline.
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-2xl">3.</div>
            <div>
              <strong className="text-white">Compete</strong> — Your strategy plays ~20 opponents, ~10 rounds each.
              Matches are automated; you don't need to be online.
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-2xl">4.</div>
            <div>
              <strong className="text-white">Win</strong> — Top 25% by score split the prize pool.
              Your share is proportional to your stake.
            </div>
          </div>
        </div>
      </section>

      {/* ROI Explanation */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Same ROI for All Winners</h2>
        <p className="text-gray-400 mb-4">
          All winners get the same return on investment (ROI) percentage.
          If you stake more, you win more in absolute terms, but the percentage is the same.
        </p>
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-3">Example with 60% ROI:</p>
          <div className="space-y-2 font-mono">
            <div className="flex justify-between">
              <span>Alice stakes 0.1 SOL, wins →</span>
              <span className="text-green-400">0.16 SOL (+60%)</span>
            </div>
            <div className="flex justify-between">
              <span>Bob stakes 5 SOL, wins →</span>
              <span className="text-green-400">8 SOL (+60%)</span>
            </div>
            <div className="flex justify-between">
              <span>Carol stakes 2 SOL, loses →</span>
              <span className="text-red-400">0 SOL (-100%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Strategies */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Strategies</h2>
        <p className="text-gray-400 mb-6">
          Choose a base strategy and tune its parameters. Each strategy has different strengths.
        </p>

        <div className="space-y-4">
          {STRATEGY_INFO.map((s) => (
            <div key={s.id} className="bg-gray-800 rounded-xl p-4">
              <div className="font-semibold text-lg">{s.name}</div>
              <p className="text-gray-400 text-sm mt-1">{s.description}</p>
              {s.params.filter(p => p.applicable).length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {s.params.filter(p => p.applicable).map(p => (
                    <span key={p.key} className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {p.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Tips</h2>
        <ul className="space-y-3 text-gray-400">
          <li className="flex gap-2">
            <span>💡</span>
            <span>
              <strong className="text-white">Tit for Tat</strong> is historically one of the most successful strategies.
              It's simple, forgiving, and retaliatory.
            </span>
          </li>
          <li className="flex gap-2">
            <span>💡</span>
            <span>
              <strong className="text-white">Always Defect</strong> might seem tempting, but it gets punished
              by retaliatory strategies over many rounds.
            </span>
          </li>
          <li className="flex gap-2">
            <span>💡</span>
            <span>
              Adding some <strong className="text-white">forgiveness</strong> can help recover from
              misunderstandings and avoid endless retaliation cycles.
            </span>
          </li>
          <li className="flex gap-2">
            <span>💡</span>
            <span>
              Watch past matches to see how different strategies perform against each other!
            </span>
          </li>
        </ul>
      </section>
    </div>
  )
}
