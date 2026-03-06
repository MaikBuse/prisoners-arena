import { PublicKey } from '@solana/web3.js';
import { fetchEntryByPlayer } from '@/lib/solana';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';
import { NextRequest } from 'next/server';
import { resolveNetwork } from '@/lib/config';
import { runWithNetwork } from '@/lib/network-context';

export async function GET(req: NextRequest, { params }: { params: Promise<{ pubkey: string }> }) {
  const network = resolveNetwork(req);
  return runWithNetwork(network, async () => {
    const limited = rateLimited(req);
    if (limited) return limited;
    try {
      const { pubkey } = await params;
      try {
        new PublicKey(pubkey);
      } catch {
        return apiError('Invalid public key', 'INVALID_PUBKEY', 400);
      }
      const entry = await fetchEntryByPlayer(pubkey);
      if (!entry) return apiError('Entry not found', 'NOT_FOUND', 404);
      return apiSuccess(entry);
    } catch (e) {
      return apiError((e as Error).message, 'FETCH_ERROR', 500);
    }
  });
}
