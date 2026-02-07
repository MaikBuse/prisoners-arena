# Frontend

**Status: Deferred to v2**

---

## V1 Philosophy

For v1, Dilemma Arena is a **contract-as-API** product. Players build their own clients.

**Rationale:**
- Builds trust through "do your own research"
- Players verify contract logic directly
- No need to trust our UI implementation
- Lower development surface for launch
- Community can build competing interfaces

**What players need:**
- Contract IDL (published)
- Match-logic WASM for replay visualization
- Documentation on how to interact

---

## V2 Scope (Future)

When a reference frontend is built:

### Pages
| Page | Purpose |
|------|---------|
| `/` | Tournament status, countdown, enter CTA |
| `/enter` | Strategy picker, submit entry |
| `/my-entry` | View entry, refund, claim payout |
| `/leaderboard` | Live scores during tournament |
| `/match/:id/:index` | Animated match replay |
| `/how-to-play` | Rules and strategy guide |

### Tech Stack
- React 18+ / Vite / TypeScript
- Tailwind CSS
- Solana Wallet Adapter
- Anchor client (from IDL)
- match-logic WASM

### Match Animation
1. Anticipation (0.3s) — cards face-down
2. Reveal (0.5s) — simultaneous flip
3. Outcome (0.3s) — color flash, points float
4. Score update (0.2s) — counters tick

Controls: play/pause, speed (0.5×-4×), scrubber

### Testing
- [ ] Component unit tests (Vitest)
