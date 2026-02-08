import React, { useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { NetworkProvider, useNetwork } from "./contexts/NetworkContext";
import { ToastProvider, TransactionToasts } from "./contexts/ToastContext";
import { Header } from "./components/Header";
import { Dashboard } from "./pages/Dashboard";
import { EntryView } from "./pages/EntryView";
import { History } from "./pages/History";
import { Guide } from "./pages/Guide";

function AppInner() {
  const { rpcUrl } = useNetwork();
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/entry" element={<EntryView />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/guide" element={<Guide />} />
                </Routes>
              </main>
              <TransactionToasts />
            </div>
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default function App() {
  return (
    <NetworkProvider>
      <AppInner />
    </NetworkProvider>
  );
}
