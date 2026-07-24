import { ASSET_CLASSES } from './types'
import type { AssetClass } from './types'

const PERCENT_SUM = 100

/** A dollar amount the user wants held in a specific asset class. */
export interface DollarGoal {
  assetClass: AssetClass
  amount: number
}

/**
 * Split a whole-number `total` across `weights`, returning integers that sum to
 * exactly `total`. Uses the largest-remainder method; falls back to an even
 * split when every weight is zero.
 */
function distributeIntegers(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return []
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  if (weightSum <= 0) {
    const base = Math.floor(total / weights.length)
    const result = weights.map(() => base)
    let leftover = total - base * weights.length
    for (let i = 0; i < result.length && leftover > 0; i += 1, leftover -= 1) {
      result[i] += 1
    }
    return result
  }
  const raw = weights.map((w) => (w / weightSum) * total)
  const result = raw.map((value) => Math.floor(value))
  let leftover = total - result.reduce((sum, value) => sum + value, 0)
  const byRemainder = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < byRemainder.length && leftover > 0; k += 1, leftover -= 1) {
    result[byRemainder[k].index] += 1
  }
  return result
}

/** Assemble a full 5-class mix in canonical order; missing classes are 0. */
function buildMix(percentByClass: Map<AssetClass, number>): Record<AssetClass, number> {
  return Object.fromEntries(
    ASSET_CLASSES.map((c) => [c, percentByClass.get(c) ?? 0]),
  ) as Record<AssetClass, number>
}

/**
 * Turn dollar goals into a whole-number target mix that sums to 100.
 *
 * Each class the user named a dollar amount for is sized by rounding its
 * percentage UP (ceil), so the resulting dollars meet or exceed the goal and
 * never fall short. The leftover percentage is spread across the classes with
 * no dollar goal, weighted by `baseline` (the AI's suggested shape). All five
 * values are whole numbers summing to exactly 100.
 *
 * Returns `baseline` unchanged when there are no usable goals or the household
 * total is not a positive, finite number.
 */
export function applyDollarGoals(
  baseline: Record<AssetClass, number>,
  goals: readonly DollarGoal[],
  householdTotal: number,
): Record<AssetClass, number> {
  if (goals.length === 0 || !Number.isFinite(householdTotal) || householdTotal <= 0) {
    return { ...baseline }
  }

  // Aggregate amounts per class (a class named twice sums its amounts).
  const amountByClass = new Map<AssetClass, number>()
  for (const goal of goals) {
    if (!Number.isFinite(goal.amount) || goal.amount <= 0) continue
    const prior = amountByClass.get(goal.assetClass) ?? 0
    amountByClass.set(goal.assetClass, prior + goal.amount)
  }
  if (amountByClass.size === 0) return { ...baseline }

  // Named classes: round each percentage UP so its dollar goal is met or beaten.
  const namedPercent = new Map<AssetClass, number>()
  for (const [assetClass, amount] of amountByClass) {
    const pct = Math.min(PERCENT_SUM, Math.ceil((amount / householdTotal) * PERCENT_SUM))
    namedPercent.set(assetClass, pct)
  }

  const namedClasses = [...namedPercent.keys()]
  const namedTotal = [...namedPercent.values()].reduce((sum, p) => sum + p, 0)
  const unnamed = ASSET_CLASSES.filter((c) => !namedPercent.has(c))

  // Case A: goals alone reach or exceed 100% — they can't all fit. Scale the
  // named classes down to sum to 100; unnamed classes get nothing.
  if (namedTotal >= PERCENT_SUM) {
    const scaled = distributeIntegers(
      PERCENT_SUM,
      namedClasses.map((c) => namedPercent.get(c) ?? 0),
    )
    return buildMix(new Map(namedClasses.map((c, i) => [c, scaled[i]])))
  }

  const remaining = PERCENT_SUM - namedTotal

  // Case B: no unnamed class to hold the remainder — add it to the largest goal
  // (overshooting a target is acceptable; undershooting is not).
  if (unnamed.length === 0) {
    const largest = [...amountByClass.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const result = new Map(namedPercent)
    result.set(largest, (result.get(largest) ?? 0) + remaining)
    return buildMix(result)
  }

  // Case C: spread the remainder across unnamed classes, weighted by baseline.
  const unnamedAlloc = distributeIntegers(
    remaining,
    unnamed.map((c) => Math.max(0, baseline[c] ?? 0)),
  )
  const result = new Map(namedPercent)
  unnamed.forEach((c, i) => result.set(c, unnamedAlloc[i]))
  return buildMix(result)
}
