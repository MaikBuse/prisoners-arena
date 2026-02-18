# Prisoner's Arena: Optimal Configuration Analysis

## Context

Prisoner's Arena is functionally complete on devnet. Before launch, we need to determine the right configuration to maximize adoption among AI agent builders — developers building autonomous Solana agents who will compete in Iterated Prisoner's Dilemma tournaments. This document analyzes every tunable parameter from a business perspective and recommends launch values.

---

## Target Audience Profile: AI Agent Builders

Key behavioral traits that inform every recommendation below:

- **Iterate compulsively** — they'll play many tournaments, tweaking strategy params between each. Cadence and feedback richness matter more than individual prize size.
- **Value fairness and transparency** — they're technical enough to audit the code and will reject anything that smells like a rigged house. Zero fee and full round-robin are trust signals.
- **Share results publicly** — "my agent placed 2nd out of 50" is a flex. Scoreboards, strategy breakdowns, and tournament history are organic marketing fuel.
- **Price-insensitive within reason** — $5-20 per tournament is a rounding error vs their dev time. But the stake must feel *meaningful enough* to validate their work.
- **Time-rich but attention-poor** — they'll automate entry, but need enough time between tournaments to analyze results and push code updates.
- **Competitive with each other** — the agent builder community is small and tribal (Claude vs GPT vs custom). Leaderboards create status games.

---

## Parameter-by-Parameter Analysis

### 1. Stake: 0.1 SOL (100,000,000 lamports)

| Factor | Analysis |
|---|---|
| **Current** | 0.05 SOL — too low to feel meaningful. At $4-5, winning barely registers. |
| **Recommended** | 0.1 SOL (~$10) |
| **Floor reasoning** | Must exceed transaction friction (rent + tx fees ≈ 0.005 SOL) by at least 10x. Below that, the cost of entering is uncomfortably close to the cost of transacting — feels wasteful. |
| **Ceiling reasoning** | Must stay below "I need to think about this" threshold. For developers, $10 is an impulse decision. $50 requires justification. |
| **Winner math** | 20 players → 2 SOL pool → 5 winners get 0.4 SOL each (4x return, ~$40). That's enough to tweet about but not enough to attract gambling degens who'd pollute the competitive ecosystem. |
| **Retention math** | At 0.1 SOL, a builder can play 10 tournaments for 1 SOL ($85-100). That's a week's worth of experimentation for the cost of lunch. Low enough to sustain iterative play without hesitation. |

### 2. Min Participants: 4

| Factor | Analysis |
|---|---|
| **Current** | 2 — a heads-up match, not a tournament. |
| **Recommended** | 4 |
| **Cold-start reality** | The first weeks will have very few players. If min is 8 or 10, tournaments will stall, the operator logs "waiting for N more" indefinitely, and early adopters see a dead product. 4 is the absolute minimum that feels like a competition (6 unique matchups, strategy diversity matters, 1 winner out of 4). |
| **Growth trigger** | Once 4-player tournaments consistently fill, raise to 6, then 8. Each increase should follow organic demand, never precede it. A stalled tournament is the #1 adoption killer. |
| **Game theory minimum** | With fewer than 4 strategies in play, the Prisoner's Dilemma meta is trivially solvable. At 4+ players, emergent dynamics appear (defectors exploit cooperators, TFT stabilizes the field, meta shifts between tournaments). |

### 3. Max Participants: 50

| Factor | Analysis |
|---|---|
| **Current** | 100 — fine technically but wrong for launch optics. |
| **Recommended** | 50 |
| **Scarcity psychology** | "42/50 spots filled" triggers FOMO. "42/100 spots filled" signals low demand. The number you don't show is as important as the one you do. Keep max low and raise it as demand grows — every increase becomes a marketing event ("due to demand, tournaments now support 100 players"). |
| **Prize pool headline** | 50 × 0.1 SOL = 5 SOL (~$425-500). Marketable. 100 × 0.1 SOL = 10 SOL but you'll never fill it early, and "2/100" is depressing. |
| **Runtime** | 50 players = full round-robin (49 matches each) = 1,225 total matches = 245 tx batches × 5 sec = ~20 min running phase. Fast enough that results feel immediate. At 100 players it's 80+ min — agents wait too long between iterations. |
| **Data richness** | Full round-robin means every agent plays every other agent. This is the gold standard for competitive evaluation and produces the richest dataset for builders to analyze. Critical for the "iterate and improve" loop. |

### 4. Registration Duration: 3,600 seconds (1 hour)

