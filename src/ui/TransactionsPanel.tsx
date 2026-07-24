import { classOf } from '../engine/mapping'
import { CLASS_LABELS } from '../engine/types'
import type { Account, AssetClass, RebalanceResult } from '../engine/types'
import { CLASS_COLORS } from './colors'
import { fmtPct, fmtShares, fmtUsd } from './format'
import { FUND_PLAIN_NAMES, tidyDescription } from './fundNames'

/** Since-purchase gain/loss, straight from the CSV — display only. */
function GainSentence({ dollar, percent }: { dollar: number; percent?: number }) {
  const isUp = dollar >= 0
  return (
    <p className={`fund-shares gain-sentence ${isUp ? 'gain-up' : 'gain-down'}`}>
      since purchase: {isUp ? 'up' : 'down'} {fmtUsd(Math.abs(dollar))}
      {percent !== undefined &&
        ` (${isUp ? '+' : '−'}${fmtPct(Math.abs(percent))})`}
    </p>
  )
}

interface TransactionsPanelProps {
  account: Account
  assetClass: AssetClass
  result: RebalanceResult | null
  onClose: () => void
}

export function TransactionsPanel({
  account,
  assetClass,
  result,
  onClose,
}: TransactionsPanelProps) {
  const color = CLASS_COLORS[assetClass]
  const holdings = account.positions.filter((p) => classOf(p.symbol) === assetClass)
  const classValue = holdings.reduce((sum, p) => sum + p.value, 0)
  const shareOfAccount = account.total > 0 ? (classValue / account.total) * 100 : 0

  const plan = result?.ok
    ? result.plans.find((p) => p.accountId === account.id) ?? null
    : null
  const classRow = plan?.classRows.find((row) => row.assetClass === assetClass) ?? null
  const trades =
    plan === null
      ? []
      : plan.trades.filter((trade) => classOf(trade.symbol) === assetClass)
  const tradeBySymbol = new Map(trades.map((trade) => [trade.symbol, trade]))
  const heldSymbols = new Set(holdings.map((holding) => holding.symbol))
  const newBuys = trades.filter((trade) => !heldSymbols.has(trade.symbol))

  // Cash is never traded directly — it is spent by buys and filled by sells,
  // automatically. Its change is the account's cashDelta, worded honestly.
  const isCash = assetClass === 'CASH'
  const cashDelta = plan?.cashDelta ?? 0

  function cashChip(delta: number) {
    return (
      <span className={`trade-chip ${delta > 0 ? 'chip-buy' : 'chip-sell'}`}>
        {delta > 0
          ? `FROM SALES +${fmtUsd(delta)}`
          : `USED FOR BUYS −${fmtUsd(Math.abs(delta))}`}
      </span>
    )
  }

  return (
    <aside
      className="detail-panel"
      style={{ '--accent': color } as React.CSSProperties}
      aria-label={`${CLASS_LABELS[assetClass]} in ${account.name}`}
    >
      <header className="detail-head">
        <div>
          <p className="detail-eyebrow">{account.name}</p>
          <h2 className="detail-title">{CLASS_LABELS[assetClass]}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </header>

      <section className="detail-section" aria-label="Rebalance in this account">
        <h3 className="detail-subhead">Rebalance in this account</h3>
        {classRow === null ? (
          <p className="detail-note">
            Finish the targets (whole numbers totalling 100) to see the plan.
          </p>
        ) : plan?.isFrozen ? (
          <p className="detail-note">Left as-is — this account is too small to trade.</p>
        ) : (
          <>
            <p className="fund-journey">
              <span>
                <span className="journey-label">current</span> {fmtUsd(classValue)}
              </span>
              <span className="journey-arrow" aria-hidden="true">→</span>
              {Math.abs(classRow.gap) < 0.005 ? (
                <span className="delta-chip delta-none">no change</span>
              ) : isCash ? (
                cashChip(classRow.gap)
              ) : (
                <span
                  className={`trade-chip ${classRow.gap > 0 ? 'chip-buy' : 'chip-sell'}`}
                >
                  {classRow.gap > 0 ? 'BUY +' : 'SELL −'}
                  {fmtUsd(Math.abs(classRow.gap))}
                </span>
              )}
              <span className="journey-arrow" aria-hidden="true">→</span>
              <span className="journey-after">{fmtUsd(classRow.target)}</span>
            </p>
            <p className="fund-shares">
              {fmtPct(shareOfAccount)} of this account now →{' '}
              {fmtPct(account.total > 0 ? (classRow.target / account.total) * 100 : 0)}{' '}
              at target
            </p>
          </>
        )}
      </section>

      <section className="detail-section" aria-label="Holdings and planned trades">
        <h3 className="detail-subhead">Holdings & plan</h3>
        <ul className="holding-list">
          {holdings.map((holding, index) => {
            const trade = tradeBySymbol.get(holding.symbol) ?? null
            // Cash rows carry their share of the account's automatic cash change.
            const rowCashDelta =
              isCash && classRow !== null && classValue > 0
                ? cashDelta * (holding.value / classValue)
                : 0
            const signed =
              trade !== null
                ? trade.action === 'BUY'
                  ? trade.amount
                  : -trade.amount
                : rowCashDelta
            return (
              <li
                key={`${holding.symbol}-${index}`}
                className="fund-row panel-fund-row"
                style={{ '--i': index } as React.CSSProperties}
              >
                <div className="fund-head">
                  <span
                    className="fund-dot"
                    style={{ background: color, color }}
                    aria-hidden="true"
                  />
                  <span className="fund-name">{holding.symbol}</span>
                  <span className="fund-ticker">{fmtUsd(holding.price)} / share</span>
                </div>
                <p className="fund-desc" title={holding.description}>
                  {FUND_PLAIN_NAMES[holding.symbol] ?? tidyDescription(holding.description)}
                </p>
                <p className="fund-journey">
                  <span>
                    <span className="journey-label">current</span>{' '}
                    {fmtUsd(holding.value)}
                  </span>
                  <span className="journey-arrow" aria-hidden="true">→</span>
                  {trade === null ? (
                    Math.abs(rowCashDelta) >= 0.005 ? (
                      cashChip(rowCashDelta)
                    ) : (
                      <span className="delta-chip delta-none">
                        {classRow === null ? '—' : 'no change'}
                      </span>
                    )
                  ) : (
                    <span
                      className={`trade-chip ${trade.action === 'BUY' ? 'chip-buy' : 'chip-sell'}`}
                    >
                      {trade.action === 'BUY' ? 'BUY +' : 'SELL −'}
                      {fmtUsd(trade.amount)}
                    </span>
                  )}
                  <span className="journey-arrow" aria-hidden="true">→</span>
                  <span className="journey-after">
                    {fmtUsd(holding.value + signed)}
                  </span>
                </p>
                {trade !== null && (
                  <p className="fund-shares">
                    {trade.action === 'BUY' ? 'buys' : 'sells'}{' '}
                    {fmtShares(trade.shares)} shares
                  </p>
                )}
                {holding.gainDollar !== undefined && (
                  <GainSentence
                    dollar={holding.gainDollar}
                    percent={holding.gainPercent}
                  />
                )}
              </li>
            )
          })}
          {newBuys.map((trade, index) => (
            <li
              key={`new-${trade.symbol}-${index}`}
              className="fund-row panel-fund-row"
              style={{ '--i': holdings.length + index } as React.CSSProperties}
            >
              <div className="fund-head">
                <span
                  className="fund-dot"
                  style={{ background: color, color }}
                  aria-hidden="true"
                />
                <span className="fund-name">{trade.symbol}</span>
                <span className="fund-ticker">new position</span>
              </div>
              {FUND_PLAIN_NAMES[trade.symbol] !== undefined && (
                <p className="fund-desc">{FUND_PLAIN_NAMES[trade.symbol]}</p>
              )}
              <p className="fund-journey">
                <span>new</span>
                <span className="journey-arrow" aria-hidden="true">→</span>
                <span className="trade-chip chip-buy">
                  BUY +{fmtUsd(trade.amount)}
                </span>
                <span className="journey-arrow" aria-hidden="true">→</span>
                <span className="journey-after">{fmtUsd(trade.amount)}</span>
              </p>
              <p className="fund-shares">
                buys {fmtShares(trade.shares)} shares at {fmtUsd(trade.price)} each
              </p>
            </li>
          ))}
          {holdings.length === 0 && newBuys.length === 0 && (
            <li className="holding-empty">Nothing here — and the plan needs nothing here.</li>
          )}
        </ul>
      </section>
    </aside>
  )
}
