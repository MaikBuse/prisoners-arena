import type { NetworkId } from './network-config';
import { getNetworkConfig } from './network-config';

export interface AppConfig {
  programId: string;
  rpcUrl: string;
  network: string;
  baseUrl: string;
}

const defaults: AppConfig = {
  programId: '2j8FBKuXsBsHRjfVLWCdPtZbPDLKzM3jXG7JSAy4jtga',
  rpcUrl: 'https://api.devnet.solana.com',
  network: 'devnet',
  baseUrl: 'https://prisoners-arena.dev',
};

export function getConfig(): AppConfig {
  if (typeof window !== 'undefined' && window.__ENV__) {
    // Client: read from injected window.__ENV__
    const env = window.__ENV__;
    return {
      programId: env.PROGRAM_ID || defaults.programId,
      rpcUrl: env.RPC_URL || defaults.rpcUrl,
      network: env.NETWORK || defaults.network,
      baseUrl: env.BASE_URL || defaults.baseUrl,
    };
  }

  // Server: read network from AsyncLocalStorage via globalThis
  // (set by network-context.ts, avoids importing node:async_hooks here)
  const storage = (globalThis as Record<string, unknown>).__networkStorage as
    { getStore(): NetworkId | undefined } | undefined;
  const network: NetworkId = storage?.getStore() ?? 'devnet';
  const cfg = getNetworkConfig(network);
  return {
    programId: cfg.programId,
    rpcUrl: cfg.rpcUrl,
    network: cfg.network,
    baseUrl: cfg.baseUrl,
  };
}

/** Helper to resolve NetworkId from an incoming request's x-network header */
export function resolveNetwork(request: Request): NetworkId {
  return (request.headers.get('x-network') as NetworkId) || 'devnet';
}
