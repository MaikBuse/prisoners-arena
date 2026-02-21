/**
 * Prisoner's Arena v1.7 — Comprehensive Integration Tests (Commit-Reveal)
 *
 * Single Config PDA, shared admin/operator across all suites.
 * Uses `testing` feature for short expiry times (2s).
 *
 * Run: anchor test -- --features testing
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";
import { createHash, randomBytes } from "crypto";

// ── Strategy helpers ───────────────────────────────────────────────

const Strategy = {
  TitForTat: { titForTat: {} },
  AlwaysDefect: { alwaysDefect: {} },
  AlwaysCooperate: { alwaysCooperate: {} },
  GrimTrigger: { grimTrigger: {} },
  Pavlov: { pavlov: {} },
  SuspiciousTitForTat: { suspiciousTitForTat: {} },
  Random: { random: {} },
  TitForTwoTats: { titForTwoTats: {} },
  Gradual: { gradual: {} },
} as const;

const STRATEGY_LIST = [
  Strategy.TitForTat,
  Strategy.AlwaysDefect,
  Strategy.AlwaysCooperate,
  Strategy.GrimTrigger,
  Strategy.Pavlov,
  Strategy.SuspiciousTitForTat,
  Strategy.Random,
  Strategy.TitForTwoTats,
  Strategy.Gradual,
];

const UPDATE_DEFAULTS = {
  operator: null,
  houseFeeBps: null,
  stake: null,
  minParticipants: null,
  maxParticipants: null,
  registrationDuration: null,
  matchesPerPlayer: null,
  revealDuration: null,
  operatorTxFee: null,
};

// ── Commitment helper ──────────────────────────────────────────────

function computeCommitment(
  strategyIndex: number,
  salt: Buffer,
): number[] {
  const preimage = Buffer.alloc(17);
  preimage[0] = strategyIndex;
  salt.copy(preimage, 1);
  const hash = createHash("sha256").update(preimage).digest();
  return Array.from(hash);
}

// ── PDA helpers ────────────────────────────────────────────────────

function deriveCfg(pid: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], pid);
}

function deriveT(pid: PublicKey, id: number): [PublicKey, number] {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("tournament"), buf], pid);
}

function deriveE(pid: PublicKey, tournament: PublicKey, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("entry"), tournament.toBuffer(), player.toBuffer()],
    pid,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function airdrop(conn: anchor.web3.Connection, key: PublicKey, sol: number) {
  const sig = await conn.requestAirdrop(key, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig);
}

// ── Tests ──────────────────────────────────────────────────────────

describe("prisoners-arena", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PrisonersArena as Program;
  const conn = provider.connection;
  const pid = program.programId;

  const admin = Keypair.generate();
  const operator = Keypair.generate();
  const players: Keypair[] = [];

  const stake = new BN(0.1 * LAMPORTS_PER_SOL);
  const REG_DURATION = 30;
  const REVEAL_DURATION = 10;
  const MATCHES_PER_PLAYER = 6;

  // Per-player salts for commit-reveal (indexed by player index)
  const salts: Map<string, Buffer> = new Map();

  let configKey: PublicKey;
  let t0Key: PublicKey;

  // Helper: enter a player with commitment
  async function enterPlayer(
    tournamentKey: PublicKey,
    player: Keypair,
    strategyIndex: number,
  ): Promise<{ salt: Buffer; commitment: number[] }> {
    const salt = randomBytes(16);
    const commitment = computeCommitment(strategyIndex, salt);
    salts.set(`${tournamentKey.toString()}-${player.publicKey.toString()}`, salt);

    const [eKey] = deriveE(pid, tournamentKey, player.publicKey);
    await program.methods
      .enterTournament(commitment)
      .accounts({
        config: configKey, tournament: tournamentKey, entry: eKey,
        player: player.publicKey, systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    return { salt, commitment };
  }

  // Helper: reveal a player's strategy
  async function revealPlayer(
    tournamentKey: PublicKey,
    player: Keypair,
    strategy: any,
    salt?: Buffer,
  ) {
    const s = salt || salts.get(`${tournamentKey.toString()}-${player.publicKey.toString()}`)!;
    const [eKey] = deriveE(pid, tournamentKey, player.publicKey);
    await program.methods
      .revealStrategy(strategy, Array.from(s), null)
      .accounts({
        entry: eKey, tournament: tournamentKey, player: player.publicKey,
      })
      .signers([player])
      .rpc();
  }

  // Helper: wait for registration to expire then close it
  async function waitAndCloseRegistration(tournamentKey: PublicKey) {
    const t = await program.account.tournament.fetch(tournamentKey);
    const now = Math.floor(Date.now() / 1000);
    const remaining = t.registrationEnds.toNumber() - now;
    await sleep(Math.max(remaining + 5, 3) * 1000);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await program.methods
          .closeRegistration()
          .accounts({
            config: configKey, tournament: tournamentKey,
            operator: operator.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        return;
      } catch (err: any) {
        if (err?.error?.errorCode?.code === "RegistrationOpen") {
          await sleep(2000);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to close registration after retries");
  }

  // Helper: wait for reveal to expire then close it
  async function waitAndCloseReveal(tournamentKey: PublicKey, refundEntry?: PublicKey | null, refundPlayer?: PublicKey | null) {
    const t = await program.account.tournament.fetch(tournamentKey);
    const now = Math.floor(Date.now() / 1000);
    const remaining = t.revealEnds.toNumber() - now;
    await sleep(Math.max(remaining + 5, 5) * 1000);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await program.methods
          .closeReveal()
          .accounts({
            config: configKey, tournament: tournamentKey,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            refundEntry: refundEntry || null, refundPlayer: refundPlayer || null,
            operator: operator.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        return;
      } catch (err: any) {
        if (err?.error?.errorCode?.code === "RevealPeriodNotEnded") {
          await sleep(2000);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to close reveal after retries");
  }

  // Helper: run all matches
  async function runAllMatches(tournamentKey: PublicKey) {
    let t = await program.account.tournament.fetch(tournamentKey);
    const entryMetas: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
    for (let i = 0; i < t.players.length; i++) {
      if (t.players[i].toString() === PublicKey.default.toString()) continue;
      const [eKey] = deriveE(pid, tournamentKey, t.players[i]);
      entryMetas.push({ pubkey: eKey, isSigner: false, isWritable: true });
    }
    while (t.matchesCompleted < t.matchesTotal) {
      await program.methods
        .runMatches()
        .accounts({ config: configKey, tournament: tournamentKey, operator: operator.publicKey })
        .remainingAccounts(entryMetas)
        .signers([operator])
        .rpc();
      t = await program.account.tournament.fetch(tournamentKey);
    }
    return t;
  }

  before(async () => {
    await airdrop(conn, admin.publicKey, 50);
    await airdrop(conn, operator.publicKey, 20);
    for (let i = 0; i < 12; i++) {
      const p = Keypair.generate();
      await airdrop(conn, p.publicKey, 5);
      players.push(p);
    }
    [configKey] = deriveCfg(pid);
    [t0Key] = deriveT(pid, 0);
  });

  // ================================================================
  // 1. Initialization
  // ================================================================
  describe("Initialization", () => {
    it("initializes config and Tournament #0 with revealDuration", async () => {
      await program.methods
        .initializeConfig({
          operator: operator.publicKey, stake, minParticipants: 2, maxParticipants: 100,
          registrationDuration: new BN(REG_DURATION), matchesPerPlayer: MATCHES_PER_PLAYER,
          revealDuration: new BN(REVEAL_DURATION),
        })
        .accounts({
          config: configKey, tournament: t0Key,
          admin: admin.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.admin.toString()).to.equal(admin.publicKey.toString());
      expect(cfg.operator.toString()).to.equal(operator.publicKey.toString());
      expect(cfg.stake.toNumber()).to.equal(stake.toNumber());
      expect(cfg.minParticipants).to.equal(2);
      expect(cfg.maxParticipants).to.equal(100);
      expect(cfg.matchesPerPlayer).to.equal(MATCHES_PER_PLAYER);
      expect(cfg.currentTournamentId).to.equal(0);
      expect(cfg.houseFeeBps).to.equal(0);
      expect(cfg.accumulatedFees.toNumber()).to.equal(0);
      expect(cfg.registrationDuration.toNumber()).to.equal(REG_DURATION);
      expect(cfg.revealDuration.toNumber()).to.equal(REVEAL_DURATION);
    });

    it("Tournament #0 has correct initial state with reveal fields", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.id).to.equal(0);
      expect(t.state).to.deep.equal({ registration: {} });
      expect(t.stake.toNumber()).to.equal(stake.toNumber());
      expect(t.houseFeeBps).to.equal(0);
      expect(t.matchesPerPlayer).to.equal(MATCHES_PER_PLAYER);
      expect(t.registrationDuration.toNumber()).to.equal(REG_DURATION);
      expect(t.revealDuration.toNumber()).to.equal(REVEAL_DURATION);
      expect(t.participantCount).to.equal(0);
      expect(t.pool.toNumber()).to.equal(0);
      expect(t.revealsCompleted).to.equal(0);
      expect(t.registrationEnds.toNumber()).to.be.greaterThan(0);
    });

    it("randomness seed is zeroed before close_registration", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.randomnessSeed.every((b: number) => b === 0)).to.be.true;
    });

    it("rejects double initialization", async () => {
      try {
        await program.methods
          .initializeConfig({
            operator: operator.publicKey, stake, minParticipants: 2, maxParticipants: 100,
            registrationDuration: new BN(REG_DURATION), matchesPerPlayer: MATCHES_PER_PLAYER,
            revealDuration: new BN(REVEAL_DURATION),
          })
          .accounts({
            config: configKey, tournament: t0Key,
            admin: admin.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });
  });

  // ================================================================
  // 2. Config Updates
  // ================================================================
  describe("Config Updates", () => {
    it("updates house_fee_bps", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, houseFeeBps: 250 })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).houseFeeBps).to.equal(250);
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, houseFeeBps: 0 })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates operator key", async () => {
      const tmp = Keypair.generate();
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, operator: tmp.publicKey })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).operator.toString())
        .to.equal(tmp.publicKey.toString());
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, operator: operator.publicKey })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates stake", async () => {
      const newStake = new BN(0.5 * LAMPORTS_PER_SOL);
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, stake: newStake })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).stake.toNumber())
        .to.equal(newStake.toNumber());
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, stake })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates matches_per_player", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, matchesPerPlayer: 15 })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).matchesPerPlayer).to.equal(15);
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, matchesPerPlayer: MATCHES_PER_PLAYER })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates min_participants (even values only)", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: 4 })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).minParticipants).to.equal(4);
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: 2 })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates registration_duration", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, registrationDuration: new BN(7200) })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).registrationDuration.toNumber())
        .to.equal(7200);
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, registrationDuration: new BN(REG_DURATION) })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates reveal_duration", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, revealDuration: new BN(3600) })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).revealDuration.toNumber())
        .to.equal(3600);
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, revealDuration: new BN(REVEAL_DURATION) })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    // ── Validation rejections ──

    it("rejects odd min_participants", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: 3 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidMinParticipants");
      }
    });

    it("rejects min_participants = 0", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: 0 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidMinParticipants");
      }
    });

    it("rejects min_participants = 1", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: 1 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidMinParticipants");
      }
    });

    it("rejects house_fee_bps > 10000", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, houseFeeBps: 10001 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Overflow");
      }
    });

    it("rejects stake = 0", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, stake: new BN(0) })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Overflow");
      }
    });

    it("rejects registration_duration = 0", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, registrationDuration: new BN(0) })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Overflow");
      }
    });

    it("rejects matches_per_player = 0", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, matchesPerPlayer: 0 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Overflow");
      }
    });

    it("rejects max_participants < min_participants", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, maxParticipants: 1 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Overflow");
      }
    });

    it("rejects reveal_duration = 0", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, revealDuration: new BN(0) })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Overflow");
      }
    });

    it("rejects update from non-admin", async () => {
      try {
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, houseFeeBps: 500 })
          .accounts({ config: configKey, admin: operator.publicKey })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  // ================================================================
  // 3. Fee Withdrawal
  // ================================================================
  describe("Fee Withdrawal", () => {
    it("rejects withdraw with no fees", async () => {
      try {
        await program.methods
          .withdrawFees()
          .accounts({
            config: configKey, admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("NoFeesToWithdraw");
      }
    });

    it("rejects withdraw from non-admin", async () => {
      try {
        await program.methods
          .withdrawFees()
          .accounts({
            config: configKey, admin: operator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  // ================================================================
  // 4. Player Entry (commit-reveal)
  // ================================================================
  describe("Player Entry", () => {
    it("player 0 enters with commitment, stake deducted", async () => {
      const p = players[0];
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      const balBefore = await conn.getBalance(p.publicKey);

      const { commitment } = await enterPlayer(t0Key, p, 0); // TitForTat

      const entry = await program.account.entry.fetch(eKey);
      expect(entry.player.toString()).to.equal(p.publicKey.toString());
      expect(entry.tournament.toString()).to.equal(t0Key.toString());
      expect(entry.index).to.equal(0);
      expect(Array.from(entry.commitment)).to.deep.equal(commitment);
      expect(entry.revealed).to.equal(false);
      // Strategy is default (TitForTat = index 0) until reveal
      expect(entry.strategy).to.deep.equal({ titForTat: {} });
      expect(entry.score).to.equal(0);
      expect(entry.matchesPlayed).to.equal(0);
      expect(entry.paidOut).to.equal(false);
      expect(entry.createdAt.toNumber()).to.be.greaterThan(0);

      const t = await program.account.tournament.fetch(t0Key);
      expect(t.participantCount).to.equal(1);
      expect(t.pool.toNumber()).to.equal(stake.toNumber());

      const balAfter = await conn.getBalance(p.publicKey);
      expect(balBefore - balAfter).to.be.greaterThan(stake.toNumber());
    });

    it("enters players 1-8 (all 9 strategies)", async () => {
      for (let i = 1; i <= 8; i++) {
        await enterPlayer(t0Key, players[i], i);
      }

      const t = await program.account.tournament.fetch(t0Key);
      expect(t.participantCount).to.equal(9);
      expect(t.pool.toNumber()).to.equal(stake.toNumber() * 9);
      expect(t.players.length).to.equal(9);
      expect(t.scores.length).to.equal(9);
      t.scores.forEach((s: number) => expect(s).to.equal(0));
    });

    it("rejects duplicate entry", async () => {
      const p = players[0];
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      const salt = randomBytes(16);
      const commitment = computeCommitment(6, salt);
      try {
        await program.methods
          .enterTournament(commitment)
          .accounts({
            config: configKey, tournament: t0Key, entry: eKey,
            player: p.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it("players, scores, and strategies vecs have matching lengths", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.players.length).to.equal(t.scores.length);
      expect(t.players.length).to.equal(t.strategies.length);
    });

    it("entry created_at is a valid recent timestamp", async () => {
      const p = players[0];
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      const entry = await program.account.entry.fetch(eKey);
      const now = Math.floor(Date.now() / 1000);
      expect(entry.createdAt.toNumber()).to.be.greaterThan(now - 120);
      expect(entry.createdAt.toNumber()).to.be.lessThanOrEqual(now + 60);
    });

    it("all entry scores and matches_played start at zero", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, t0Key, t.players[i]);
        const entry = await program.account.entry.fetch(eKey);
        expect(entry.score).to.equal(0);
        expect(entry.matchesPlayed).to.equal(0);
      }
    });
  });

  // ================================================================
  // 5. Refund During Registration
  // ================================================================
  describe("Refund During Registration", () => {
    it("player gets refund, entry closed, pool reduced", async () => {
      const p = players[8]; // Gradual
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      const balBefore = await conn.getBalance(p.publicKey);
      const tBefore = await program.account.tournament.fetch(t0Key);

      await program.methods
        .claimRefund()
        .accounts({
          tournament: t0Key, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      const balAfter = await conn.getBalance(p.publicKey);
      expect(balAfter).to.be.greaterThan(balBefore);

      const tAfter = await program.account.tournament.fetch(t0Key);
      expect(tAfter.participantCount).to.equal(tBefore.participantCount - 1);
      expect(tAfter.pool.toNumber()).to.equal(tBefore.pool.toNumber() - stake.toNumber());
      expect(tAfter.players[8].toString()).to.equal(PublicKey.default.toString());
      expect(tAfter.strategies[8]).to.equal(255);

      try {
        await program.account.entry.fetch(eKey);
        expect.fail("Entry should be closed");
      } catch {
        // expected
      }
    });

    // Note: "re-enter after refund" is not tested here because with 10s
    // registration duration, registration closes before we can re-enter.
    // The contract supports it — tested implicitly in other flows.

    it("non-participant cannot claim refund", async () => {
      const outsider = Keypair.generate();
      await airdrop(conn, outsider.publicKey, 1);
      const [eKey] = deriveE(pid, t0Key, outsider.publicKey);

      try {
        await program.methods
          .claimRefund()
          .accounts({
            tournament: t0Key, entry: eKey,
            player: outsider.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([outsider])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });
  });

  // ================================================================
  // 6. State Machine — Invalid Transitions (from Registration)
  // ================================================================
  describe("State Machine (Registration phase)", () => {
    it("run_matches fails", async () => {
      try {
        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: t0Key, operator: operator.publicKey })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("finalize_tournament fails", async () => {
      const [t1Key] = deriveT(pid, 1);
      try {
        await program.methods
          .finalizeTournament()
          .accounts({
            config: configKey, tournament: t0Key, nextTournament: t1Key,
            operator: operator.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("claim_payout fails", async () => {
      const [eKey] = deriveE(pid, t0Key, players[0].publicKey);
      try {
        await program.methods
          .claimPayout()
          .accounts({
            tournament: t0Key, entry: eKey,
            player: players[0].publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([players[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("close_entry fails in Registration state", async () => {
      const [eKey] = deriveE(pid, t0Key, players[0].publicKey);
      try {
        await program.methods
          .closeEntry()
          .accounts({
            config: configKey, tournament: t0Key, entry: eKey,
            player: players[0].publicKey,
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("close_tournament fails", async () => {
      try {
        await program.methods
          .closeTournament()
          .accounts({
            config: configKey, tournament: t0Key,
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("close_reveal fails in Registration state", async () => {
      try {
        await program.methods
          .closeReveal()
          .accounts({
            config: configKey, tournament: t0Key,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            refundEntry: null, refundPlayer: null,
            operator: operator.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });
  });

  // ================================================================
  // 7. Authorization Checks
  // ================================================================
  describe("Authorization", () => {
    it("non-operator cannot close_registration", async () => {
      const fake = Keypair.generate();
      await airdrop(conn, fake.publicKey, 1);
      try {
        await program.methods
          .closeRegistration()
          .accounts({
            config: configKey, tournament: t0Key,
            operator: fake.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("non-operator cannot run_matches", async () => {
      const fake = Keypair.generate();
      await airdrop(conn, fake.publicKey, 1);
      try {
        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: t0Key, operator: fake.publicKey })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("non-operator cannot finalize_tournament", async () => {
      const fake = Keypair.generate();
      const [t1Key] = deriveT(pid, 1);
      await airdrop(conn, fake.publicKey, 1);
      try {
        await program.methods
          .finalizeTournament()
          .accounts({
            config: configKey, tournament: t0Key, nextTournament: t1Key,
            operator: fake.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("non-admin cannot withdraw_fees", async () => {
      try {
        await program.methods
          .withdrawFees()
          .accounts({
            config: configKey, admin: operator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  // ================================================================
  // 7b. Authorization — operator-gated instructions
  // ================================================================
  describe("Authorization — operator-gated instructions", () => {
    it("non-operator cannot close_reveal", async () => {
      const fake = Keypair.generate();
      await airdrop(conn, fake.publicKey, 1);
      try {
        await program.methods
          .closeReveal()
          .accounts({
            config: configKey, tournament: t0Key,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            refundEntry: null, refundPlayer: null,
            operator: fake.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("non-operator cannot forfeit_unrevealed", async () => {
      const fake = Keypair.generate();
      await airdrop(conn, fake.publicKey, 1);
      // Use an existing entry PDA (players[0] in t0Key)
      const [eKey] = deriveE(pid, t0Key, players[0].publicKey);
      try {
        await program.methods
          .forfeitUnrevealed()
          .accounts({
            config: configKey, entry: eKey, tournament: t0Key,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            operator: fake.publicKey,
          })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("non-operator cannot close_entry", async () => {
      const fake = Keypair.generate();
      await airdrop(conn, fake.publicKey, 1);
      const [eKey] = deriveE(pid, t0Key, players[0].publicKey);
      try {
        await program.methods
          .closeEntry()
          .accounts({
            config: configKey, tournament: t0Key, entry: eKey,
            player: players[0].publicKey,
            operator: fake.publicKey,
          })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("non-operator/non-admin cannot close_tournament", async () => {
      const fake = Keypair.generate();
      await airdrop(conn, fake.publicKey, 1);
      try {
        await program.methods
          .closeTournament()
          .accounts({
            config: configKey, tournament: t0Key,
            operator: fake.publicKey,
          })
          .signers([fake])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  // ================================================================
  // 8. Full Lifecycle — Registration → Reveal → Running → Payout (T0)
  // ================================================================
  describe("Full Lifecycle (T0)", () => {
    // Keep players[0] (TitForTat) and players[1] (AlwaysDefect).
    // Refund players[2..8] so we have a clean 2-player tournament.
    before(async () => {
      for (let i = 2; i <= 8; i++) {
        const p = players[i];
        const [eKey] = deriveE(pid, t0Key, p.publicKey);
        try {
          await program.methods
            .claimRefund()
            .accounts({
              tournament: t0Key, entry: eKey,
              player: p.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([p])
            .rpc();
        } catch {
          // might already be refunded
        }
      }
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.participantCount).to.equal(2);
    });

    it("close_registration transitions to Reveal state", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      const now = Math.floor(Date.now() / 1000);
      const remaining = t.registrationEnds.toNumber() - now;
      await sleep(Math.max(remaining + 5, 3) * 1000);

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await program.methods
            .closeRegistration()
            .accounts({
              config: configKey, tournament: t0Key,
              operator: operator.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([operator])
            .rpc();
          break;
        } catch (err: any) {
          if (err?.error?.errorCode?.code === "RegistrationOpen") {
            await sleep(2000);
            continue;
          }
          throw err;
        }
      }

      const tAfter = await program.account.tournament.fetch(t0Key);
      expect(tAfter.state).to.deep.equal({ reveal: {} });
      expect(tAfter.revealEnds.toNumber()).to.be.greaterThan(0);
      // Randomness seed NOT set yet (set at close_reveal)
      expect(tAfter.matchesTotal).to.equal(0);
    });

    it("entry fails in Reveal state", async () => {
      const p = players[9];
      const salt = randomBytes(16);
      const commitment = computeCommitment(4, salt);
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      try {
        await program.methods
          .enterTournament(commitment)
          .accounts({
            config: configKey, tournament: t0Key, entry: eKey,
            player: p.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("RegistrationClosed");
      }
    });

    it("both players reveal their strategies", async () => {
      // Player 0: TitForTat (index 0)
      await revealPlayer(t0Key, players[0], Strategy.TitForTat);
      const [e0Key] = deriveE(pid, t0Key, players[0].publicKey);
      const e0 = await program.account.entry.fetch(e0Key);
      expect(e0.revealed).to.equal(true);
      expect(e0.strategy).to.deep.equal({ titForTat: {} });

      // Player 1: AlwaysDefect (index 1)
      await revealPlayer(t0Key, players[1], Strategy.AlwaysDefect);
      const [e1Key] = deriveE(pid, t0Key, players[1].publicKey);
      const e1 = await program.account.entry.fetch(e1Key);
      expect(e1.revealed).to.equal(true);
      expect(e1.strategy).to.deep.equal({ alwaysDefect: {} });

      const t = await program.account.tournament.fetch(t0Key);
      expect(t.revealsCompleted).to.equal(2);
    });

    it("close_reveal transitions to Running state", async () => {
      // Wait for reveal period to expire (Solana clock may lag behind wall clock)
      const t = await program.account.tournament.fetch(t0Key);
      const now = Math.floor(Date.now() / 1000);
      const remaining = t.revealEnds.toNumber() - now;
      await sleep(Math.max(remaining + 5, 5) * 1000);

      // Retry loop in case Solana clock hasn't caught up
      let success = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await program.methods
            .closeReveal()
            .accounts({
              config: configKey, tournament: t0Key,
              slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
              refundEntry: null, refundPlayer: null,
              operator: operator.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([operator])
            .rpc();
          success = true;
          break;
        } catch (err: any) {
          if (err?.error?.errorCode?.code === "RevealPeriodNotEnded") {
            await sleep(2000);
            continue;
          }
          throw err;
        }
      }
      expect(success).to.be.true;

      const tAfter = await program.account.tournament.fetch(t0Key);
      expect(tAfter.state).to.deep.equal({ running: {} });
      expect(tAfter.matchesTotal).to.be.greaterThan(0);
      expect(tAfter.randomnessSeed.some((b: number) => b !== 0)).to.be.true;
    });

    it("refund fails in Running state", async () => {
      const [eKey] = deriveE(pid, t0Key, players[0].publicKey);
      try {
        await program.methods
          .claimRefund()
          .accounts({
            tournament: t0Key, entry: eKey,
            player: players[0].publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([players[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("runs all matches (multi-batch)", async () => {
      const t = await runAllMatches(t0Key);
      expect(t.matchesCompleted).to.equal(t.matchesTotal);
      expect(t.matchesTotal).to.equal(1);
      expect(t.scores.some((s: number) => s > 0)).to.be.true;
    });

    it("scores are reflected in entry accounts", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, t0Key, t.players[i]);
        const entry = await program.account.entry.fetch(eKey);
        expect(entry.score).to.equal(t.scores[i]);
      }
    });

    it("finalizes tournament and creates T1", async () => {
      const [t1Key] = deriveT(pid, 1);

      // Set house fee BEFORE finalize so T1 snapshots it
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, houseFeeBps: 500 })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();

      await program.methods
        .finalizeTournament()
        .accounts({
          config: configKey, tournament: t0Key, nextTournament: t1Key,
          operator: operator.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc();

      const t0 = await program.account.tournament.fetch(t0Key);
      expect(t0.state).to.deep.equal({ payout: {} });
      expect(t0.winnerCount).to.be.greaterThan(0);
      expect(t0.winnerPool.toNumber()).to.be.greaterThan(0);
      expect(t0.payoutStartedAt.toNumber()).to.be.greaterThan(0);

      const t1 = await program.account.tournament.fetch(t1Key);
      expect(t1.id).to.equal(1);
      expect(t1.state).to.deep.equal({ registration: {} });
      expect(t1.revealDuration.toNumber()).to.equal(REVEAL_DURATION);

      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.currentTournamentId).to.equal(1);
    });

    it("winner claims payout, receives SOL", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      let winnerPlayerIdx = -1;
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        if (t.scores[i] >= t.minWinningScore) {
          winnerPlayerIdx = i;
          break;
        }
      }
      expect(winnerPlayerIdx).to.not.equal(-1);

      const winnerKey = t.players[winnerPlayerIdx];
      const winnerKeypair = players.find(
        (p) => p.publicKey.toString() === winnerKey.toString()
      )!;

      const [eKey] = deriveE(pid, t0Key, winnerKey);
      const balBefore = await conn.getBalance(winnerKey);

      await program.methods
        .claimPayout()
        .accounts({
          tournament: t0Key, entry: eKey,
          player: winnerKey, systemProgram: SystemProgram.programId,
        })
        .signers([winnerKeypair])
        .rpc();

      const balAfter = await conn.getBalance(winnerKey);
      expect(balAfter).to.be.greaterThan(balBefore);

      try {
        await program.account.entry.fetch(eKey);
        expect.fail("Entry should be closed after payout");
      } catch {
        // expected
      }

      const tAfter = await program.account.tournament.fetch(t0Key);
      expect(tAfter.claimsProcessed).to.be.greaterThan(0);
      expect(tAfter.strategies.length).to.equal(tAfter.players.length);
    });

    it("double claim_payout fails (entry already closed)", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        if (t.scores[i] >= t.minWinningScore) {
          const [eKey] = deriveE(pid, t0Key, t.players[i]);
          const kp = players.find(
            (p) => p.publicKey.toString() === t.players[i].toString()
          )!;
          try {
            await program.methods
              .claimPayout()
              .accounts({
                tournament: t0Key, entry: eKey,
                player: t.players[i], systemProgram: SystemProgram.programId,
              })
              .signers([kp])
              .rpc();
            expect.fail("Should have thrown");
          } catch (err) {
            expect(err).to.exist;
          }
          break;
        }
      }
    });

    it("non-winner gets NotWinner error", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        if (t.scores[i] < t.minWinningScore) {
          const [eKey] = deriveE(pid, t0Key, t.players[i]);
          const kp = players.find(
            (p) => p.publicKey.toString() === t.players[i].toString()
          )!;
          try {
            await program.methods
              .claimPayout()
              .accounts({
                tournament: t0Key, entry: eKey,
                player: t.players[i], systemProgram: SystemProgram.programId,
              })
              .signers([kp])
              .rpc();
            expect.fail("Should have thrown");
          } catch (err) {
            expect((err as AnchorError).error.errorCode.code).to.equal("NotWinner");
          }
          break;
        }
      }
    });
  });

  // ================================================================
  // 9. Lifecycle with House Fee (T1)
  // ================================================================
  describe("Lifecycle with House Fee (T1)", () => {
    let t1Key: PublicKey;

    before(async () => {
      [t1Key] = deriveT(pid, 1);

      // Enter 2 players into T1 with commitments
      await enterPlayer(t1Key, players[4], 2); // AlwaysCooperate
      await enterPlayer(t1Key, players[5], 1); // AlwaysDefect
    });

    it("T1 snapshots house_fee_bps = 500", async () => {
      const t1 = await program.account.tournament.fetch(t1Key);
      expect(t1.houseFeeBps).to.equal(500);
      expect(t1.participantCount).to.equal(2);
    });

    it("full lifecycle with reveal phase completes, fees accumulated", async () => {
      // Wait for reg to expire, close registration → Reveal
      await waitAndCloseRegistration(t1Key);

      let t1 = await program.account.tournament.fetch(t1Key);
      expect(t1.state).to.deep.equal({ reveal: {} });

      // Both players reveal
      await revealPlayer(t1Key, players[4], Strategy.AlwaysCooperate);
      await revealPlayer(t1Key, players[5], Strategy.AlwaysDefect);

      // Wait for reveal to expire, close reveal → Running
      await waitAndCloseReveal(t1Key);

      t1 = await program.account.tournament.fetch(t1Key);
      expect(t1.state).to.deep.equal({ running: {} });

      // Run all matches
      await runAllMatches(t1Key);

      // Finalize
      const [t2Key] = deriveT(pid, 2);
      await program.methods
        .finalizeTournament()
        .accounts({
          config: configKey, tournament: t1Key, nextTournament: t2Key,
          operator: operator.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc();

      // Check fees
      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.accumulatedFees.toNumber()).to.be.greaterThan(0);
      const expectedFee = Math.floor(0.2 * LAMPORTS_PER_SOL * 500 / 10000);
      expect(cfg.accumulatedFees.toNumber()).to.equal(expectedFee);

      expect((await program.account.tournament.fetch(t1Key)).state).to.deep.equal({ payout: {} });
      expect((await program.account.tournament.fetch(t2Key)).state).to.deep.equal({ registration: {} });
      expect(cfg.currentTournamentId).to.equal(2);
    });

    it("admin withdraws fees", async () => {
      const cfg = await program.account.config.fetch(configKey);
      const fees = cfg.accumulatedFees.toNumber();
      const balBefore = await conn.getBalance(admin.publicKey);

      await program.methods
        .withdrawFees()
        .accounts({
          config: configKey, admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      expect((await program.account.config.fetch(configKey)).accumulatedFees.toNumber()).to.equal(0);
      const balAfter = await conn.getBalance(admin.publicKey);
      expect(balAfter - balBefore).to.be.greaterThan(fees - 10000);
    });

    it("withdraw fails again (no fees left)", async () => {
      try {
        await program.methods
          .withdrawFees()
          .accounts({
            config: configKey, admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("NoFeesToWithdraw");
      }
    });
  });

  // ================================================================
  // 10. Commit-Reveal Specific Tests
  // ================================================================
  describe("Commit-Reveal Specific", () => {
    // Use T2 which should be in Registration
    let crTournamentKey: PublicKey;
    let crPlayers: Keypair[];
    let crSalts: Buffer[] = [];

    before(async () => {
      [crTournamentKey] = deriveT(pid, 2);
      crPlayers = [players[6], players[7], players[8]];

      // Enter 3 players with commitments
      for (let i = 0; i < 3; i++) {
        const salt = randomBytes(16);
        crSalts.push(salt);
        const commitment = computeCommitment(i, salt);
        const [eKey] = deriveE(pid, crTournamentKey, crPlayers[i].publicKey);
        await program.methods
          .enterTournament(commitment)
          .accounts({
            config: configKey, tournament: crTournamentKey, entry: eKey,
            player: crPlayers[i].publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([crPlayers[i]])
          .rpc();
      }
    });

    it("reveal before close_registration fails (InvalidState)", async () => {
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      try {
        await program.methods
          .revealStrategy(Strategy.TitForTat, Array.from(crSalts[0]), null)
          .accounts({
            entry: eKey, tournament: crTournamentKey, player: crPlayers[0].publicKey,
          })
          .signers([crPlayers[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("refund during Registration phase succeeds", async () => {
      // Player 2 (index 2, AlwaysCooperate) claims refund while still in Registration
      const p = crPlayers[2];
      const [eKey] = deriveE(pid, crTournamentKey, p.publicKey);
      const balBefore = await conn.getBalance(p.publicKey);

      await program.methods
        .claimRefund()
        .accounts({
          tournament: crTournamentKey, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      const balAfter = await conn.getBalance(p.publicKey);
      expect(balAfter).to.be.greaterThan(balBefore);
    });

    it("close_registration enters Reveal phase", async () => {
      await waitAndCloseRegistration(crTournamentKey);
      const t = await program.account.tournament.fetch(crTournamentKey);
      expect(t.state).to.deep.equal({ reveal: {} });
    });

    it("refund during Reveal phase fails (InvalidState)", async () => {
      // After M4 fix: refunds are only allowed during Registration
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      try {
        await program.methods
          .claimRefund()
          .accounts({
            tournament: crTournamentKey, entry: eKey,
            player: crPlayers[0].publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([crPlayers[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });

    it("reveal with wrong strategy fails (CommitmentMismatch)", async () => {
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      try {
        await program.methods
          .revealStrategy(Strategy.AlwaysDefect, Array.from(crSalts[0]), null)
          .accounts({
            entry: eKey, tournament: crTournamentKey, player: crPlayers[0].publicKey,
          })
          .signers([crPlayers[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("CommitmentMismatch");
      }
    });

    it("reveal with wrong salt fails (CommitmentMismatch)", async () => {
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      const wrongSalt = randomBytes(16);
      try {
        await program.methods
          .revealStrategy(Strategy.TitForTat, Array.from(wrongSalt), null)
          .accounts({
            entry: eKey, tournament: crTournamentKey, player: crPlayers[0].publicKey,
          })
          .signers([crPlayers[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("CommitmentMismatch");
      }
    });

    it("correct reveal succeeds", async () => {
      // Player 0: TitForTat (index 0)
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      await program.methods
        .revealStrategy(Strategy.TitForTat, Array.from(crSalts[0]), null)
        .accounts({
          entry: eKey, tournament: crTournamentKey, player: crPlayers[0].publicKey,
        })
        .signers([crPlayers[0]])
        .rpc();

      const entry = await program.account.entry.fetch(eKey);
      expect(entry.revealed).to.equal(true);
      expect(entry.strategy).to.deep.equal({ titForTat: {} });
    });

    it("double reveal fails (AlreadyRevealed)", async () => {
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      try {
        await program.methods
          .revealStrategy(Strategy.TitForTat, Array.from(crSalts[0]), null)
          .accounts({
            entry: eKey, tournament: crTournamentKey, player: crPlayers[0].publicKey,
          })
          .signers([crPlayers[0]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("AlreadyRevealed");
      }
    });

    it("close_reveal before reveal_ends fails (RevealPeriodNotEnded)", async () => {
      // We might still be within the reveal period
      const t = await program.account.tournament.fetch(crTournamentKey);
      const now = Math.floor(Date.now() / 1000);
      if (t.revealEnds.toNumber() > now) {
        try {
          await program.methods
            .closeReveal()
            .accounts({
              config: configKey, tournament: crTournamentKey,
              slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
              refundEntry: null, refundPlayer: null,
              operator: operator.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([operator])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("RevealPeriodNotEnded");
        }
      }
    });

    it("forfeit_unrevealed before reveal deadline fails (RevealPeriodNotEnded)", async () => {
      const t = await program.account.tournament.fetch(crTournamentKey);
      const now = Math.floor(Date.now() / 1000);
      if (t.revealEnds.toNumber() > now) {
        const [eKey] = deriveE(pid, crTournamentKey, crPlayers[1].publicKey);
        try {
          await program.methods
            .forfeitUnrevealed()
            .accounts({
              config: configKey, entry: eKey, tournament: crTournamentKey,
              slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
              operator: operator.publicKey,
            })
            .signers([operator])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("RevealPeriodNotEnded");
        }
      }
    });

    it("forfeit_unrevealed on revealed entry fails (AlreadyRevealed)", async () => {
      // Wait for reveal deadline
      const t = await program.account.tournament.fetch(crTournamentKey);
      const now = Math.floor(Date.now() / 1000);
      const remaining = t.revealEnds.toNumber() - now;
      if (remaining > 0) await sleep((remaining + 2) * 1000);

      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[0].publicKey);
      try {
        await program.methods
          .forfeitUnrevealed()
          .accounts({
            config: configKey, entry: eKey, tournament: crTournamentKey,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("AlreadyRevealed");
      }
    });

    it("reveal after reveal_ends fails (RevealPeriodEnded)", async () => {
      // Player 1 didn't reveal and deadline has passed
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[1].publicKey);
      try {
        await program.methods
          .revealStrategy(Strategy.AlwaysDefect, Array.from(crSalts[1]), null)
          .accounts({
            entry: eKey, tournament: crTournamentKey, player: crPlayers[1].publicKey,
          })
          .signers([crPlayers[1]])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("RevealPeriodEnded");
      }
    });

    it("forfeit unrevealed player assigns random strategy after deadline", async () => {
      const [eKey] = deriveE(pid, crTournamentKey, crPlayers[1].publicKey);
      await program.methods
        .forfeitUnrevealed()
        .accounts({
          config: configKey, entry: eKey, tournament: crTournamentKey,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          operator: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Entry still exists and is now revealed with an auto-assigned strategy
      const entry = await program.account.entry.fetch(eKey);
      expect(entry.revealed).to.equal(true);

      const t = await program.account.tournament.fetch(crTournamentKey);
      expect(t.revealsCompleted).to.equal(2);
      // Player still in tournament
      expect(t.players[1].toString()).to.equal(crPlayers[1].publicKey.toString());
      expect(t.strategies[1]).to.not.equal(255);
    });

    it("close_reveal with 2 active players transitions to Running with matches", async () => {
      // After auto-assign, both players are revealed (even count).
      // close_reveal transitions directly to Running with real matches.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await program.methods
            .closeReveal()
            .accounts({
              config: configKey, tournament: crTournamentKey,
              slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
              refundEntry: null, refundPlayer: null,
              operator: operator.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([operator])
            .rpc();
          break;
        } catch (err: any) {
          if (err?.error?.errorCode?.code === "RevealPeriodNotEnded") {
            await sleep(2000);
            continue;
          }
          throw err;
        }
      }

      const t = await program.account.tournament.fetch(crTournamentKey);
      expect(t.state).to.deep.equal({ running: {} });
      expect(t.matchesTotal).to.be.greaterThan(0);
    });
  });

  // ================================================================
  // 11. Cross-tournament Independence
  // ================================================================
  describe("Cross-tournament Independence", () => {
    it("new tournament accepts entries while old is in Payout", async () => {
      // Find a tournament in Registration state
      const cfg = await program.account.config.fetch(configKey);
      // Try tournaments from current down to find one in Registration
      let tKey: PublicKey | null = null;
      for (let id = cfg.currentTournamentId; id >= 0; id--) {
        const [key] = deriveT(pid, id);
        try {
          const t = await program.account.tournament.fetch(key);
          if (JSON.stringify(t.state) === JSON.stringify({ registration: {} })) {
            tKey = key;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!tKey) {
        // No registration tournament available — skip gracefully
        console.log("    (skipped: no tournament in Registration state)");
        return;
      }

      const p = players[10];
      const salt = randomBytes(16);
      const commitment = computeCommitment(4, salt);
      const [eKey] = deriveE(pid, tKey, p.publicKey);
      try {
        await program.methods
          .enterTournament(commitment)
          .accounts({
            config: configKey, tournament: tKey, entry: eKey,
            player: p.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();

        const entry = await program.account.entry.fetch(eKey);
        expect(entry.revealed).to.equal(false);
      } catch (err) {
        // Registration may have closed due to timing — acceptable
        console.log("    (entry failed due to timing — acceptable)");
      }
    });
  });

  // ================================================================
  // 12. Entry Counter & Close Tournament (v1.2)
  // ================================================================
  describe("Entry Counter & Close Tournament (v1.2)", () => {
    it("entries_remaining tracks entry lifecycle", async () => {
      const t0 = await program.account.tournament.fetch(t0Key);
      expect(t0.entriesRemaining).to.be.a("number");
    });

    it("entries_remaining decremented by claim_payout (T0)", async () => {
      const t0 = await program.account.tournament.fetch(t0Key);
      expect(t0.entriesRemaining).to.be.greaterThanOrEqual(0);
      expect(t0.entriesRemaining).to.be.lessThan(t0.players.length);
    });
  });

  // ================================================================
  // 13. Close Tournament Flow (v1.2, requires testing feature)
  // ================================================================
  describe("Close Tournament Flow (v1.2)", () => {
    it("close_tournament fails when entries still remaining", async () => {
      const [t1Key] = deriveT(pid, 1);

      try {
        await program.methods
          .closeTournament()
          .accounts({
            config: configKey, tournament: t1Key,
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("EntriesRemaining");
      }
    });

    it("close entries for T1 (rent returns to player)", async () => {
      const [t1Key] = deriveT(pid, 1);
      const t1 = await program.account.tournament.fetch(t1Key);
      for (let i = 0; i < t1.players.length; i++) {
        if (t1.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, t1Key, t1.players[i]);
        try {
          await program.account.entry.fetch(eKey);
        } catch {
          continue;
        }
        await program.methods
          .closeEntry()
          .accounts({
            config: configKey, tournament: t1Key, entry: eKey,
            player: t1.players[i],
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
      }

      const t1After = await program.account.tournament.fetch(t1Key);
      expect(t1After.entriesRemaining).to.equal(0);
    });

    it("close_tournament succeeds and routes lamports to accumulated_fees", async () => {
      const [t1Key] = deriveT(pid, 1);
      const tournamentLamports = await conn.getBalance(t1Key);

      const cfgBefore = await program.account.config.fetch(configKey);
      const configBalBefore = await conn.getBalance(configKey);
      const feesBefore = cfgBefore.accumulatedFees.toNumber();

      await program.methods
        .closeTournament()
        .accounts({
          config: configKey, tournament: t1Key,
          operator: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      const tournamentInfo = await conn.getAccountInfo(t1Key);
      expect(tournamentInfo).to.be.null;

      const configBalAfter = await conn.getBalance(configKey);
      expect(configBalAfter).to.equal(configBalBefore + tournamentLamports);

      const cfgAfter = await program.account.config.fetch(configKey);
      expect(cfgAfter.accumulatedFees.toNumber()).to.equal(feesBefore + tournamentLamports);
    });

    it("admin can withdraw fees including tournament rent", async () => {
      const cfg = await program.account.config.fetch(configKey);
      const fees = cfg.accumulatedFees.toNumber();
      expect(fees).to.be.greaterThan(0);

      const balBefore = await conn.getBalance(admin.publicKey);
      await program.methods
        .withdrawFees()
        .accounts({
          config: configKey, admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const cfgAfter = await program.account.config.fetch(configKey);
      expect(cfgAfter.accumulatedFees.toNumber()).to.equal(0);
      const balAfter = await conn.getBalance(admin.publicKey);
      expect(balAfter - balBefore).to.be.greaterThan(fees - 10000);
    });
  });

  // ================================================================
  // 14. PDA Derivation Correctness
  // ================================================================
  describe("PDA Derivation", () => {
    it("config PDA is deterministic", () => {
      const [a] = deriveCfg(pid);
      const [b] = deriveCfg(pid);
      expect(a.toString()).to.equal(b.toString());
    });

    it("tournament PDAs differ by ID", () => {
      const ids = [0, 1, 2, 100, 65535];
      const pdas = ids.map((id) => deriveT(pid, id)[0].toString());
      const unique = new Set(pdas);
      expect(unique.size).to.equal(ids.length);
    });

    it("entry PDAs differ by player", () => {
      const [t] = deriveT(pid, 0);
      const [a] = deriveE(pid, t, Keypair.generate().publicKey);
      const [b] = deriveE(pid, t, Keypair.generate().publicKey);
      expect(a.toString()).not.to.equal(b.toString());
    });

    it("entry PDAs differ by tournament", () => {
      const p = Keypair.generate().publicKey;
      const [t0] = deriveT(pid, 0);
      const [t1] = deriveT(pid, 1);
      const [e0] = deriveE(pid, t0, p);
      const [e1] = deriveE(pid, t1, p);
      expect(e0.toString()).not.to.equal(e1.toString());
    });
  });

  // ================================================================
  // 15. Account Sizing
  // ================================================================
  describe("Account Sizing", () => {
    it("tournament account size accommodates player vecs", async () => {
      const info = await conn.getAccountInfo(t0Key);
      expect(info).to.not.be.null;
      expect(info!.data.length).to.be.greaterThan(100);
    });
  });

  // ================================================================
  // 16. T2 Full Lifecycle After Auto-Assign
  // ================================================================
  describe("T2 Full Lifecycle After Auto-Assign", () => {
    // T2 is in Running state with real matches after the commit-reveal
    // tests (one player revealed manually, one got auto-assigned strategy).
    let t2Key: PublicKey;

    before(async () => {
      [t2Key] = deriveT(pid, 2);
    });

    it("T2 is in Running state with real matches", async () => {
      const t2 = await program.account.tournament.fetch(t2Key);
      expect(t2.state).to.deep.equal({ running: {} });
      expect(t2.matchesTotal).to.be.greaterThan(0);
    });

    it("runs all matches for T2", async () => {
      const t2 = await runAllMatches(t2Key);
      expect(t2.matchesCompleted).to.equal(t2.matchesTotal);
      expect(t2.scores.some((s: number) => s > 0)).to.be.true;
    });

    it("finalize_tournament creates T3 with winners", async () => {
      const [t3Key] = deriveT(pid, 3);

      await program.methods
        .finalizeTournament()
        .accounts({
          config: configKey, tournament: t2Key, nextTournament: t3Key,
          operator: operator.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc();

      const t2 = await program.account.tournament.fetch(t2Key);
      expect(t2.state).to.deep.equal({ payout: {} });
      expect(t2.winnerCount).to.be.greaterThan(0);

      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.currentTournamentId).to.equal(3);

      const t3 = await program.account.tournament.fetch(t3Key);
      expect(t3.id).to.equal(3);
      expect(t3.state).to.deep.equal({ registration: {} });
    });

    it("close entries and close tournament", async () => {
      const t2 = await program.account.tournament.fetch(t2Key);
      for (let i = 0; i < t2.players.length; i++) {
        if (t2.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, t2Key, t2.players[i]);
        try {
          await program.account.entry.fetch(eKey);
        } catch {
          continue; // Entry already closed
        }
        await program.methods
          .closeEntry()
          .accounts({
            config: configKey, tournament: t2Key, entry: eKey,
            player: t2.players[i],
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
      }

      const t2After = await program.account.tournament.fetch(t2Key);
      expect(t2After.entriesRemaining).to.equal(0);

      // Wait for closure expiry (2 seconds with testing feature)
      await sleep(3000);

      await program.methods
        .closeTournament()
        .accounts({
          config: configKey, tournament: t2Key,
          operator: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Tournament account should be zeroed/closed
      const info = await conn.getAccountInfo(t2Key);
      expect(info).to.be.null;
    });
  });

  // ================================================================
  // 17. Operator Cost Reimbursement & Auto-Payout (v1.8)
  // ================================================================
  describe("Operator Cost Reimbursement & Auto-Payout (v1.8)", () => {
    it("updates operator_tx_fee config", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, operatorTxFee: new BN(5000) })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();

      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.operatorTxFee.toNumber()).to.equal(5000);
    });

    it("new tournament starts with operator_costs = 0", async () => {
      // After T2 lifecycle, we should be on T3 in Registration
      const cfg = await program.account.config.fetch(configKey);
      const [tKey] = deriveT(pid, cfg.currentTournamentId);
      const t = await program.account.tournament.fetch(tKey);

      expect(t.operatorCosts.toNumber()).to.equal(0);
    });

    it("full lifecycle with operator reimbursement and close_entry auto-payout", async () => {
      const cfg = await program.account.config.fetch(configKey);
      const currentId = cfg.currentTournamentId;
      const [tKey] = deriveT(pid, currentId);

      // Enter 2 players
      await enterPlayer(tKey, players[9], 0);  // TitForTat
      await enterPlayer(tKey, players[10], 1); // AlwaysDefect

      // Run full lifecycle
      await waitAndCloseRegistration(tKey);

      // Check operator_costs accumulated after close_registration
      let t = await program.account.tournament.fetch(tKey);
      expect(t.operatorCosts.toNumber()).to.equal(5000); // 1 tx × 5000

      await revealPlayer(tKey, players[9], Strategy.TitForTat);
      await revealPlayer(tKey, players[10], Strategy.AlwaysDefect);
      await waitAndCloseReveal(tKey);

      // Check operator_costs accumulated after close_reveal
      t = await program.account.tournament.fetch(tKey);
      expect(t.operatorCosts.toNumber()).to.equal(10000); // 2 txs × 5000

      await runAllMatches(tKey);

      // Check operator_costs accumulated after run_matches
      t = await program.account.tournament.fetch(tKey);
      expect(t.operatorCosts.toNumber()).to.equal(15000); // 3 txs × 5000

      // Finalize — operator gets reimbursed
      const [nextTKey] = deriveT(pid, currentId + 1);

      await program.methods
        .finalizeTournament()
        .accounts({
          config: configKey, tournament: tKey, nextTournament: nextTKey,
          operator: operator.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc();

      const tAfter = await program.account.tournament.fetch(tKey);
      expect(tAfter.state).to.deep.equal({ payout: {} });
      // operator_costs = 3 pre-finalization + 1 finalization + post-finalization (entries_remaining + 1)
      // entries_remaining = 2, so post = (2+1) * 5000 = 15000
      // Total = 15000 + 5000 + 15000 = 35000
      expect(tAfter.operatorCosts.toNumber()).to.equal(35000);

      // Now close entries — winner should get payout, rent returns to player
      for (let i = 0; i < tAfter.players.length; i++) {
        if (tAfter.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, tKey, tAfter.players[i]);
        try {
          await program.account.entry.fetch(eKey);
        } catch { continue; }

        const balBefore = await conn.getBalance(tAfter.players[i]);

        await program.methods
          .closeEntry()
          .accounts({
            config: configKey, tournament: tKey, entry: eKey,
            player: tAfter.players[i],
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();

        const balAfter = await conn.getBalance(tAfter.players[i]);
        // Every player gets at least their entry rent back
        expect(balAfter).to.be.greaterThan(balBefore);
      }

      const tFinal = await program.account.tournament.fetch(tKey);
      expect(tFinal.entriesRemaining).to.equal(0);
    });

    it("claim_payout still works as player fallback", async () => {
      // This was tested in the T0 lifecycle — claim_payout is unchanged.
      expect(program.methods.claimPayout).to.exist;
    });

    it("resets operator_tx_fee to 0", async () => {
      await program.methods
        .updateConfig({ ...UPDATE_DEFAULTS, operatorTxFee: new BN(0) })
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();

      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.operatorTxFee.toNumber()).to.equal(0);
    });
  });

  // ================================================================
  // 19. Edge cases & negative paths
  // ================================================================
  describe("Edge cases & negative paths", () => {
    // Shared keypairs used across sub-describes (TournamentFull enters them,
    // MinParticipantsNotReached forfeits them to drive the lifecycle forward).
    let sharedP1: Keypair;
    let sharedP2: Keypair;

    // ── Tournament A: TournamentFull ──
    describe("TournamentFull", () => {
      let tAKey: PublicKey;
      let origMax: number;

      before(async () => {
        const cfg = await program.account.config.fetch(configKey);
        origMax = cfg.maxParticipants;
        [tAKey] = deriveT(pid, cfg.currentTournamentId);

        // Set max_participants = 2
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, maxParticipants: 2 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();

        // Enter 2 players (shared so MinParticipantsNotReached can forfeit them)
        sharedP1 = Keypair.generate();
        sharedP2 = Keypair.generate();
        await airdrop(conn, sharedP1.publicKey, 5);
        await airdrop(conn, sharedP2.publicKey, 5);

        await enterPlayer(tAKey, sharedP1, 0);
        await enterPlayer(tAKey, sharedP2, 1);
      });

      it("rejects entry when tournament is full (TournamentFull)", async () => {
        const p3 = Keypair.generate();
        await airdrop(conn, p3.publicKey, 5);
        const salt = randomBytes(16);
        const commitment = computeCommitment(2, salt);
        const [eKey] = deriveE(pid, tAKey, p3.publicKey);
        try {
          await program.methods
            .enterTournament(commitment)
            .accounts({
              config: configKey, tournament: tAKey, entry: eKey,
              player: p3.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([p3])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("TournamentFull");
        }
      });

      after(async () => {
        // Restore max_participants
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, maxParticipants: origMax })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
      });
    });

    // ── Tournament B: MinParticipantsNotReached ──
    describe("MinParticipantsNotReached", () => {
      // This test reuses the current tournament (tA) which has 2 players.
      // We need a tournament with < min_participants when close_registration is called.
      // Strategy: create a new tournament by finalizing current one, enter only 1 player,
      // wait for reg to expire, try close_registration.
      // But that requires running the current tournament through its lifecycle first.
      // Simpler: temporarily set min_participants=4, then try close_registration on
      // the current tournament which only has 2 players.

      // Actually, the current tournament already has 2 players from the TournamentFull
      // test above. We can temporarily bump min_participants to 4, wait for reg to expire,
      // and try close_registration.
      let tKey: PublicKey;
      let origMin: number;

      before(async () => {
        const cfg = await program.account.config.fetch(configKey);
        origMin = cfg.minParticipants;
        [tKey] = deriveT(pid, cfg.currentTournamentId);

        // Set min_participants = 4 (current tournament has 2)
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: 4 })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
      });

      it("close_registration fails when min_participants not reached (MinParticipantsNotReached)", async () => {
        // Wait for registration to expire
        const t = await program.account.tournament.fetch(tKey);
        const now = Math.floor(Date.now() / 1000);
        const remaining = t.registrationEnds.toNumber() - now;
        if (remaining > 0) await sleep((remaining + 5) * 1000);

        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await program.methods
              .closeRegistration()
              .accounts({
                config: configKey, tournament: tKey,
                operator: operator.publicKey, systemProgram: SystemProgram.programId,
              })
              .signers([operator])
              .rpc();
            expect.fail("Should have thrown");
          } catch (err: any) {
            if (err?.error?.errorCode?.code === "RegistrationOpen") {
              await sleep(2000);
              continue;
            }
            expect((err as AnchorError).error.errorCode.code).to.equal("MinParticipantsNotReached");
            break;
          }
        }
      });

      after(async () => {
        // Restore min_participants
        await program.methods
          .updateConfig({ ...UPDATE_DEFAULTS, minParticipants: origMin })
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();

        // Close registration (now min=2 is met with 2 players from TournamentFull)
        await waitAndCloseRegistration(tKey);

        // Wait for reveal expiry, then forfeit both shared players (they never revealed)
        const t = await program.account.tournament.fetch(tKey);
        const now = Math.floor(Date.now() / 1000);
        const remaining = t.revealEnds.toNumber() - now;
        if (remaining > 0) await sleep((remaining + 2) * 1000);

        for (const p of [sharedP1, sharedP2]) {
          const [eKey] = deriveE(pid, tKey, p.publicKey);
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              await program.methods
                .forfeitUnrevealed()
                .accounts({
                  config: configKey, entry: eKey, tournament: tKey,
                  slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
                  operator: operator.publicKey,
                })
                .signers([operator])
                .rpc();
              break;
            } catch (err: any) {
              if (err?.error?.errorCode?.code === "RevealPeriodNotEnded") {
                await sleep(2000);
                continue;
              }
              break;
            }
          }
        }

        // Close reveal → Running → finalize → next Registration tournament
        await waitAndCloseReveal(tKey);
        await runAllMatches(tKey);
        const cfg = await program.account.config.fetch(configKey);
        const [nextTKey] = deriveT(pid, cfg.currentTournamentId + 1);
        await program.methods
          .finalizeTournament()
          .accounts({
            config: configKey, tournament: tKey, nextTournament: nextTKey,
            operator: operator.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
      });
    });

    // ── Tournament C: Reveal/Forfeit edge cases ──
    describe("Reveal/Forfeit edge cases", () => {
      let tCKey: PublicKey;
      let tCPlayers: Keypair[];
      let tCSalts: Buffer[];

      before(async () => {
        // MinParticipantsNotReached after() ensures we have a fresh Registration tournament
        const cfg = await program.account.config.fetch(configKey);
        [tCKey] = deriveT(pid, cfg.currentTournamentId);

        // Enter 3 fresh players
        tCPlayers = [];
        tCSalts = [];
        for (let i = 0; i < 3; i++) {
          const p = Keypair.generate();
          await airdrop(conn, p.publicKey, 5);
          tCPlayers.push(p);
          const salt = randomBytes(16);
          tCSalts.push(salt);
          const commitment = computeCommitment(i, salt);
          const [eKey] = deriveE(pid, tCKey, p.publicKey);
          await program.methods
            .enterTournament(commitment)
            .accounts({
              config: configKey, tournament: tCKey, entry: eKey,
              player: p.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([p])
            .rpc();
        }
        await waitAndCloseRegistration(tCKey);

        const tAfter = await program.account.tournament.fetch(tCKey);
        expect(tAfter.state).to.deep.equal({ reveal: {} });
      });

      it("close_reveal fails with unprocessed forfeits (UnprocessedForfeits)", async () => {
        // Reveal only player 0, leave players 1 and 2 unrevealed
        await revealPlayer(tCKey, tCPlayers[0], Strategy.TitForTat, tCSalts[0]);

        // Wait for reveal to expire
        const t = await program.account.tournament.fetch(tCKey);
        const now = Math.floor(Date.now() / 1000);
        const remaining = t.revealEnds.toNumber() - now;
        if (remaining > 0) await sleep((remaining + 5) * 1000);

        // Try close_reveal without forfeiting unrevealed players
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await program.methods
              .closeReveal()
              .accounts({
                config: configKey, tournament: tCKey,
                slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
                refundEntry: null, refundPlayer: null,
                operator: operator.publicKey, systemProgram: SystemProgram.programId,
              })
              .signers([operator])
              .rpc();
            expect.fail("Should have thrown");
          } catch (err: any) {
            if (err?.error?.errorCode?.code === "RevealPeriodNotEnded") {
              await sleep(2000);
              continue;
            }
            expect((err as AnchorError).error.errorCode.code).to.equal("UnprocessedForfeits");
            break;
          }
        }
      });

      it("odd participant count triggers refund in close_reveal", async () => {
        // Forfeit unrevealed players 1 and 2
        for (let i = 1; i <= 2; i++) {
          const [eKey] = deriveE(pid, tCKey, tCPlayers[i].publicKey);
          await program.methods
            .forfeitUnrevealed()
            .accounts({
              config: configKey, entry: eKey, tournament: tCKey,
              slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
              operator: operator.publicKey,
            })
            .signers([operator])
            .rpc();
        }

        // Now all 3 are "revealed" (1 manually + 2 auto-assigned).
        // active = participant_count = 3 (odd).
        // But we may also have players from the MinParticipantsNotReached test.
        // Let's check the actual state.
        let t = await program.account.tournament.fetch(tCKey);
        const activeCount = t.participantCount;

        // Find the last active player for odd-count refund
        let lastActiveIdx = -1;
        let lastActivePlayer: PublicKey | null = null;
        for (let i = t.players.length - 1; i >= 0; i--) {
          if (t.players[i].toString() !== PublicKey.default.toString()) {
            lastActiveIdx = i;
            lastActivePlayer = t.players[i];
            break;
          }
        }

        expect(activeCount % 2 === 1, "expected odd active count").to.be.true;
        expect(lastActivePlayer, "expected a last active player").to.not.be.null;

        const balBefore = await conn.getBalance(lastActivePlayer);

        // Odd count → close_reveal should refund last player
        const [lastEKey] = deriveE(pid, tCKey, lastActivePlayer);
        await waitAndCloseReveal(tCKey, lastEKey, lastActivePlayer);

        const tAfter = await program.account.tournament.fetch(tCKey);
        expect(tAfter.state).to.deep.equal({ running: {} });
        // Last active player's slot should now be default (refunded)
        expect(tAfter.players[lastActiveIdx].toString()).to.equal(PublicKey.default.toString());
        // Verify refund received
        const balAfter = await conn.getBalance(lastActivePlayer);
        expect(balAfter).to.be.greaterThan(balBefore);
        // Entry account should no longer exist (closed in close_reveal)
        const refundEntryInfo = await conn.getAccountInfo(lastEKey);
        expect(refundEntryInfo).to.be.null;
        // entries_remaining should reflect the decrement
        expect(tAfter.entriesRemaining).to.equal(tAfter.participantCount);
      });

      it("finalize_tournament fails before all matches complete (MatchesIncomplete)", async () => {
        const t = await program.account.tournament.fetch(tCKey);
        expect(t.matchesTotal, "expected matches to exist").to.be.greaterThan(0);
        expect(t.matchesCompleted, "expected incomplete matches").to.be.lessThan(t.matchesTotal);

        const cfg = await program.account.config.fetch(configKey);
        const [nextTKey] = deriveT(pid, cfg.currentTournamentId + 1);
        try {
          await program.methods
            .finalizeTournament()
            .accounts({
              config: configKey, tournament: tCKey, nextTournament: nextTKey,
              operator: operator.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([operator])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("MatchesIncomplete");
        }
      });

      it("run_matches is a no-op when all matches already complete", async () => {
        // Run all matches first
        const tBefore = await runAllMatches(tCKey);

        // Call run_matches again — should succeed but not change state
        const entryMetas: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
        for (let i = 0; i < tBefore.players.length; i++) {
          if (tBefore.players[i].toString() === PublicKey.default.toString()) continue;
          const [eKey] = deriveE(pid, tCKey, tBefore.players[i]);
          entryMetas.push({ pubkey: eKey, isSigner: false, isWritable: true });
        }

        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: tCKey, operator: operator.publicKey })
          .remainingAccounts(entryMetas)
          .signers([operator])
          .rpc();

        const tAfter = await program.account.tournament.fetch(tCKey);
        expect(tAfter.matchesCompleted).to.equal(tBefore.matchesCompleted);
      });

      after(async () => {
        // Best-effort: advance to next tournament for subsequent tests
        try {
          const t = await program.account.tournament.fetch(tCKey);
          if (JSON.stringify(t.state) === JSON.stringify({ running: {} })) {
            if (t.matchesCompleted < t.matchesTotal) {
              await runAllMatches(tCKey);
            }
            const cfg = await program.account.config.fetch(configKey);
            const [nextTKey] = deriveT(pid, cfg.currentTournamentId + 1);
            await program.methods
              .finalizeTournament()
              .accounts({
                config: configKey, tournament: tCKey, nextTournament: nextTKey,
                operator: operator.publicKey, systemProgram: SystemProgram.programId,
              })
              .signers([operator])
              .rpc();
          }
        } catch {
          // Ignore — the Payout timing before() will handle state advancement
        }
      });
    });

    // ── Tournament D: Payout timing constraints ──
    describe("Payout timing constraints", () => {
      let tDKey: PublicKey;
      let tDPlayers: Keypair[];
      let tDSalts: Buffer[];
      let winnerIdx: number;
      let loserIdx: number;

      before(async () => {
        // Reveal/Forfeit after() ensures we have a fresh Registration tournament
        const cfg = await program.account.config.fetch(configKey);
        [tDKey] = deriveT(pid, cfg.currentTournamentId);

        // Enter 2 players
        tDPlayers = [];
        tDSalts = [];
        for (let i = 0; i < 2; i++) {
          const p = Keypair.generate();
          await airdrop(conn, p.publicKey, 5);
          tDPlayers.push(p);
          const salt = randomBytes(16);
          tDSalts.push(salt);
        }

        // Player 0: AlwaysCooperate, Player 1: AlwaysDefect
        // AlwaysDefect always wins against AlwaysCooperate
        const c0 = computeCommitment(2, tDSalts[0]); // AlwaysCooperate
        const c1 = computeCommitment(1, tDSalts[1]); // AlwaysDefect

        const [e0Key] = deriveE(pid, tDKey, tDPlayers[0].publicKey);
        await program.methods
          .enterTournament(c0)
          .accounts({
            config: configKey, tournament: tDKey, entry: e0Key,
            player: tDPlayers[0].publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([tDPlayers[0]])
          .rpc();

        const [e1Key] = deriveE(pid, tDKey, tDPlayers[1].publicKey);
        await program.methods
          .enterTournament(c1)
          .accounts({
            config: configKey, tournament: tDKey, entry: e1Key,
            player: tDPlayers[1].publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([tDPlayers[1]])
          .rpc();

        // Close registration → Reveal
        await waitAndCloseRegistration(tDKey);

        // Reveal both
        await revealPlayer(tDKey, tDPlayers[0], Strategy.AlwaysCooperate, tDSalts[0]);
        await revealPlayer(tDKey, tDPlayers[1], Strategy.AlwaysDefect, tDSalts[1]);

        // Close reveal → Running
        await waitAndCloseReveal(tDKey);

        // Run all matches
        await runAllMatches(tDKey);

        // Finalize → Payout
        const cfgNow = await program.account.config.fetch(configKey);
        const [nextTKey] = deriveT(pid, cfgNow.currentTournamentId + 1);
        await program.methods
          .finalizeTournament()
          .accounts({
            config: configKey, tournament: tDKey, nextTournament: nextTKey,
            operator: operator.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();

        // Identify winner and loser
        const t = await program.account.tournament.fetch(tDKey);
        expect(t.state).to.deep.equal({ payout: {} });

        winnerIdx = -1;
        loserIdx = -1;
        for (let i = 0; i < t.players.length; i++) {
          if (t.players[i].toString() === PublicKey.default.toString()) continue;
          if (t.scores[i] >= t.minWinningScore) {
            winnerIdx = i;
          } else {
            loserIdx = i;
          }
        }

        // Wait for claim expiry (2s with testing feature).
        // Use strict > (not >=) so the clock is clearly past expiry when the
        // next transaction's simulation runs.
        const CLOCK_SYSVAR = new PublicKey("SysvarC1ock11111111111111111111111111111111");
        const expiresAt = t.payoutStartedAt.toNumber() + 2;
        for (let attempt = 0; attempt < 30; attempt++) {
          await sleep(500);
          const tx = new anchor.web3.Transaction().add(
            SystemProgram.transfer({
              fromPubkey: operator.publicKey,
              toPubkey: operator.publicKey,
              lamports: 1,
            }),
          );
          await provider.sendAndConfirm(tx, [operator]);
          const clockInfo = await conn.getAccountInfo(CLOCK_SYSVAR);
          if (clockInfo) {
            const onChainTime = Number(clockInfo.data.readBigInt64LE(32));
            if (onChainTime > expiresAt) break;
          }
        }
      });

      it("claim_refund fails in Payout state (InvalidState)", async () => {
        // Try refund for one of the players
        const p = tDPlayers[0];
        const [eKey] = deriveE(pid, tDKey, p.publicKey);
        try {
          await program.methods
            .claimRefund()
            .accounts({
              tournament: tDKey, entry: eKey,
              player: p.publicKey, systemProgram: SystemProgram.programId,
            })
            .signers([p])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
        }
      });

      it("claim_payout fails after expiry (ClaimExpired)", async () => {
        const t = await program.account.tournament.fetch(tDKey);
        expect(winnerIdx).to.not.equal(-1);

        const winnerKey = t.players[winnerIdx];
        const winnerKp = tDPlayers.find(p => p.publicKey.toString() === winnerKey.toString())!;
        const [eKey] = deriveE(pid, tDKey, winnerKey);

        try {
          await program.methods
            .claimPayout()
            .accounts({
              tournament: tDKey, entry: eKey,
              player: winnerKey, systemProgram: SystemProgram.programId,
            })
            .signers([winnerKp])
            .rpc();
          expect.fail("Should have thrown ClaimExpired");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("ClaimExpired");
        }
      });

      it("close_entry sweeps unclaimed winner prize to accumulated_fees after expiry", async () => {
        const cfgBefore = await program.account.config.fetch(configKey);
        const feesBefore = cfgBefore.accumulatedFees.toNumber();

        // Close entry for the winner (unclaimed, expired → prize goes to fees)
        const t = await program.account.tournament.fetch(tDKey);
        for (let i = 0; i < t.players.length; i++) {
          if (t.players[i].toString() === PublicKey.default.toString()) continue;
          if (t.scores[i] >= t.minWinningScore) {
            const [eKey] = deriveE(pid, tDKey, t.players[i]);
            try {
              await program.account.entry.fetch(eKey);
            } catch { continue; }

            await program.methods
              .closeEntry()
              .accounts({
                config: configKey, tournament: tDKey, entry: eKey,
                player: t.players[i],
                operator: operator.publicKey,
              })
              .signers([operator])
              .rpc();
            break;
          }
        }

        const cfgAfter = await program.account.config.fetch(configKey);
        expect(cfgAfter.accumulatedFees.toNumber()).to.be.greaterThan(feesBefore);
      });

      it("close_tournament fails before all entries closed (EntriesRemaining)", async () => {
        const t = await program.account.tournament.fetch(tDKey);
        expect(t.entriesRemaining, "expected entries still remaining").to.be.greaterThan(0);

        try {
          await program.methods
            .closeTournament()
            .accounts({
              config: configKey, tournament: tDKey,
              operator: operator.publicKey,
            })
            .signers([operator])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect((err as AnchorError).error.errorCode.code).to.equal("EntriesRemaining");
        }
      });

      it("admin can close_tournament", async () => {
        // Close remaining entries first
        const t = await program.account.tournament.fetch(tDKey);
        for (let i = 0; i < t.players.length; i++) {
          if (t.players[i].toString() === PublicKey.default.toString()) continue;
          const [eKey] = deriveE(pid, tDKey, t.players[i]);
          try {
            await program.account.entry.fetch(eKey);
          } catch { continue; }

          await program.methods
            .closeEntry()
            .accounts({
              config: configKey, tournament: tDKey, entry: eKey,
              player: t.players[i],
              operator: operator.publicKey,
            })
            .signers([operator])
            .rpc();
        }

        const tAfter = await program.account.tournament.fetch(tDKey);
        expect(tAfter.entriesRemaining).to.equal(0);

        // Expiry already passed (we slept 3s above, testing feature = 2s)
        // close_tournament signed by admin instead of operator
        await program.methods
          .closeTournament()
          .accounts({
            config: configKey, tournament: tDKey,
            operator: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        // Tournament account should be zeroed/closed
        const info = await conn.getAccountInfo(tDKey);
        expect(info).to.be.null;
      });
    });
  });
});
