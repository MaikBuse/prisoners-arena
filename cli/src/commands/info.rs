use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

use crate::config::ArenaConfig;
use crate::state;

const STRATEGY_NAMES: [&str; 9] = [
    "TitForTat", "AlwaysDefect", "AlwaysCooperate", "GrimTrigger",
    "Pavlov", "SuspiciousTitForTat", "Random", "TitForTwoTats", "Gradual",
];

fn strategy_name(id: u8) -> &'static str {
    STRATEGY_NAMES.get(id as usize).unwrap_or(&"Unknown")
}

fn format_params(params: [u8; 5]) -> String {
    let [forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias] = params;
    let mut parts = Vec::new();
    if forgiveness > 0 { parts.push(format!("forgiveness: {}%", forgiveness)); }
    if retaliation_delay > 0 { parts.push(format!("retaliation_delay: {}", retaliation_delay)); }
    if noise_tolerance > 0 { parts.push(format!("noise_tolerance: {}", noise_tolerance)); }
    if initial_moves > 0 { parts.push(format!("initial_moves: 0b{:08b}", initial_moves)); }
    if cooperate_bias != 50 { parts.push(format!("cooperate_bias: {}%", cooperate_bias)); }
    if parts.is_empty() { String::new() } else { format!(" ({})", parts.join(", ")) }
}

pub fn status(cfg: &ArenaConfig) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let (config, tournament) = state::fetch_current_tournament(&client, &program_id)?;

    println!("=== Tournament #{} — {} ===", tournament.id, tournament.state);
    println!("  Participants: {}", tournament.participant_count);
    println!("  Stake:        {} lamports ({:.4} SOL)", tournament.stake, tournament.stake as f64 / 1e9);
    println!("  Pool:         {} lamports ({:.4} SOL)", tournament.pool, tournament.pool as f64 / 1e9);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    match tournament.state {
        state::TournamentState::Registration => {
            let remaining = tournament.registration_ends - now;
            if remaining > 0 {
                println!("  Time Left:    {}s", remaining);
            } else {
                println!("  Registration: EXPIRED (awaiting close)");
            }
            println!("  Min Players:  {}", config.min_participants);
        }
        state::TournamentState::Reveal => {
            let remaining = tournament.reveal_ends - now;
            let active = tournament.participant_count - tournament.forfeits;
            println!("  Revealed:     {}/{}", tournament.reveals_completed, active);
            if remaining > 0 {
                let hours = remaining / 3600;
                let mins = (remaining % 3600) / 60;
                println!("  Time Left:    {}h {}m", hours, mins);
            } else {
                println!("  Reveal:       EXPIRED (awaiting close)");
            }
            if tournament.forfeits > 0 {
                println!("  Forfeits:     {}", tournament.forfeits);
            }
        }
        state::TournamentState::Running => {
            println!("  Matches:      {}/{}", tournament.matches_completed, tournament.matches_total);
        }
        state::TournamentState::Payout => {
            println!("  Winners:      {}", tournament.winner_count);
            println!("  Winner Pool:  {} lamports ({:.4} SOL)", tournament.winner_pool, tournament.winner_pool as f64 / 1e9);
            println!("  Claims:       {}/{}", tournament.claims_processed, tournament.winner_count);
        }
    }
    Ok(())
}

pub fn tournament(cfg: &ArenaConfig, id: u32) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let t = state::fetch_tournament(&client, &program_id, id)?;

    println!("=== Tournament #{} ===", t.id);
    println!("  State:              {}", t.state);
    println!("  Stake:              {} lamports", t.stake);
    println!("  House Fee:          {} bps", t.house_fee_bps);
    println!("  Matches Per Player: {}", t.matches_per_player);
    println!("  Round Tier:         {}", match t.round_tier { 0 => "Standard (20-50 rounds)", 1 => "Compressed (10-30 rounds)", _ => "Unknown" });
    println!("  Pool:               {} lamports", t.pool);
    println!("  Participants:       {}", t.participant_count);
    println!("  Registration Ends:  {}", t.registration_ends);
    println!("  Reveal Duration:    {}s", t.reveal_duration);
    if t.reveal_ends > 0 {
        println!("  Reveal Ends:        {}", t.reveal_ends);
        println!("  Reveals Completed:  {}", t.reveals_completed);
    }
    if t.forfeits > 0 {
        println!("  Forfeits:           {}", t.forfeits);
    }
    println!("  Matches:            {}/{}", t.matches_completed, t.matches_total);
    if t.operator_costs > 0 {
        println!("  Operator Costs:     {} lamports", t.operator_costs);
    }
    println!("  Winners:            {}", t.winner_count);
    println!("  Winner Pool:        {} lamports", t.winner_pool);
    println!("  Claims Processed:   {}", t.claims_processed);
    if t.payout_started_at > 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let elapsed = now - t.payout_started_at;
        let days = elapsed / 86400;
        let hours = (elapsed % 86400) / 3600;
        let mins = (elapsed % 3600) / 60;
        println!("  Payout Started At:  {} ({}d {}h {}m ago)", t.payout_started_at, days, hours, mins);
    }

    if !t.players.is_empty() {
        println!("\n  Players:");
        for (i, player) in t.players.iter().enumerate() {
            let score = t.scores.get(i).copied().unwrap_or(0);
            let strat = t.strategies.get(i).copied().unwrap_or(255);
            let default_pk = Pubkey::default();
            let status = if *player == default_pk {
                " (refunded/forfeited)".to_string()
            } else if strat == 255 {
                " 🔒 Hidden".to_string()
            } else {
                let params = t.strategy_params.get(i).copied().unwrap_or([0; 5]);
                format!(" — {}{}, score: {}", strategy_name(strat), format_params(params), score)
            };
            println!("    [{}] {}{}", i, player, status);
        }
    }
    Ok(())
}

pub fn entries(cfg: &ArenaConfig, tournament_id: Option<u32>) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;

    let tid = match tournament_id {
        Some(id) => id,
        None => state::resolve_latest_tournament_id(&client, &program_id)?,
    };

    let t = state::fetch_tournament(&client, &program_id, tid)?;
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, tid);

    println!("=== Entries for Tournament #{} ({}) ===", tid, t.state);

    if t.players.is_empty() {
        println!("  No entries");
        return Ok(());
    }

    for (i, player) in t.players.iter().enumerate() {
        let default_pk = Pubkey::default();
        if *player == default_pk {
            println!("  [{}] (refunded/forfeited)", i);
            continue;
        }

        let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, player);
        match client.get_account(&entry_pda) {
            Ok(account) => {
                let entry = state::Entry::deserialize(&account.data)?;
                let score = t.scores.get(i).copied().unwrap_or(entry.score);
                if entry.revealed {
                    println!(
                        "  [{}] {} — ✅ {}, score: {}, matches: {}, paid: {}",
                        entry.index, player, strategy_name(entry.strategy), score,
                        entry.matches_played, entry.paid_out
                    );
                } else {
                    println!(
                        "  [{}] {} — 🔒 committed (unrevealed)",
                        entry.index, player
                    );
                }
            }
            Err(_) => {
                let score = t.scores.get(i).copied().unwrap_or(0);
                let strat = t.strategies.get(i).copied().unwrap_or(255);
                let strat_str = if strat <= 8 { strategy_name(strat) } else { "Unknown" };
                println!("  [{}] {} — {}, score: {} (entry closed)", i, player, strat_str, score);
            }
        }
    }
    Ok(())
}
