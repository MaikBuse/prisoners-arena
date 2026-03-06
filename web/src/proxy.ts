import { NextRequest, NextResponse } from 'next/server';
import { resolveNetworkFromHost } from './lib/network-config';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.solana.com; img-src 'self' data:; font-src 'self'",
};

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0] ?? 'localhost';
  const network = resolveNetworkFromHost(hostname);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-network', network);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
