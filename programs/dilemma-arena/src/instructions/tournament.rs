//! Tournament lifecycle instructions

use anchor_lang::prelude::*;
use crate::state::{Config, Tournament, Entry, TournamentState, CLAIM_EXPIRY_SECONDS, TOURNAMENT_CLOSURE_SECONDS, MATCHES_PER_TX};
use crate::error::DilemmaError;

/// Close registration and start matches (or extend deadline)
#[derive(Accounts)]
pub struct CloseRegistration<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = operator @ DilemmaError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,
    
    /// CHECK: SlotHashes sysvar for randomness
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,

    /// Optional: Entry to refund if odd participant count
    /// Only needed when participant_count is odd
    pub refund_entry: Option<Account<'info, Entry>>,

    /// Player to receive refund if odd count
    /// CHECK: Validated via refund_entry.player
    #[account(mut)]
    pub refund_player: Option<AccountInfo<'info>>,

    pub operator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn close_registration(ctx: Context<CloseRegistration>) -> Result<()> {
    let config = &ctx.accounts.config;
    let tournament = &mut ctx.accounts.tournament;
    let clock = Clock::get()?;

    require!(
        tournament.state == TournamentState::Registration,
        DilemmaError::InvalidState
    );

    require!(
        clock.unix_timestamp >= tournament.registration_ends,
        DilemmaError::RegistrationOpen
    );

    // Check if minimum participants reached
    if tournament.participant_count < config.min_participants as u32 {
        // Extend registration deadline using snapshotted duration (never cancel)
        tournament.registration_ends = clock.unix_timestamp + tournament.registration_duration;
        msg!(
            "Tournament {} extended: only {} participants, need {}. New deadline: {}",
            tournament.id,
            tournament.participant_count,
            config.min_participants,
            tournament.registration_ends
        );
        return Ok(());
    }

    // If odd participant count, refund the last registrant
    if tournament.participant_count % 2 == 1 {
        // Find the last valid (non-refunded) player
        let last_index = tournament.players.iter()
            .rposition(|pk| *pk != Pubkey::default())
            .ok_or(DilemmaError::InvalidState)?;
        
        let last_player = tournament.players[last_index];
        
        // Verify refund_entry and refund_player are provided and match
        let refund_entry = ctx.accounts.refund_entry.as_ref()
            .ok_or(DilemmaError::InvalidEntryAccount)?;
        let refund_player = ctx.accounts.refund_player.as_ref()
            .ok_or(DilemmaError::InvalidEntryAccount)?;
        
        require!(
            refund_entry.player == last_player && refund_player.key() == last_player,
            DilemmaError::InvalidEntryAccount
        );
        require!(
            refund_entry.index == last_index as u32,
            DilemmaError::InvalidEntryAccount
        );

        // Process refund
        let refund_amount = tournament.stake;
        **tournament.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
        **refund_player.try_borrow_mut_lamports()? += refund_amount;

        tournament.players[last_index] = Pubkey::default();
        tournament.participant_count -= 1;
        tournament.pool -= refund_amount;

        msg!("Refunded last player {} to ensure even participant count", last_player);
    }

    // Generate randomness seed from slot hash
    // SlotHashes layout: 8-byte vec len + (8-byte slot + 32-byte hash) pairs
    // Skip 8 (vec len) + 8 (first slot number) = 16 to reach first hash
    let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;
    let mut seed = [0u8; 32];
    require!(slot_hashes_data.len() >= 48, DilemmaError::SlotHashUnavailable);
    seed.copy_from_slice(&slot_hashes_data[16..48]);
    
    // Mix in tournament-specific data
    let tournament_bytes = tournament.id.to_le_bytes();
    for (i, b) in tournament_bytes.iter().enumerate() {
        seed[i] ^= b;
    }
    tournament.randomness_seed = seed;

    // Calculate total matches using match-logic crate
    tournament.matches_total = match_logic::calculate_match_count(
        tournament.participant_count,
        tournament.matches_per_player,
        &tournament.randomness_seed,
    );

    tournament.state = TournamentState::Running;

    msg!(
        "Tournament {} started with {} participants, {} matches",
        tournament.id,
        tournament.participant_count,
        tournament.matches_total
    );

    Ok(())
}

/// Run a batch of matches (up to 5 per transaction)
#[derive(Accounts)]
pub struct RunMatches<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = operator @ DilemmaError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    pub operator: Signer<'info>,
    // Entry accounts passed via remaining_accounts
}