| Factor | Analysis |
|---|---|
| **Current** | 60 seconds — bot-only, humans can't participate. |
| **Recommended** | 3,600 seconds (1 hour) |
| **Agent builder workflow** | Registration needs to accommodate: see announcement → check current strategy → decide to enter → run entry script → confirm on-chain. Even for automated agents, 60 seconds is too tight if the builder needs to review/approve the transaction. 1 hour gives comfortable margin. |
| **Cadence math** | 1h registration + 30min reveal + ~20min running + overhead = ~2 hour cycle. That's 12 tournaments/day. An active builder can enter 3-4 per session, with time to analyze results between each. This creates a natural "enter → analyze → iterate → re-enter" loop that's the core engagement mechanic. |
| **Marketing window** | 1 hour is enough to tweet "Tournament #47 open — 45 min left" and have followers act on it. 60 seconds means only pre-scheduled bots participate — no organic growth possible. |
| **Urgency** | The countdown timer in the UI is already built. 1 hour creates natural urgency without inaccessibility. Long enough to discover, short enough to feel time-pressured. |

### 5. Reveal Duration: 1,800 seconds (30 minutes)

| Factor | Analysis |
|---|---|
| **Current** | 60 seconds — punitive. New users will miss it and get assigned random strategies, creating a terrible first experience. |
| **Recommended** | 1,800 seconds (30 minutes) |
| **Failure cost** | Missing reveal doesn't refund your stake — you get assigned a random strategy (deterministic from `commitment[0] % 9`). This is a harsh penalty. The reveal window must be long enough that missing it is clearly the player's fault, not a timing trap. 30 min is generous. |
| **Agent perspective** | A well-designed agent auto-reveals immediately when the phase opens. 30 min is a safety net for those still scripting their flow or dealing with RPC congestion. Once the ecosystem matures, this can tighten to 15 min. |
| **Cycle impact** | Adds 30 min to the tournament cycle. Acceptable — it maintains the ~2h cadence. Going longer (1h) would slow the iterate loop without meaningful benefit. |

### 6. Matches Per Player: 10

| Factor | Analysis |
|---|---|
| **Current** | 6 — irrelevant at n ≤ 200 (forced to full round-robin K=n-1). |
| **Recommended** | 10 |
| **Why it doesn't matter (yet)** | With max_participants=50, effective K = n-1 (full round-robin). Every player plays every other player. The `matches_per_player` config is only used when n > 200, where K is clamped to [49, 99]. Setting 10 is a reasonable placeholder for when max_participants scales up. |
| **Full round-robin is a feature** | For AI agent builders, "your agent played every other agent" is the fairest possible evaluation. No "bad draw" excuses. The leaderboard is definitive. This matters enormously for a competitive developer audience. |

### 7. House Fee: 0 bps (0%)

| Factor | Analysis |
|---|---|
| **Current** | 0 — correct. |
| **Recommended** | 0 for launch. 250 (2.5%) at growth phase. 500 (5%) at maturity. |
| **Growth over revenue** | With a small user base, even 5% on a 5 SOL pool yields 0.25 SOL per tournament (~$20). That's not revenue — it's noise. But it does reduce the winner payout visibly (from 0.4 SOL to 0.38 SOL per winner in a 20-player field). Net negative. |
| **Trust signal** | "Zero platform fee — 100% of stakes go to players" is the single most powerful message for a technical audience that's seen too many platforms skim. It's the DeFi equivalent of "no ads." |
| **When to introduce** | When consistent 30+ player tournaments are the norm, introduce 2.5% framed as "operator sustainability fee." Announce 2 weeks in advance. The community will accept it because they've already seen you run at zero for months — proof of good faith. |
| **Maturity math** | At 100 players × 0.5 SOL × 5% × 12 tournaments/day = 30 SOL/day (~$2,500/day). That's a sustainable business. But it requires the player base to exist first. |

### 8. Operator Tx Fee: 5,000 lamports

| Factor | Analysis |
|---|---|
| **Current** | 0 — operator eats all costs. |
| **Recommended** | 5,000 lamports per operator transaction |
| **Cost reality** | A 20-player tournament requires ~64 operator transactions (close_registration + close_reveal + ~2 forfeits + 38 match batches + finalize + 20 close_entries + close_tournament). At 5,000 lamports each = 320,000 lamports (0.00032 SOL). On a 2 SOL pool, that's 0.016% — invisible to players. |
| **Sustainability** | Without reimbursement, the operator wallet drains. At 12 tournaments/day with 20 players each, operator costs ~0.004 SOL/day. Trivial, but accumulates. Reimbursement ensures the operator is self-sustaining without external funding. |
| **Transparency** | On-chain and auditable. Agent builders can compute exact operator extraction. This aligns with their trust expectations. |

---

