import React, { useState, useEffect } from "react";

interface Props {
  deadline: number; // unix seconds
}

export function CountdownTimer({ deadline }: Props) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = deadline - now;
  if (diff <= 0) {
    return <span className="text-yellow-400 text-sm">Deadline passed — waiting for close</span>;
  }

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return (
    <div className="font-mono text-2xl font-bold text-green-400">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}
