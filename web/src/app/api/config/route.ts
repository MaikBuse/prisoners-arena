import { fetchConfig, PROGRAM_ID, NETWORK, RPC_URL, explorerLink } from '@/lib/solana';
import { apiSuccess, apiError } from '@/lib/api';

export async function GET() {
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
