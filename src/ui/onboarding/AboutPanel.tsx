import { useRef } from 'react'
import { useBodyScrollLock, useSheetDrag } from '../sheetDrag'
import { useMediaQuery } from '../useMediaQuery'

interface AboutPanelProps {
  onClose: () => void
  onReplayTour: () => void
}

/** Matches the width where the transactions panel also becomes a bottom sheet. */
const SHEET_QUERY = '(max-width: 980px)'

/** A bottom sheet on phones, a small panel under the “i” button on desktop. */
export function AboutPanel({ onClose, onReplayTour }: AboutPanelProps) {
  const isSheet = useMediaQuery(SHEET_QUERY)
  const panelRef = useRef<HTMLElement>(null)
  const dragZoneRef = useRef<HTMLElement>(null)
  useSheetDrag(panelRef, dragZoneRef, onClose, isSheet)
  useBodyScrollLock(isSheet)

  return (
    <>
      <div className={`about-backdrop ${isSheet ? 'is-sheet' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`about-panel ${isSheet ? 'is-sheet' : ''}`}
        role="dialog"
        aria-labelledby="about-title"
      >
        <header className="about-head" ref={dragZoneRef}>
          <div>
            <p className="about-eyebrow">About AssetPilot</p>
            <h2 id="about-title" className="about-title">
              Rebalancing multiple accounts as one household portfolio
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close about">
            ✕
          </button>
        </header>
        <section className="about-section">
          <h3>The problem</h3>
          <p>
            Investments spread across several brokerage accounts are difficult to reason about as
            one portfolio.
          </p>
        </section>
        <section className="about-section">
          <h3>What AssetPilot does</h3>
          <p>
            AssetPilot combines holdings from four accounts into a single allocation view, compares
            that portfolio with a target mix, and generates the exact trades needed to move closer
            to it.
          </p>
        </section>
        <section className="about-section">
          <h3>How trades are calculated</h3>
          <p>
            All balances, allocations, and trades are produced by deterministic code. AI can suggest
            a target from a goal you describe, but it does not calculate or execute trades.
          </p>
        </section>
        <section className="about-section">
          <h3>Account boundaries</h3>
          <p>
            Each account must fund its own purchases using its own cash or proceeds from its own
            sells. Assets and cash are never moved between accounts.
          </p>
        </section>
        <button type="button" className="tour-primary tour-primary-wide" onClick={onReplayTour}>
          Replay the tour
        </button>
      </aside>
    </>
  )
}
