import React, { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import type { Network } from "../types";

interface NetworkCtx {
  network: Network;
  setNetwork: (n: Network) => void;
  rpcUrl: string;
}

const Ctx = createContext<NetworkCtx>({
  network: "devnet",
  setNetwork: () => {},
  rpcUrl: clusterApiUrl("devnet"),
});

export const useNetwork = () => useContext(Ctx);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<Network>("devnet");

  const rpcUrl = useMemo(() => {
    const env = import.meta.env.VITE_RPC_URL;
    if (env) return env as string;
    return clusterApiUrl(network);
  }, [network]);

  return <Ctx.Provider value={{ network, setNetwork, rpcUrl }}>{children}</Ctx.Provider>;
}
