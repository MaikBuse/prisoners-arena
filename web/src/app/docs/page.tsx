import { Metadata } from 'next';
import { headers } from 'next/headers';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TracingBeam } from '@/components/TracingBeam';
import { STRATEGIES, EXPLORER_BASE } from '@/lib/solana';
import { STRATEGY_CONFIGS } from '@/lib/strategyConfig';
import { getNetworkConfig, getAllNetworkConfigs } from '@/lib/network-config';
import type { NetworkId } from '@/lib/network-config';

export const metadata: Metadata = {
  title: 'How It Works — Prisoner\'s Arena',
  description: 'Full protocol documentation for Prisoner\'s Arena. Learn how the Solana smart contract, tournament lifecycle, commit-reveal scheme, and matching algorithm work.',
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'lifecycle', label: 'Tournament Lifecycle' },
  { id: 'commit-reveal', label: 'Commit-Reveal' },
  { id: 'payoff-matrix', label: 'Payoff Matrix' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'matching', label: 'Matching Algorithm' },
  { id: 'rounds', label: 'Rounds & Scoring' },
  { id: 'payouts', label: 'Fees & Payouts' },
  { id: 'accounts', label: 'On-Chain Accounts' },
  { id: 'security', label: 'Security' },
] as const;

function makeExplorerLink(address: string, network: string, type: 'address' | 'tx' = 'address'): string {
  const base = `${EXPLORER_BASE}/${type}/${address}`;
  if (network === 'mainnet-beta') return base;
  return `${base}?cluster=${network}`;
}

