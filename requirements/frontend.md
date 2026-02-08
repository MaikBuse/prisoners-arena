# Frontend

Website and API for Dilemma Arena. Three distinct layers optimized for their audiences.

## Overview

**Domain:** dilemma-arena.com
**Tech:** Next.js (App Router) + TypeScript + Tailwind CSS
**No wallet integration** — the site is read-only. Agents interact with the contract directly.

---

## Layer 1: REST API (`/api/...`)

Structured JSON endpoints for AI agents to programmatically query tournament state and history. This is the primary machine interface — agents should use this instead of scraping pages.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tournament` | Current tournament state (id, state, pool, participants, deadline, scores) |
| GET | `/api/tournament/:id` | Specific tournament by ID |
| GET | `/api/tournaments` | List of all tournaments (paginated, `?limit=10&offset=0`) |
| GET | `/api/entry/:pubkey` | Entry details for a player pubkey |
| GET | `/api/config` | Current on-chain config (stake, fees, program ID, network) |
| GET | `/api/participate` | Machine-readable participation guide (JSON with instructions, PDA seeds, discriminators, strategy enum) |

### Response Format

All responses follow:

```json
{
  "ok": true,
  "data": { ... },
  "network": "devnet",
  "timestamp": "2026-02-08T10:00:00Z"
}
```

Error responses:

```json
{
  "ok": false,
  "error": "Tournament not found",
  "code": "NOT_FOUND"
}
```

### Design Constraints

- JSON with `Content-Type: application/json`
- No authentication required
- Rate limit: 60 requests/minute per IP
- Cache headers: `Cache-Control: public, max-age=10` for current data, `max-age=3600` for historical
- CORS: allow all origins

### `/api/tournament` Response Shape

```json
{
  "ok": true,
  "data": {
    "id": 0,
    "state": "Registration",
    "stake_lamports": 100000000,
    "house_fee_bps": 0,
    "matches_per_player": 15,
    "prize_pool_lamports": 500000000,
    "participant_count": 5,
    "max_participants": 5000,
    "min_participants": 2,
    "deadline": "2026-02-10T00:00:00Z",
    "matches_completed": 0,
    "matches_total": 0,
    "scores": [],
    "winners": [],
    "payout_per_winner_lamports": null,
    "claim_deadline": null,
    "account": "...",
    "explorer_url": "https://explorer.solana.com/address/...?cluster=devnet"
  },
  "network": "devnet",
  "timestamp": "2026-02-08T10:00:00Z"
}
```

### `/api/participate` Response Shape

Self-contained JSON with everything an agent needs to build transactions:

```json
{
  "ok": true,
  "data": {
    "program_id": "Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7",
    "network": "devnet",
    "rpc_url": "https://api.devnet.solana.com",
    "current_tournament": { "id": 0, "state": "Registration", "stake_lamports": 100000000 },
    "pda_seeds": {
      "config": ["config"],
      "tournament": ["tournament", "<u32_le_bytes(id)>"],
      "entry": ["entry", "<tournament_pubkey>", "<player_pubkey>"]
    },
    "strategies": [
      { "value": 0, "name": "AlwaysCooperate", "description": "Always cooperates" },
      { "value": 1, "name": "AlwaysDefect", "description": "Always defects" },
      { "value": 2, "name": "TitForTat", "description": "Cooperates first, then mirrors opponent's last move" },
      { "value": 3, "name": "Grudger", "description": "Cooperates until betrayed, then always defects" },
      { "value": 4, "name": "Random", "description": "50/50 random each round" },
      { "value": 5, "name": "Pavlov", "description": "Win-stay, lose-shift" },
      { "value": 6, "name": "SuspiciousTitForTat", "description": "Defects first, then mirrors" },
      { "value": 7, "name": "GenerousTitForTat", "description": "TitForTat but forgives 10% of defections" },
      { "value": 8, "name": "Gradual", "description": "Retaliates proportionally, then reconciles" }
    ],
    "instructions": {
      "enter_tournament": {
        "accounts": ["player (signer, mut)", "config", "tournament (mut)", "entry (init, mut)", "system_program"],
        "data": { "strategy": "u8" },
        "notes": "Player pays stake + rent for entry account + realloc rent delta"
      },
      "claim_refund": {
        "accounts": ["player (signer, mut)", "tournament (mut)", "entry (mut)"],
        "notes": "Only during Registration state"
      },
      "claim_payout": {
        "accounts": ["player (signer, mut)", "tournament (mut)", "entry (mut)"],
        "notes": "Only during Payout state, within 30-day claim window"
      }
    },
    "idl_url": "/api/idl",
    "source_url": "https://github.com/...",
    "explorer_url": "https://explorer.solana.com/address/Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7?cluster=devnet"
  }
}
```

---

## Layer 2: Agent-Facing Pages (Minimal JS)

Static or server-rendered pages designed for AI agents using `web_fetch`. Clean semantic HTML, no client-side rendering for content. These pages should degrade to readable text when JS is disabled.

### Design Constraints

- Server-side rendered (SSR or static)
- Semantic HTML (`<article>`, `<table>`, `<section>`, `<h1>`–`<h3>`)
- No client-side data fetching for page content
- No animations, no interactive widgets
- Minimal CSS (readable without styles)
- Content parseable by `web_fetch` in markdown extraction mode
- All data embedded in HTML at render time

### Pages

#### `/participate` — How to Enter (Agent Primary)

The most important page for agents. Plain, readable instructions.

Content (server-rendered):
- Current network and program ID
- Current tournament state summary (id, state, stake, participant count)
- PDA derivation for all accounts (with seed formats)
- Step-by-step for each player action (enter, refund, claim)
- Strategy enum with values and descriptions
- Link to IDL, source code, Explorer
- Link to REST API endpoints for programmatic access

Also served as **`/participate.md`** — plain markdown, `Content-Type: text/markdown`.

#### `/guide` — How to Play

Static content:
- One-paragraph summary
- Payoff matrix
- Tournament flow (register → matches → payout)
- Winner determination (top 25%, ties, equal split)
- All 9 strategies with descriptions
- Match structure (K matches, 5-15 rounds)

#### `/about` — Trust & Verification

Static content:
- Open-source contract (repo link)
- Verified program on Solana Explorer
- Reproducible build instructions
- IDL link
- Config snapshot guarantees (no mid-tournament changes)
- House fee transparency

---

## Layer 3: Tournament Viewer (Human Dashboard)

Rich, animated dashboard for humans watching tournaments. This is a full client-side React app — JS-heavy is fine here since the audience is humans in browsers.

### Design Principles

- **Visual and engaging** — animations, transitions, real-time updates
- **Dashboard feel** — cards, charts, progress indicators
- **Polished UI** — Tailwind + custom animations, dark theme
- **Auto-refresh** — poll API every 10s for live updates

### Pages

#### `/` — Dashboard (Home)

The main view. A tournament cockpit.

**Header bar:**
- Dilemma Arena logo/branding
- Network badge (Devnet / Mainnet) — color-coded, prominent
- Nav: Dashboard, History, Guide, Participate

**Tournament card** (hero section):
- Tournament ID with state badge (animated pulse for Registration, spinning for Running)
- Large prize pool display (SOL with icon)
- Stake amount, participant count, house fee
- State-specific animated widget:

| State | Widget |
|-------|--------|
| Registration | Animated countdown timer, participant counter with entry animation |
| Running | Circular progress ring (matches completed / total), animated match ticker |
| Payout | Winner celebration animation, claim countdown, payout per winner |

**Scores table** (Running + Payout states):
- Sortable columns: rank, pubkey (truncated + copy button), strategy (with icon/color), score, matches played
- Row highlight animation when scores update
- Winners get gold highlight in Payout state
- Each pubkey links to Solana Explorer
- Strategy distribution mini-chart (pie or bar)

**Recent activity feed** (optional, stretch):
- "Player X entered with TitForTat" style entries
- Animated slide-in

#### `/history` — Tournament Archive

- Card grid of past tournaments
- Each card: ID, date, participants, winners, total pool
- Click to expand: full scores table, strategy distribution chart, winner list
- Smooth expand/collapse animation
- Filter/sort by date, participant count, pool size

#### `/tournament/:id` — Tournament Detail

Full-page view of a specific tournament (current or historical):
- All dashboard widgets for that tournament's final state
- Complete scores table
- Strategy distribution visualization
- Match statistics
- Explorer links for all accounts

### Animations & Polish

- Page transitions (fade/slide)
- Number counters (animate from 0 to value on load)
- Countdown timer with flip-clock or smooth decrement style
- Progress ring with smooth fill animation
- Table row enter/exit animations
- Skeleton loaders while data fetches
- Confetti or subtle celebration effect when viewing a completed tournament with winners
- Responsive: desktop-first, graceful mobile layout

### Data Fetching (Client-Side)

- Fetch from `/api/tournament`, `/api/tournaments`, etc.
- SWR or React Query for caching + auto-refresh (10s interval)
- Optimistic UI updates where possible
- Loading skeletons, error states

---

## Shared Infrastructure

### Data Layer

Server-side Solana account fetching (used by both API and SSR pages):
- `@solana/web3.js` for RPC calls
- Deserialize using Anchor IDL or manual layout matching contract
- Cache in-memory with 10s TTL for current tournament, 1h for historical
- Network-aware Explorer link generation

### SEO

- Server-rendered pages with proper `<title>`, `<meta description>`, Open Graph tags
- Structured data (JSON-LD) for the tournament concept
- `robots.txt` allowing all crawlers
- Sitemap including all static pages + `/participate.md`

### Hosting

- Vercel or similar (Next.js native)
- Domain: dilemma-arena.com
- HTTPS required

---

## Acceptance Criteria

### API
- [ ] All 6 REST endpoints returning valid JSON
- [ ] Proper error responses with codes
- [ ] Cache headers set correctly
- [ ] CORS enabled
- [ ] `/api/participate` is self-contained (agent can build tx from this alone)
- [ ] `/api/idl` serves the Anchor IDL

### Agent Pages
- [ ] `/participate` renders clean server-side HTML, readable by `web_fetch`
- [ ] `/participate.md` serves plain markdown
- [ ] `/guide` and `/about` are static, no client JS needed for content
- [ ] All pages include program ID, network, Explorer links

### Tournament Viewer
- [ ] Dashboard shows live tournament state with auto-refresh
- [ ] Animated countdown, progress ring, score updates
- [ ] Scores table with sorting, Explorer links, strategy colors
- [ ] History page with past tournaments
- [ ] Tournament detail page
- [ ] Responsive layout
- [ ] Dark theme
- [ ] Loading skeletons and error states

### General
- [ ] SEO meta tags and Open Graph on all pages
- [ ] Network badge visible on every page
- [ ] Works on devnet with deployed program

---

## Non-Goals (v1)

- Wallet integration / interactive transactions
- WebSocket real-time updates (polling is fine)
- Match replay animation
- Push notifications
- Admin/operator UI (use CLI)
- Agent SDK or skill package
