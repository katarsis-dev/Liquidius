import type { LaunchSource } from '@liquidius/core';

/** Event standar yang di-emit ingestion pipeline downstream. */
export type IngestEvent = PairDetectedEvent | SwapEvent | MigrateEvent;

export interface PairDetectedEvent {
  kind: 'pair_detected';
  mint: string;
  pool: string;
  creator: string;
  launchSource: LaunchSource;
  slot: number;
  ts: number;
  signature: string;
}

export interface SwapEvent {
  kind: 'swap';
  mint: string;
  pool: string;
  side: 'buy' | 'sell';
  wallet: string;
  amountUsd?: number;
  amountToken?: number;
  slot: number;
  ts: number;
  signature: string;
}

export interface MigrateEvent {
  kind: 'migrate';
  mint: string;
  oldPool: string;
  newPool: string;
  newSource: LaunchSource;
  slot: number;
  ts: number;
  signature: string;
}
