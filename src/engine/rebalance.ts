import { classTotals } from './allocate'
import { classOf, DEFAULT_BUY_SYMBOL } from './mapping'
import { ASSET_CLASSES, CLASS_LABELS } from './types'
import type {
  Account,
  AccountPlan,
  AssetClass,
  CashPlacementStep,
  ClassRow,
  Position,
  RebalanceResult,
  Target,
  Trade,
} from './types'

/** Dollar amounts within half a cent are treated as settled. */
const CENT_EPSILON = 0.005
/** Percent-sum tolerance for float noise only (40+20+10+20+10 style input). */
const PERCENT_EPSILON = 1e-9

/**
 * Compute exact buy/sell transactions to reach the target allocation.
 *
 * Hard constraint (PROBLEM.md): cash cannot move between accounts. Every
 * account is rebalanced independently, funded only by its own sells and
 * its own money-market cash — so no account's total ever changes.
 */
export interface RebalanceOptions {
  /**
   * Override which symbols can be traded in fractional shares. When omitted, the
   * engine infers it from the data (see `detectFractionalSupport`). A BUY of a
   * symbol this returns `false` for is rounded down to a whole share, and the
   * unspent dollars stay as account cash.
   */
  supportsFractional?: (symbol: string) => boolean
}

/**
 * Infer which symbols support fractional trading straight from the CSV data.
 *
 * A holding with a fractional quantity (e.g. 428.791 shares of FNILX) is proof
 * that its security trades fractionally — you can't own 0.791 of a share
 * otherwise. Any symbol seen with a fractional quantity anywhere in the
 * household is therefore treated as fractional. A symbol only ever seen in
 * whole amounts is ambiguous, so it's treated conservatively as whole-share
 * only: the engine rounds its buys down and never plans a fraction the broker
 * might reject. Cash is skipped — it is never bought or sold.
 *
 * This makes the capability automatic: drop in a new CSV and the engine adapts,
 * no code change required.
 */
export function detectFractionalSupport(
  accounts: readonly Account[],
): (symbol: string) => boolean {
  const fractional = new Set<string>()
  for (const account of accounts) {
    for (const position of account.positions) {
      if (classOf(position.symbol) === 'CASH') continue
      if (!Number.isInteger(position.quantity)) fractional.add(position.symbol)
    }
  }
  return (symbol) => fractional.has(symbol)
}

export function rebalance(
  accounts: readonly Account[],
  target: Target,
  options: RebalanceOptions = {},
): RebalanceResult {
  const canFractional = options.supportsFractional ?? detectFractionalSupport(accounts)
  const percentSum = ASSET_CLASSES.reduce(
    (sum, c) => sum + target.percents[c],
    0,
  )
  const hasInvalidPercent = ASSET_CLASSES.some(
    (c) => !Number.isFinite(target.percents[c]) || target.percents[c] < 0,
  )
  if (hasInvalidPercent || Math.abs(percentSum - 100) > PERCENT_EPSILON) {
    return {
      ok: false,
      error: `Target percentages must each be 0–100 and add up to exactly 100 (they currently add up to ${formatUsdNumber(percentSum)}).`,
      percentSum,
    }
  }

  const householdTotal = accounts.reduce((sum, a) => sum + a.total, 0)
  const tradable = target.cashOrder
    .map((id) => accounts.find((a) => a.id === id))
    .filter((a): a is Account => a !== undefined)
  const frozen = accounts.filter((a) => !target.cashOrder.includes(a.id))

  const { cashTargets, placement } = placeCash(
    tradable,
    frozen,
    (target.percents.CASH / 100) * householdTotal,
  )

  const priceOf = buildPriceMap(accounts)
  const tradablePlans = tradable.map((account) =>
    planAccount(
      account,
      target.percents,
      cashTargets.get(account.id) ?? 0,
      priceOf,
      canFractional,
    ),
  )
  const frozenPlans = frozen.map(frozenPlan)

  const plans = [...tradablePlans, ...frozenPlans]
  plans.forEach(assertAccountBalances)

  return {
    ok: true,
    householdTotal,
    plans,
    placement,
    hasOverflow: placement.some((step) => step.isCapped),
  }
}

/**
 * Cash-location preference (research.md D6): walk the accounts in the
 * user's order; each takes min(remaining, its own total); the rest spills
 * onward. Frozen accounts keep their cash as-is — it counts as placed.
 */
