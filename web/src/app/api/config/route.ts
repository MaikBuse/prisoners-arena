import { NextRequest } from 'next/server';
import { fetchConfig, getProgramId, getNetwork, explorerLink } from '@/lib/solana';
import { getConfig } from '@/lib/config';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';

export async function GET(request: NextRequest) {
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
      rpcUrl: getConfig().rpcUrl,
      explorerUrl: explorerLink(programId),
    });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
