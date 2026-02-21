'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { ScoreboardEntry } from '@/lib/api';
import { STRATEGIES, STRATEGY_BAR_COLORS } from '@/lib/solana';
import { StrategyBadge } from '@/components/StrategyBadge';

interface StrategyDistributionChartProps {
  entries: ScoreboardEntry[];
}

interface DistEntry {
  index: number;
  name: string;
  color: string;
  count: number;
  totalScore: number;
  avgScore: string;
}

const STRATEGY_HEX: Record<string, string> = {
  blue: '96,165,250',
  red: '248,113,113',
  green: '74,222,128',
  purple: '167,139,250',
  amber: '251,191,36',
  orange: '251,146,60',
  gray: '156,163,175',
  cyan: '34,211,238',
  pink: '244,114,182',
  indigo: '129,140,248',
};

export function StrategyDistributionChart({ entries }: StrategyDistributionChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { distribution, maxCount, totalPlayers } = useMemo(() => {
    const dist = new Map<number, { count: number; totalScore: number }>();
    entries.filter(e => e.revealed !== false && e.strategy >= 0).forEach(e => {
      const d = dist.get(e.strategy) || { count: 0, totalScore: 0 };
      d.count++;
      d.totalScore += e.score;
      dist.set(e.strategy, d);
    });

    const distribution: DistEntry[] = [];
    let total = 0;
    for (const s of STRATEGIES) {
      const d = dist.get(s.index);
      if (!d) continue;
      total += d.count;
      distribution.push({
        index: s.index,
        name: s.name,
        color: s.color,
        count: d.count,
        totalScore: d.totalScore,
        avgScore: d.count > 0 ? (d.totalScore / d.count).toFixed(1) : '—',
      });
    }

    return {
      distribution,
      maxCount: Math.max(...distribution.map(d => d.count), 1),
      totalPlayers: total,
    };
  }, [entries]);

  const showDonut = distribution.length >= 4;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-6">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          {distribution.map((d, i) => {
            const pct = totalPlayers > 0 ? ((d.count / totalPlayers) * 100).toFixed(1) : '0';
            const isHovered = hoveredIdx === d.index;
            const rgb = STRATEGY_HEX[d.color] || '156,163,175';

            return (
              <motion.div
                key={d.index}
                className="flex items-center gap-3 rounded-lg px-1 py-0.5 transition-colors"
                style={isHovered ? { backgroundColor: `rgba(${rgb}, 0.08)` } : undefined}
                onMouseEnter={() => setHoveredIdx(d.index)}
                onMouseLeave={() => setHoveredIdx(null)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
              >
                <span className="w-28 shrink-0">
                  <StrategyBadge strategy={d.index} />
                </span>
                <div className="flex-1 bg-skeleton rounded-full h-3 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${STRATEGY_BAR_COLORS[d.color]}`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(d.count / maxCount) * 100}%`,
                      scale: isHovered ? 1.02 : 1,
                    }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    style={isHovered ? { filter: `drop-shadow(0 0 4px rgba(${rgb}, 0.5))` } : undefined}
                  />
                </div>
                <span className="text-xs text-muted w-6 text-right font-mono">{d.count}</span>
                <span className="text-xs text-muted w-16 text-right font-mono hidden sm:inline" title={`${pct}% · avg ${d.avgScore}`}>
                  avg {d.avgScore}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Mini donut chart */}
        {showDonut && (
          <div className="hidden md:block shrink-0">
            <DonutChart distribution={distribution} total={totalPlayers} />
          </div>
        )}
      </div>
    </div>
  );
}

function DonutChart({ distribution, total }: { distribution: DistEntry[]; total: number }) {
  const size = 80;
  const radius = 30;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumOffset = 0;
  const segments = distribution.map((d) => {
    const segLen = (d.count / total) * circumference;
    const seg = { ...d, dasharray: `${segLen} ${circumference - segLen}`, dashoffset: -cumOffset };
    cumOffset += segLen;
    return seg;
  });

  return (
    <svg width={size} height={size} className="-rotate-90">
      {segments.map((seg, i) => {
        const rgb = STRATEGY_HEX[seg.color] || '156,163,175';
        return (
          <motion.circle
            key={seg.index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`rgb(${rgb})`}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
          />
        );
      })}
    </svg>
  );
}
