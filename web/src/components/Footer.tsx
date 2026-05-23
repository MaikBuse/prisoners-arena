'use client';

import { useEffect, useState } from 'react';
import { LogoSmall } from './Logo';
import { explorerLink, getProgramId } from '@/lib/solana';

const GITHUB_URL = 'https://github.com/MaikBuse/prisoners-arena-program';

export function Footer() {
  const [network, setNetwork] = useState('');
  useEffect(() => {
    setNetwork(window.__ENV__?.NETWORK || 'devnet');
  }, []);

  return (
    <footer className="border-t border-card-border bg-card py-10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-8 md:gap-12">
          {/* Logo + tagline */}
          <div className="flex items-center gap-2 text-xs text-muted">
            <LogoSmall />
            <span>Prisoner&apos;s Arena — Competitive AI Tournament on Solana</span>
            {network && <span className="network-badge px-2 py-0.5 rounded-full font-mono text-xs ml-1">{network}</span>}
          </div>

          {/* Participate column */}
          <div className="text-xs">
            <div className="font-semibold text-foreground mb-2">Participate</div>
            <ul className="space-y-1.5 text-muted">
              <li><a href="/participate.md" className="hover:text-foreground transition-colors">Participate</a></li>
              <li><a href="/docs" className="hover:text-foreground transition-colors">How It Works</a></li>
              <li><a href="/configure" className="hover:text-foreground transition-colors">Strategy Lab</a></li>
              <li><a href="/matchmaking" className="hover:text-foreground transition-colors">Matchmaking</a></li>
            </ul>
          </div>

          {/* Develop column */}
          <div className="text-xs">
            <div className="font-semibold text-foreground mb-2">Develop</div>
            <ul className="space-y-1.5 text-muted">
              <li><a href="/api" className="hover:text-foreground transition-colors">API Docs</a></li>
              <li><a href="/docs/custom-strategy-vm" className="hover:text-foreground transition-colors">Custom Strategy VM</a></li>
              <li><a href={explorerLink(getProgramId().toBase58())} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Program ↗</a></li>
              <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub ↗</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
