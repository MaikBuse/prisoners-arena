'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface SegmentedCountdownProps {
  targetTimestamp: number;
  label?: string;
  expiredText?: string;
  expiredClassName?: string;
}

interface TimeSegments {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function parseRemaining(target: number): TimeSegments | null {
  const diff = target - Math.floor(Date.now() / 1000);
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  };
}

function Digit({ value, label }: { value: string; label?: string }) {
  return (
    <span className="inline-flex flex-col items-center">
      <span className="relative overflow-hidden countdown-digit w-7 h-9 sm:w-9 sm:h-11 flex items-center justify-center text-base sm:text-lg font-bold font-mono">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      {label && <span className="text-[10px] text-muted mt-0.5">{label}</span>}
    </span>
  );
}

function pad2(n: number): [string, string] {
  const s = String(n).padStart(2, '0');
  return [s[0], s[1]];
}

export function SegmentedCountdown({
  targetTimestamp,
  label,
  expiredText,
  expiredClassName,
}: SegmentedCountdownProps) {
  const [segments, setSegments] = useState<TimeSegments | null>(() => parseRemaining(targetTimestamp));

  useEffect(() => {
    function tick() {
      setSegments(parseRemaining(targetTimestamp));
    }
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [targetTimestamp]);

  const expiredClass = expiredClassName ?? 'text-error';

  if (segments === null) {
    return (
      <div className="text-center">
        {label && <div className="text-xs text-muted uppercase tracking-wider mb-1">{label}</div>}
        <div className={`text-2xl font-bold font-mono ${expiredClass}`}>
          {expiredText || 'Expired'}
        </div>
      </div>
    );
  }

  const [d1, d2] = pad2(segments.days);
  const [h1, h2] = pad2(segments.hours);
  const [m1, m2] = pad2(segments.minutes);
  const [s1, s2] = pad2(segments.seconds);
  const showDays = segments.days > 0;

  return (
    <div className="text-center" aria-live="polite">
      {label && <div className="text-xs text-muted uppercase tracking-wider mb-2">{label}</div>}
      <div className="inline-flex items-start gap-1 sm:gap-1.5">
        {showDays && (
          <>
            <Digit value={d1} />
            <Digit value={d2} label="d" />
            <span className="text-muted font-mono text-lg sm:text-xl mt-1.5">:</span>
          </>
        )}
        <Digit value={h1} />
        <Digit value={h2} label="h" />
        <span className="text-muted font-mono text-lg sm:text-xl mt-1.5">:</span>
        <Digit value={m1} />
        <Digit value={m2} label="m" />
        <span className="text-muted font-mono text-lg sm:text-xl mt-1.5">:</span>
        <Digit value={s1} />
        <Digit value={s2} label="s" />
      </div>
    </div>
  );
}