pub fn run_matches<'info>(
    ctx: Context<'_, '_, '_, 'info, RunMatches<'info>>,
) -> Result<()> {
    let tournament = &mut ctx.accounts.tournament;

    require!(
        tournament.state == TournamentState::Running,
        DilemmaError::InvalidState
    );

    // Process up to MATCHES_PER_TX matches
    let matches_to_run = MATCHES_PER_TX.min(tournament.matches_total - tournament.matches_completed);
    
    if matches_to_run == 0 {
        msg!("No matches remaining");
        return Ok(());
    }

    // Snapshot starting index before the loop mutates matches_completed
    let start_index = tournament.matches_completed;

    // Build a map of player index -> remaining_account index for entry accounts
    let remaining_accounts = &ctx.remaining_accounts;
    
    for batch_idx in 0..matches_to_run {
        let match_index = start_index + batch_idx;
        
        // Get pairing for this match
        let pairing = match_logic::get_pairing_for_match(
            tournament.participant_count,
            tournament.matches_per_player,
            &tournament.randomness_seed,
            match_index,
        ).ok_or(DilemmaError::InvalidMatch)?;

        let (idx_a, idx_b) = pairing;

        // Skip if either player is refunded (default pubkey)
        let player_a = tournament.players.get(idx_a as usize)
            .ok_or(DilemmaError::InvalidMatch)?;
        let player_b = tournament.players.get(idx_b as usize)
            .ok_or(DilemmaError::InvalidMatch)?;

        if *player_a == Pubkey::default() || *player_b == Pubkey::default() {
            // Skip this match (player refunded)
            tournament.matches_completed += 1;
            continue;
        }

        // Find entry accounts in remaining_accounts
        let entry_a = find_entry_account(remaining_accounts, &tournament.key(), player_a)?;
        let entry_b = find_entry_account(remaining_accounts, &tournament.key(), player_b)?;

        // Deserialize entries
        let entry_a_data = entry_a.try_borrow_data()?;
        let entry_b_data = entry_b.try_borrow_data()?;
        
        let mut entry_a_account = deserialize_entry(&entry_a_data)?;
        let mut entry_b_account = deserialize_entry(&entry_b_data)?;
        drop(entry_a_data);
        drop(entry_b_data);

        // Verify indices match
        require!(entry_a_account.index == idx_a, DilemmaError::InvalidEntryAccount);
        require!(entry_b_account.index == idx_b, DilemmaError::InvalidEntryAccount);

        // Run the match using match-logic crate
        let strategy_a: match_logic::Strategy = entry_a_account.strategy.into();
        let strategy_b: match_logic::Strategy = entry_b_account.strategy.into();

        let result = match_logic::run_match(
            &strategy_a,
            &strategy_b,
            &tournament.randomness_seed,
            match_index,
        );

        // Update scores (both entry and tournament)
        entry_a_account.score += result.total_score_a;
        entry_b_account.score += result.total_score_b;
        entry_a_account.matches_played += 1;
        entry_b_account.matches_played += 1;

        // Write back
        let mut entry_a_data = entry_a.try_borrow_mut_data()?;
        let mut entry_b_data = entry_b.try_borrow_mut_data()?;
        serialize_entry(&entry_a_account, &mut entry_a_data)?;
        serialize_entry(&entry_b_account, &mut entry_b_data)?;
        drop(entry_a_data);
        drop(entry_b_data);

        tournament.scores[idx_a as usize] += result.total_score_a;
        tournament.scores[idx_b as usize] += result.total_score_b;

        tournament.matches_completed += 1;

        msg!(
            "Match {}: {} vs {} -> {} : {}",
            match_index,
            idx_a,
            idx_b,
            result.total_score_a,
            result.total_score_b
        );
    }

    msg!(
        "Tournament {}: {}/{} matches completed",
        tournament.id,
        tournament.matches_completed,
        tournament.matches_total
    );

    Ok(())
}

/// Helper to find an entry account in remaining_accounts
fn find_entry_account<'info>(
    remaining_accounts: &[AccountInfo<'info>],
    tournament_key: &Pubkey,
    player_key: &Pubkey,
) -> Result<AccountInfo<'info>> {
    // Derive expected PDA
    let (expected_pda, _bump) = Pubkey::find_program_address(
        &[b"entry", tournament_key.as_ref(), player_key.as_ref()],
        &crate::ID,
    );

    for account in remaining_accounts {
        if account.key() == expected_pda {
            return Ok(account.clone());
        }
    }

    Err(DilemmaError::InvalidEntryAccount.into())
}

