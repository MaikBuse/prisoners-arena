'use client';
import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetTimestamp: number;
  label?: string;
  /** Text to show instead of "Expired" when countdown reaches zero */
  expiredText?: string;
  /** Extra CSS class for the expired state (default: red) */
  expiredClassName?: string;
}

export function CountdownTimer({ targetTimestamp, label, expiredText, expiredClassName }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function update() {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTimestamp - now;
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft(expiredText || 'Expired');
        return;
      }
      setExpired(false);
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    }
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [targetTimestamp, expiredText]);

  const expiredClass = expiredClassName ?? 'text-error';

  return (
    <div className="text-center">
      {label && <div className="text-xs text-muted uppercase tracking-wider mb-1">{label}</div>}
      <div className={`text-2xl font-bold font-mono ${expired ? expiredClass : 'text-foreground'}`}>
        {timeLeft || '...'}
      </div>
    </div>
  );
}
