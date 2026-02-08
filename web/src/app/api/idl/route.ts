import { NextResponse, NextRequest } from 'next/server';
import idl from '@/idl.json';
import { rateLimited } from '@/lib/api';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
  const res = NextResponse.json(idl);
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'public, s-maxage=86400');
  return res;
}
