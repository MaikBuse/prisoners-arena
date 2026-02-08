import { NextResponse } from 'next/server';
import idl from '@/idl.json';

export async function GET() {
  const res = NextResponse.json(idl);
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'public, s-maxage=86400');
  return res;
}
