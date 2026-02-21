'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useTransform, motion } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix = '',
  decimals = 0,
  duration,
  className = '',
}: AnimatedCounterProps) {
  const ref = useRef(value);
  const motionVal = useMotionValue(ref.current);
  const spring = useSpring(motionVal, {
    damping: 40,
    stiffness: duration ? 200 / (duration / 0.6) : 200,
  });
  const display = useTransform(spring, (v) =>
    `${v.toFixed(decimals)}${suffix}`,
  );

  useEffect(() => {
    if (ref.current !== value) {
      ref.current = value;
      motionVal.set(value);
    }
  }, [value, motionVal]);

  return <motion.span className={className}>{display}</motion.span>;
}
