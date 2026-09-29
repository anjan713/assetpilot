import { useEffect, useMemo, useState } from 'react'
import csvText from '../data/portfolio.csv?raw'
import { classTotals, groupAccounts, householdTotal } from '../engine/allocate'
import { defaultCashOrder, defaultTargets } from '../engine/defaults'
import { classOf } from '../engine/mapping'
import { parsePortfolioCsv } from '../engine/parse'
import { rebalance } from '../engine/rebalance'
import { ASSET_CLASSES } from '../engine/types'
import type { Account, AssetClass, RebalanceResult } from '../engine/types'
import { AtomView } from './atom/AtomView'
import type { AtomStage } from './atom/AtomView'
import { GoalBar } from './GoalBar'
import { TargetLegend } from './TargetLegend'
import { CashOrderDrawer } from './CashOrderDrawer'
import { TradesDrawer } from './TradesDrawer'
import { TransactionsPanel } from './TransactionsPanel'
import { useMediaQuery } from './useMediaQuery'
import { AboutPanel } from './onboarding/AboutPanel'
import { Onboarding } from './onboarding/Onboarding'
import { hasSeenTour, markTourSeen, nextTourStep, tourStorage } from './onboarding/tourSteps'
import type { TourStep } from './onboarding/tourSteps'

export type PercentInputs = Record<AssetClass, string>

type Drawer = 'cash' | 'trades' | null

/**
 * Matches AtomView's phone spine. There the details open as a bottom sheet
 * over the tree, so picking an account must not open one straight away.
 */
const PHONE_QUERY = '(max-width: 699px)'

/** The first asset class this account actually holds (its first leaf). */
function firstHeldClass(account: Account): AssetClass {
  return (
    ASSET_CLASSES.find((c) =>
      account.positions.some((p) => classOf(p.symbol) === c && p.value >= 0.005),
    ) ?? ASSET_CLASSES[0]
  )
}

function toInputs(percents: Record<AssetClass, number>): PercentInputs {
  return Object.fromEntries(
    ASSET_CLASSES.map((c) => [c, String(percents[c])]),
  ) as PercentInputs
}

function toPercents(inputs: PercentInputs): Record<AssetClass, number> | null {
  const entries = ASSET_CLASSES.map((c) => [c, Number(inputs[c].trim())] as const)
  const hasInvalid = entries.some(
    ([, value]) => !Number.isInteger(value) || value < 0,
  )
  if (hasInvalid || ASSET_CLASSES.some((c) => inputs[c].trim() === '')) return null
  return Object.fromEntries(entries) as Record<AssetClass, number>
}

