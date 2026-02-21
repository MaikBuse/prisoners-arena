import { NextRequest, NextResponse } from 'next/server';
import { resolveNetworkFromHost } from './lib/network-config';

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0] ?? 'localhost';
  const network = resolveNetworkFromHost(hostname);

  const headers = new Headers(request.headers);
  headers.set('x-network', network);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
