import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getNetworkConfig } from '@/lib/network-config';
import type { NetworkId } from '@/lib/network-config';
import { enterNetwork } from '@/lib/network-context';

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const network = (hdrs.get('x-network') as NetworkId) || 'devnet';
  enterNetwork(network);
  const cfg = getNetworkConfig(network);

  const envPayload = JSON.stringify({
    PROGRAM_ID: cfg.programId,
    RPC_URL: cfg.rpcUrl,
    NETWORK: cfg.network,
    BASE_URL: cfg.baseUrl,
  });

  return (
    <html lang="en" className="dark" data-network={network}>
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
