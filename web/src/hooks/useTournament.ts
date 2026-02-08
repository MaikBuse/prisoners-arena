import { useState, useEffect, useCallback } from "react";
import { useProgram, useProgramId, getConfigPda, getTournamentPda, getEntryPda } from "./useProgram";
import type { ConfigAccount, TournamentAccount, EntryAccount } from "../types";
import { PublicKey } from "@solana/web3.js";

export function useConfig() {
  const program = useProgram();
  const programId = useProgramId();
  const [config, setConfig] = useState<ConfigAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const pda = getConfigPda(programId);
      const acc = await (program.account as any).config.fetch(pda);
      setConfig(acc as ConfigAccount);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [program, programId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { config, loading, refetch: fetch };
}

export function useTournament(id: number | null) {
  const program = useProgram();
  const programId = useProgramId();
  const [tournament, setTournament] = useState<TournamentAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (id === null) { setLoading(false); return; }
    try {
      const pda = getTournamentPda(programId, id);
      const acc = await (program.account as any).tournament.fetch(pda);
      setTournament(acc as TournamentAccount);
    } catch {
      setTournament(null);
    } finally {
      setLoading(false);
    }
  }, [program, programId, id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { tournament, loading, refetch: fetch };
}

export function useEntry(tournamentId: number | null, player: PublicKey | null) {
  const program = useProgram();
  const programId = useProgramId();
  const [entry, setEntry] = useState<EntryAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (tournamentId === null || !player) { setEntry(null); setLoading(false); return; }
    try {
      const tournamentPda = getTournamentPda(programId, tournamentId);
      const entryPda = getEntryPda(programId, tournamentPda, player);
      const acc = await (program.account as any).entry.fetch(entryPda);
      setEntry(acc as EntryAccount);
    } catch {
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [program, programId, tournamentId, player]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entry, loading, refetch: fetch };
}

export function usePolling(
  refetchConfig: () => Promise<void>,
  refetchTournament: () => Promise<void>,
  tournament: TournamentAccount | null
) {
  useEffect(() => {
    const isRunning = tournament?.state && "running" in tournament.state;
    const interval = isRunning ? 5000 : 30000;
    const id = setInterval(() => {
      refetchConfig();
      refetchTournament();
    }, interval);
    return () => clearInterval(id);
  }, [refetchConfig, refetchTournament, tournament]);
}
