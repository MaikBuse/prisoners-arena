export function Logo({ size = 80 }: { size?: number }) {
  // Clean 2x2 payoff matrix inside a hexagon
  const s = size;
  const cellSize = s * 0.2;
  const gap = s * 0.02;
  const cx = s / 2;
  const cy = s / 2;
  const gridOffset = cellSize + gap / 2;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hexagon */}
      <polygon
        points={hexPoints(cx, cy, s * 0.46)}
        stroke="var(--color-accent)"
        strokeWidth={s * 0.02}
        fill="color-mix(in srgb, var(--color-accent) 4%, transparent)"
      />
      {/* 2x2 grid centered */}
      {/* Top-left: CC (green) */}
      <rect x={cx - gridOffset} y={cy - gridOffset} width={cellSize} height={cellSize} rx={s * 0.02}
        fill="color-mix(in srgb, var(--color-accent) 25%, transparent)" stroke="var(--color-accent)" strokeWidth={s * 0.01} />
      {/* Top-right: CD (red) */}
      <rect x={cx + gap / 2} y={cy - gridOffset} width={cellSize} height={cellSize} rx={s * 0.02}
        fill="color-mix(in srgb, var(--color-error) 25%, transparent)" stroke="var(--color-error)" strokeWidth={s * 0.01} />
      {/* Bottom-left: DC (red) */}
      <rect x={cx - gridOffset} y={cy + gap / 2} width={cellSize} height={cellSize} rx={s * 0.02}
        fill="color-mix(in srgb, var(--color-error) 25%, transparent)" stroke="var(--color-error)" strokeWidth={s * 0.01} />
      {/* Bottom-right: DD (gray) */}
      <rect x={cx + gap / 2} y={cy + gap / 2} width={cellSize} height={cellSize} rx={s * 0.02}
        fill="color-mix(in srgb, var(--color-muted) 25%, transparent)" stroke="var(--color-muted)" strokeWidth={s * 0.01} />
    </svg>
  );
}

export function LogoSmall() {
  return <Logo size={32} />;
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}
