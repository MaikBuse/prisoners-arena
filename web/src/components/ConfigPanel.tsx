import React, { useState } from "react";
import type { ConfigAccount } from "../types";
import { lamportsToSol } from "../types";

interface Props {
  config: ConfigAccount;
}

export function ConfigPanel({ config }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-800 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800/50"
      >
        <span className="font-medium">⚙ Config</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2 text-xs">
          <Field label="Admin" value={config.admin.toBase58().slice(0, 8) + "..."} />
          <Field label="Operator" value={config.operator.toBase58().slice(0, 8) + "..."} />
          <Field label="Stake" value={`${lamportsToSol(config.stake)} SOL`} />
          <Field label="House Fee" value={`${config.houseFeeBps} bps (${(config.houseFeeBps / 100).toFixed(1)}%)`} />
          <Field label="Min Participants" value={String(config.minParticipants)} />
          <Field label="Max Participants" value={String(config.maxParticipants)} />
          <Field label="Registration Duration" value={`${config.registrationDuration.toNumber()}s`} />
          <Field label="Matches/Player" value={String(config.matchesPerPlayer)} />
          <Field label="Accumulated Fees" value={`${lamportsToSol(config.accumulatedFees)} SOL`} />
          <Field label="Current Tournament" value={`#${config.currentTournamentId}`} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