/// Workaround for deserializing Entry from account data
fn deserialize_entry(data: &[u8]) -> Result<Entry> {
    if data.len() < 8 {
        return Err(DilemmaError::InvalidEntryAccount.into());
    }
    Entry::try_deserialize(&mut &data[..])
        .map_err(|_| DilemmaError::InvalidEntryAccount.into())
}

fn serialize_entry(entry: &Entry, data: &mut [u8]) -> Result<()> {
    // try_serialize writes discriminator + borsh data, so write from offset 0
    let mut writer = &mut data[..];
    entry.try_serialize(&mut writer)
        .map_err(|_| DilemmaError::InvalidEntryAccount.into())
}

/// Finalize tournament and determine winners, create next tournament
#[derive(Accounts)]
pub struct FinalizeTournament<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = operator @ DilemmaError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    /// Next tournament to create (starts with base size, grows via realloc as players join)
    #[account(
        init,
        payer = operator,
        space = Tournament::BASE_SPACE,
        seeds = [b"tournament", (config.current_tournament_id + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub next_tournament: Account<'info, Tournament>,

    #[account(mut)]
    pub operator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn finalize_tournament(ctx: Context<FinalizeTournament>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let tournament = &mut ctx.accounts.tournament;
    let next_tournament = &mut ctx.accounts.next_tournament;
    let clock = Clock::get()?;

    require!(
        tournament.state == TournamentState::Running,
        DilemmaError::InvalidState
    );

    require!(
        tournament.matches_completed >= tournament.matches_total,
        DilemmaError::MatchesIncomplete
    );

    // Sort scores descending to find threshold
    let mut sorted_scores: Vec<u32> = tournament.scores.iter()
        .enumerate()
        .filter(|(i, _)| tournament.players[*i] != Pubkey::default())
        .map(|(_, &s)| s)
        .collect();
    sorted_scores.sort_by(|a, b| b.cmp(a));

    // Calculate winner count (top 25%, minimum 1)
    let target_winners = std::cmp::max(1, (tournament.participant_count + 3) / 4); // ceil(n/4)
    
    // Set min_winning_score (threshold to be a winner)
    tournament.min_winning_score = sorted_scores
        .get((target_winners - 1) as usize)
        .copied()
        .unwrap_or(0);

    // Count actual winners (all players at or above threshold)
    tournament.winner_count = sorted_scores
        .iter()
        .filter(|&&s| s >= tournament.min_winning_score)
        .count() as u32;

    // Calculate house fee
    let house_fee = tournament.pool
        .checked_mul(tournament.house_fee_bps as u64)
        .ok_or(DilemmaError::Overflow)?
        .checked_div(10000)
        .ok_or(DilemmaError::Overflow)?;

    // Determine max distributable lamports (total - rent-exempt minimum)
    let rent = Rent::get()?;
    let tournament_info = tournament.to_account_info();
    let min_balance = rent.minimum_balance(tournament_info.data_len());
    let max_distributable = tournament_info.lamports()
        .saturating_sub(min_balance);
    
    // Winner pool is the lesser of (pool - fees) and max distributable
    let winner_pool_raw = (tournament.pool - house_fee).min(max_distributable);
    let per_winner = winner_pool_raw / tournament.winner_count as u64;
    let dust = winner_pool_raw - (per_winner * tournament.winner_count as u64);

    let fee_total = house_fee + dust;
    config.accumulated_fees += fee_total;

    // Transfer fee lamports from tournament account to config account
    **tournament.to_account_info().try_borrow_mut_lamports()? -= fee_total;
    **config.to_account_info().try_borrow_mut_lamports()? += fee_total;

    tournament.winner_pool = per_winner * tournament.winner_count as u64;
    tournament.payout_started_at = clock.unix_timestamp;
    tournament.state = TournamentState::Payout;

    // Create next tournament with snapshotted config values
    config.current_tournament_id += 1;
    
    next_tournament.id = config.current_tournament_id;
    next_tournament.state = TournamentState::Registration;
    next_tournament.stake = config.stake;
    next_tournament.house_fee_bps = config.house_fee_bps;
    next_tournament.matches_per_player = config.matches_per_player;
    next_tournament.registration_duration = config.registration_duration;
    next_tournament.pool = 0;
    next_tournament.participant_count = 0;
    next_tournament.registration_ends = clock.unix_timestamp + config.registration_duration;
    next_tournament.matches_completed = 0;
    next_tournament.matches_total = 0;
    next_tournament.randomness_seed = [0u8; 32];
    next_tournament.min_winning_score = 0;
    next_tournament.winner_count = 0;
    next_tournament.winner_pool = 0;
    next_tournament.claims_processed = 0;
    next_tournament.payout_started_at = 0;
    next_tournament.entries_remaining = 0;
    next_tournament.players = Vec::new();
    next_tournament.scores = Vec::new();
    next_tournament.bump = ctx.bumps.next_tournament;

    msg!(
        "Tournament {} finalized. {} winners (min score: {}) will split {} lamports",
        tournament.id,
        tournament.winner_count,
        tournament.min_winning_score,
        tournament.winner_pool
    );
    msg!(
        "Tournament {} created, registration ends at {}",
        next_tournament.id,
        next_tournament.registration_ends
    );

    Ok(())
}

/// Close expired entry and recover unclaimed funds
#[derive(Accounts)]
pub struct CloseExpiredEntry<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = operator @ DilemmaError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [b"entry", tournament.key().as_ref(), entry.player.as_ref()],
        bump = entry.bump,
        has_one = tournament,
        close = operator
    )]
    pub entry: Account<'info, Entry>,

    #[account(mut)]
    pub operator: Signer<'info>,
}

