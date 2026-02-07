import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { RoundResult, Move } from '../types'

// Mock match data - replace with WASM replay
const mockMatchResult = {
  rounds: [
    { round: 0, move_a: 'Cooperate' as Move, move_b: 'Cooperate' as Move, score_a: 3, score_b: 3, cumulative_a: 3, cumulative_b: 3 },
    { round: 1, move_a: 'Cooperate' as Move, move_b: 'Defect' as Move, score_a: 0, score_b: 5, cumulative_a: 3, cumulative_b: 8 },
    { round: 2, move_a: 'Defect' as Move, move_b: 'Defect' as Move, score_a: 1, score_b: 1, cumulative_a: 4, cumulative_b: 9 },
    { round: 3, move_a: 'Defect' as Move, move_b: 'Cooperate' as Move, score_a: 5, score_b: 0, cumulative_a: 9, cumulative_b: 9 },
    { round: 4, move_a: 'Cooperate' as Move, move_b: 'Cooperate' as Move, score_a: 3, score_b: 3, cumulative_a: 12, cumulative_b: 12 },
    { round: 5, move_a: 'Cooperate' as Move, move_b: 'Cooperate' as Move, score_a: 3, score_b: 3, cumulative_a: 15, cumulative_b: 15 },
    { round: 6, move_a: 'Cooperate' as Move, move_b: 'Defect' as Move, score_a: 0, score_b: 5, cumulative_a: 15, cumulative_b: 20 },
    { round: 7, move_a: 'Defect' as Move, move_b: 'Defect' as Move, score_a: 1, score_b: 1, cumulative_a: 16, cumulative_b: 21 },
  ],
  total_score_a: 16,
  total_score_b: 21,
  round_count: 8,
}

type PlaybackState = 'paused' | 'playing'

