import { fetchEntryByPlayer } from '@/lib/solana';
import { apiSuccess, apiError } from '@/lib/api';
import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pubkey: string }> }) {
  try {
    const { pubkey } = await params;
    const entry = await fetchEntryByPlayer(pubkey);
    if (!entry) return apiError('Entry not found', 'NOT_FOUND', 404);
    return apiSuccess(entry);
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
