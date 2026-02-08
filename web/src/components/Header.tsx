import React from "react";
import { Link, useLocation } from "react-router-dom";
import { NetworkSelector } from "./NetworkSelector";
import { WalletButton } from "./WalletButton";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/entry", label: "My Entry" },
  { to: "/history", label: "History" },
  { to: "/guide", label: "How to Play" },
];

export function Header() {
  const { pathname } = useLocation();

  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <Link to="/" className="text-lg font-bold text-white mr-4">
          ⚔ Dilemma Arena
        </Link>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-1.5 rounded text-sm ${
                pathname === n.to ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <NetworkSelector />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