export default function Match() {
  const { tournamentId, matchIndex } = useParams()
  const [currentRound, setCurrentRound] = useState(-1) // -1 = before start
  const [playback, setPlayback] = useState<PlaybackState>('paused')
  const [speed, setSpeed] = useState(1)

  const rounds = mockMatchResult.rounds
  const totalRounds = rounds.length

  // Auto-advance when playing
  useEffect(() => {
    if (playback !== 'playing') return
    if (currentRound >= totalRounds - 1) {
      setPlayback('paused')
      return
    }

    const timer = setTimeout(() => {
      setCurrentRound((r) => r + 1)
    }, 1500 / speed)

    return () => clearTimeout(timer)
  }, [playback, currentRound, speed, totalRounds])

  const currentRoundData = currentRound >= 0 ? rounds[currentRound] : null

  const handlePlay = () => {
    if (currentRound >= totalRounds - 1) {
      setCurrentRound(-1)
    }
    setPlayback('playing')
  }

  const handlePause = () => setPlayback('paused')

  const handleStepBack = () => {
    setPlayback('paused')
    setCurrentRound((r) => Math.max(-1, r - 1))
  }

  const handleStepForward = () => {
    setPlayback('paused')
    setCurrentRound((r) => Math.min(totalRounds - 1, r + 1))
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/leaderboard" className="text-gray-400 hover:text-white text-sm">
            ← Back to Leaderboard
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            Match #{matchIndex} - Tournament #{tournamentId}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Round</div>
          <div className="text-2xl font-mono">
            {currentRound + 1} / {totalRounds}
          </div>
        </div>
      </div>

      {/* Arena */}
      <div className="bg-gray-800 rounded-xl p-8 mb-6">
        <div className="grid grid-cols-3 gap-8">
          {/* Player A */}
          <div className="text-center">
            <AgentDisplay
              label="Agent A"
              strategy="Tit for Tat"
              score={currentRoundData?.cumulative_a ?? 0}
              move={currentRoundData?.move_a}
              isRevealing={playback === 'playing' && currentRound >= 0}
            />
          </div>

          {/* VS / Outcome */}
          <div className="flex items-center justify-center">
            <OutcomeDisplay round={currentRoundData} />
          </div>

          {/* Player B */}
          <div className="text-center">
            <AgentDisplay
              label="Agent B"
              strategy="Pavlov"
              score={currentRoundData?.cumulative_b ?? 0}
              move={currentRoundData?.move_b}
              isRevealing={playback === 'playing' && currentRound >= 0}
            />
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-center gap-4">
        <button
          onClick={handleStepBack}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          disabled={currentRound < 0}
        >
          ⏮
        </button>

        {playback === 'paused' ? (
          <button
            onClick={handlePlay}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
          >
            ▶ Play
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
          >
            ⏸ Pause
          </button>
        )}

        <button
          onClick={handleStepForward}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          disabled={currentRound >= totalRounds - 1}
        >
          ⏭
        </button>

        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-gray-400">Speed:</span>
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-sm ${
                speed === s ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'
              } transition-colors`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Round History */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Round History</h2>
        <div className="flex gap-1 flex-wrap">
          {rounds.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                setPlayback('paused')
                setCurrentRound(i)
              }}
              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-mono transition-colors ${
                i === currentRound
                  ? 'ring-2 ring-primary-500'
                  : ''
              } ${
                i <= currentRound
                  ? getOutcomeColor(r.move_a, r.move_b)
                  : 'bg-gray-700'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500/50 rounded" /> Both Cooperate
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500/50 rounded" /> Both Defect
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500/50 rounded" /> Mixed
          </span>
        </div>
      </div>
    </div>
  )
}

function AgentDisplay({
  label,
  strategy,
  score,
  move,
  isRevealing,
}: {
  label: string
  strategy: string
  score: number
  move?: Move
  isRevealing: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Agent Icon */}
      <div className="w-24 h-24 mx-auto bg-gray-700 rounded-2xl flex items-center justify-center">
        <span className="text-4xl">🤖</span>
      </div>

      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-gray-400">{strategy}</div>
      </div>

      {/* Score */}
      <motion.div
        key={score}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.2, 1] }}
        className="text-3xl font-bold font-mono"
      >
        {score}
      </motion.div>

      {/* Move Card */}
      <AnimatePresence mode="wait">
        {move && (
          <motion.div
            key={move}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`mx-auto w-20 h-28 rounded-lg flex items-center justify-center font-bold text-sm ${
              move === 'Cooperate'
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500'
                : 'bg-red-500/20 text-red-400 border-2 border-red-500'
            }`}
          >
            {move === 'Cooperate' ? '🤝' : '⚔️'}
            <br />
            {move}
          </motion.div>
        )}
        {!move && (
          <div className="mx-auto w-20 h-28 rounded-lg flex items-center justify-center bg-gray-700 text-gray-500">
            ?
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function OutcomeDisplay({ round }: { round: RoundResult | null }) {
  if (!round) {
    return <div className="text-4xl text-gray-600">VS</div>
  }

  const bothCooperate = round.move_a === 'Cooperate' && round.move_b === 'Cooperate'
  const bothDefect = round.move_a === 'Defect' && round.move_b === 'Defect'

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`p-4 rounded-xl ${
        bothCooperate
          ? 'bg-green-500/20'
          : bothDefect
          ? 'bg-red-500/20'
          : 'bg-yellow-500/20'
      }`}
    >
      <div className="text-center">
        <div className="text-sm text-gray-400 mb-1">Points</div>
        <div className="text-2xl font-bold font-mono">
          +{round.score_a} / +{round.score_b}
        </div>
      </div>
    </motion.div>
  )
}

function getOutcomeColor(a: Move, b: Move): string {
  if (a === 'Cooperate' && b === 'Cooperate') return 'bg-green-500/50'
  if (a === 'Defect' && b === 'Defect') return 'bg-red-500/50'
  return 'bg-yellow-500/50'
}
