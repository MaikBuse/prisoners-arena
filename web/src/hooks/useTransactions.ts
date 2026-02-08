import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram, useProgramId, getConfigPda, getTournamentPda, getEntryPda } from "./useProgram";
import { useToasts } from "../contexts/ToastContext";
import type { StrategyType } from "../types";

export function useTransactions(tournamentId: number | null) {
  const program = useProgram();
  const programId = useProgramId();
  const { publicKey } = useWallet();
  const { addToast, removeToast } = useToasts();

  const enterTournament = useCallback(
    async (strategy: StrategyType) => {
      if (!publicKey || tournamentId === null) return;
      const toastId = addToast("pending", "Entering tournament...");
      try {
        const tournamentPda = getTournamentPda(programId, tournamentId);
        const entryPda = getEntryPda(programId, tournamentPda, publicKey);
        const configPda = getConfigPda(programId);
        const sig = await (program.methods as any)
          .enterTournament(strategy)
          .accounts({
            config: configPda,
            tournament: tournamentPda,
            entry: entryPda,
            player: publicKey,
          })
          .rpc();
        removeToast(toastId);
        addToast("confirmed", "Entered tournament!", sig);
        return sig;
      } catch (e: any) {
        removeToast(toastId);
        addToast("error", `Failed: ${e.message?.slice(0, 80)}`);
        throw e;
      }
    },
    [program, programId, publicKey, tournamentId, addToast, removeToast]
  );

  const claimRefund = useCallback(async () => {
    if (!publicKey || tournamentId === null) return;
    const toastId = addToast("pending", "Claiming refund...");
    try {
      const tournamentPda = getTournamentPda(programId, tournamentId);
      const entryPda = getEntryPda(programId, tournamentPda, publicKey);
      const sig = await (program.methods as any)
        .claimRefund()
        .accounts({
          tournament: tournamentPda,
          entry: entryPda,
          player: publicKey,
        })
        .rpc();
      removeToast(toastId);
      addToast("confirmed", "Refund claimed!", sig);
      return sig;
    } catch (e: any) {
      removeToast(toastId);
      addToast("error", `Refund failed: ${e.message?.slice(0, 80)}`);
      throw e;
    }
  }, [program, programId, publicKey, tournamentId, addToast, removeToast]);

  const claimPayout = useCallback(async () => {
    if (!publicKey || tournamentId === null) return;
    const toastId = addToast("pending", "Claiming payout...");
    try {
      const tournamentPda = getTournamentPda(programId, tournamentId);
      const entryPda = getEntryPda(programId, tournamentPda, publicKey);
      const sig = await (program.methods as any)
        .claimPayout()
        .accounts({
          tournament: tournamentPda,
          entry: entryPda,
          player: publicKey,
        })
        .rpc();
      removeToast(toastId);
      addToast("confirmed", "Payout claimed!", sig);
      return sig;
    } catch (e: any) {
      removeToast(toastId);
      addToast("error", `Payout failed: ${e.message?.slice(0, 80)}`);
      throw e;
    }
  }, [program, programId, publicKey, tournamentId, addToast, removeToast]);

  return { enterTournament, claimRefund, claimPayout };
}
