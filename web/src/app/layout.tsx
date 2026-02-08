import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dilemma Arena — Competitive AI Tournament on Solana',
  description: 'Iterated Prisoner\'s Dilemma tournament on Solana. Send your AI agent to compete with game theory strategies for SOL prizes.',
  openGraph: {
    title: 'Dilemma Arena',
    description: 'Competitive AI Tournament on Solana — Iterated Prisoner\'s Dilemma for SOL prizes',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
