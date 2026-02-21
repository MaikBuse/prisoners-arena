'use client';

import { useState } from 'react';
import { LogoSmall } from './Logo';

const DOCS = [
  { href: '/api', label: 'API', desc: 'REST endpoints, PDA derivation, and error reference' },
  { href: '/docs/custom-strategy-vm', label: 'Custom Strategy VM', desc: 'Bytecode VM specification for custom strategies' },
];

const TOOLS = [
  { href: '/explorer', label: 'Tournament Explorer', desc: 'Browse and inspect tournament details' },
  { href: '/configure', label: 'Strategy Lab', desc: 'Simulate and compare strategies' },
  { href: '/matchmaking', label: 'Matchmaking', desc: 'Visualize how pairing and scoring work' },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-card-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoSmall />
          <span className="font-bold text-lg">Prisoner&apos;s Arena</span>
        </a>
        <div className="flex items-center gap-4 text-sm text-muted">
          <a href="/docs" className="hover:text-foreground transition-colors hidden sm:inline">
            How It Works
          </a>
          {/* Tools dropdown */}
          <div className="relative group hidden sm:block">
            <button className="hover:text-foreground transition-colors flex items-center gap-1">
              Tools
              <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <div className="bg-card border border-card-border rounded-xl shadow-lg py-2 w-56">
                {TOOLS.map(t => (
                  <a key={t.href} href={t.href} className="block px-4 py-2.5 hover:bg-white/5 transition-colors">
                    <div className="text-sm text-foreground font-medium">{t.label}</div>
                    <div className="text-xs text-muted">{t.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
          {/* Docs dropdown */}
          <div className="relative group hidden sm:block">
            <button className="hover:text-foreground transition-colors flex items-center gap-1">
              Docs
              <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <div className="bg-card border border-card-border rounded-xl shadow-lg py-2 w-56">
                {DOCS.map(t => (
                  <a key={t.href} href={t.href} className="block px-4 py-2.5 hover:bg-white/5 transition-colors">
                    <div className="text-sm text-foreground font-medium">{t.label}</div>
                    <div className="text-xs text-muted">{t.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <a href="https://github.com/makoto-kusanagi/prisoners-arena-program" target="_blank" rel="noopener noreferrer"
             className="hover:text-foreground transition-colors" aria-label="GitHub">
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
          <span className="network-badge text-xs px-2 py-0.5 rounded-full font-mono">devnet</span>
          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-1 hover:text-foreground transition-colors"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-card-border bg-card px-4 py-3 space-y-3 text-sm">
          <a href="/docs" className="block text-muted hover:text-foreground transition-colors">
            How It Works
          </a>
          {DOCS.map(t => (
            <a key={t.href} href={t.href} className="block text-muted hover:text-foreground transition-colors">
              {t.label}
            </a>
          ))}
          {TOOLS.map(t => (
            <a key={t.href} href={t.href} className="block text-muted hover:text-foreground transition-colors">
              {t.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
