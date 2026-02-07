import { Link } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { Entry } from '../types'

// Mock data - replace with actual data fetching
const mockEntries: Entry[] = [
  {
    tournament: 'xxx',
    player: 'Abc...xyz',
    index: 0,
    stake: 1_000_000_000,
    strategy: { base: 'TitForTat', params: { forgiveness: 10, retaliation_delay: 0, noise_tolerance: 0, initial_moves: 0, cooperate_bias: 50 } },
    score: 156,
    matches_played: 20,
    is_winner: true,
    paid_out: false,
  },
  {
    tournament: 'xxx',
    player: 'Def...uvw',
    index: 1,
    stake: 500_000_000,
    strategy: { base: 'Pavlov', params: { forgiveness: 0, retaliation_delay: 0, noise_tolerance: 0, initial_moves: 0, cooperate_bias: 50 } },
    score: 142,
    matches_played: 20,
    is_winner: true,
    paid_out: false,
  },
  {
    tournament: 'xxx',
    player: 'Ghi...rst',
    index: 2,
    stake: 2_000_000_000,
    strategy: { base: 'GrimTrigger', params: { forgiveness: 0, retaliation_delay: 0, noise_tolerance: 1, initial_moves: 0, cooperate_bias: 50 } },
    score: 138,
    matches_played: 20,
    is_winner: true,
    paid_out: false,
  },
  {
    tournament: 'xxx',
    player: 'Jkl...opq',
    index: 3,
    stake: 100_000_000,
    strategy: { base: 'AlwaysDefect', params: { forgiveness: 0, retaliation_delay: 0, noise_tolerance: 0, initial_moves: 0, cooperate_bias: 50 } },
    score: 95,
    matches_played: 20,
    is_winner: false,
    paid_out: false,
  },
]

export default function Leaderboard() {
  const { tournament } = useTournament()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        {tournament && (
          <span className="text-gray-400">
            Tournament #{tournament.id}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-400">Participants</div>
          <div className="text-2xl font-bold">{mockEntries.length}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-400">Winners</div>
          <div className="text-2xl font-bold text-green-400">
            {mockEntries.filter(e => e.is_winner).length}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-400">Prize Pool</div>
          <div className="text-2xl font-bold">
            {(mockEntries.reduce((sum, e) => sum + e.stake, 0) / 1e9).toFixed(2)} SOL
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-400">Top Strategy</div>
          <div className="text-2xl font-bold">TitForTat</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Rank</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Player</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Strategy</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Score</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Matches</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Stake</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {mockEntries
              .sort((a, b) => b.score - a.score)
              .map((entry, i) => (
                <tr
                  key={entry.index}
                  className={`${entry.is_winner ? 'bg-green-500/5' : ''} hover:bg-gray-700/50 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-bold ${i < 3 ? 'text-yellow-400' : ''}`}>
                      #{i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{entry.player}</td>
                  <td className="px-4 py-3">{entry.strategy.base}</td>
                  <td className="px-4 py-3 text-right font-mono">{entry.score}</td>
                  <td className="px-4 py-3 text-right font-mono">{entry.matches_played}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {(entry.stake / 1e9).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.is_winner ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">
                        Winner
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* View Matches */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
        <div className="grid gap-2">
          {[0, 1, 2].map((matchIndex) => (
            <Link
              key={matchIndex}
              to={`/match/1/${matchIndex}`}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="text-gray-500">Match #{matchIndex + 1}</span>
                <span className="font-mono">Entry 0 vs Entry 1</span>
              </div>
              <span className="font-mono">28 - 32</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
