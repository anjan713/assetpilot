import { describe, expect, test } from 'vitest'
import csvText from '../data/portfolio.csv?raw'
import { groupAccounts } from './allocate'
import { defaultCashOrder, defaultTargets } from './defaults'
import { parsePortfolioCsv } from './parse'
import { detectFractionalSupport, executableTrade, rebalance } from './rebalance'
import { ASSET_CLASSES } from './types'
import type { Account, AssetClass, Position, RebalanceResult } from './types'

type OkResult = Extract<RebalanceResult, { ok: true }>

function makePosition(symbol: string, quantity: number, price: number): Position {
  return {
    accountId: 'TEST',
    accountName: 'Test',
    symbol,
    description: symbol,
    quantity,
    price,
    value: quantity * price,
  }
}

function makeAccount(positions: Position[]): Account {
  return {
    id: 'TEST',
    name: 'Test',
    positions,
    total: positions.reduce((sum, p) => sum + p.value, 0),
  }
}

const { positions } = parsePortfolioCsv(csvText)
const accounts = groupAccounts(positions)

const JOINT = 'X483920176'
const IRA_ALEX = '8043672915'
const IRA_JORDAN = '2957816403'
const OLD_BROKERAGE = 'XQMTVRWK'
const DEFAULT_ORDER = [JOINT, IRA_ALEX, IRA_JORDAN]

const REFERENCE_TARGET: Record<AssetClass, number> = {
  US_EQUITY: 40,
  INTERNATIONAL: 20,
  GOLD: 10,
  TREASURIES: 20,
  CASH: 10,
}

function run(
  percents: Record<AssetClass, number>,
  cashOrder: string[] = DEFAULT_ORDER,
): Extract<RebalanceResult, { ok: true }> {
  const result = rebalance(accounts, { percents, cashOrder })
  if (!result.ok) throw new Error(`expected ok result, got: ${result.error}`)
  return result
}

describe('validation', () => {
  test('rejects percentages that do not sum to 100', () => {
    const result = rebalance(accounts, {
      percents: { ...REFERENCE_TARGET, GOLD: 15 },
      cashOrder: DEFAULT_ORDER,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.percentSum).toBeCloseTo(105, 9)
      expect(result.error).toContain('105.00')
    }
  })

  test('rejects negative percentages', () => {
    const result = rebalance(accounts, {
      percents: { ...REFERENCE_TARGET, GOLD: -10, CASH: 30 },
      cashOrder: DEFAULT_ORDER,
    })
    expect(result.ok).toBe(false)
  })
})

describe('cash placement (liquidity preference)', () => {
  test('reference target: household cash lands in Joint, IRAs end at $0 cash', () => {
    const result = run(REFERENCE_TARGET)
    const targets = new Map(result.placement.map((s) => [s.accountId, s.cashTarget]))
    // 10% of $533,137.47 = $53,313.747 minus the frozen account's $0.21
    expect(targets.get(JOINT)).toBeCloseTo(53313.537, 2)
    expect(targets.get(IRA_ALEX)).toBeCloseTo(0, 2)
    expect(targets.get(IRA_JORDAN)).toBeCloseTo(0, 2)
    expect(result.hasOverflow).toBe(false)
  })

  test('cash 20% overflows Joint: Joint becomes 100% cash, rest spills to next account', () => {
    const result = run({ ...REFERENCE_TARGET, US_EQUITY: 30, CASH: 20 })
    const targets = new Map(result.placement.map((s) => [s.accountId, s.cashTarget]))
    expect(targets.get(JOINT)).toBeCloseTo(62364.09, 2)
    expect(targets.get(IRA_ALEX)).toBeCloseTo(106627.494 - 0.21 - 62364.09, 2)
    expect(targets.get(IRA_JORDAN)).toBeCloseTo(0, 2)
    expect(result.hasOverflow).toBe(true)
  })

  test('cash order is respected: putting IRA (Jordan) first fills it before Joint', () => {
    const result = run(REFERENCE_TARGET, [IRA_JORDAN, JOINT, IRA_ALEX])
    const targets = new Map(result.placement.map((s) => [s.accountId, s.cashTarget]))
    expect(targets.get(IRA_JORDAN)).toBeCloseTo(53313.537, 2)
    expect(targets.get(JOINT)).toBeCloseTo(0, 2)
  })

  test('cash 0%: every account fully invested, all money market spent', () => {
    const result = run({ ...REFERENCE_TARGET, US_EQUITY: 50, CASH: 0 })
    result.plans
      .filter((p) => !p.isFrozen)
      .forEach((plan) => {
        expect(plan.cashTarget).toBeCloseTo(0, 2)
        expect(plan.cashDelta).toBeCloseTo(-plan.cashBefore, 2)
      })
  })
})

