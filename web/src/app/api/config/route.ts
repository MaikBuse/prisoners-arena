import { NextRequest } from 'next/server';
import { fetchConfig, PROGRAM_ID, NETWORK, RPC_URL, explorerLink } from '@/lib/solana';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
  try {
    const config = await fetchConfig();
    if (!config) return apiError('Config not found', 'NOT_FOUND', 404);
    return apiSuccess({
      ...config,
      programId: PROGRAM_ID.toBase58(),
      network: NETWORK,
      rpcUrl: RPC_URL,
      explorerUrl: explorerLink(PROGRAM_ID.toBase58()),
    });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