function placeCash(
  tradable: readonly Account[],
  frozen: readonly Account[],
  householdCashTarget: number,
): { cashTargets: Map<string, number>; placement: CashPlacementStep[] } {
  const frozenCash = frozen.reduce(
    (sum, a) => sum + classTotals(a.positions).CASH,
    0,
  )
  const { placement } = tradable.reduce(
    (state, account) => {
      const cashTarget = Math.min(Math.max(state.remaining, 0), account.total)
      const isCapped =
        cashTarget >= account.total - CENT_EPSILON && cashTarget > 0
      return {
        remaining: state.remaining - cashTarget,
        placement: [
          ...state.placement,
          { accountId: account.id, accountName: account.name, cashTarget, isCapped },
        ],
      }
    },
    {
      remaining: Math.max(householdCashTarget - frozenCash, 0),
      placement: [] as CashPlacementStep[],
    },
  )
  return {
    cashTargets: new Map(placement.map((s) => [s.accountId, s.cashTarget])),
    placement,
  }
}

/**
 * Turn a desired dollar amount into an executable trade. Securities that trade
 * fractionally fill the amount exactly. Whole-share-only securities are rounded
 * DOWN to the nearest whole share, so we never place a fraction the broker
 * would reject; the unspent remainder is simply not traded (it stays as account
 * cash). Returns the `shares` to trade and the matching `amount` (shares×price),
 * so `amount / price === shares` always holds.
 */
export function executableTrade(
  amount: number,
  price: number,
  allowFractional: boolean,
): { shares: number; amount: number } {
  if (allowFractional) return { shares: amount / price, amount }
  const shares = Math.floor(amount / price)
  return { shares, amount: shares * price }
}

/** Per-account plan: class targets → gaps → proportional, executable trades. */
function planAccount(
  account: Account,
  percents: Record<AssetClass, number>,
  cashTarget: number,
  priceOf: ReadonlyMap<string, number>,
  canFractional: (symbol: string) => boolean,
): AccountPlan {
  const current = classTotals(account.positions)
  const invested = account.total - cashTarget
  const nonCashPercentSum = 100 - percents.CASH

  // The ideal dollar target for a class — what the user's percentages ask for.
  const desiredTarget = (assetClass: AssetClass): number =>
    assetClass === 'CASH'
      ? cashTarget
      : nonCashPercentSum === 0
        ? 0
        : (invested * percents[assetClass]) / nonCashPercentSum

  // Trades come from the ideal gaps, each rounded to what its security can trade.
  const trades = ASSET_CLASSES.filter(
    (assetClass) =>
      assetClass !== 'CASH' &&
      Math.abs(desiredTarget(assetClass) - current[assetClass]) >= CENT_EPSILON,
  ).flatMap((assetClass) =>
    tradesForClass(
      account,
      assetClass as Exclude<AssetClass, 'CASH'>,
      desiredTarget(assetClass) - current[assetClass],
      priceOf,
      canFractional,
    ),
  )
  const ordered = [
    ...trades.filter((t) => t.action === 'SELL'),
    ...trades.filter((t) => t.action === 'BUY'),
  ]

  const sellTotal = sumAmounts(ordered, 'SELL')
  const buyTotal = sumAmounts(ordered, 'BUY')
  // Cash absorbs the net of the executed trades — including any dollars a
  // whole-share rounding left unspent — so the account still balances exactly.
  const cashDelta = sellTotal - buyTotal

  // Net dollars actually traded into each non-cash class.
  const tradedByClass = ordered.reduce<Partial<Record<AssetClass, number>>>(
    (totals, trade) => {
      const assetClass = classOf(trade.symbol)
      const signed = trade.action === 'BUY' ? trade.amount : -trade.amount
      return { ...totals, [assetClass]: (totals[assetClass] ?? 0) + signed }
    },
    {},
  )

  // Where each class actually lands after the executable trades.
  const classRows: ClassRow[] = ASSET_CLASSES.map((assetClass) => {
    const end =
      assetClass === 'CASH'
        ? current.CASH + cashDelta
        : current[assetClass] + (tradedByClass[assetClass] ?? 0)
    return {
      assetClass,
      current: current[assetClass],
      target: end,
      gap: end - current[assetClass],
    }
  })
  const totalAfter = classRows.reduce((sum, row) => sum + row.target, 0)

  return {
    accountId: account.id,
    accountName: account.name,
    isFrozen: false,
    totalBefore: account.total,
    totalAfter,
    cashBefore: current.CASH,
    cashTarget: current.CASH + cashDelta,
    cashDelta,
    classRows,
    trades: ordered,
    sellTotal,
    buyTotal,
  }
}

