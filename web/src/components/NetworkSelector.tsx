import React from "react";
import { useNetwork } from "../contexts/NetworkContext";
import type { Network } from "../types";

export function NetworkSelector() {
  const { network, setNetwork } = useNetwork();
  const isDevnet = network === "devnet";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
          isDevnet ? "bg-green-600/30 text-green-400 border border-green-600" : "bg-red-600/30 text-red-400 border border-red-600"
        }`}
      >
        {isDevnet ? "Devnet" : "Mainnet"}
      </span>
      <select
        value={network}
        onChange={(e) => setNetwork(e.target.value as Network)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
      >
        <option value="devnet">Devnet</option>
        <option value="mainnet-beta">Mainnet</option>
      </select>
    </div>
  );
}