export default async function HowItWorksPage() {
  const hdrs = await headers();
  const networkId = (hdrs.get('x-network') as NetworkId) || 'devnet';
  const cfg = getNetworkConfig(networkId);
  const programId = cfg.programId;
  const network = cfg.network;
  const explorerLink = (address: string) => makeExplorerLink(address, network);

  return (
    <>
    <Nav />
    <TracingBeam className="max-w-5xl mx-auto px-4 py-12">
      <a href="/" className="text-sm text-accent hover:text-accent-hover mb-6 inline-block">← Back to Arena</a>

      <h1 className="text-3xl font-bold mb-2">How It Works</h1>
      <p className="text-muted mb-8">Complete protocol documentation for Prisoner&apos;s Arena. Everything about how the on-chain tournament works.</p>

      <div className="lg:flex lg:gap-10">
        {/* Sidebar TOC — desktop */}
        <nav className="hidden lg:block lg:w-48 shrink-0">
          <div className="sticky top-20">
            <div className="text-xs font-bold text-muted uppercase mb-3">Contents</div>
            <div className="space-y-1">
              {SECTIONS.map(s => (
                <TOCLink key={s.id} id={s.id} label={s.label} />
              ))}
            </div>
          </div>
        </nav>

        {/* Mobile TOC strip */}
        <nav className="lg:hidden mb-8 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border border-card-border text-muted hover:text-foreground hover:border-accent transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-muted mb-4">
              Prisoner&apos;s Arena is a competitive AI tournament platform on Solana that implements the Iterated Prisoner&apos;s Dilemma. Players stake SOL, select strategies, compete in automated matches, and the top 25% split the prize pool.
            </p>
            <p className="text-muted mb-6">
              The entire tournament lifecycle is governed by an on-chain Solana program. Strategies are hidden during registration via a commit-reveal scheme, matches are executed deterministically using on-chain randomness, and all results are publicly verifiable.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {getAllNetworkConfigs().map(c => {
                const isActive = c.network === network;
                return (
                  <div key={c.network} className={`rounded-xl border p-4 ${isActive ? 'border-accent bg-accent/5' : 'border-card-border bg-surface'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="network-badge text-xs px-2 py-0.5 rounded-full font-mono"
                            data-network={c.network}>{c.network === 'mainnet-beta' ? 'mainnet' : c.network}</span>
                      {isActive && <span className="text-[10px] text-accent font-medium">Active</span>}
                    </div>
                    <div className="text-xs text-muted mb-1">Program ID</div>
                    <a href={makeExplorerLink(c.programId, c.network)} target="_blank" rel="noopener noreferrer"
                       className="font-mono text-sm text-accent hover:text-accent-hover break-all">{c.programId}</a>
                  </div>
                );
              })}
            </div>
            <InfoRow label="Source">
              <a href="https://github.com/makoto-kusanagi/prisoners-arena-program" target="_blank" rel="noopener noreferrer"
                 className="text-accent hover:text-accent-hover">prisoners-arena-program ↗</a>
            </InfoRow>
          </Section>

          {/* Tournament Lifecycle */}
          <Section id="lifecycle" title="Tournament Lifecycle">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { phase: 'Registration', badge: 'badge-registration', actor: 'Player', what: 'Stake SOL and submit a strategy commitment hash' },
                { phase: 'Reveal', badge: 'badge-reveal', actor: 'Player', what: 'Submit the preimage (strategy + salt) to prove commitment' },
                { phase: 'Running', badge: 'badge-running', actor: 'Operator', what: 'Execute matches in batches, record scores on-chain' },
                { phase: 'Payout', badge: 'badge-payout', actor: 'Player', what: 'Winners claim their share of the prize pool' },
              ].map((p, i) => (
                <div key={p.phase} className="neon-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted font-mono">{i + 1}.</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.badge}`}>{p.phase}</span>
                  </div>
                  <div className="text-xs text-muted">{p.what}</div>
                  <div className="text-[10px] text-muted mt-1">Actor: <strong>{p.actor}</strong></div>
                </div>
              ))}
            </div>

            <DetailBlock summary="Timing details">
              <ul className="list-disc list-inside text-sm text-muted space-y-1">
                <li><strong>Registration duration:</strong> configured by admin</li>
                <li><strong>Reveal duration:</strong> configured by admin, starts when registration closes</li>
                <li><strong>Running:</strong> operator processes matches in batches of 5 until all complete</li>
                <li><strong>Payout:</strong> winners have 30 days to claim; unclaimed funds go to house fees</li>
                <li>The operator bot automates phase transitions — players only need to enter and claim</li>
              </ul>
            </DetailBlock>
          </Section>

          {/* Commit-Reveal */}
          <Section id="commit-reveal" title="Commit-Reveal Scheme">
            <p className="text-muted mb-4">
              The commit-reveal scheme prevents strategy front-running. During registration, players submit only a hash of their strategy — nobody (including the operator) can see which strategies are in play until the reveal phase.
            </p>

            <div className="mb-4">
              <div className="text-xs font-bold text-muted uppercase mb-2">Built-in Strategies (0-8)</div>
              <div className="bg-surface border border-card-border rounded-lg p-3 font-mono text-sm">
                SHA256(strategy_byte || salt[16])
              </div>
              <p className="text-xs text-muted mt-2">
                17 bytes total: 1 byte strategy index, 16 bytes random salt.
              </p>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-muted uppercase mb-2">Custom Strategy (index 9)</div>
              <div className="bg-surface border border-card-border rounded-lg p-3 font-mono text-sm">
                SHA256(9u8 || SHA256(bytecode) || salt[16])
              </div>
              <p className="text-xs text-muted mt-2">
                49 bytes total: 1 byte (always 9), 32 bytes SHA256 of bytecode, 16 bytes random salt. See <a href="/docs/custom-strategy-vm#commit-reveal" className="text-accent hover:text-accent-hover">Custom Strategy VM</a> for details.
              </p>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-muted uppercase mb-2">Reveal Verification</div>
              <p className="text-sm text-muted">
                During the reveal phase, the player submits the preimage (strategy, salt). The program recomputes SHA256 and verifies it matches the stored commitment. If it doesn&apos;t match, the reveal is rejected.
              </p>
            </div>

            <div>
              <div className="text-xs font-bold text-muted uppercase mb-2">Forfeit Handling</div>
              <p className="text-sm text-muted">
                If a player fails to reveal before the deadline, the operator calls <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">forfeit_unrevealed</code>, which derives a built-in strategy index from the on-chain <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">SlotHashes</code> sysvar — unpredictable at registration time, preventing players from gaming forfeit outcomes. This ensures every registered player competes — no one can grief by withholding their reveal.
              </p>
            </div>

          </Section>

          {/* Payoff Matrix */}
          <Section id="payoff-matrix" title="The Payoff Matrix">
            <p className="text-sm text-muted mb-4">Each round, two players simultaneously choose to <strong>Cooperate</strong> or <strong>Defect</strong>:</p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-card-border rounded overflow-hidden">
                <thead>
                  <tr className="bg-surface">
                    <th className="p-3 border-b border-r border-card-border"></th>
                    <th className="p-3 border-b border-r border-card-border text-accent">They: C</th>
                    <th className="p-3 border-b border-card-border text-error">They: D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-r border-card-border font-bold text-accent bg-surface">You: C</td>
                    <td className="p-3 border-b border-r border-card-border text-center font-mono">3, 3</td>
                    <td className="p-3 border-b border-card-border text-center font-mono text-error">0, 5</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r border-card-border font-bold text-error bg-surface">You: D</td>
                    <td className="p-3 border-r border-card-border text-center font-mono text-warning">5, 0</td>
                    <td className="p-3 text-center font-mono text-muted">1, 1</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <OutcomeCard name="Reward" scores="3, 3" desc="Both cooperate" color="text-accent" />
              <OutcomeCard name="Punishment" scores="1, 1" desc="Both defect" color="text-muted" />
              <OutcomeCard name="Temptation" scores="5, 0" desc="You defect, they cooperate" color="text-warning" />
              <OutcomeCard name="Sucker" scores="0, 5" desc="You cooperate, they defect" color="text-error" />
            </div>

            <p className="text-sm text-muted">
              Defecting wins individual rounds, but cooperation wins tournaments. Mutual cooperation (3+3=6 total) creates more value than mutual defection (1+1=2 total). The best strategies balance retaliation with forgiveness.
            </p>
          </Section>

          {/* Strategies */}
          <Section id="strategies" title="Strategies">
            <p className="text-sm text-muted mb-4">
              There are 9 built-in strategies. Each implements a different decision-making algorithm for choosing Cooperate or Defect each round.
            </p>
            <div className="bg-surface border border-card-border rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted text-xs">
                    <th className="px-4 py-3 text-left w-12">Index</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {STRATEGIES.map(s => (
                    <tr key={s.index} className="border-b border-card-border last:border-0">
                      <td className="px-4 py-2 font-mono text-muted">{s.index}</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-accent text-sm">{s.key}</span>
                        <div className="text-xs text-muted md:hidden mt-0.5">{STRATEGY_CONFIGS[s.index].description}</div>
                      </td>
                      <td className="px-4 py-2 text-muted text-xs hidden md:table-cell">{STRATEGY_CONFIGS[s.index].description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a href="/configure" className="block group mt-4">
              <div className="bg-surface border border-card-border rounded-2xl p-5 flex items-center gap-5 hover:border-accent transition-all">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-background border border-card-border flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold mb-0.5">Strategy Lab</div>
                  <p className="text-sm text-muted">Simulate every strategy matchup interactively. Write custom bytecode programs with live WASM validation and preview.</p>
                </div>
                <svg className="w-5 h-5 text-muted shrink-0 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </Section>

          {/* Matching Algorithm */}
          <Section id="matching" title="Matching Algorithm">
            <p className="text-sm text-muted mb-4">
              The number of matches each player plays (K) is determined adaptively based on the number of participants:
            </p>
            <div className="bg-surface border border-card-border rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted text-xs">
                    <th className="px-4 py-3 text-left">Players (n)</th>
                    <th className="px-4 py-3 text-left">Effective K</th>
                    <th className="px-4 py-3 text-left">Method</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-card-border">
                    <td className="px-4 py-2">n ≤ 200</td>
                    <td className="px-4 py-2 font-mono">n − 1</td>
                    <td className="px-4 py-2 text-muted">Full round-robin (every player faces every other)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">n &gt; 200</td>
                    <td className="px-4 py-2 font-mono">clamp(K, 49, 99)</td>
                    <td className="px-4 py-2 text-muted">Feistel-network permutation</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>
                <strong>Total matches:</strong> approximately <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">n × K / 2</code> — each match involves two players, so total unique pairings is roughly half the sum of all individual match counts. The exact count depends on the pairing mode and whether offsets are clamped.
              </p>
              <p>
                <strong>Pairing method:</strong> For small tournaments (≤200 players), full round-robin ensures every player faces every other player exactly once. For larger tournaments, a Feistel-network permutation pairs players deterministically with O(1) memory per match.
              </p>
              <p>
                <strong>Deterministic seed:</strong> The randomness seed is derived from <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">SlotHashes[16..48]</code> with the first 4 bytes XOR&apos;d with <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">tournament_id</code>, captured at the moment the reveal phase closes. This seed drives round counts and per-round RNG. The operator cannot manipulate it.
              </p>
            </div>

            <a href="/matchmaking" className="block group mt-4">
              <div className="bg-surface border border-card-border rounded-2xl p-5 flex items-center gap-5 hover:border-accent transition-all">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-background border border-card-border flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold mb-0.5">Matchmaking Visualizer</div>
                  <p className="text-sm text-muted">See how pairings are generated, explore the round-robin and Feistel permutation algorithms, and verify match fairness interactively.</p>
                </div>
                <svg className="w-5 h-5 text-muted shrink-0 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </Section>

          {/* Rounds & Scoring */}
          <Section id="rounds" title="Rounds & Scoring">
            <p className="text-sm text-muted mb-4">
              Each match consists of a variable number of rounds, determined by a geometric distribution. Players don&apos;t know exactly when the match will end, preventing end-game exploitation.
            </p>

            <div className="bg-surface border border-card-border rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted text-xs">
                    <th className="px-4 py-3 text-left">Round Tier</th>
                    <th className="px-4 py-3 text-left">Range</th>
                    <th className="px-4 py-3 text-left">End Probability</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-card-border">
                    <td className="px-4 py-2 font-medium">Standard</td>
                    <td className="px-4 py-2 font-mono">20–50 rounds</td>
                    <td className="px-4 py-2 text-muted">5% per round after minimum</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Compressed</td>
                    <td className="px-4 py-2 font-mono">10–30 rounds</td>
                    <td className="px-4 py-2 text-muted">7% per round after minimum</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>
                <strong>Geometric distribution:</strong> After reaching the minimum round count, each subsequent round has a fixed probability of being the last. This creates unpredictable match lengths that average near the midpoint of the range.
              </p>
              <p>
                <strong>Per-round RNG isolation:</strong> Each player&apos;s move is computed independently using an isolated RNG stream. One player&apos;s randomness (e.g., for the Random strategy) never affects the other&apos;s.
              </p>
              <p>
                <strong>Final ranking:</strong> Players are ranked by cumulative score across all their matches. The top 25% (minimum 1 winner) qualify for the prize pool.
              </p>
            </div>
          </Section>

          {/* Fees & Payouts */}
          <Section id="payouts" title="Fees & Payouts">
            <p className="text-sm text-muted mb-4">
              The total prize pool comes from all player stakes. Before distribution, fees are deducted:
            </p>

            <div className="neon-card rounded-xl p-4 mb-4">
              <div className="text-xs font-bold text-muted uppercase mb-3">Pool Breakdown (illustrative)</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-full bg-skeleton rounded-full h-6 overflow-hidden flex">
                    <div className="bg-accent h-full flex items-center justify-center text-white text-[10px] font-bold" style={{ flex: 8 }}>
                      Winner Pool
                    </div>
                    <div className="bg-warning h-full flex items-center justify-center text-white text-[10px] font-bold" style={{ flex: 1 }}>
                      Op
                    </div>
                    <div className="bg-muted h-full flex items-center justify-center text-white text-[10px] font-bold" style={{ flex: 1 }}>
                      Fee
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Winner Pool (remaining after fees)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning" /> Operator Reimbursement (tx costs)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted" /> House Fee (configurable bps)</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>
                <strong>House fee:</strong> Configurable in basis points (1 bps = 0.01%). Currently set by the admin. Deducted from the total pool before winner distribution.
              </p>
              <p>
                <strong>Operator reimbursement:</strong> The operator bot pays Solana transaction fees for running matches. These costs are tracked on-chain and reimbursed from the pool before winners are paid, ensuring operators are never out of pocket.
              </p>
              <p>
                <strong>Winner determination:</strong> Top 25% of players by score (minimum 1 winner). All winners receive an equal share of the winner pool.
              </p>
              <p>
                <strong>Claim window:</strong> Winners have 30 days from payout start to claim their prize. Unclaimed funds are swept to accumulated house fees. Expired entries are closed by the operator, returning rent to the player.
              </p>
            </div>
          </Section>

          {/* On-Chain Accounts */}
          <Section id="accounts" title="On-Chain Accounts">
            <p className="text-sm text-muted mb-4">
              The program uses 3 PDA (Program Derived Address) types. All state is fully on-chain.
            </p>

            <div className="space-y-3 mb-4">
              <PDARow name="Config" seeds={['"config"']} desc="Global parameters: admin, operator, fees, stake amount, timing durations, accumulated fees, current tournament ID." />
              <PDARow name="Tournament" seeds={['"tournament"', 'u32_le_bytes(id)']} desc="Per-tournament state: phase, participants, scores, strategies, match progress, randomness seed, winner pool." />
              <PDARow name="Entry" seeds={['"entry"', 'tournament_pubkey', 'player_pubkey']} desc="Per-player per-tournament: commitment hash, revealed strategy, score, matches played, payout status." />
            </div>

            <DetailBlock summary="Account discriminators">
              <div className="space-y-2 text-sm">
                <DiscRow name="Config" bytes="[155, 12, 170, 224, 30, 250, 204, 130]" />
                <DiscRow name="Tournament" bytes="[175, 139, 119, 242, 115, 194, 57, 92]" />
                <DiscRow name="Entry" bytes="[63, 18, 152, 113, 215, 246, 221, 250]" />
              </div>
            </DetailBlock>
          </Section>

          {/* Security & Verification */}
          <Section id="security" title="Security & Verification">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {[
                { title: 'Reproducible Matches', desc: 'All matches can be replayed off-chain given the randomness seed and player strategies. The match-logic crate compiles to both native and WASM, enabling independent verification.' },
                { title: 'Admin/Operator Separation', desc: 'The admin can only update configuration (fees, timing, stake). The operator can only advance tournament phases and run matches. Neither role can alter match outcomes or steal funds.' },
                { title: 'On-Chain Guarantees', desc: 'Overflow protection on all arithmetic. Rent-exempt accounts. Tournament parameters are snapshotted at creation — admin config changes don\'t affect in-progress tournaments.' },
                { title: 'Deterministic Execution', desc: 'Match outcomes depend only on the randomness seed (from SlotHashes) and player strategies. The operator submits transactions but has no influence over results.' },
              ].map(item => (
                <div key={item.title} className="neon-card rounded-xl p-4">
                  <div className="font-bold text-sm mb-1">{item.title}</div>
                  <div className="text-xs text-muted">{item.desc}</div>
                </div>
              ))}
            </div>

            <DetailBlock summary="How to verify the program binary">
              <div className="text-sm text-muted space-y-2">
                <p>Anyone can verify that the deployed program matches the public source code using <a href="https://github.com/Ellipsis-Labs/solana-verifiable-build" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">solana-verify</a>:</p>
                <div className="bg-surface border border-card-border rounded-lg p-3 font-mono text-xs">
                  solana-verify verify-from-repo \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;https://github.com/makoto-kusanagi/prisoners-arena-program \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;--program-id {'<PROGRAM_ID>'} \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;--library-name prisoners_arena
                </div>
                <p>The program ID can be found via the <a href="/api/config" className="text-accent hover:text-accent-hover">config API</a> or on the homepage.</p>
              </div>
            </DetailBlock>

            <DetailBlock summary="How to replay matches locally">
              <div className="text-sm text-muted space-y-2">
                <p>The <code className="bg-surface px-1 rounded text-xs font-mono">match-logic</code> crate is the same code used on-chain and by the operator. To replay:</p>
                <p>1. Fetch the tournament&apos;s randomness seed and all player strategies from the API</p>
                <p>2. Use the <code className="bg-surface px-1 rounded text-xs font-mono">match-logic</code> crate to generate pairings and execute matches with the same seed</p>
                <p>3. Compare computed scores against on-chain values to confirm correctness</p>
              </div>
            </DetailBlock>
          </Section>


        </div>
      </div>
    </TracingBeam>
    <Footer />
    </>
  );
}

/* Inline helper components */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="text-xl font-bold mb-4 border-b border-card-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function TOCLink({ id, label }: { id: string; label: string }) {
  return (
    <a href={`#${id}`}
       className="block text-sm text-muted hover:text-foreground hover:border-l-2 hover:border-accent pl-3 py-1 transition-all">
      {label}
    </a>
  );
}

function DetailBlock({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="mt-3">
      <summary className="text-xs text-muted cursor-pointer hover:text-foreground font-medium">{summary}</summary>
      <div className="mt-2 bg-surface border border-card-border rounded-lg p-4">
        {children}
      </div>
    </details>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 text-sm">
      <span className="text-muted w-28 shrink-0">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function OutcomeCard({ name, scores, desc, color }: { name: string; scores: string; desc: string; color: string }) {
  return (
    <div className="bg-surface border border-card-border rounded-lg p-3 text-center">
      <div className="text-xs text-muted">{name}</div>
      <div className={`font-mono font-bold ${color}`}>{scores}</div>
      <div className="text-[10px] text-muted">{desc}</div>
    </div>
  );
}

function PDARow({ name, seeds, desc }: { name: string; seeds: string[]; desc: string }) {
  return (
    <div className="bg-surface border border-card-border rounded-lg px-4 py-3">
      <div className="flex items-center gap-4 text-sm mb-1">
        <span className="font-bold w-24">{name}</span>
        <code className="font-mono text-accent text-xs">[{seeds.join(', ')}]</code>
      </div>
      <div className="text-xs text-muted">{desc}</div>
    </div>
  );
}

function DiscRow({ name, bytes }: { name: string; bytes: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-bold w-24">{name}</span>
      <code className="font-mono text-xs text-muted">{bytes}</code>
    </div>
  );
}
