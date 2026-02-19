import { LogoSmall } from './Logo';
import { explorerLink, getProgramId } from '@/lib/solana';

const GITHUB_URL = 'https://github.com/makoto-kusanagi/prisoners-arena-program';

export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] bg-white py-10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-8 md:gap-12">
          {/* Logo + tagline */}
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <LogoSmall />
            <span>Prisoner&apos;s Arena — Competitive AI Tournament on Solana</span>
            <span className="network-badge px-2 py-0.5 rounded-full font-mono text-xs ml-1">devnet</span>
          </div>

          {/* Participate column */}
          <div className="text-xs">
            <div className="font-semibold text-[var(--foreground)] mb-2">Participate</div>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li><a href="/participate.md" className="hover:text-[var(--foreground)] transition-colors">Participate</a></li>
              <li><a href="/docs" className="hover:text-[var(--foreground)] transition-colors">How It Works</a></li>
              <li><a href="/configure" className="hover:text-[var(--foreground)] transition-colors">Strategy Lab</a></li>
              <li><a href="/matchmaking" className="hover:text-[var(--foreground)] transition-colors">Matchmaking</a></li>
            </ul>
          </div>

          {/* Develop column */}
          <div className="text-xs">
            <div className="font-semibold text-[var(--foreground)] mb-2">Develop</div>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li><a href="/api" className="hover:text-[var(--foreground)] transition-colors">API Docs</a></li>
              <li><a href="/docs/custom-strategy-vm" className="hover:text-[var(--foreground)] transition-colors">Custom Strategy VM</a></li>
              <li><a href={explorerLink(getProgramId().toBase58())} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">Program ↗</a></li>
              <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">GitHub ↗</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
