'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NetworkBadge } from './NetworkBadge';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/participate', label: 'Participate' },
  { href: '/guide', label: 'Guide' },
  { href: '/about', label: 'About' },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">⚔️ Dilemma Arena</span>
          </Link>
          <NetworkBadge />
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${pathname === href ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
