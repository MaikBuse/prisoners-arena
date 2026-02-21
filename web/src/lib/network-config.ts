export type NetworkId = 'mainnet-beta' | 'devnet';

export const NETWORK_IDS: NetworkId[] = ['devnet', 'mainnet-beta'];

export interface NetworkConfig {
  programId: string;
  rpcUrl: string;
  network: NetworkId;
  baseUrl: string;
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getNetworkConfig(network: NetworkId): NetworkConfig {
  if (network === 'mainnet-beta') {
    return {
      programId: getEnv('MAINNET_PROGRAM_ID') || 'TBD',
      rpcUrl: getEnv('MAINNET_RPC_URL') || 'https://api.mainnet-beta.solana.com',
      network: 'mainnet-beta',
      baseUrl: 'https://prisoners-arena.com',
    };
  }
  return {
    programId: '2j8FBKuXsBsHRjfVLWCdPtZbPDLKzM3jXG7JSAy4jtga',
    rpcUrl: getEnv('DEVNET_RPC_URL') || getEnv('RPC_URL') || 'https://api.devnet.solana.com',
    network: 'devnet',
    baseUrl: 'https://prisoners-arena.dev',
  };
}

export function getAllNetworkConfigs(): NetworkConfig[] {
  return NETWORK_IDS.map(getNetworkConfig);
}

export function resolveNetworkFromHost(hostname: string): NetworkId {
  if (hostname === 'prisoners-arena.com' || hostname === 'www.prisoners-arena.com') {
    return 'mainnet-beta';
  }
  return 'devnet';
}
