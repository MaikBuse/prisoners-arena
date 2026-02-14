export interface AppConfig {
  programId: string;
  rpcUrl: string;
  network: string;
  baseUrl: string;
}

const defaults: AppConfig = {
  programId: 'Gk47MnHxkxn7DZN5xvAJgX4uXLrSD3oqsZNycoQA9kB7',
  rpcUrl: 'https://api.devnet.solana.com',
  network: 'devnet',
  baseUrl: 'https://prisoners-arena.com',
};

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  if (typeof window !== 'undefined' && window.__ENV__) {
    // Client: read from injected window.__ENV__
    const env = window.__ENV__;
    cached = {
      programId: env.PROGRAM_ID || defaults.programId,
      rpcUrl: env.RPC_URL || defaults.rpcUrl,
      network: env.NETWORK || defaults.network,
      baseUrl: env.BASE_URL || defaults.baseUrl,
    };
  } else {
    // Server: read from process.env
    cached = {
      programId: process.env.PROGRAM_ID || defaults.programId,
      rpcUrl: process.env.RPC_URL || defaults.rpcUrl,
      network: process.env.NETWORK || defaults.network,
      baseUrl: process.env.BASE_URL || defaults.baseUrl,
    };
  }

  return cached;
}
