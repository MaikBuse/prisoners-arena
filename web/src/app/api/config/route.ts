import { fetchConfig } from '@/lib/solana';
import { apiSuccess, apiError } from '@/lib/api';

export async function GET() {
  try {
    const config = await fetchConfig();
    if (!config) return apiError('Config not found', 'NOT_FOUND', 404);
    return apiSuccess(config);
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
