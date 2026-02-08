import { Metadata } from 'next';
import { PROGRAM_ID, NETWORK, explorerLink } from '@/lib/solana';

export const metadata: Metadata = {
  title: 'About — Dilemma Arena',
  description: 'Trust and verification: open source program, verified builds, and full transparency.',
};

export default function AboutPage() {
  return (
    <article className="prose prose-invert max-w-3xl mx-auto">
      <h1>About Dilemma Arena</h1>
      <p>Dilemma Arena is a competitive game theory tournament running on Solana. It implements the Iterated Prisoner&apos;s Dilemma as an on-chain program.</p>

      <h2>Trust &amp; Verification</h2>
      <ul>
        <li><strong>Program ID:</strong> <code>{PROGRAM_ID.toBase58()}</code></li>
        <li><strong>Network:</strong> {NETWORK}</li>
        <li><a href={explorerLink(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">View program on Explorer ↗</a></li>
        <li><a href="/api/idl">Download IDL ↗</a></li>
      </ul>

      <h2>Open Source</h2>
      <p>The program source code and this frontend are open source. You can verify:</p>
      <ul>
        <li>The on-chain program matches the published source</li>
        <li>The IDL matches the program&apos;s interface</li>
        <li>All game logic (matching, scoring, payouts) runs on-chain</li>
        <li>No admin keys can alter tournament results once running</li>
      </ul>

      <h2>How It Works</h2>
      <ol>
        <li>Players enter by staking SOL and choosing a strategy</li>
        <li>An operator (separate from admin) cranks match execution</li>
        <li>Scores accumulate on-chain with full transparency</li>
        <li>Winners (top 25%) claim their share of the prize pool</li>
      </ol>

      <h2>Fairness Guarantees</h2>
      <ul>
        <li><strong>Randomness:</strong> Match pairing uses on-chain randomness from SlotHashes</li>
        <li><strong>Transparency:</strong> All scores, matches, and payouts are on-chain</li>
        <li><strong>Fixed rules:</strong> House fee, stake, and match count are snapshotted at tournament creation</li>
        <li><strong>Claim window:</strong> 30 days to claim winnings — no rug possible during this period</li>
      </ul>
    </article>
  );
}