## Winner Percentage: Critical Missing Parameter

**Currently hardcoded at 25%** (`tournament.rs:602`). Cannot be changed without contract redeploy.

### Analysis for AI Agent Builders

25% is a reasonable default for this audience:

- **Skill rewards over variance** — agent builders want consistent skill to be rewarded. With top 25% winning, a well-tuned TitForTat variant will reliably place. Lower percentages (10%) introduce more variance, which frustrates the "systematic improvement" mindset.
- **4x return multiplier** — at 25%, expected return for a winner is 4x stake (before fees). This is satisfying without being speculative. Agent builders aren't here to gamble — they're here to prove their agent is better.
- **Iterate loop incentive** — "I finished 7th out of 20 (top 35%) — I was close to the 25% cutoff" is a powerful re-engagement trigger. The near-miss effect is strongest when the cutoff is psychologically close to achievable.

**However**, making this configurable would unlock:
- **"Friendly" tournaments (50%)** for onboarding new builders — lower risk, more positive first experiences
- **"Competitive" tournaments (10%)** for leaderboard-hardened builders — bigger prizes, higher stakes
- **A/B testing** different ratios to find the empirical optimum for this specific audience

**Recommendation:** 25% is acceptable for launch. Making it configurable is a high-value product improvement for the growth phase, when you want to run diverse tournament formats.

---

## Phased Rollout Strategy

### Phase 1: Soft Launch (Months 1-2)

**Goal:** First 50 active agent builders. Prove the feedback loop works.

```
stake = 0.1 SOL          min_participants = 4       max_participants = 50
registration = 1 hour     reveal = 30 min            house_fee = 0%
matches_per_player = 10   operator_tx_fee = 5000     winner_percentage = 25% (hardcoded)
```

**Key metrics to track:**
- Fill rate (% of max_participants filled per tournament)
- Return player rate (% of players who enter 3+ tournaments)
- Strategy diversity (are all 9 strategies being used?)
- Time between registration open and first entry (measures awareness/automation)
- Tournament completion time (measures UX of the cadence)

**Marketing approach:**
- Target Solana agent framework communities (Solana Agent Kit, SendAI, etc.)
- "Zero fee, fully on-chain, verifiable AI tournament" — the trust pitch
- Share tournament results as strategy analysis threads
- Publish the participation API docs prominently — make it trivially easy for agents to enter

### Phase 2: Growth (Months 2-4)

**Trigger:** Consistently filling 20+ players per tournament.

```
stake = 0.2 SOL          min_participants = 8       max_participants = 100
registration = 2 hours    reveal = 1 hour            house_fee = 2.5%
```

**Product changes for this phase:**
- Make `winner_percentage` configurable (contract upgrade)
- Run parallel tournament formats: "Standard (25%)" and "Friendly (50%)"
- Add cumulative leaderboards (cross-tournament rankings)
- "Season 1" framing with multi-tournament standings

### Phase 3: Maturity (Month 5+)

**Trigger:** 50+ players per tournament, recognized in agent builder community.

```
stake = 0.5 SOL          min_participants = 16      max_participants = 256
registration = 4 hours    reveal = 1 hour            house_fee = 5%
```

**Revenue projection:** 200 players × 0.5 SOL × 5% × 6 tournaments/day = 30 SOL/day (~$2,500/day).

---

## Summary: Recommended Launch Configuration

| Parameter | Value | Key Rationale |
|---|---|---|
| `stake` | 100,000,000 (0.1 SOL) | $10 impulse threshold, 4x winner return |
| `min_participants` | 4 | Cold-start proof, minimum viable competition |
| `max_participants` | 50 | Scarcity optics, fast full round-robin, ~20 min running |
| `registration_duration` | 3600 (1 hour) | Agent workflow + marketing window |
| `reveal_duration` | 1800 (30 min) | Safety net for new builders |
| `matches_per_player` | 10 | Placeholder (full round-robin at n≤200) |
| `house_fee_bps` | 0 | Trust signal, growth > revenue |
| `operator_tx_fee` | 5000 | Self-sustaining operator |

**Apply with:**
```bash
arena config update \
  --stake 100000000 \
  --min_participants 4 \
  --max_participants 50 \
  --registration_duration 3600 \
  --reveal_duration 1800 \
  --matches_per_player 10 \
  --house_fee_bps 0 \
  --operator_tx_fee 5000
```

**Future product priorities (by impact):**
1. Make `winner_percentage` configurable (contract change, high impact)
2. Cumulative cross-tournament leaderboard (frontend, medium impact)
3. Parallel tournament formats at different stakes/configs (operational, medium impact)
4. Tiered payout structure (contract change, lower priority)
