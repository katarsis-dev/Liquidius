// Program IDs — sumber: Helius docs & program deployment on-chain.
// PumpSwap masih uncertain; nilai di bawah placeholder yg akan diverifikasi
// di runtime (dicek exists lewat getAccountInfo saat startup).

export const PROGRAM_IDS = {
  PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  RAYDIUM_AMM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  // Uncertain — verifikasi via Helius docs / metaplex explorer sebelum production.
  PUMP_SWAP: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
} as const;

export type ProgramName = keyof typeof PROGRAM_IDS;
