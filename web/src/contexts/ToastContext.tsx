import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useNetwork } from "./NetworkContext";

export type ToastType = "pending" | "confirmed" | "error";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  txSig?: string;
}

interface ToastCtx {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, txSig?: string) => number;
  removeToast: (id: number) => void;
}

const Ctx = createContext<ToastCtx>({ toasts: [], addToast: () => 0, removeToast: () => {} });
export const useToasts = () => useContext(Ctx);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, txSig?: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, type, message, txSig }]);
    if (type !== "pending") setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    return id;
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return <Ctx.Provider value={{ toasts, addToast, removeToast }}>{children}</Ctx.Provider>;
}

export function TransactionToasts() {
  const { toasts, removeToast } = useToasts();
  const { network } = useNetwork();

  if (!toasts.length) return null;

  const explorerUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=${network}`;

  const colors: Record<ToastType, string> = {
    pending: "bg-yellow-900/80 border-yellow-600",
    confirmed: "bg-green-900/80 border-green-600",
    error: "bg-red-900/80 border-red-600",
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`${colors[t.type]} border rounded-lg p-3 shadow-lg flex items-start gap-2`}>
          <div className="flex-1">
            <p className="text-sm font-medium">{t.message}</p>
            {t.txSig && (
              <a href={explorerUrl(t.txSig)} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                View on Explorer ↗
              </a>
            )}
          </div>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-white text-xs">✕</button>
        </div>
      ))}
    </div>
  );
}
