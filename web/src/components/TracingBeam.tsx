'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';

interface TracingBeamProps {
  children: React.ReactNode;
  className?: string;
}

export function TracingBeam({ children, className }: TracingBeamProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);
  const rawId = useId();
  const id = rawId.replace(/:/g, '-');

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSvgHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: contentRef,
    offset: ['start 0.1', 'end end'],
  });

  const y1 = useSpring(
    useTransform(scrollYProgress, [0, 0.8], [0, svgHeight]),
    { stiffness: 500, damping: 50 },
  );
  const y2 = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, svgHeight]),
    { stiffness: 500, damping: 50 },
  );

  return (
    <div ref={contentRef} className={`relative ${className ?? ''}`}>
      {/* Beam — lg+ only */}
      {svgHeight > 0 && (
        <div className="absolute -left-4 xl:-left-8 top-0 hidden lg:block">
          <svg
            viewBox={`0 0 3 ${svgHeight}`}
            width="3"
            height={svgHeight}
            className="block"
            aria-hidden
          >
            <defs>
              <motion.linearGradient
                id={`beam${id}`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                x2="0"
                y1={y1}
                y2={y2}
              >
                <stop stopColor="#10b981" stopOpacity="0" />
                <stop stopColor="#10b981" />
                <stop offset="0.325" stopColor="#34d399" />
                <stop offset="1" stopColor="#34d399" stopOpacity="0" />
              </motion.linearGradient>
            </defs>

            {/* Track line */}
            <line
              x1="1.5"
              y1="0"
              x2="1.5"
              y2={svgHeight}
              stroke="currentColor"
              className="text-card-border"
              strokeWidth="1"
            />

            {/* Animated gradient beam */}
            <line
              x1="1.5"
              y1="0"
              x2="1.5"
              y2={svgHeight}
              stroke={`url(#beam${id})`}
              strokeWidth="3"
            />
          </svg>
        </div>
      )}

      {children}
    </div>
  );
}
