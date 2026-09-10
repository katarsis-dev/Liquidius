'use client';

import { useEffect, useRef, useState } from 'react';
import { playAlertSound } from './notifSound';

export type AlertSource = 'pumpfun' | 'dexscreener' | 'raydium' | 'pumpswap' | 'fixture';

export interface AlertPayload {
  id: string;
  mode: 'DEGEN' | 'MEDIUM' | 'SAFE';
  trigger: string;
  /** Data source label — di-render sebagai chip di AlertCard. */
  source: AlertSource;
  /** Detail sumber opsional, mis. "Helius WS logs" / "DS boost feed". */
  sourceDetail?: string;
  mint: string;
  pool: string;
  symbol?: string;
  name?: string;
  logoUri?: string;
  age_sec: number;
  mc_usd?: number;
  liq_usd?: number;
  vol_1m_usd?: number;
  vol_5m_usd?: number;
  unique_buyers_5m?: number;
  buy_sell_ratio_5m?: number;
  safety: {
    mintDisabled?: boolean;
    freezeDisabled?: boolean;
    lpBurned?: boolean;
    lpLocked?: boolean;
    topPct?: number;
    creatorPct?: number;
    bundlePct?: number;
    sniperPct?: number;
    honeypot?: boolean;
  };
  trackedWallets: { smart: number; sniper: number; caller: number };
  isMigrated: boolean;
  bondingProgressPct?: number;
  links: { gmgn: string; solscan: string; dexscreener: string; birdeye: string };
  createdAt: number;
}

const MAX_PER_MODE = 200;

/**
 * Subscribe SSE stream `/api/alerts/stream`, buffer per mode.
 * Batching state update per 250ms untuk mencegah re-render storm.
 */
export function useAlertStream(paused: boolean = false) {
  const [alerts, setAlerts] = useState<Record<'DEGEN' | 'MEDIUM' | 'SAFE', AlertPayload[]>>({
    DEGEN: [],
    MEDIUM: [],
    SAFE: [],
  });
  const [connected, setConnected] = useState(false);
  const bufferRef = useRef<AlertPayload[]>([]);

  useEffect(() => {
    if (paused) return;
    const es = new EventSource('/api/alerts/stream');

    const flush = () => {
      const buf = bufferRef.current;
      if (buf.length === 0) return;
      bufferRef.current = [];
      setAlerts((prev) => {
        const next = { ...prev };
        for (const a of buf) {
          const list = [a, ...next[a.mode]].slice(0, MAX_PER_MODE);
          next[a.mode] = list;
        }
        return next;
      });
    };
    const tick = setInterval(flush, 250);

    es.addEventListener('ready', () => setConnected(true));
    es.addEventListener('alert', (e: MessageEvent) => {
      try {
        const p: AlertPayload = JSON.parse(e.data);
        bufferRef.current.push(p);
        // Suara notif (respect mute + rate limit di helper).
        playAlertSound(p.mode);
      } catch {
        /* ignore malformed */
      }
    });
    es.addEventListener('error', () => setConnected(false));

    return () => {
      clearInterval(tick);
      es.close();
      setConnected(false);
    };
  }, [paused]);

  // Load history sekali di mount
  useEffect(() => {
    (async () => {
      const modes = ['DEGEN', 'MEDIUM', 'SAFE'] as const;
      for (const m of modes) {
        try {
          const res = await fetch(`/api/alerts/recent?mode=${m}&limit=50`);
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setAlerts((prev) => ({ ...prev, [m]: data.items }));
          }
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  return { alerts, connected };
}
