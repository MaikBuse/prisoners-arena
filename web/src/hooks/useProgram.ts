import { useMemo } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useNetwork } from "../contexts/NetworkContext";
import idlJson from "../idl/dilemma_arena.json";

const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID ?? "Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7"
);

export function useConnection() {
  const { rpcUrl } = useNetwork();
  return useMemo(() => new Connection(rpcUrl, "confirmed"), [rpcUrl]);
}

export function useProgram() {
  const connection = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    // Use a dummy wallet for read-only if not connected
    const provider = wallet
      ? new AnchorProvider(connection, wallet, { commitment: "confirmed" })
      : new AnchorProvider(
          connection,
          { publicKey: PublicKey.default, signAllTransactions: async (txs) => txs, signTransaction: async (tx) => tx } as any,
          { commitment: "confirmed" }
        );
    return new Program(idlJson as Idl, provider);
  }, [connection, wallet]);
}

export function useProgramId() {
  return PROGRAM_ID;
}

export function getConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

export function getTournamentPda(programId: PublicKey, id: number): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("tournament"), buf], programId)[0];
}

export function getEntryPda(programId: PublicKey, tournament: PublicKey, player: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("entry"), tournament.toBuffer(), player.toBuffer()],
    programId
  )[0];
}