describe('per-account class targets and gaps', () => {
  test('Joint invested money splits 40:20:10:20 across non-cash classes', () => {
    const result = run(REFERENCE_TARGET)
    const joint = result.plans.find((p) => p.accountId === JOINT)!
    const invested = 62364.09 - 53313.537
    const rows = new Map(joint.classRows.map((r) => [r.assetClass, r]))
    expect(rows.get('US_EQUITY')!.target).toBeCloseTo((invested * 40) / 90, 2)
    expect(rows.get('INTERNATIONAL')!.target).toBeCloseTo((invested * 20) / 90, 2)
    expect(rows.get('GOLD')!.target).toBeCloseTo((invested * 10) / 90, 2)
    expect(rows.get('TREASURIES')!.target).toBeCloseTo((invested * 20) / 90, 2)
    expect(rows.get('CASH')!.target).toBeCloseTo(53313.537, 2)
  })

  test('summed across accounts, class targets reproduce the household target', () => {
    const result = run(REFERENCE_TARGET)
    ASSET_CLASSES.forEach((assetClass) => {
      const summed = result.plans.reduce(
        (sum, plan) =>
          sum + plan.classRows.find((r) => r.assetClass === assetClass)!.target,
        0,
      )
      expect(summed).toBeCloseTo(
        (REFERENCE_TARGET[assetClass] / 100) * 533137.47,
        1,
      )
    })
  })
})

describe('trades', () => {
  test('SELLs come before BUYs within each account', () => {
    const result = run(REFERENCE_TARGET)
    result.plans.forEach((plan) => {
      const firstBuy = plan.trades.findIndex((t) => t.action === 'BUY')
      const lastSell = plan.trades
        .map((t, i) => (t.action === 'SELL' ? i : -1))
        .reduce((a, b) => Math.max(a, b), -1)
      if (firstBuy !== -1 && lastSell !== -1) {
        expect(lastSell).toBeLessThan(firstBuy)
      }
    })
  })

  test('a class gap splits across holdings proportional to current values', () => {
    const result = run(REFERENCE_TARGET)
    const joint = result.plans.find((p) => p.accountId === JOINT)!
    const fzilx = joint.trades.find((t) => t.symbol === 'FZILX')!
    const vgk = joint.trades.find((t) => t.symbol === 'VGK')!
    expect(fzilx.action).toBe('SELL')
    expect(vgk.action).toBe('SELL')
    expect(fzilx.amount / vgk.amount).toBeCloseTo(12136.99 / 10567.0, 6)
    // Together they cover the whole International gap
    const intlGap = joint.classRows.find(
      (r) => r.assetClass === 'INTERNATIONAL',
    )!.gap
    expect(fzilx.amount + vgk.amount).toBeCloseTo(Math.abs(intlGap), 6)
  })

  test('shares are amount ÷ price', () => {
    const result = run(REFERENCE_TARGET)
    result.plans
      .flatMap((p) => p.trades)
      .forEach((trade) => {
        expect(trade.shares).toBeCloseTo(trade.amount / trade.price, 9)
        expect(trade.amount).toBeGreaterThan(0)
      })
  })

  test('reason names the class and the over/under amount', () => {
    const result = run(REFERENCE_TARGET)
    const joint = result.plans.find((p) => p.accountId === JOINT)!
    const iau = joint.trades.find((t) => t.symbol === 'IAU')!
    expect(iau.reason).toMatch(/^Gold is \$[\d,]+\.\d{2} over target in this account$/)
  })

  test('a class set to 0% is fully sold in every account', () => {
    const result = run({ ...REFERENCE_TARGET, US_EQUITY: 50, GOLD: 0 })
    const joint = result.plans.find((p) => p.accountId === JOINT)!
    const iau = joint.trades.find((t) => t.symbol === 'IAU')!
    expect(iau.action).toBe('SELL')
    expect(iau.amount).toBeCloseTo(4728.44, 2)
    expect(iau.shares).toBeCloseTo(58.189, 3)
  })

  test('the $0.21 dust account never trades', () => {
    const result = run(REFERENCE_TARGET)
    const dust = result.plans.find((p) => p.accountId === OLD_BROKERAGE)!
    expect(dust.isFrozen).toBe(true)
    expect(dust.trades).toHaveLength(0)
    expect(dust.totalAfter).toBeCloseTo(0.21, 2)
  })
})

