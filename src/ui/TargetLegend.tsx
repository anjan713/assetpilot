import { ASSET_CLASSES, CLASS_LABELS } from '../engine/types'
import type { AssetClass } from '../engine/types'
import type { PercentInputs } from './App'
import { CLASS_COLORS } from './colors'

const SUM_EPSILON = 1e-9

interface TargetLegendProps {
  percentInputs: PercentInputs
  onPercentsChange: (next: PercentInputs) => void
  /** Null while any input is empty or not a whole number. */
  percents: Record<AssetClass, number> | null
}

/**
 * Floating legend shown while the atom is open: one row per asset class
 * (color dot + name) with its editable whole-number target beside it.
 * Edits recompute the plan instantly; the details panel shows the
 * resulting transactions for whichever class is selected.
 */
export function TargetLegend({
  percentInputs,
  onPercentsChange,
  percents,
}: TargetLegendProps) {
  const sum =
    percents === null
      ? null
      : ASSET_CLASSES.reduce((total, c) => total + percents[c], 0)
  const isValidSum = sum !== null && Math.abs(sum - 100) <= SUM_EPSILON

  return (
    <section className="target-legend" aria-label="Target allocation">
      <h2 className="legend-title">Targets</h2>
      <div className="legend-rows">
        {ASSET_CLASSES.map((assetClass) => (
          <label className="legend-row" key={assetClass}>
            <span
              className="target-dot"
              style={{ color: CLASS_COLORS[assetClass], background: CLASS_COLORS[assetClass] }}
              aria-hidden="true"
            />
            <span className="legend-name">{CLASS_LABELS[assetClass]}</span>
            <span className="legend-input-wrap">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={percentInputs[assetClass]}
                onChange={(event) =>
                  onPercentsChange({
                    ...percentInputs,
                    [assetClass]: event.target.value,
                  })
                }
                aria-label={`${CLASS_LABELS[assetClass]} target percent`}
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>
        ))}
      </div>
      <p
        className={`target-sum ${isValidSum ? 'sum-ok' : 'sum-bad'}`}
        role="status"
        aria-live="polite"
      >
        {percents === null
          ? 'Whole numbers in every box'
          : isValidSum
            ? 'Adds up to 100 ✓'
            : `Adds up to ${sum} — needs 100`}
      </p>
    </section>
  )
}
