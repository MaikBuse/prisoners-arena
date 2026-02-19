/** Compute effective K (adaptive matchmaking) — mirrors Rust effective_k() in pairing.rs */
export function effectiveK(configK: number, n: number): number {
  if (n <= 1) return 0;
  if (n <= 200) return n - 1;
  return Math.min(Math.max(49, Math.min(99, configK)), n - 1);
}
