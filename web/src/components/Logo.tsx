export function Logo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer hexagon */}
      <path
        d="M50 5L93.3 27.5V72.5L50 95L6.7 72.5V27.5L50 5Z"
        stroke="#10b981"
        strokeWidth="2"
        fill="rgba(16, 185, 129, 0.05)"
      />
      {/* Inner grid - game theory matrix */}
      <rect x="30" y="30" width="18" height="18" rx="2" fill="rgba(16, 185, 129, 0.3)" stroke="#10b981" strokeWidth="1" />
      <rect x="52" y="30" width="18" height="18" rx="2" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="1" />
      <rect x="30" y="52" width="18" height="18" rx="2" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="1" />
      <rect x="52" y="52" width="18" height="18" rx="2" fill="rgba(107, 114, 128, 0.3)" stroke="#6b7280" strokeWidth="1" />
      {/* C and D labels */}
      <text x="39" y="43" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold" fontFamily="monospace">C</text>
      <text x="61" y="43" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace">D</text>
      <text x="39" y="65" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace">D</text>
      <text x="61" y="65" textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="bold" fontFamily="monospace">1</text>
      {/* Scores */}
      <text x="39" y="43" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="monospace" dy="0">3</text>
      <text x="61" y="43" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold" fontFamily="monospace" dy="0">5</text>
      <text x="39" y="65" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold" fontFamily="monospace" dy="0">5</text>
      <text x="61" y="65" textAnchor="middle" fill="#6b7280" fontSize="8" fontWeight="bold" fontFamily="monospace" dy="0">1</text>
    </svg>
  );
}

export function LogoSmall() {
  return (
    <svg width={32} height={32} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5L93.3 27.5V72.5L50 95L6.7 72.5V27.5L50 5Z" stroke="#10b981" strokeWidth="3" fill="rgba(16, 185, 129, 0.08)" />
      <rect x="28" y="28" width="20" height="20" rx="2" fill="rgba(16, 185, 129, 0.4)" />
      <rect x="52" y="28" width="20" height="20" rx="2" fill="rgba(239, 68, 68, 0.4)" />
      <rect x="28" y="52" width="20" height="20" rx="2" fill="rgba(239, 68, 68, 0.4)" />
      <rect x="52" y="52" width="20" height="20" rx="2" fill="rgba(107, 114, 128, 0.4)" />
    </svg>
  );
}
