'use client';

import { useState, useEffect } from 'react';

interface TrialTimerProps {
  trialEndsAt: number;
  onExpired?: () => void;
}

export function TrialTimer({ trialEndsAt, onExpired }: TrialTimerProps) {
  const [remaining, setRemaining] = useState<string>('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = trialEndsAt - now;

      if (diff <= 0) {
        setExpired(true);
        setRemaining('Trial expired');
        onExpired?.();
        return;
      }

      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setRemaining(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [trialEndsAt, onExpired]);

  if (expired) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded">
        Trial period has ended. Upgrade to continue using this app.
      </div>
    );
  }

  return (
    <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded">
      Trial ending in: <strong>{remaining}</strong>
    </div>
  );
}
