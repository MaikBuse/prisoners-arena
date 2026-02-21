import { AsyncLocalStorage } from 'node:async_hooks';
import type { NetworkId } from './network-config';

const storage = new AsyncLocalStorage<NetworkId>();

// Expose on globalThis so config.ts can read the current network
// without importing this module (which pulls in node:async_hooks
// and breaks client component bundling).
(globalThis as Record<string, unknown>).__networkStorage = storage;

export function runWithNetwork<T>(network: NetworkId, fn: () => T): T {
  return storage.run(network, fn);
}

export function getCurrentNetwork(): NetworkId {
  return storage.getStore() ?? 'devnet';
}
