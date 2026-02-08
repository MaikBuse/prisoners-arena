import { NextResponse } from 'next/server';
import { NETWORK } from './solana';

export function apiSuccess(data: unknown, cacheSeconds = 10) {
  const res = NextResponse.json({
    ok: true,
    data,
    network: NETWORK,
    timestamp: new Date().toISOString(),
  });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`);
  return res;
}

export function apiError(error: string, code: string, status = 400) {
  const res = NextResponse.json({
    ok: false,
    error,
    code,
    network: NETWORK,
    timestamp: new Date().toISOString(),
  }, { status });
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}
