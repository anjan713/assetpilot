export const ASSET_CLASSES = [
  'US_EQUITY',
  'INTERNATIONAL',
  'GOLD',
  'TREASURIES',
  'CASH',
] as const

export type AssetClass = (typeof ASSET_CLASSES)[number]

export const CLASS_LABELS: Record<AssetClass, string> = {
  US_EQUITY: 'US Equity',
  INTERNATIONAL: 'International',
  GOLD: 'Gold',
  TREASURIES: 'Treasuries',
  CASH: 'Cash',
}

/** One parsed CSV row. */
export interface Position {
  accountId: string
  accountName: string
  symbol: string
  description: string
  quantity: number
  price: number
  value: number
  /** Display only — "Total Gain/Loss Dollar" from the CSV; absent for cash rows. */
  gainDollar?: number
  /** Display only — "Total Gain/Loss Percent" from the CSV; absent for cash rows. */
  gainPercent?: number
}

/** Positions grouped by account. `total` is INVARIANT: trades never change it. */
export interface Account {
  id: string
  name: string
  positions: readonly Position[]
  total: number
}

/** The user's editable target. Percents must sum to exactly 100. */
export interface Target {
  percents: Record<AssetClass, number>
  /** Cash-location preference: accounts take household cash in this order. */
  cashOrder: readonly string[]
}

export interface Trade {
  accountId: string
  action: 'BUY' | 'SELL'
  symbol: string
  shares: number
  price: number
  amount: number
  reason: string
}

export interface ClassRow {
  assetClass: AssetClass
  current: number
  target: number
  gap: number
}

export interface AccountPlan {
  accountId: string
  accountName: string
  /** True for dust accounts left untouched (not in cashOrder). */
  isFrozen: boolean
  totalBefore: number
  totalAfter: number
  cashBefore: number
  cashTarget: number
  /** cashTarget − cashBefore; negative = money-market money spent on buys. */
  cashDelta: number
  classRows: readonly ClassRow[]
  trades: readonly Trade[]
  sellTotal: number
  buyTotal: number
}

export interface CashPlacementStep {
  accountId: string
  accountName: string
  cashTarget: number
  /** True when this account hit its capacity and cash spilled onward. */
  isCapped: boolean
}

export type RebalanceResult =
  | { ok: false; error: string; percentSum: number }
  | {
      ok: true
      householdTotal: number
      plans: readonly AccountPlan[]
      placement: readonly CashPlacementStep[]
      /** True when household cash did not fit in the first account of cashOrder. */
      hasOverflow: boolean
    }
