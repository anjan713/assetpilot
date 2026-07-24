import { useState } from 'react'
import { classOf } from '../engine/mapping'
import { ASSET_CLASSES, CLASS_LABELS } from '../engine/types'
import type { AccountPlan, RebalanceResult } from '../engine/types'
import { CLASS_COLORS } from './colors'
import { fmtPct, fmtShares, fmtUsd } from './format'

interface TradesDrawerProps {
  /** Null while the target inputs are not readable numbers. */
  result: RebalanceResult | null
  onClose: () => void
}

export function TradesDrawer({ result, onClose }: TradesDrawerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer drawer-wide"
        aria-label="Your trade list"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <h2 className="drawer-title">Your trade list</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close trade list">
            ✕
          </button>
        </header>

        <p className="drawer-note">
          Every buy and sell needed to hit your target, with the reason for each.
          Accounts never share cash. Each is balanced on its own.
        </p>

        {result === null || !result.ok ? (
          <p className="drawer-note" role="status">
            {result === null
              ? 'Finish the target percentages in the TARGETS bar to see the trades.'
              : result.error}
          </p>
        ) : (
          <TradesBody
            result={result}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </aside>
    </div>
  )
}

function TradesBody({
  result,
  selectedId,
  onSelect,
}: {
  result: Extract<RebalanceResult, { ok: true }>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const plans = result.plans
  const selected = plans.find((plan) => plan.accountId === selectedId) ?? plans[0]

  return (
    <>
      <div className="account-tabs" role="tablist" aria-label="Accounts">
        {plans.map((plan) => (
          <button
            key={plan.accountId}
            type="button"
            role="tab"
            aria-selected={plan.accountId === selected.accountId}
            className={`account-tab ${plan.accountId === selected.accountId ? 'is-active' : ''}`}
            onClick={() => onSelect(plan.accountId)}
          >
            {plan.accountName}
            <span className="account-tab-count">{plan.trades.length}</span>
          </button>
        ))}
      </div>
      <AccountPanel plan={selected} />
    </>
  )
}

function AccountPanel({ plan }: { plan: AccountPlan }) {
  // Group the account's trades into one outlined box per asset class.
  const tradeGroups = ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    trades: plan.trades.filter((trade) => classOf(trade.symbol) === assetClass),
  })).filter((group) => group.trades.length > 0)

  // Cash moves as one action: + when sells add to it, − when buys draw it down.
  const cashDelta = plan.cashDelta
  const cashAdds = cashDelta > 0.005
  const cashUses = cashDelta < -0.005
  const cashPct = plan.totalBefore > 0 ? (Math.abs(cashDelta) / plan.totalBefore) * 100 : 0
  const cashChipClass = cashAdds ? 'chip-buy' : 'chip-sell'
  const cashChipText = cashAdds
    ? `FROM SALES +${fmtUsd(cashDelta)}`
    : `USED FOR BUYS −${fmtUsd(Math.abs(cashDelta))}`
  const cashSignedPct = `${cashAdds ? '+' : '−'}${fmtPct(cashPct)}`

  return (
    <article className="account-plan" role="tabpanel">
      <p className="drawer-note">
        Total stays {fmtUsd(plan.totalBefore)} — trades only swap what this
        account holds.
      </p>
      {plan.isFrozen ? (
        <p className="drawer-note">
          Left untouched — this account only holds {fmtUsd(plan.totalBefore)} in
          cash, too small to trade.
        </p>
      ) : plan.trades.length === 0 && Math.abs(plan.cashDelta) < 0.005 ? (
        <p className="drawer-note">Already at target — nothing to do here.</p>
      ) : (
        <div className="trade-groups">
          {tradeGroups.map(({ assetClass, trades }) => (
            <section
              key={assetClass}
              className="trade-class-box"
              aria-label={CLASS_LABELS[assetClass]}
            >
              <header className="trade-class-head">
                <span
                  className="fund-dot"
                  style={{ background: CLASS_COLORS[assetClass], color: CLASS_COLORS[assetClass] }}
                  aria-hidden="true"
                />
                <span className="trade-class-name">{CLASS_LABELS[assetClass]}</span>
              </header>
              <p className="trade-class-reason">{trades[0].reason}</p>
              <div className="trades-scroll">
                <table className="trades-table">
                  <thead>
                    <tr>
                      <th scope="col">Action</th>
                      <th scope="col">Symbol</th>
                      <th scope="col" className="num">Shares</th>
                      <th scope="col" className="num">Price</th>
                      <th scope="col" className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade, index) => (
                      <tr key={`${trade.symbol}-${index}`}>
                        <td>
                          <span className={`trade-chip ${trade.action === 'BUY' ? 'chip-buy' : 'chip-sell'}`}>
                            {trade.action}
                          </span>
                        </td>
                        <td className="mono">{trade.symbol}</td>
                        <td className="num mono">{fmtShares(trade.shares)}</td>
                        <td className="num mono">{fmtUsd(trade.price)}</td>
                        <td className="num mono">{fmtUsd(trade.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <section className="trade-class-box" aria-label="Cash">
            <header className="trade-class-head">
              <span
                className="fund-dot"
                style={{ background: CLASS_COLORS.CASH, color: CLASS_COLORS.CASH }}
                aria-hidden="true"
              />
              <span className="trade-class-name">Cash</span>
            </header>
            <p className="trade-class-reason">
              Cash isn&rsquo;t bought or sold. It&rsquo;s the account&rsquo;s money
              market that funds the buys and collects the sells.
            </p>
            {cashAdds || cashUses ? (
              <>
                <p className="fund-journey">
                  <span>{fmtUsd(plan.cashBefore)}</span>
                  <span className="journey-arrow" aria-hidden="true">→</span>
                  <span className={`trade-chip ${cashChipClass}`}>{cashChipText}</span>
                  <span className="journey-arrow" aria-hidden="true">→</span>
                  <span className="journey-after">{fmtUsd(plan.cashTarget)}</span>
                </p>
                <p className="fund-shares">{cashSignedPct} of the account</p>
              </>
            ) : (
              <p className="drawer-note">Cash unchanged at {fmtUsd(plan.cashTarget)}.</p>
            )}
          </section>
        </div>
      )}
    </article>
  )
}
