/**
 * Dexscreener API client (free tier).
 *
 * Rate limit (uncertain, dari public docs — bisa berubah):
 *   - /token-profiles/latest/v1        60 req/min
 *   - /token-boosts/latest/v1          60 req/min
 *   - /token-boosts/top/v1             60 req/min
 *   - /latest/dex/tokens/{address}     300 req/min
 *   - /latest/dex/pairs/{chain}/{addr} 300 req/min
 *
 * Kita rate-limit lokal ke <100 req/min supaya aman.
 */

const BASE = 'https://api.dexscreener.com';

export interface DsPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  pairCreatedAt?: number; // ms
  info?: { imageUrl?: string; websites?: { url: string }[] };
}

export interface DsTokensResponse {
  pairs: DsPair[] | null;
}

export interface DsBoost {
  url: string;
  chainId: string;
  tokenAddress: string;
  amount: number;
  totalAmount: number;
  icon?: string;
  header?: string;
  description?: string;
  links?: { type: string; url: string }[];
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: 'application/json' },
      // Next.js: no cache (kita mau realtime data)
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Latest boosted tokens (Solana filter di caller). */
export function getLatestBoosts(): Promise<DsBoost[] | null> {
  return get<DsBoost[]>('/token-boosts/latest/v1');
}

/** Top boosted tokens (most active). */
export function getTopBoosts(): Promise<DsBoost[] | null> {
  return get<DsBoost[]>('/token-boosts/top/v1');
}

/** Full pair data by token mint. Return list; kita ambil pair Solana yg terbesar. */
export function getPairsByToken(mint: string): Promise<DsTokensResponse | null> {
  return get<DsTokensResponse>(`/latest/dex/tokens/${mint}`);
}

/** Search pool: `/latest/dex/search?q=<query>` — return pairs terbaru/paling aktif. */
export interface DsSearchResponse {
  pairs: DsPair[] | null;
}
export function searchPairs(query: string): Promise<DsSearchResponse | null> {
  return get<DsSearchResponse>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
}

/** Latest token profiles — metadata terbaru (link sosmed, header). */
export interface DsProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { label: string; url: string }[];
}
export function getLatestProfiles(): Promise<DsProfile[] | null> {
  return get<DsProfile[]>('/token-profiles/latest/v1');
}
