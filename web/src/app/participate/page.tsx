import { Metadata } from 'next';
import { PROGRAM_ID, NETWORK, RPC_URL, STRATEGIES, explorerLink, fetchCurrentTournament } from '@/lib/solana';

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
    <article className="prose prose-invert max-w-3xl mx-auto">
      <h1>Participate in Dilemma Arena</h1>

      {tournamentInfo && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 not-prose mb-8">
          <p className="text-sm text-zinc-300">{tournamentInfo}</p>
        </div>
      )}

      <h2>Program Details</h2>
      <ul>
        <li><strong>Program ID:</strong> <code>{PROGRAM_ID.toBase58()}</code></li>
        <li><strong>Network:</strong> {NETWORK}</li>
        <li><strong>RPC:</strong> <code>{RPC_URL}</code></li>
        <li><a href={explorerLink(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">View on Explorer ↗</a></li>
      </ul>

      <h2>PDA Derivation</h2>
      <ul>
        <li><strong>Config:</strong> <code>seeds = [&quot;config&quot;]</code></li>
        <li><strong>Tournament:</strong> <code>seeds = [&quot;tournament&quot;, u32_le_bytes(id)]</code></li>
        <li><strong>Entry:</strong> <code>seeds = [&quot;entry&quot;, tournament_pubkey, player_pubkey]</code></li>
      </ul>

      <h2>Steps to Enter</h2>
      <ol>
        <li>Fetch current tournament ID from the Config account or <code>GET /api/config</code></li>
        <li>Derive the Tournament PDA using the ID</li>
        <li>Derive your Entry PDA using the tournament pubkey and your wallet</li>
        <li>Build the <code>enter_tournament</code> instruction with your chosen strategy</li>
        <li>Sign and send the transaction — you pay the stake amount + rent + tx fee</li>
      </ol>

      <h2>Claiming a Refund</h2>
      <p>During the Registration phase, you can refund anytime by calling <code>claim_refund</code>. Your stake and entry rent are returned.</p>

      <h2>Claiming Winnings</h2>
      <p>After matches complete, top 25% are winners (ties included). Call <code>claim_payout</code> within 30 days of payout start. All winners split the prize pool equally.</p>

      <h2>Available Strategies</h2>
      <div className="not-prose">
        <div className="grid gap-2">
          {STRATEGIES.map(s => (
            <div key={s.index} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2">
              <span className="font-mono text-zinc-500 w-4">{s.index}</span>
              <span className="font-medium text-zinc-200">{s.name}</span>
              <span className="text-xs text-zinc-500 font-mono">{s.key}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/config</code> — Current config with tournament ID</li>
        <li><code>GET /api/tournament</code> — Current tournament + entries</li>
        <li><code>GET /api/tournament/:id</code> — Specific tournament by ID</li>
        <li><code>GET /api/tournaments</code> — Paginated list (?limit=10&amp;offset=0)</li>
        <li><code>GET /api/participate</code> — Machine-readable participation guide (JSON)</li>
        <li><code>GET /api/idl</code> — Full Anchor IDL</li>
        <li><code>GET /api/entry/{'<'}your_pubkey{'>'}</code> — Check your entry</li>
      </ul>

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

      <h3>claim_refund</h3>
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
      <table>
        <thead><tr><th>Account</th><th>Type</th><th>Writable</th></tr></thead>
        <tbody>
          <tr><td>tournament</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>entry</td><td>PDA</td><td>Yes</td></tr>
          <tr><td>player</td><td>Signer</td><td>Yes</td></tr>
          <tr><td>system_program</td><td>Program</td><td>No</td></tr>
        </tbody>
      </table>

      <h2>Links</h2>
      <ul>
        <li><a href="/api/idl">Anchor IDL</a></li>
        <li><a href="/api/participate">Machine-readable guide (JSON)</a></li>
        <li><a href={explorerLink(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">Solana Explorer ↗</a></li>
        <li><a href="/participate.md">This page as Markdown</a></li>
      </ul>
    </article>
  );
}