export function App() {
  const { positions } = useMemo(
    () => parsePortfolioCsv(csvText),
    [],
  )
  const accounts = useMemo(() => groupAccounts(positions), [positions])
  const household = useMemo(() => householdTotal(accounts), [accounts])
  const currentTotals = useMemo(() => classTotals(positions), [positions])

  const [isAtomOpen, setIsAtomOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<AssetClass | null>(null)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [tourStep, setTourStep] = useState<TourStep | null>(() =>
    hasSeenTour(tourStorage()) ? null : 'intro',
  )
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [percentInputs, setPercentInputs] = useState<PercentInputs>(() =>
    toInputs(defaultTargets(accounts)),
  )
  const [cashOrder, setCashOrder] = useState<string[]>(() =>
    defaultCashOrder(accounts),
  )

  const percents = useMemo(() => toPercents(percentInputs), [percentInputs])

  const { result, engineError } = useMemo((): {
    result: RebalanceResult | null
    engineError: string | null
  } => {
    if (percents === null) return { result: null, engineError: null }
    try {
      return { result: rebalance(accounts, { percents, cashOrder }), engineError: null }
    } catch (error) {
      return {
        result: null,
        engineError: error instanceof Error ? error.message : String(error),
      }
    }
  }, [accounts, percents, cashOrder])

  const stage: AtomStage = !isAtomOpen
    ? 'atom'
    : selectedAccountId === null
      ? 'accounts'
      : 'categories'

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? null
  const isPanelOpen = selectedAccount !== null && selectedClass !== null

  const tradeCount = result?.ok
    ? result.plans.reduce((sum, plan) => sum + plan.trades.length, 0)
    : null
  function finishTour() {
    markTourSeen(tourStorage())
    setTourStep(null)
  }

  /**
   * Each tour button does the real thing it describes. The steps that wait on
   * an action move on in the effect below, so tapping the lit sun or the lit
   * Trade list itself advances the tour exactly like the bubble's button.
   */
  function advanceTour(step: TourStep) {
    if (step === 'household') setIsAtomOpen(true)
    else if (step === 'trades') setDrawer('trades')
    else setTourStep(nextTourStep(step))
  }

  useEffect(() => {
    if (tourStep === 'household' && isAtomOpen) setTourStep('target')
    if (tourStep === 'trades' && drawer === 'trades') finishTour()
  }, [tourStep, isAtomOpen, drawer])

  function replayTour() {
    setIsAboutOpen(false)
    setDrawer(null)
    setSelectedClass(null)
    setSelectedAccountId(null)
    setIsAtomOpen(false)
    setTourStep('intro')
  }

  function stepBack() {
    if (tourStep !== null) finishTour()
    else if (isAboutOpen) setIsAboutOpen(false)
    else if (drawer !== null) setDrawer(null)
    else if (selectedClass !== null) setSelectedClass(null)
    else if (selectedAccountId !== null) setSelectedAccountId(null)
    else setIsAtomOpen(false)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') stepBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="stage">
      <AtomView
        accounts={accounts}
        householdTotal={household}
        stage={stage}
        selectedAccountId={selectedAccountId}
        selectedClass={selectedClass}
        isPanelOpen={isPanelOpen}
        onAtomToggle={() => {
          if (isAtomOpen) {
            setSelectedClass(null)
            setSelectedAccountId(null)
            setIsAtomOpen(false)
          } else {
            setIsAtomOpen(true)
          }
        }}
        onSelectAccount={(id) => {
          if (id === selectedAccountId) {
            setSelectedClass(null)
            setSelectedAccountId(null)
          } else {
            const account = accounts.find((a) => a.id === id)
            setSelectedClass(
              isPhone ? null : account === undefined ? ASSET_CLASSES[0] : firstHeldClass(account),
            )
            setSelectedAccountId(id)
          }
        }}
        onSelectClass={(assetClass) =>
          setSelectedClass(assetClass === selectedClass ? null : assetClass)
        }
      />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">
            Asset<span className="brand-thin">Pilot</span>
          </span>
          <button
            type="button"
            className="about-button"
            onClick={() => setIsAboutOpen(true)}
            aria-label="About AssetPilot"
            aria-expanded={isAboutOpen}
          >
            i
          </button>
        </div>
        <div className="topbar-actions">
          {isAtomOpen && (
            <>
              <button type="button" className="pill-button" onClick={() => setDrawer('cash')}>
                Cash order
              </button>
              <button type="button" className="pill-button" onClick={() => setDrawer('trades')} data-tour="trades">
                Trade list
                {tradeCount !== null && <span className="pill-badge">{tradeCount}</span>}
              </button>
            </>
          )}
        </div>
      </header>

      {engineError !== null && (
        <div className="engine-error" role="alert">
          <strong>Something went wrong:</strong> {engineError}
        </div>
      )}

      {isAtomOpen && (
        <>
          <GoalBar
            aiContext={{
              householdTotal: household,
              accounts: accounts.map((a) => ({ name: a.name, total: a.total })),
              currentAllocation: currentTotals,
              currentTargets: percents,
            }}
            onApplyPercents={(newPercents) => setPercentInputs(toInputs(newPercents))}
          />
          <TargetLegend
            percentInputs={percentInputs}
            onPercentsChange={setPercentInputs}
            percents={percents}
          />
        </>
      )}

      {isPanelOpen && selectedAccount !== null && selectedClass !== null && (
        <TransactionsPanel
          account={selectedAccount}
          assetClass={selectedClass}
          result={result}
          onClose={() => setSelectedClass(null)}
        />
      )}

      {/* The targets legend occupies the same bottom strip, so the footnote
          steps aside once the atom is open. */}
      <p className={`stage-footnote${isAtomOpen ? ' footnote-hidden' : ''}`}>
        Every number is computed by tested, deterministic code from the broker
        CSV — nothing is estimated.
      </p>

      {drawer === 'cash' && (
        <CashOrderDrawer
          accounts={accounts}
          cashOrder={cashOrder}
          onCashOrderChange={setCashOrder}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer === 'trades' && (
        <TradesDrawer result={result} onClose={() => setDrawer(null)} />
      )}
      {isAboutOpen && (
        <AboutPanel onClose={() => setIsAboutOpen(false)} onReplayTour={replayTour} />
      )}

      {tourStep !== null && (
        <Onboarding
          step={tourStep}
          householdTotal={household}
          accountCount={accounts.length}
          onPrimary={advanceTour}
          onSecondary={finishTour}
        />
      )}
    </div>
  )
}
