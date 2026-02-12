import { LogoSmall } from './Logo';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/configure', label: 'Strategy Lab' },
  { href: '/matchmaking', label: 'Matchmaking' },
  { href: '/docs', label: 'API Docs' },
];

export function Nav() {
  return (
    <nav className="border-b border-[var(--card-border)] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoSmall />
          <span className="font-bold text-lg">Dilemma Arena</span>
        </a>
        <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
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
