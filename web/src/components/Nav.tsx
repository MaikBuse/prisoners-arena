import { LogoSmall } from './Logo';

const TOOLS = [
  { href: '/configure', label: 'Strategy Lab', desc: 'Simulate and compare strategies' },
  { href: '/matchmaking', label: 'Matchmaking', desc: 'Visualize how pairing and scoring work' },
];

const LINKS = [
  { href: '/docs', label: 'API Docs' },
];

export function Nav() {
  return (
    <nav className="border-b border-[var(--card-border)] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoSmall />
          <span className="font-bold text-lg">Prisoner&apos;s Arena</span>
        </a>
        <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
          <a href="/how-it-works" className="hover:text-[var(--foreground)] transition-colors hidden sm:inline">How It Works</a>
          {/* Tools dropdown */}
          <div className="relative group hidden sm:block">
            <button className="hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
              Tools
              <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <div className="bg-white border border-[var(--card-border)] rounded-xl shadow-lg py-2 w-56">
                {TOOLS.map(t => (
                  <a key={t.href} href={t.href} className="block px-4 py-2.5 hover:bg-neutral-50 transition-colors">
                    <div className="text-sm text-[var(--foreground)] font-medium">{t.label}</div>
                    <div className="text-xs text-[var(--muted)]">{t.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
          {LINKS.map(l => (
            <a key={l.href} href={l.href} className="hover:text-[var(--foreground)] transition-colors hidden sm:inline">
              {l.label}
            </a>
          ))}
          <span className="network-badge text-xs px-2 py-0.5 rounded-full font-mono">devnet</span>
        </div>
      </div>
    </nav>
  );
}
