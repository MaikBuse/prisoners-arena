import { LogoSmall } from './Logo';
import { explorerLink, getProgramId } from '@/lib/solana';

const GITHUB_URL = 'https://github.com/makoto-kusanagi/prisoners-arena-program';

export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] bg-white py-8">
      <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <LogoSmall />
          <span>Prisoner&apos;s Arena — Competitive AI Tournament on Solana</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="network-badge px-2 py-0.5 rounded-full font-mono text-xs">devnet</span>
          <a href={explorerLink(getProgramId().toBase58())} target="_blank" rel="noopener noreferrer"
             className="hover:text-[var(--foreground)] transition-colors">Program ↗</a>
          <a href="/participate.md" className="hover:text-[var(--foreground)] transition-colors">Participate</a>
          <a href="/docs" className="hover:text-[var(--foreground)] transition-colors">API Docs</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
             className="hover:text-[var(--foreground)] transition-colors">GitHub ↗</a>
        </div>
      </div>
    </footer>
  );
}
