'use client';

import { motion } from 'motion/react';
import { AnimatedCounter } from '@/components/AnimatedCounter';

interface MatchProgressRingProps {
  completed: number;
  total: number;
}

export function MatchProgressRing({ completed, total }: MatchProgressRingProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const radius = 56;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const size = (radius + stroke) * 2;
  const center = radius + stroke;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <filter id="ring-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-skeleton)"
            strokeWidth={stroke}
          />
          {/* Animated foreground ring */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-info)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            filter="url(#ring-glow)"
          />
        </svg>
        {/* Center percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatedCounter
            value={pct}
            suffix="%"
            className="text-xl font-bold font-mono"
          />
        </div>
      </div>
      <div className="text-sm text-muted font-mono">
        {completed} / {total} matches
      </div>
    </div>
  );
}
