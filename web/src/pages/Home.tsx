import { Link } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'

export default function Home() {
  const { tournament, loading } = useTournament()

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Dilemma Arena
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Compete with AI strategies in the classic Prisoner's Dilemma.
          Top 25% split the prize pool.
        </p>
      </div>

      {/* Tournament Status Card */}
      <div className="bg-gray-800 rounded-xl p-6 max-w-xl mx-auto">
        <h2 className="text-lg font-semibold mb-4">Current Tournament</h2>
        
        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : tournament ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Status</span>
              <TournamentBadge state={tournament.state} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Prize Pool</span>
              <span className="font-mono text-lg">
                {(tournament.pool / 1e9).toFixed(2)} SOL
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Participants</span>
              <span className="font-mono">{tournament.participant_count}</span>
            </div>

            {tournament.state === 'Registration' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Ends In</span>
                <Countdown endTime={tournament.registration_ends} />
              </div>
            )}

            {tournament.state === 'Running' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Progress</span>
                <span className="font-mono">
                  {tournament.matches_completed} / {tournament.matches_total} matches
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500">No active tournament</div>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            to="/enter"
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-center py-3 rounded-lg font-medium transition-colors"
          >
            Enter Tournament
          </Link>
          <Link
            to="/leaderboard"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-center py-3 rounded-lg font-medium transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Game Preview */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">The Game</h3>
          <div className="text-sm text-gray-400 space-y-2">
            <p>Each round, you and your opponent choose to <span className="text-cooperate">Cooperate</span> or <span className="text-defect">Defect</span>.</p>
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs">
              <div>Both Cooperate → 3, 3</div>
              <div>Both Defect → 1, 1</div>
              <div>Mixed → 5, 0</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">How to Win</h3>
          <div className="text-sm text-gray-400 space-y-2">
            <p>Play ~20 opponents, ~10 rounds each.</p>
            <p>Top 25% by total score win.</p>
            <p>Prize split by stake: same ROI% for all winners.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TournamentBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    Registration: 'bg-green-500/20 text-green-400',
    Running: 'bg-yellow-500/20 text-yellow-400',
    Payout: 'bg-blue-500/20 text-blue-400',
    Complete: 'bg-gray-500/20 text-gray-400',
    Cancelled: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`px-2 py-1 rounded text-sm font-medium ${colors[state] || ''}`}>
      {state}
    </span>
  )
}

function Countdown({ endTime }: { endTime: number }) {
  // Simple countdown - in production use useEffect with interval
  const now = Math.floor(Date.now() / 1000)
  const remaining = Math.max(0, endTime - now)
  
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60

  return (
    <span className="font-mono">
      {hours.toString().padStart(2, '0')}:
      {minutes.toString().padStart(2, '0')}:
      {seconds.toString().padStart(2, '0')}
    </span>
  )
}
