import { explorerLink, truncateAddress } from '@/lib/solana';

export function ExplorerLink({ address, type = 'address', label, className = '' }: {
  address: string;
  type?: 'address' | 'tx';
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={explorerLink(address, type)}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm ${className}`}
    >
      {label || truncateAddress(address)}
    </a>
  );
}
