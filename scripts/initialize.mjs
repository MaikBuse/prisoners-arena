import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import pkg from "@coral-xyz/anchor";
const { AnchorProvider, Program, setProvider, BN } = pkg;
import { readFileSync } from "fs";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Load IDL
const idl = JSON.parse(readFileSync(join(projectRoot, "target/idl/dilemma_arena.json"), "utf-8"));

// Load wallets
const adminSecret = JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf-8"));
const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(adminSecret));

const operatorSecret = JSON.parse(readFileSync(join(homedir(), ".config/solana/operator.json"), "utf-8"));
const operatorKeypair = Keypair.fromSecretKey(Uint8Array.from(operatorSecret));

const programId = new PublicKey(idl.address);

console.log("Program ID:", programId.toString());
console.log("Admin:", adminKeypair.publicKey.toString());
console.log("Operator:", operatorKeypair.publicKey.toString());

// Setup provider
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = {
  publicKey: adminKeypair.publicKey,
  signTransaction: async (tx) => { tx.partialSign(adminKeypair); return tx; },
  signAllTransactions: async (txs) => { txs.forEach(tx => tx.partialSign(adminKeypair)); return txs; },
  payer: adminKeypair,
};
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
setProvider(provider);

const program = new Program(idl, provider);

// PDAs
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  programId
);

const tournamentIdBuf = Buffer.alloc(4);
tournamentIdBuf.writeUInt32LE(0);
const [tournamentPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("tournament"), tournamentIdBuf],
  programId
);

console.log("Config PDA:", configPda.toString());
console.log("Tournament #0 PDA:", tournamentPda.toString());

// Params
const stake = new BN(100_000_000); // 0.1 SOL
const minParticipants = 2;
const maxParticipants = 100;
const registrationDuration = new BN(300); // 5 min for testing
const matchesPerPlayer = 15;

console.log("\nInitializing with:");
console.log("  Stake: 0.1 SOL");
console.log("  Min participants:", minParticipants);
console.log("  Max participants:", maxParticipants);
console.log("  Registration: 300s");
console.log("  Matches/player:", matchesPerPlayer);

try {
  const tx = await program.methods
    .initializeConfig(
      operatorKeypair.publicKey,
      stake,
      minParticipants,
      maxParticipants,
      registrationDuration,
      matchesPerPlayer
    )
    .accounts({
      config: configPda,
      tournament: tournamentPda,
      admin: adminKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([adminKeypair])
    .rpc();

  console.log("\n✅ Config initialized! TX:", tx);

  const config = await program.account.config.fetch(configPda);
  console.log("\nVerified config:");
  console.log("  Admin:", config.admin.toString());
  console.log("  Operator:", config.operator.toString());
  console.log("  Stake:", config.stake.toNumber() / 1e9, "SOL");
  console.log("  Tournament ID:", config.currentTournamentId);
} catch (e) {
  console.error("Error:", e.message || e);
  if (e.logs) console.error("Logs:", e.logs);
}
