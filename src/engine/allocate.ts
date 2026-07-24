import { classOf } from './mapping'
import { ASSET_CLASSES } from './types'
import type { Account, AssetClass, Position } from './types'

/** Group positions into accounts, preserving file order. */
export function groupAccounts(positions: readonly Position[]): Account[] {
  const ids = [...new Set(positions.map((p) => p.accountId))]
  return ids.map((id) => {
    const accountPositions = positions.filter((p) => p.accountId === id)
    return {
      id,
      name: accountPositions[0].accountName,
      positions: accountPositions,
      total: sumValues(accountPositions),
    }
  })
}

export function sumValues(positions: readonly Position[]): number {
  return positions.reduce((sum, p) => sum + p.value, 0)
}

/** Dollar total per asset class for a set of positions. */
export function classTotals(
  positions: readonly Position[],
): Record<AssetClass, number> {
  const zero = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<
    AssetClass,
    number
  >
  return positions.reduce(
    (totals, p) => ({
      ...totals,
      [classOf(p.symbol)]: totals[classOf(p.symbol)] + p.value,
    }),
    zero,
  )
}

export function householdTotal(accounts: readonly Account[]): number {
  return accounts.reduce((sum, a) => sum + a.total, 0)
}
