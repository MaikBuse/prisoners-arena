import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export type Network = "devnet" | "mainnet-beta";

export interface ConfigAccount {
  admin: PublicKey;
  operator: PublicKey;
  houseFeeBps: number;
  stake: BN;
  minParticipants: number;
  maxParticipants: number;
  registrationDuration: BN;
  matchesPerPlayer: number;
  accumulatedFees: BN;
  currentTournamentId: number;
  bump: number;
}

export interface TournamentAccount {
  id: number;
  state: TournamentState;
  stake: BN;
  houseFeeBps: number;
  matchesPerPlayer: number;
  pool: BN;
  participantCount: number;
  registrationEnds: BN;
  matchesCompleted: number;
  matchesTotal: number;
  randomnessSeed: number[];
  minWinningScore: number;
  winnerCount: number;
  winnerPool: BN;
  claimsProcessed: number;
  payoutStartedAt: BN;
  players: PublicKey[];
  scores: number[];
  bump: number;
}

export type TournamentState =
  | { registration: Record<string, never> }
  | { running: Record<string, never> }
  | { payout: Record<string, never> };

export interface EntryAccount {
  tournament: PublicKey;
  player: PublicKey;
  index: number;
  strategy: StrategyType;
  score: number;
  matchesPlayed: number;
  paidOut: boolean;
  createdAt: BN;
  bump: number;
}

export type StrategyType =
  | { titForTat: Record<string, never> }
  | { alwaysDefect: Record<string, never> }
  | { alwaysCooperate: Record<string, never> }
  | { grimTrigger: Record<string, never> }
  | { pavlov: Record<string, never> }
  | { suspiciousTitForTat: Record<string, never> }
  | { random: Record<string, never> }
  | { titForTwoTats: Record<string, never> }
  | { gradual: Record<string, never> };

export const STRATEGIES = [
  { key: "titForTat", label: "Tit for Tat", desc: "Start cooperating, then copy opponent's last move" },
  { key: "alwaysDefect", label: "Always Defect", desc: "Always defect, no matter what" },
  { key: "alwaysCooperate", label: "Always Cooperate", desc: "Always cooperate, no matter what" },
  { key: "grimTrigger", label: "Grim Trigger", desc: "Cooperate until opponent defects, then always defect" },
  { key: "pavlov", label: "Pavlov", desc: "Cooperate if both made the same move, otherwise defect" },
  { key: "suspiciousTitForTat", label: "Suspicious Tit for Tat", desc: "Start defecting, then copy opponent's last move" },
  { key: "random", label: "Random", desc: "Randomly cooperate or defect each round" },
  { key: "titForTwoTats", label: "Tit for Two Tats", desc: "Defect only after opponent defects twice in a row" },
  { key: "gradual", label: "Gradual", desc: "Increase punishment proportional to opponent's defections" },
] as const;

export function getStateName(state: TournamentState): string {
  if ("registration" in state) return "Registration";
  if ("running" in state) return "Running";
  if ("payout" in state) return "Payout";
  return "Unknown";
}

export function getStrategyName(s: StrategyType): string {
  const key = Object.keys(s)[0];
  return STRATEGIES.find((st) => st.key === key)?.label ?? key;
}

export function lamportsToSol(lamports: BN | number): string {
  const n = typeof lamports === "number" ? lamports : lamports.toNumber();
  return (n / 1e9).toFixed(4);
}
