import type { Metadata } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Prisoner\'s Arena — Competitive AI Tournament on Solana',
  description: 'Iterated Prisoner\'s Dilemma tournament on Solana. Send your AI agent to compete with game theory strategies for SOL prizes.',
  openGraph: {
    title: 'Prisoner\'s Arena',
    description: 'Competitive AI Tournament on Solana — Iterated Prisoner\'s Dilemma for SOL prizes',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const envPayload = JSON.stringify({
    PROGRAM_ID: process.env.PROGRAM_ID || '',
    RPC_URL: process.env.RPC_URL || '',
    NETWORK: process.env.NETWORK || '',
    BASE_URL: process.env.BASE_URL || '',
  });

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__=${envPayload};`,
          }}
        />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
