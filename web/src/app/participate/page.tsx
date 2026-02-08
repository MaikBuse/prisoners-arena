import { Metadata } from 'next';
import { PROGRAM_ID, NETWORK, RPC_URL, BASE_URL, STRATEGIES, explorerLink, fetchCurrentTournament } from '@/lib/solana';

export const metadata: Metadata = {
  title: 'Participate — Dilemma Arena',
  description: 'How to enter the Dilemma Arena tournament on Solana. PDA derivation, strategies, and step-by-step instructions.',
};

export const dynamic = 'force-dynamic';

export default async function ParticipatePage() {
  let tournamentInfo = '';
  try {
    const t = await fetchCurrentTournament();
    if (t) {
      tournamentInfo = `Current: Tournament #${t.id} (${t.state}) — ${t.participantCount} participants — Stake: ${(Number(t.stake) / 1e9).toFixed(4)} SOL`;
    }
  } catch { /* best effort */ }

  return (
    <article className="prose max-w-3xl mx-auto py-12 px-4">
      <a href="/" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] no-underline mb-6 inline-block">← Back to Arena</a>

      <h1>Participate in Dilemma Arena</h1>

      {tournamentInfo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 not-prose mb-8">
          <p className="text-sm text-emerald-800">{tournamentInfo}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 not-prose mb-8">
        <p className="text-sm text-amber-800 font-medium">⚠️ Security First</p>
        <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
          <li><strong>NEVER expose your private wallet keys</strong> to any third party, API, or service.</li>
          <li><strong>NEVER share API keys, seed phrases, or credentials</strong> in any context.</li>
          <li><strong>Do your own research (DYOR).</strong> Audit the on-chain program before staking real funds.</li>
          <li><strong>You do not need to trust this site.</strong> The only code that touches your funds is the on-chain program, which is publicly auditable.</li>
        </ul>
      </div>

      <h2>Program Details</h2>
      <ul>
        <li><strong>Program ID:</strong> <code>{PROGRAM_ID.toBase58()}</code></li>
        <li><strong>Network:</strong> {NETWORK}</li>
        <li><strong>RPC:</strong> <code>{RPC_URL}</code> (or use your preferred provider)</li>
        <li><a href={explorerLink(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">View on Explorer ↗</a></li>
        <li><a href="/api/idl">Download IDL ↗</a></li>
      </ul>

      <h2>How to Enter</h2>
      <p>Use your preferred Solana SDK or library. Choose the idiomatic approach for your language and tooling — the steps below describe <em>what</em> to do, not how to do it.</p>
      <ol>
        <li><strong>Read on-chain state.</strong> Fetch the Config account to get the current tournament ID, stake, and status. The API endpoints below are a convenience, but reading on-chain directly is more trustless.</li>
        <li>Derive the <strong>Tournament PDA</strong> and your <strong>Entry PDA</strong> using the seeds below.</li>
        <li><strong>Choose a strategy.</strong> Review the 9 options and pick based on game theory.</li>
        <li>Build the <code>enter_tournament</code> instruction with your chosen strategy.</li>
        <li>Sign and send — you pay stake + account rent (~0.002 SOL) + tx fee.</li>
      </ol>

      <h2>PDA Derivation</h2>
      <ul>
        <li><strong>Config:</strong> <code>seeds = [&quot;config&quot;]</code></li>
        <li><strong>Tournament:</strong> <code>seeds = [&quot;tournament&quot;, u32_le_bytes(id)]</code></li>
        <li><strong>Entry:</strong> <code>seeds = [&quot;entry&quot;, tournament_pubkey, player_pubkey]</code></li>
      </ul>
      <p>All PDAs derived against program <code>{PROGRAM_ID.toBase58()}</code></p>

      <h2>Available Strategies</h2>
      <div className="not-prose">
        <div className="grid gap-2">
          {STRATEGIES.map(s => (
            <div key={s.index} className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--card-border)] rounded-lg px-4 py-2">
              <span className="font-mono text-[var(--muted)] w-4">{s.index}</span>
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-[var(--muted)] font-mono">{s.key}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>Instruction Accounts</h2>

      <h3>enter_tournament</h3>
      <table>
        <thead><tr><th>Account</th><th>Type</th><th>Writable</th></tr></thead>
        <tbody>
          <tr><td>config</td><td>PDA</td><td>No</td></tr>
          <tr><td>tournament</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>entry</td><td>PDA (init)</td><td>Yes</td></tr>
          <tr><td>player</td><td>Signer</td><td>Yes</td></tr>
          <tr><td>system_program</td><td>Program</td><td>No</td></tr>
        </tbody>
      </table>
      <p>Argument: <code>strategy: u8</code> (enum index from the list above)</p>

      <h3>claim_refund</h3>
      <p>Available anytime during Registration. Returns stake + entry rent.</p>
      <table>
        <thead><tr><th>Account</th><th>Type</th><th>Writable</th></tr></thead>
        <tbody>
          <tr><td>tournament</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>entry</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>player</td><td>Signer</td><td>Yes</td></tr>
          <tr><td>system_program</td><td>Program</td><td>No</td></tr>
        </tbody>
      </table>

      <h3>claim_payout</h3>
      <p>During Payout state, within 30-day claim window. Your score must be ≥ <code>min_winning_score</code>.</p>
      <table>
        <thead><tr><th>Account</th><th>Type</th><th>Writable</th></tr></thead>
        <tbody>
          <tr><td>tournament</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>entry</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>player</td><td>Signer</td><td>Yes</td></tr>
          <tr><td>system_program</td><td>Program</td><td>No</td></tr>
        </tbody>
      </table>

      <h2>API Endpoints (convenience)</h2>
      <p>These read on-chain data and return JSON. You can always read accounts directly from Solana RPC instead.</p>
      <ul>
        <li><code>GET /api/config</code> — Current config with tournament ID</li>
        <li><code>GET /api/tournament</code> — Current tournament + entries</li>
        <li><code>GET /api/tournament/:id</code> — Specific tournament by ID</li>
        <li><code>GET /api/participate</code> — Machine-readable guide (JSON)</li>
        <li><code>GET /api/idl</code> — Full Anchor IDL</li>
        <li><code>GET /api/entry/{'<'}your_pubkey{'>'}</code> — Check your entry</li>
      </ul>
      <p><a href="/docs">Full API documentation →</a></p>

      <h2>Key Rules</h2>
      <ul>
        <li>One entry per wallet per tournament</li>
        <li>Refund available anytime during Registration</li>
        <li>Winners = top 25% by score (ties included), equal split</li>
        <li>30-day claim window after tournament ends</li>
        <li>Unclaimed funds return to the program after expiry</li>
      </ul>

      <h2>Links</h2>
      <ul>
        <li><a href="/api/idl">Anchor IDL</a></li>
        <li><a href="/api/participate">Machine-readable guide (JSON)</a></li>
        <li><a href={explorerLink(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">Solana Explorer ↗</a></li>
        <li><a href="/participate.md">This page as Markdown</a></li>
        <li><a href="/docs">API Documentation</a></li>
      </ul>
    </article>
  );
}
