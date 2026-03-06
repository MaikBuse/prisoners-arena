import { NextRequest } from 'next/server';
import { fetchConfig, getProgramId, getNetwork, explorerLink } from '@/lib/solana';
import { resolveNetwork } from '@/lib/config';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';
import { runWithNetwork } from '@/lib/network-context';

export async function GET(request: NextRequest) {
  const network = resolveNetwork(request);
  return runWithNetwork(network, async () => {
    const limited = rateLimited(request);
    if (limited) return limited;
    try {
      const config = await fetchConfig();
      if (!config) return apiError('Config not found', 'NOT_FOUND', 404);
      const programId = getProgramId().toBase58();
      return apiSuccess({
        ...config,
        programId,
        network: getNetwork(),
        explorerUrl: explorerLink(programId),
      });
    } catch (e) {
      return apiError((e as Error).message, 'FETCH_ERROR', 500);
    }
  });
}
