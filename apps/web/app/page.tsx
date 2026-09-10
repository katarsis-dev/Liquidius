'use client';

import { useMemo, useState } from 'react';
import { useAlertStream } from '@/lib/sse';
import { Header } from '@/components/Header';
import { ModeColumn } from '@/components/ModeColumn';

export default function Dashboard() {
  const [paused, setPaused] = useState(false);
  const { alerts, connected } = useAlertStream(paused);

  const total = useMemo(
    () => alerts.DEGEN.length + alerts.MEDIUM.length + alerts.SAFE.length,
    [alerts],
  );

  return (
    <div className="flex flex-col h-screen">
      <Header
        connected={connected}
        paused={paused}
        totalAlerts={total}
        onTogglePause={() => setPaused((p) => !p)}
      />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-[1600px] px-4 py-4">
        <div className="grid gap-4 h-full grid-cols-1 md:grid-cols-3 min-h-0">
          <ModeColumn mode="DEGEN" alerts={alerts.DEGEN} />
          <ModeColumn mode="MEDIUM" alerts={alerts.MEDIUM} />
          <ModeColumn mode="SAFE" alerts={alerts.SAFE} />
        </div>
      </main>
    </div>
  );
}