describe('invariants (FR-008): self-funding and unchanged totals', () => {
  // Deterministic pseudo-random generator so failures are reproducible.
  function makeLcg(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  const ORDERS = [
    [JOINT, IRA_ALEX, IRA_JORDAN],
    [JOINT, IRA_JORDAN, IRA_ALEX],
    [IRA_ALEX, JOINT, IRA_JORDAN],
    [IRA_ALEX, IRA_JORDAN, JOINT],
    [IRA_JORDAN, JOINT, IRA_ALEX],
    [IRA_JORDAN, IRA_ALEX, JOINT],
  ]

  test('hold across 60 random valid targets and every cash order', () => {
    const random = makeLcg(20260615)
    for (let i = 0; i < 60; i += 1) {
      const draws = [0, 1, 2, 3].map(() => Math.round(random() * 2400) / 100)
      const percents: Record<AssetClass, number> = {
        US_EQUITY: draws[0],
        INTERNATIONAL: draws[1],
        GOLD: draws[2],
        TREASURIES: draws[3],
        CASH: 100 - draws[0] - draws[1] - draws[2] - draws[3],
      }
      const result = run(percents, ORDERS[i % ORDERS.length])
      result.plans.forEach((plan) => {
        const fundingError = plan.buyTotal - plan.sellTotal + plan.cashDelta
        expect(Math.abs(fundingError)).toBeLessThan(0.005)
        expect(Math.abs(plan.totalAfter - plan.totalBefore)).toBeLessThan(0.005)
      })
    }
  })

  test('reference target: Joint cash increase exactly funds the shortfall of its sells', () => {
    const result = run(REFERENCE_TARGET)
    const joint = result.plans.find((p) => p.accountId === JOINT)!
    // Joint sells everything down to reach an 85%-cash position
    expect(joint.sellTotal).toBeCloseTo(joint.cashDelta, 2)
    expect(joint.buyTotal).toBeCloseTo(0, 2)
  })
})

describe('automatic fractional-support detection (from CSV quantities)', () => {
  test('every stock in the real file is detected as fractional', () => {
    const canFractional = detectFractionalSupport(accounts)
    // All non-cash holdings in the file carry fractional quantities.
    ;['FNILX', 'NUKZ', 'SHLD', 'FZILX', 'VGK', 'IAU', 'BIL'].forEach((symbol) => {
      expect(canFractional(symbol)).toBe(true)
    })
  })

  test('a fractional quantity proves the security trades fractionally', () => {
    const canFractional = detectFractionalSupport([
      makeAccount([makePosition('FNILX', 428.791, 27.03)]),
    ])
    expect(canFractional('FNILX')).toBe(true)
  })

  test('a symbol only ever held in whole amounts is treated as whole-share only', () => {
    const canFractional = detectFractionalSupport([
      makeAccount([makePosition('FNILX', 100, 27.03)]),
    ])
    expect(canFractional('FNILX')).toBe(false)
  })

  test('any fractional sighting across the household wins', () => {
    const canFractional = detectFractionalSupport([
      makeAccount([makePosition('FNILX', 100, 27.03)]),
      makeAccount([makePosition('FNILX', 12.5, 27.03)]),
    ])
    expect(canFractional('FNILX')).toBe(true)
  })
})

describe('fractional-share rounding (edge case 3)', () => {
  test('fractional securities fill the exact dollar amount', () => {
    const { shares, amount } = executableTrade(65, 27, true)
    expect(shares).toBeCloseTo(65 / 27, 9)
    expect(amount).toBe(65)
  })

  test('whole-share-only securities round the share count down', () => {
    const { shares, amount } = executableTrade(65, 27, false)
    expect(shares).toBe(2) // floor(65 / 27)
    expect(amount).toBe(54) // 2 shares × $27
  })

  test('a buy smaller than one whole share becomes no trade', () => {
    const { shares, amount } = executableTrade(20, 27, false)
    expect(shares).toBe(0)
    expect(amount).toBe(0)
  })

  test('rounding a real BUY down leaves the remainder as cash; invariants hold', () => {
    const target = {
      percents: {
        US_EQUITY: 60,
        INTERNATIONAL: 15,
        GOLD: 10,
        TREASURIES: 10,
        CASH: 5,
      },
      cashOrder: DEFAULT_ORDER,
    }
    const fractional = rebalance(accounts, target)
    const wholeShare = rebalance(accounts, target, {
      supportsFractional: (symbol) => symbol !== 'FNILX',
    })
    if (!fractional.ok || !wholeShare.ok) throw new Error('expected ok result')

    const fnilxBuys = (result: OkResult) =>
      result.plans
        .flatMap((plan) => plan.trades)
        .filter((trade) => trade.symbol === 'FNILX' && trade.action === 'BUY')

    // The feature is actually exercised: fractional run has a partial-share buy,
    // and the whole-share run turns every FNILX buy into a whole number.
    expect(fnilxBuys(wholeShare).length).toBeGreaterThan(0)
    expect(fnilxBuys(fractional).some((t) => !Number.isInteger(t.shares))).toBe(true)
    fnilxBuys(wholeShare).forEach((t) => {
      expect(Number.isInteger(t.shares)).toBe(true)
      expect(t.amount).toBeCloseTo(t.shares * t.price, 9)
    })

    // Self-funding and unchanged-total invariants still hold to the cent.
    wholeShare.plans.forEach((plan) => {
      expect(Math.abs(plan.buyTotal - plan.sellTotal + plan.cashDelta)).toBeLessThan(0.005)
      expect(Math.abs(plan.totalAfter - plan.totalBefore)).toBeLessThan(0.005)
    })
  })
})

describe('defaults', () => {
  test('default cash order is Joint first, then IRAs by size; dust excluded', () => {
    expect(defaultCashOrder(accounts)).toEqual(DEFAULT_ORDER)
  })

  test('default target sums to exactly 100 and mirrors the current allocation', () => {
    const percents = defaultTargets(accounts)
    const sum = ASSET_CLASSES.reduce((s, c) => s + percents[c], 0)
    expect(sum).toBeCloseTo(100, 9)
    // Current household cash is ~19% — the default should be close to it
    expect(percents.CASH).toBeGreaterThan(15)
    expect(percents.CASH).toBeLessThan(25)
    // And a rebalance against the default target must be valid
    const result = rebalance(accounts, { percents, cashOrder: DEFAULT_ORDER })
    expect(result.ok).toBe(true)
  })
})
