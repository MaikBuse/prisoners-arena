/**
 * Dilemma Arena Integration Tests
 * 
 * Requirements:
 * - solana-test-validator with AVX CPU support
 * - Run: anchor test
 * 
 * For environments without AVX (cloud VMs, some containers):
 * - Use devnet testing instead
 * - Or use litesvm/solana-program-test for Rust-based tests
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";

// Strategy constants matching the contract
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

describe("dilemma-arena", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DilemmaArena as Program;
  
  // Test accounts
  const admin = Keypair.generate();
  const operator = Keypair.generate();
  const players: Keypair[] = [];
  
  // PDAs
  let configPda: PublicKey;
  let configBump: number;
  let tournamentPda: PublicKey;
  let tournamentBump: number;

  // Test parameters
  const stake = new BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
  const minParticipants = 2;
  const maxParticipants = 100;
  const registrationDuration = new BN(3600); // 1 hour
  const matchesPerPlayer = 6;

  before(async () => {
    // Derive PDAs
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    
    [tournamentPda, tournamentBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament"), Buffer.from([0, 0, 0, 0])], // Tournament #0
      program.programId
    );

    // Fund admin and operator
    const sig1 = await provider.connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL);
    const sig2 = await provider.connection.requestAirdrop(operator.publicKey, 10 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig1);
    await provider.connection.confirmTransaction(sig2);

    // Create player accounts
    for (let i = 0; i < 10; i++) {
      const player = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(player.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
      players.push(player);
    }
  });

  describe("Admin Instructions", () => {
    it("initializes config and Tournament #0", async () => {
      await program.methods
        .initializeConfig(
          operator.publicKey,
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
        .signers([admin])
        .rpc();

      // Verify config
      const config = await program.account.config.fetch(configPda);
      expect(config.admin.toString()).to.equal(admin.publicKey.toString());
      expect(config.operator.toString()).to.equal(operator.publicKey.toString());
      expect(config.stake.toNumber()).to.equal(stake.toNumber());
      expect(config.minParticipants).to.equal(minParticipants);
      expect(config.maxParticipants).to.equal(maxParticipants);
      expect(config.matchesPerPlayer).to.equal(matchesPerPlayer);
      expect(config.currentTournamentId).to.equal(0);
      expect(config.houseFeeBps).to.equal(0);

      // Verify tournament #0
      const tournament = await program.account.tournament.fetch(tournamentPda);
      expect(tournament.id).to.equal(0);
      expect(tournament.state).to.deep.equal({ registration: {} });
      expect(tournament.stake.toNumber()).to.equal(stake.toNumber());
      expect(tournament.participantCount).to.equal(0);
    });

    it("fails with odd min_participants", async () => {
      const badAdmin = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(badAdmin.publicKey, 1 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);

      // This would try to create a new config which isn't possible since it already exists
      // So we test update_config with odd value instead
      try {
        await program.methods
          .updateConfig(null, null, null, 3, null, null, null) // odd min_participants
          .accounts({
            config: configPda,
            admin: admin.publicKey,
          })
          .signers([admin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidMinParticipants");
      }
    });

    it("updates config (admin only)", async () => {
      const newHouseFee = 250; // 2.5%
      
      await program.methods
        .updateConfig(null, newHouseFee, null, null, null, null, null)
        .accounts({
          config: configPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPda);
      expect(config.houseFeeBps).to.equal(newHouseFee);
    });

    it("fails update_config from non-admin", async () => {
      try {
        await program.methods
          .updateConfig(null, 500, null, null, null, null, null)
          .accounts({
            config: configPda,
            admin: operator.publicKey, // operator is not admin
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  describe("Player Instructions", () => {
    it("player enters tournament", async () => {
      const player = players[0];
      
      const [entryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
        program.programId
      );

      const balanceBefore = await provider.connection.getBalance(player.publicKey);

      await program.methods
        .enterTournament(Strategy.TitForTat)
        .accounts({
          config: configPda,
          tournament: tournamentPda,
          entry: entryPda,
          player: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      // Verify entry
      const entry = await program.account.entry.fetch(entryPda);
      expect(entry.player.toString()).to.equal(player.publicKey.toString());
      expect(entry.index).to.equal(0);
      expect(entry.strategy).to.deep.equal({ titForTat: {} });
      expect(entry.score).to.equal(0);
      expect(entry.paidOut).to.equal(false);

      // Verify tournament updated
      const tournament = await program.account.tournament.fetch(tournamentPda);
      expect(tournament.participantCount).to.equal(1);
      expect(tournament.pool.toNumber()).to.equal(stake.toNumber());

      // Verify stake transferred
      const balanceAfter = await provider.connection.getBalance(player.publicKey);
      expect(balanceBefore - balanceAfter).to.be.greaterThan(stake.toNumber() - 10000); // Allow for rent
    });

    it("second player enters with different strategy", async () => {
      const player = players[1];
      
      const [entryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .enterTournament(Strategy.AlwaysDefect)
        .accounts({
          config: configPda,
          tournament: tournamentPda,
          entry: entryPda,
          player: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      const entry = await program.account.entry.fetch(entryPda);
      expect(entry.index).to.equal(1);
      expect(entry.strategy).to.deep.equal({ alwaysDefect: {} });

      const tournament = await program.account.tournament.fetch(tournamentPda);
      expect(tournament.participantCount).to.equal(2);
    });

    it("fails duplicate entry", async () => {
      const player = players[0];
      
      const [entryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .enterTournament(Strategy.Random)
          .accounts({
            config: configPda,
            tournament: tournamentPda,
            entry: entryPda,
            player: player.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        // Entry already exists, so init will fail
        expect(err).to.exist;
      }
    });

    it("player claims refund during registration", async () => {
      const player = players[1];
      
      const [entryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
        program.programId
      );

      const balanceBefore = await provider.connection.getBalance(player.publicKey);
      const tournamentBefore = await program.account.tournament.fetch(tournamentPda);

      await program.methods
        .claimRefund()
        .accounts({
          tournament: tournamentPda,
          entry: entryPda,
          player: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      // Verify refund received
      const balanceAfter = await provider.connection.getBalance(player.publicKey);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);

      // Verify tournament updated
      const tournament = await program.account.tournament.fetch(tournamentPda);
      expect(tournament.participantCount).to.equal(tournamentBefore.participantCount - 1);
      
      // Entry should be closed
      try {
        await program.account.entry.fetch(entryPda);
        expect.fail("Entry should be closed");
      } catch {
        // Expected
      }
    });

    it("re-enter after refund with different strategy", async () => {
      const player = players[1];
      
      const [entryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .enterTournament(Strategy.GrimTrigger)
        .accounts({
          config: configPda,
          tournament: tournamentPda,
          entry: entryPda,
          player: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      const entry = await program.account.entry.fetch(entryPda);
      expect(entry.strategy).to.deep.equal({ grimTrigger: {} });
    });
  });

  describe("Tournament Lifecycle", () => {
    // Add more players for a proper tournament
    before(async () => {
      for (let i = 2; i < 6; i++) {
        const player = players[i];
        const [entryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
          program.programId
        );

        const strategies = [
          Strategy.AlwaysCooperate,
          Strategy.Pavlov,
          Strategy.TitForTwoTats,
          Strategy.Gradual,
        ];

        await program.methods
          .enterTournament(strategies[i - 2])
          .accounts({
            config: configPda,
            tournament: tournamentPda,
            entry: entryPda,
            player: player.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();
      }
    });

    it("fails close_registration before deadline", async () => {
      try {
        await program.methods
          .closeRegistration()
          .accounts({
            config: configPda,
            tournament: tournamentPda,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            refundEntry: null,
            refundPlayer: null,
            operator: operator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([operator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("RegistrationOpen");
      }
    });

    // Note: Further lifecycle tests would require time manipulation
    // which isn't straightforward in localnet. In a real test environment,
    // you would either:
    // 1. Use a custom test validator with time warping
    // 2. Set very short registration_duration for testing
    // 3. Use bankrun for more control
  });

  describe("Error Conditions", () => {
    it("unauthorized operator fails", async () => {
      const fakeOperator = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(fakeOperator.publicKey, 1 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .closeRegistration()
          .accounts({
            config: configPda,
            tournament: tournamentPda,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            refundEntry: null,
            refundPlayer: null,
            operator: fakeOperator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([fakeOperator])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("claim_payout fails in Registration state", async () => {
      const player = players[0];
      const [entryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), tournamentPda.toBuffer(), player.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .claimPayout()
          .accounts({
            tournament: tournamentPda,
            entry: entryPda,
            player: player.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as AnchorError).error.errorCode.code).to.equal("InvalidState");
      }
    });
  });

  describe("Fee Withdrawal", () => {
    it("fails withdraw with no fees", async () => {
      try {
        await program.methods
          .withdrawFees()
          .accounts({
            config: configPda,
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
  });
});
