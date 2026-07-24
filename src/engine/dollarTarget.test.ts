import { describe, expect, it } from 'vitest'
import { applyDollarGoals } from './dollarTarget'
import { ASSET_CLASSES } from './types'
import type { AssetClass } from './types'

const BASELINE: Record<AssetClass, number> = {
  US_EQUITY: 10,
  INTERNATIONAL: 10,
  GOLD: 10,
  TREASURIES: 20,
  CASH: 50,
}

function sum(mix: Record<AssetClass, number>): number {
  return ASSET_CLASSES.reduce((total, c) => total + mix[c], 0)
}

describe('applyDollarGoals', () => {
  it('rounds the percentage UP so the dollar goal is met or exceeded', () => {
    // Arrange: 300k / 533,137.47 = 56.27% — must round up to 57, not down to 56.
    const household = 533137.47

    // Act
    const mix = applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 300000 }], household)

    // Assert
    expect(mix.CASH).toBe(57)
    expect((mix.CASH / 100) * household).toBeGreaterThanOrEqual(300000)
  })

  it('always produces whole numbers that sum to exactly 100', () => {
    const mix = applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 300000 }], 533137.47)

    expect(sum(mix)).toBe(100)
    for (const c of ASSET_CLASSES) {
      expect(Number.isInteger(mix[c])).toBe(true)
      expect(mix[c]).toBeGreaterThanOrEqual(0)
    }
  })

  it('gives the remaining percent to the classes with no dollar goal', () => {
    const mix = applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 300000 }], 533137.47)

    const unnamedSum = mix.US_EQUITY + mix.INTERNATIONAL + mix.GOLD + mix.TREASURIES
    expect(unnamedSum).toBe(100 - mix.CASH)
  })

  it('applies to any asset class, not just cash', () => {
    // Arrange: 100k / 500k = 20% exactly for gold.
    const mix = applyDollarGoals(BASELINE, [{ assetClass: 'GOLD', amount: 100000 }], 500000)

    // Assert
    expect(mix.GOLD).toBe(20)
    expect(sum(mix)).toBe(100)
  })

  it('handles several dollar goals at once', () => {
    const flat: Record<AssetClass, number> = {
      US_EQUITY: 20,
      INTERNATIONAL: 20,
      GOLD: 20,
      TREASURIES: 20,
      CASH: 20,
    }

    const mix = applyDollarGoals(
      flat,
      [
        { assetClass: 'GOLD', amount: 100000 },
        { assetClass: 'CASH', amount: 200000 },
      ],
      500000,
    )

    expect(mix.GOLD).toBe(20)
    expect(mix.CASH).toBe(40)
    expect(sum(mix)).toBe(100)
    expect((mix.CASH / 100) * 500000).toBeGreaterThanOrEqual(200000)
    expect((mix.GOLD / 100) * 500000).toBeGreaterThanOrEqual(100000)
  })

  it('caps a class at 100% when the goal exceeds the whole portfolio', () => {
    const mix = applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 600000 }], 500000)

    expect(mix.CASH).toBe(100)
    expect(mix.US_EQUITY).toBe(0)
    expect(sum(mix)).toBe(100)
  })

  it('scales goals down to 100 when together they exceed the portfolio', () => {
    const mix = applyDollarGoals(
      BASELINE,
      [
        { assetClass: 'CASH', amount: 400000 },
        { assetClass: 'GOLD', amount: 300000 },
      ],
      500000,
    )

    expect(sum(mix)).toBe(100)
    expect(mix.CASH).toBeGreaterThanOrEqual(mix.GOLD)
    expect(mix.US_EQUITY).toBe(0)
    expect(mix.INTERNATIONAL).toBe(0)
    expect(mix.TREASURIES).toBe(0)
  })

  it('returns the baseline unchanged when there are no goals', () => {
    const mix = applyDollarGoals(BASELINE, [], 533137.47)

    expect(mix).toEqual(BASELINE)
  })

  it('returns the baseline unchanged when the household total is invalid', () => {
    expect(applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 300000 }], 0)).toEqual(BASELINE)
    expect(applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 300000 }], -5)).toEqual(BASELINE)
    expect(applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 300000 }], NaN)).toEqual(BASELINE)
  })

  it('ignores goals with non-positive amounts', () => {
    const mix = applyDollarGoals(BASELINE, [{ assetClass: 'CASH', amount: 0 }], 500000)

    expect(mix).toEqual(BASELINE)
  })
})
