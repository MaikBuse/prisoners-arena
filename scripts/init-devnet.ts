import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { readFileSync } from "fs";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey("5aUBgqYz8B3B7mogMqK4yk5n2gU2QNyTWiP8AB5iTtFW");

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path.replace("~", process.env.HOME!), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(
    JSON.parse(readFileSync("target/idl/dilemma_arena.json", "utf8")),
    provider,
  );

  const admin = loadKeypair("~/.config/solana/id.json");
  const operator = loadKeypair("~/.config/solana/operator.json");

  const [configKey] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const idBuf = Buffer.alloc(4); idBuf.writeUInt32LE(0);
  const [t0Key] = PublicKey.findProgramAddressSync([Buffer.from("tournament"), idBuf], PROGRAM_ID);

  console.log("Config PDA:", configKey.toBase58());
  console.log("Tournament #0 PDA:", t0Key.toBase58());
  console.log("Admin:", admin.publicKey.toBase58());
  console.log("Operator:", operator.publicKey.toBase58());

  // Check if already initialized
  try {
    const cfg = await program.account.config.fetch(configKey);
    console.log("Already initialized! Tournament ID:", cfg.currentTournamentId);
    return;
  } catch {}

  const stake = new BN(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL
  const regDuration = new BN(60);  // 60s registration
  const revealDuration = new BN(60); // 60s reveal
  const matchesPerPlayer = 6;

  await program.methods
    .initializeConfig(
      operator.publicKey,
      stake,
      2,    // min_participants
      100,  // max_participants
      regDuration,
      matchesPerPlayer,
      revealDuration,
    )
    .accounts({
      config: configKey,
      tournament: t0Key,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();

  console.log("✅ Config initialized, Tournament #0 created");
  console.log("   Stake: 0.05 SOL, Registration: 60s, Reveal: 60s");
}

main().catch(console.error);
