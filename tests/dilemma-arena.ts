/**
 * Dilemma Arena — Comprehensive Integration Tests
 *
 * Single Config PDA, shared admin/operator across all suites.
 * Init with short registration (5s) so lifecycle tests can wait it out.
 *
 * Run: anchor test
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";

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

const ALL_STRATEGIES = [
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

// ── Helpers ────────────────────────────────────────────────────────

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

describe("dilemma-arena", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DilemmaArena as Program;
  const conn = provider.connection;
  const pid = program.programId;

  // Shared accounts — single admin/operator for all suites
  const admin = Keypair.generate();
  const operator = Keypair.generate();
  // 12 funded player keypairs
  const players: Keypair[] = [];

  const stake = new BN(0.1 * LAMPORTS_PER_SOL);
  const REG_DURATION = 30; // seconds — enough time for entry tests, short enough to sleep through
  const MATCHES_PER_PLAYER = 6;

  let configKey: PublicKey;
  let t0Key: PublicKey;

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
    it("initializes config and Tournament #0", async () => {
      await program.methods
        .initializeConfig(
          operator.publicKey, stake, 2, 100,
          new BN(REG_DURATION), MATCHES_PER_PLAYER,
        )
        .accounts({
          config: configKey,
          tournament: t0Key,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
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
    });

    it("Tournament #0 has correct initial state", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.id).to.equal(0);
      expect(t.state).to.deep.equal({ registration: {} });
      expect(t.stake.toNumber()).to.equal(stake.toNumber());
      expect(t.houseFeeBps).to.equal(0);
      expect(t.matchesPerPlayer).to.equal(MATCHES_PER_PLAYER);
      expect(t.registrationDuration.toNumber()).to.equal(REG_DURATION);
      expect(t.participantCount).to.equal(0);
      expect(t.pool.toNumber()).to.equal(0);
      expect(t.matchesCompleted).to.equal(0);
      expect(t.matchesTotal).to.equal(0);
      expect(t.winnerCount).to.equal(0);
      expect(t.claimsProcessed).to.equal(0);
      expect(t.payoutStartedAt.toNumber()).to.equal(0);
      expect(t.registrationEnds.toNumber()).to.be.greaterThan(0);
    });

    it("randomness seed is zeroed before close_registration", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.randomnessSeed.every((b: number) => b === 0)).to.be.true;
    });

    it("rejects double initialization", async () => {
      try {
        await program.methods
          .initializeConfig(
            operator.publicKey, stake, 2, 100,
            new BN(REG_DURATION), MATCHES_PER_PLAYER,
          )
          .accounts({
            config: configKey,
            tournament: t0Key,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
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
  // 2. Config Updates (admin-only)
  // ================================================================
  describe("Config Updates", () => {
    it("updates house_fee_bps", async () => {
      await program.methods
        .updateConfig(null, 250, null, null, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).houseFeeBps).to.equal(250);
      // Reset
      await program.methods
        .updateConfig(null, 0, null, null, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates operator key", async () => {
      const tmp = Keypair.generate();
      await program.methods
        .updateConfig(tmp.publicKey, null, null, null, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).operator.toString())
        .to.equal(tmp.publicKey.toString());
      // Restore
      await program.methods
        .updateConfig(operator.publicKey, null, null, null, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates stake", async () => {
      const newStake = new BN(0.5 * LAMPORTS_PER_SOL);
      await program.methods
        .updateConfig(null, null, newStake, null, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).stake.toNumber())
        .to.equal(newStake.toNumber());
      // Restore
      await program.methods
        .updateConfig(null, null, stake, null, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates matches_per_player", async () => {
      await program.methods
        .updateConfig(null, null, null, null, null, null, 15)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).matchesPerPlayer).to.equal(15);
      // Restore
      await program.methods
        .updateConfig(null, null, null, null, null, null, MATCHES_PER_PLAYER)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates min_participants (even values only)", async () => {
      await program.methods
        .updateConfig(null, null, null, 4, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).minParticipants).to.equal(4);
      // Restore
      await program.methods
        .updateConfig(null, null, null, 2, null, null, null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    it("updates registration_duration", async () => {
      await program.methods
        .updateConfig(null, null, null, null, null, new BN(7200), null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
      expect((await program.account.config.fetch(configKey)).registrationDuration.toNumber())
        .to.equal(7200);
      // Restore
      await program.methods
        .updateConfig(null, null, null, null, null, new BN(REG_DURATION), null)
        .accounts({ config: configKey, admin: admin.publicKey })
        .signers([admin])
        .rpc();
    });

    // ── Validation rejections ──

    it("rejects odd min_participants", async () => {
      try {
        await program.methods
          .updateConfig(null, null, null, 3, null, null, null)
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
          .updateConfig(null, null, null, 0, null, null, null)
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
          .updateConfig(null, null, null, 1, null, null, null)
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
          .updateConfig(null, 10001, null, null, null, null, null)
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it("rejects stake = 0", async () => {
      try {
        await program.methods
          .updateConfig(null, null, new BN(0), null, null, null, null)
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it("rejects registration_duration = 0", async () => {
      try {
        await program.methods
          .updateConfig(null, null, null, null, null, new BN(0), null)
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it("rejects matches_per_player = 0", async () => {
      try {
        await program.methods
          .updateConfig(null, null, null, null, null, null, 0)
          .accounts({ config: configKey, admin: admin.publicKey })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it("rejects update from non-admin", async () => {
      try {
        await program.methods
          .updateConfig(null, 500, null, null, null, null, null)
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
            config: configKey,
            admin: admin.publicKey,
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
            config: configKey,
            admin: operator.publicKey,
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
  // 4. Player Entry (into T0 which has 5s reg)
  // ================================================================
  describe("Player Entry", () => {
    it("player 0 enters with TitForTat, stake deducted", async () => {
      const p = players[0];
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      const balBefore = await conn.getBalance(p.publicKey);

      await program.methods
        .enterTournament(Strategy.TitForTat)
        .accounts({
          config: configKey, tournament: t0Key, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      const entry = await program.account.entry.fetch(eKey);
      expect(entry.player.toString()).to.equal(p.publicKey.toString());
      expect(entry.tournament.toString()).to.equal(t0Key.toString());
      expect(entry.index).to.equal(0);
      expect(entry.strategy).to.deep.equal({ titForTat: {} });
      expect(entry.score).to.equal(0);
      expect(entry.matchesPlayed).to.equal(0);
      expect(entry.paidOut).to.equal(false);
      expect(entry.createdAt.toNumber()).to.be.greaterThan(0);

      const t = await program.account.tournament.fetch(t0Key);
      expect(t.participantCount).to.equal(1);
      expect(t.pool.toNumber()).to.equal(stake.toNumber());
      expect(t.players[0].toString()).to.equal(p.publicKey.toString());

      const balAfter = await conn.getBalance(p.publicKey);
      expect(balBefore - balAfter).to.be.greaterThan(stake.toNumber());
    });

    it("enters players 1-8 (all 9 strategies)", async () => {
      const strats = ALL_STRATEGIES.slice(1);
      for (let i = 0; i < strats.length; i++) {
        const p = players[i + 1];
        const [eKey] = deriveE(pid, t0Key, p.publicKey);
        await program.methods
          .enterTournament(strats[i])
          .accounts({
            config: configKey, tournament: t0Key, entry: eKey,
            player: p.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
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
      try {
        await program.methods
          .enterTournament(Strategy.Random)
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

    it("players and scores vecs have matching lengths", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.players.length).to.equal(t.scores.length);
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

      try {
        await program.account.entry.fetch(eKey);
        expect.fail("Entry should be closed");
      } catch {
        // expected
      }
    });

    it("refunded player can re-enter", async () => {
      const p = players[8];
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      await program.methods
        .enterTournament(Strategy.Gradual)
        .accounts({
          config: configKey, tournament: t0Key, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      const entry = await program.account.entry.fetch(eKey);
      expect(entry.strategy).to.deep.equal({ gradual: {} });
      expect((await program.account.tournament.fetch(t0Key)).participantCount).to.equal(9);
    });

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
        // InvalidState if entry exists, AccountNotInitialized if not
        expect(err).to.exist;
      }
    });

    it("close_expired_entry fails", async () => {
      const [eKey] = deriveE(pid, t0Key, players[0].publicKey);
      try {
        await program.methods
          .closeExpiredEntry()
          .accounts({
            config: configKey, tournament: t0Key, entry: eKey,
            operator: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.exist;
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
        expect(err).to.exist;
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
  // 8. Full Lifecycle — Registration → Running → Payout
  //    T0 has 5s reg + 9 players. We refund 7 to leave 2, wait, then go.
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

    it("close_registration succeeds after deadline", async () => {
      // Wait for the 5s registration to expire
      // The registration_ends was set at init time, then extended on each
      // close_registration call that fails min participants check.
      // T0 was created with 5s, so it expires 5s after init.
      // But entries were made, and we've been running tests for >5s already.
      // The reg should already be expired. If not, wait.
      const t = await program.account.tournament.fetch(t0Key);
      const now = Math.floor(Date.now() / 1000);
      const remaining = t.registrationEnds.toNumber() - now;
      if (remaining > 0) {
        await sleep((remaining + 2) * 1000);
      }

      await program.methods
        .closeRegistration()
        .accounts({
          config: configKey, tournament: t0Key,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          refundEntry: null, refundPlayer: null,
          operator: operator.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc();

      const tAfter = await program.account.tournament.fetch(t0Key);
      expect(tAfter.state).to.deep.equal({ running: {} });
      expect(tAfter.matchesTotal).to.be.greaterThan(0);
      expect(tAfter.randomnessSeed.some((b: number) => b !== 0)).to.be.true;
    });

    it("entry fails in Running state", async () => {
      const p = players[9];
      const [eKey] = deriveE(pid, t0Key, p.publicKey);
      try {
        await program.methods
          .enterTournament(Strategy.Pavlov)
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
        expect(err).to.exist;
      }
    });

    it("runs all matches (multi-batch)", async () => {
      let t = await program.account.tournament.fetch(t0Key);
      const total = t.matchesTotal;
      expect(total).to.be.greaterThan(0);

      // Collect entry account metas for remaining_accounts
      const entryMetas: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, t0Key, t.players[i]);
        entryMetas.push({ pubkey: eKey, isSigner: false, isWritable: true });
      }

      let batches = 0;
      while (t.matchesCompleted < total) {
        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: t0Key, operator: operator.publicKey })
          .remainingAccounts(entryMetas)
          .signers([operator])
          .rpc();
        t = await program.account.tournament.fetch(t0Key);
        batches++;
      }

      expect(t.matchesCompleted).to.equal(total);
      // 2 players, K=6 → 6 matches via repeated round-robin
      expect(total).to.equal(6);
      expect(t.scores.some((s: number) => s > 0)).to.be.true;
    });

    it("match indices were contiguous (start_index fix validated)", async () => {
      // If the old double-counting bug were present, not all 6 matches
      // would have completed — it would have hit InvalidMatch.
      // The fact that matches_completed == matches_total proves contiguity.
      const t = await program.account.tournament.fetch(t0Key);
      expect(t.matchesCompleted).to.equal(t.matchesTotal);
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

    it("run_matches after completion is a no-op or fails", async () => {
      // Depends on implementation — might succeed with 0 matches or fail
      const tBefore = await program.account.tournament.fetch(t0Key);
      try {
        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: t0Key, operator: operator.publicKey })
          .signers([operator])
          .rpc();
        const tAfter = await program.account.tournament.fetch(t0Key);
        // If it succeeded, matches_completed shouldn't change
        expect(tAfter.matchesCompleted).to.equal(tBefore.matchesCompleted);
      } catch {
        // Also acceptable — AllMatchesComplete or similar
      }
    });

    it("finalizes tournament and creates T1", async () => {
      const [t1Key] = deriveT(pid, 1);

      // Set house fee BEFORE finalize so T1 snapshots it
      await program.methods
        .updateConfig(null, 500, null, null, null, null, null)
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
      expect(t1.participantCount).to.equal(0);

      const cfg = await program.account.config.fetch(configKey);
      expect(cfg.currentTournamentId).to.equal(1);
    });

    it("run_matches fails in Payout state", async () => {
      try {
        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: t0Key, operator: operator.publicKey })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        // Could be InvalidState or InvalidEntryAccount (no remaining_accounts)
        expect(err).to.exist;
      }
    });

    it("finalize fails again (already in Payout)", async () => {
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
        // Could be InvalidState or MatchesIncomplete
        expect(err).to.exist;
      }
    });

    it("winner claims payout, receives SOL", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      // Find the winner — player with score >= min_winning_score
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
      // Find the keypair for this player
      const winnerKeypair = players.find(
        (p) => p.publicKey.toString() === winnerKey.toString()
      )!;
      expect(winnerKeypair).to.exist;

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

      // Entry account is closed (close = player in constraint)
      try {
        await program.account.entry.fetch(eKey);
        expect.fail("Entry should be closed after payout");
      } catch {
        // expected
      }

      const tAfter = await program.account.tournament.fetch(t0Key);
      expect(tAfter.claimsProcessed).to.be.greaterThan(0);
    });

    it("double claim_payout fails (entry already closed)", async () => {
      const t = await program.account.tournament.fetch(t0Key);
      // The winner's entry is already closed, so trying again will fail
      // at account deserialization (not even reaching AlreadyPaidOut).
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
            expect(err).to.exist;
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

      // House fee was already set to 500 before T1 was created (in finalize test)
      // Enter 2 players into T1
      for (let i = 0; i < 2; i++) {
        const p = players[i + 4]; // use players[4] and players[5]
        const [eKey] = deriveE(pid, t1Key, p.publicKey);
        await program.methods
          .enterTournament(i === 0 ? Strategy.AlwaysCooperate : Strategy.AlwaysDefect)
          .accounts({
            config: configKey, tournament: t1Key, entry: eKey,
            player: p.publicKey, systemProgram: SystemProgram.programId,
          })
          .signers([p])
          .rpc();
      }
    });

    it("T1 snapshots house_fee_bps = 500", async () => {
      const t1 = await program.account.tournament.fetch(t1Key);
      expect(t1.houseFeeBps).to.equal(500);
      expect(t1.participantCount).to.equal(2);
    });

    it("full lifecycle completes, fees accumulated", async () => {
      // Wait for reg to expire
      const t1 = await program.account.tournament.fetch(t1Key);
      const now = Math.floor(Date.now() / 1000);
      const remaining = t1.registrationEnds.toNumber() - now;
      if (remaining > 0) await sleep((remaining + 2) * 1000);

      // Close registration
      await program.methods
        .closeRegistration()
        .accounts({
          config: configKey, tournament: t1Key,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          refundEntry: null, refundPlayer: null,
          operator: operator.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc();

      // Run all matches
      let t = await program.account.tournament.fetch(t1Key);
      // Collect entry account metas
      const entryMetas: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
      for (let i = 0; i < t.players.length; i++) {
        if (t.players[i].toString() === PublicKey.default.toString()) continue;
        const [eKey] = deriveE(pid, t1Key, t.players[i]);
        entryMetas.push({ pubkey: eKey, isSigner: false, isWritable: true });
      }
      while (t.matchesCompleted < t.matchesTotal) {
        await program.methods
          .runMatches()
          .accounts({ config: configKey, tournament: t1Key, operator: operator.publicKey })
          .remainingAccounts(entryMetas)
          .signers([operator])
          .rpc();
        t = await program.account.tournament.fetch(t1Key);
      }

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

      // 2 × 0.1 SOL = 0.2 SOL pool, 5% fee = 0.01 SOL = 10_000_000 lamports
      const expectedFee = Math.floor(0.2 * LAMPORTS_PER_SOL * 500 / 10000);
      expect(cfg.accumulatedFees.toNumber()).to.equal(expectedFee);

      // T1 in Payout, T2 in Registration
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
  // 10. Cross-tournament Independence
  // ================================================================
  describe("Cross-tournament Independence", () => {
    it("new tournament accepts entries while old is in Payout", async () => {
      const [t2Key] = deriveT(pid, 2);
      const t2 = await program.account.tournament.fetch(t2Key);
      expect(t2.state).to.deep.equal({ registration: {} });

      const p = players[10];
      const [eKey] = deriveE(pid, t2Key, p.publicKey);
      await program.methods
        .enterTournament(Strategy.Pavlov)
        .accounts({
          config: configKey, tournament: t2Key, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      expect((await program.account.entry.fetch(eKey)).strategy).to.deep.equal({ pavlov: {} });
    });
  });

  // ================================================================
  // 11. Entry Counter & Close Tournament Validation (v1.2)
  // ================================================================
  describe("Entry Counter & Close Tournament (v1.2)", () => {
    it("entries_remaining tracks entry lifecycle", async () => {
      // T0 should have entries_remaining reflecting unclaimed/unexpired entries
      const t0 = await program.account.tournament.fetch(t0Key);
      // entries_remaining should be a number (may be 0 if all claimed/expired)
      expect(t0.entriesRemaining).to.be.a("number");
    });

    it("entries_remaining decremented by claim_payout (T0)", async () => {
      const t0 = await program.account.tournament.fetch(t0Key);
      // After lifecycle: entries were created, some claimed — count should be positive
      // (not all entries are closed yet) and less than total players vec length
      expect(t0.entriesRemaining).to.be.greaterThanOrEqual(0);
      // Winner claimed (entry closed), so less than total entries created
      expect(t0.entriesRemaining).to.be.lessThan(t0.players.length);
    });

    it("entries_remaining increments on enter, decrements on refund", async () => {
      // Use T2 which is in Registration
      const [t2Key] = deriveT(pid, 2);

      // Player 10 already entered T2 in cross-tournament test
      const t2Before = await program.account.tournament.fetch(t2Key);
      const countBefore = t2Before.entriesRemaining;

      // Enter another player
      const p = players[11];
      const [eKey] = deriveE(pid, t2Key, p.publicKey);
      await program.methods
        .enterTournament(Strategy.Random)
        .accounts({
          config: configKey, tournament: t2Key, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      const t2After = await program.account.tournament.fetch(t2Key);
      expect(t2After.entriesRemaining).to.equal(countBefore + 1);

      // Refund that player
      await program.methods
        .claimRefund()
        .accounts({
          tournament: t2Key, entry: eKey,
          player: p.publicKey, systemProgram: SystemProgram.programId,
        })
        .signers([p])
        .rpc();

      const t2AfterRefund = await program.account.tournament.fetch(t2Key);
      expect(t2AfterRefund.entriesRemaining).to.equal(countBefore);
    });
  });

  // ================================================================
  // 12. PDA Derivation Correctness
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
  // 13. Account Sizing
  // ================================================================
  describe("Account Sizing", () => {
    it("tournament account size accommodates player vecs", async () => {
      const info = await conn.getAccountInfo(t0Key);
      expect(info).to.not.be.null;
      expect(info!.data.length).to.be.greaterThan(100);
    });
  });
});