/**
 * Split one class gap across that account's holdings, proportional to
 * current values; if the account holds none, buy the class's default symbol.
 */
function tradesForClass(
  account: Account,
  assetClass: Exclude<AssetClass, 'CASH'>,
  gap: number,
  priceOf: ReadonlyMap<string, number>,
  canFractional: (symbol: string) => boolean,
): Trade[] {
  const label = CLASS_LABELS[assetClass]
  const overOrUnder = gap < 0 ? 'over' : 'under'
  const reason = `${label} is $${formatUsdNumber(Math.abs(gap))} ${overOrUnder} target in this account`
  const action = gap < 0 ? 'SELL' : 'BUY'

  const held = account.positions.filter(
    (p) => classOf(p.symbol) === assetClass && p.value > 0,
  )
  if (held.length === 0 && gap > 0) {
    const symbol = DEFAULT_BUY_SYMBOL[assetClass]
    const price = priceOf.get(symbol)
    if (price === undefined) {
      throw new Error(`No price available for ${symbol} — cannot plan a BUY`)
    }
    return [makeTrade(account.id, action, symbol, gap, price, reason, canFractional)].filter(
      (trade) => trade.amount >= CENT_EPSILON,
    )
  }

  const heldTotal = held.reduce((sum, p) => sum + p.value, 0)
  return held
    .map((position) =>
      makeTrade(
        account.id,
        action,
        position.symbol,
        (Math.abs(gap) * position.value) / heldTotal,
        position.price,
        reason,
        canFractional,
      ),
    )
    .filter((trade) => trade.amount >= CENT_EPSILON)
}

function makeTrade(
  accountId: string,
  action: 'BUY' | 'SELL',
  symbol: string,
  amount: number,
  price: number,
  reason: string,
  canFractional: (symbol: string) => boolean,
): Trade {
  // A BUY of a whole-share-only security rounds down to whole shares; the
  // unspent remainder stays as account cash. A SELL of an existing holding is
  // left exact — you can always dispose of shares you already own.
  const allowFractional = action === 'SELL' || canFractional(symbol)
  const executable = executableTrade(amount, price, allowFractional)
  return {
    accountId,
    action,
    symbol,
    shares: executable.shares,
    price,
    amount: executable.amount,
    reason,
  }
}

function frozenPlan(account: Account): AccountPlan {
  const current = classTotals(account.positions)
  return {
    accountId: account.id,
    accountName: account.name,
    isFrozen: true,
    totalBefore: account.total,
    totalAfter: account.total,
    cashBefore: current.CASH,
    cashTarget: current.CASH,
    cashDelta: 0,
    classRows: ASSET_CLASSES.map((assetClass) => ({
      assetClass,
      current: current[assetClass],
      target: current[assetClass],
      gap: 0,
    })),
    trades: [],
    sellTotal: 0,
    buyTotal: 0,
  }
}

/**
 * Invariant (FR-008): every account is self-funded to the cent —
 * buys = sells + cash spent — and its total never changes. A violation
 * means an engine bug; refuse to hand out a wrong trade list.
 */
function assertAccountBalances(plan: AccountPlan): void {
  const fundingError = plan.buyTotal - plan.sellTotal + plan.cashDelta
  if (Math.abs(fundingError) > CENT_EPSILON) {
    throw new Error(
      `Invariant violation in ${plan.accountName}: buys ($${formatUsdNumber(plan.buyTotal)}) ` +
        `are not fully funded by sells ($${formatUsdNumber(plan.sellTotal)}) ` +
        `plus the cash change ($${formatUsdNumber(plan.cashDelta)}). Refusing to show this trade list.`,
    )
  }
  if (Math.abs(plan.totalAfter - plan.totalBefore) > CENT_EPSILON) {
    throw new Error(
      `Invariant violation in ${plan.accountName}: account total would change ` +
        `from $${formatUsdNumber(plan.totalBefore)} to $${formatUsdNumber(plan.totalAfter)}.`,
    )
  }
}

function buildPriceMap(accounts: readonly Account[]): Map<string, number> {
  const entries = accounts
    .flatMap((a) => a.positions)
    .map((p: Position): [string, number] => [p.symbol, p.price])
  return new Map(entries)
}

function sumAmounts(trades: readonly Trade[], action: 'BUY' | 'SELL'): number {
  return trades
    .filter((t) => t.action === action)
    .reduce((sum, t) => sum + t.amount, 0)
}

/** 2-dp display formatting for messages (engine keeps full precision). */
function formatUsdNumber(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
