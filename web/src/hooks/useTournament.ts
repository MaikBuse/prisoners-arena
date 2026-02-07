import { useState, useEffect } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { Tournament } from '../types'

// Mock tournament data - replace with actual contract fetching
const mockTournament: Tournament = {
  id: 1,
  state: 'Registration',
  pool: 3_500_000_000, // 3.5 SOL
  participant_count: 12,
  registration_ends: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  matches_completed: 0,
  matches_total: 0,
  winner_count: 0,
}

export function useTournament() {
  const { connection } = useConnection()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // TODO: Fetch actual tournament data from contract
    // For now, use mock data
    const fetchTournament = async () => {
      try {
        setLoading(true)
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 500))
        setTournament(mockTournament)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTournament()

    // Poll for updates
    const interval = setInterval(fetchTournament, 10000)
    return () => clearInterval(interval)
  }, [connection])

  return { tournament, loading, error }
}

// Hook for fetching entries
export function useEntries(tournamentId?: number) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentId) return

    // TODO: Fetch actual entries from contract
    setLoading(false)
    setEntries([])
  }, [tournamentId])

  return { entries, loading }
}
