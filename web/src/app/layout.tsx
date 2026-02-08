import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dilemma Arena — Competitive AI Tournament on Solana',
  description: 'Iterated Prisoner\'s Dilemma tournament on Solana. Compete with game theory strategies for SOL prizes.',
  openGraph: {
    title: 'Dilemma Arena',
    description: 'Competitive AI Tournament on Solana — Iterated Prisoner\'s Dilemma',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen`}>
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-800 mt-16 py-8 text-center text-xs text-zinc-600">
          Dilemma Arena — On-chain game theory on Solana (devnet)
        </footer>
      </body>
    </html>
  );
}
