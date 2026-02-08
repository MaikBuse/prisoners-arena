import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import fs from "fs";

async function main() {
  // Setup provider from Anchor.toml
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DilemmaArena as Program;
  const admin = provider.wallet;

  // Load operator keypair
  const operatorKeypairPath = process.env.OPERATOR_KEYPAIR || `${process.env.HOME}/.config/solana/operator.json`;
  const operatorSecret = JSON.parse(fs.readFileSync(operatorKeypairPath, "utf-8"));
  const operatorKeypair = Keypair.fromSecretKey(Uint8Array.from(operatorSecret));

  console.log("Program ID:", program.programId.toString());
  console.log("Admin:", admin.publicKey.toString());
  console.log("Operator:", operatorKeypair.publicKey.toString());

  // Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // Tournament #0 PDA
  const tournamentId = 0;
  const tournamentIdBuf = Buffer.alloc(4);
  tournamentIdBuf.writeUInt32LE(tournamentId);
  const [tournamentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("tournament"), tournamentIdBuf],
    program.programId
  );

  console.log("Config PDA:", configPda.toString());
  console.log("Tournament #0 PDA:", tournamentPda.toString());

  // Tournament params
  const stake = new BN(100_000_000); // 0.1 SOL
  const minParticipants = 2;
  const maxParticipants = 100;
  const registrationDuration = new BN(300); // 5 minutes for testing
  const matchesPerPlayer = 15;

  console.log("\nInitializing config...");
  console.log("  Stake:", stake.toNumber() / 1e9, "SOL");
  console.log("  Min participants:", minParticipants);
  console.log("  Max participants:", maxParticipants);
  console.log("  Registration duration:", registrationDuration.toNumber(), "seconds");
  console.log("  Matches per player:", matchesPerPlayer);

  const tx = await (program.methods as any)
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
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("\n✅ Config initialized!");
  console.log("Transaction:", tx);

  // Verify
  const config = await (program.account as any).config.fetch(configPda);
  console.log("\nConfig state:");
  console.log("  Admin:", config.admin.toString());
  console.log("  Operator:", config.operator.toString());
  console.log("  Stake:", config.stake.toNumber() / 1e9, "SOL");
  console.log("  Tournament ID:", config.currentTournamentId);
  console.log("  House fee:", config.houseFeeBps, "bps");
}

main().catch(console.error);