pub fn close_expired_entry(ctx: Context<CloseExpiredEntry>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let tournament = &mut ctx.accounts.tournament;
    let entry = &ctx.accounts.entry;
    let clock = Clock::get()?;

    // Must be in Payout state
    require!(
        tournament.state == TournamentState::Payout,
        DilemmaError::InvalidState
    );

    // Must be past 30-day expiry
    require!(
        clock.unix_timestamp >= tournament.payout_started_at + CLAIM_EXPIRY_SECONDS,
        DilemmaError::NotExpired
    );

    // If this was an unclaimed winner, add their share to accumulated fees
    if !entry.paid_out && entry.score >= tournament.min_winning_score {
        let unclaimed_share = tournament.winner_pool / tournament.winner_count as u64;

        // Cap transfer to keep tournament above rent-exempt minimum
        // (remaining surplus will be swept by close_tournament)
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(tournament.to_account_info().data_len());
        let max_transfer = tournament.to_account_info().lamports()
            .saturating_sub(min_balance);
        let transfer_amount = unclaimed_share.min(max_transfer);

        if transfer_amount > 0 {
            config.accumulated_fees += transfer_amount;
            **tournament.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
            **config.to_account_info().try_borrow_mut_lamports()? += transfer_amount;
        }

        msg!(
            "Added unclaimed prize {} lamports to accumulated fees (of {} owed)",
            transfer_amount,
            unclaimed_share
        );
    }

    // Decrement entries_remaining counter
    tournament.entries_remaining -= 1;

    // Entry account rent goes to operator (via close = operator)
    msg!("Closed expired entry for player {}", entry.player);

    Ok(())
}

/// Close a tournament account and recover all lamports to accumulated_fees
#[derive(Accounts)]
pub struct CloseTournament<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump,
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        constraint = operator.key() == config.operator || operator.key() == config.admin @ DilemmaError::Unauthorized
    )]
    pub operator: Signer<'info>,
}

pub fn close_tournament(ctx: Context<CloseTournament>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let tournament = &ctx.accounts.tournament;
    let clock = Clock::get()?;

    // Must be in Payout state
    require!(
        tournament.state == TournamentState::Payout,
        DilemmaError::InvalidState
    );

    // Must be past 30 days since payout started
    require!(
        clock.unix_timestamp >= tournament.payout_started_at + TOURNAMENT_CLOSURE_SECONDS,
        DilemmaError::TournamentNotCloseable
    );

    // All entries must be closed (claimed, refunded, or expired)
    require!(
        tournament.entries_remaining == 0,
        DilemmaError::EntriesRemaining
    );

    // Transfer ALL lamports (rent + any surplus) to config PDA → accumulated_fees
    let tournament_info = tournament.to_account_info();
    let total_lamports = tournament_info.lamports();
    if total_lamports > 0 {
        **tournament_info.try_borrow_mut_lamports()? = 0;
        **config.to_account_info().try_borrow_mut_lamports()? += total_lamports;
        config.accumulated_fees = config.accumulated_fees
            .checked_add(total_lamports)
            .ok_or(DilemmaError::Overflow)?;
    }

    // Zero out account data to mark as closed (Solana GCs 0-lamport accounts)
    let mut data = tournament_info.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }

    msg!(
        "Closed tournament {} — {} lamports transferred to accumulated fees",
        tournament.id,
        total_lamports
    );

    Ok(())
}
