import type { Account } from '../engine/types'

interface CashOrderDrawerProps {
  accounts: readonly Account[]
  cashOrder: readonly string[]
  onCashOrderChange: (next: string[]) => void
  onClose: () => void
}

/**
 * Slim drawer for the one cash-location control: the order in which accounts
 * keep their own money as cash. Cash never moves between accounts — this only
 * decides which account holds its cash first.
 */
export function CashOrderDrawer({
  accounts,
  cashOrder,
  onCashOrderChange,
  onClose,
}: CashOrderDrawerProps) {
  function moveUp(index: number) {
    if (index === 0) return
    const next = [...cashOrder]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onCashOrderChange(next)
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        aria-label="Cash order"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <h2 className="drawer-title">Where should cash live?</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close cash order">
            ✕
          </button>
        </header>
        <p className="drawer-note">
          Cash never moves between accounts. This order only decides which
          account keeps its own money as cash first.
        </p>
        <ol className="cash-order">
          {cashOrder.map((accountId, index) => {
            const account = accounts.find((a) => a.id === accountId)
            return (
              <li key={accountId} className="cash-order-row">
                <span className="cash-order-rank" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="cash-order-name">{account?.name ?? accountId}</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  aria-label={`Move ${account?.name ?? accountId} up in the cash order`}
                >
                  ↑ Move up
                </button>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
