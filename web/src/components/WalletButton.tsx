import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  return <WalletMultiButton className="!bg-purple-700 hover:!bg-purple-600 !rounded-lg !text-sm !h-9" />;
}
