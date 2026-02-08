'use client';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-zinc-500 hover:text-zinc-300 text-xs ml-1"
      title="Copy"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}
