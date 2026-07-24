import { classTotals, householdTotal } from './allocate'
import { ASSET_CLASSES } from './types'
import type { Account, AssetClass } from './types'

/** Accounts below this are dust (the $0.21 leftover) and are never traded. */
const MIN_TRADABLE_TOTAL = 1.0

/**
 * Default cash-location order (research.md D6): the brokerage account
 * first — its money is reachable without retirement-account rules — then
 * the IRAs, larger first. The user can reorder this in the UI.
 */
export function defaultCashOrder(accounts: readonly Account[]): string[] {
  return accounts
    .filter((a) => a.total >= MIN_TRADABLE_TOTAL)
    .sort((a, b) => {
      const aIsIra = a.name.includes('IRA') ? 1 : 0
      const bIsIra = b.name.includes('IRA') ? 1 : 0
      return aIsIra - bIsIra || b.total - a.total
    })
    .map((a) => a.id)
}

/**
 * Default target = the household's current allocation, rounded to whole
 * percents and adjusted (largest-remainder) so it sums to exactly 100.
 * Targets are whole numbers by design — simpler to reason about, and the
 * dollar difference a decimal could express is noise at this scale.
 */
export function defaultTargets(
  accounts: readonly Account[],
): Record<AssetClass, number> {
  const total = householdTotal(accounts)
  const current = classTotals(accounts.flatMap((a) => [...a.positions]))
  const raw = ASSET_CLASSES.map((c) => ({
    assetClass: c,
    exact: (current[c] / total) * 100,
  }))
  const floored = raw.map((r) => ({ ...r, whole: Math.floor(r.exact) }))
  const shortfall = 100 - floored.reduce((s, r) => s + r.whole, 0)
  const byRemainder = [...floored].sort(
    (a, b) => (b.exact - b.whole) - (a.exact - a.whole),
  )
  const bumped = new Set(byRemainder.slice(0, shortfall).map((r) => r.assetClass))
  return Object.fromEntries(
    floored.map((r) => [
      r.assetClass,
      r.whole + (bumped.has(r.assetClass) ? 1 : 0),
    ]),
  ) as Record<AssetClass, number>
}
