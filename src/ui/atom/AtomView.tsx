import { useEffect, useRef, useState } from 'react'
import { classOf } from '../../engine/mapping'
import { ASSET_CLASSES, CLASS_LABELS } from '../../engine/types'
import type { Account, AssetClass } from '../../engine/types'
import { CLASS_COLORS, GOLD } from '../colors'
import { fmtUsd } from '../format'
import { SolarBackground } from './SolarBackground'
import { useMediaQuery } from '../useMediaQuery'
import { useDragScroll } from './useDragScroll'
import { useScrollRangeIntoView } from './useScrollRangeIntoView'
import { branchPath, spineLayout, trunkPath, trunkUpTo } from './spineLayout'
import type { Box, SpineLayout } from './spineLayout'

export type AtomStage = 'atom' | 'accounts' | 'categories'

interface AtomViewProps {
  accounts: readonly Account[]
  householdTotal: number
  stage: AtomStage
  selectedAccountId: string | null
  selectedClass: AssetClass | null
  /** Atom click: opens the household, or steps all the way back when open. */
  onAtomToggle: () => void
  onSelectAccount: (id: string) => void
  onSelectClass: (assetClass: AssetClass) => void
  /** True when the transactions panel is open — the fan shifts left to make room. */
  isPanelOpen: boolean
}

interface CategoryEntry {
  assetClass: AssetClass
  value: number
  count: number
}

const CARD_W = 250
const CARD_H = 78
const CARD_GAP = 16
const LEAF_W = 224
const LEAF_H = 58
const LEAF_GAP = 14
const ATOM_CORE_R = 36

function categoriesOf(account: Account): CategoryEntry[] {
  return ASSET_CLASSES.map((assetClass) => {
    const positions = account.positions.filter((p) => classOf(p.symbol) === assetClass)
    return {
      assetClass,
      value: positions.reduce((sum, p) => sum + p.value, 0),
      count: positions.length,
    }
  }).filter((entry) => entry.value >= 0.005)
}

/** Curved thread: eases out horizontally from the source, into the target. */
function threadPath(x1: number, y1: number, x2: number, y2: number): string {
  const pull = Math.max((x2 - x1) * 0.5, 40)
  return `M ${x1} ${y1} C ${x1 + pull} ${y1}, ${x2 - pull} ${y2}, ${x2} ${y2}`
}

/**
 * Sets the path both ways: the attribute for Safari, and the CSS `d` property
 * where supported so a spine thread glides with its card instead of jumping.
 */
function pathProps(d: string, extraStyle?: React.CSSProperties) {
  return { d, style: { ...extraStyle, d: `path("${d}")` } as React.CSSProperties }
}

/** Below this container width the drill-down becomes the phone spine. */
const NARROW_BREAKPOINT = 700
/**
 * The fan's x positions are fractions of the layout width while the cards keep
 * a fixed pixel width, so the columns close in on each other as the width drops
 * and eventually overlap. Below this the fan is laid out at this width anyway
 * and the canvas scrolls sideways, rather than being squeezed until the threads
 * double back on themselves. Derived from the widest column pair: the account
 * card ends at 31% + 250px and the leaves start at 56%, so 1160px leaves a ~40px
 * gap between them.
 */
const MIN_FAN_WIDTH = 1160
/** Where the leaf column starts, as a fraction of the layout width. */
const LEAF_COLUMN_FRACTION = 0.56
/** Detail panel width (480) + right margin (20) + breathing room (24). */
const PANEL_CLEARANCE = 480 + 20 + 24
/**
 * The detail panel is an overlay, so the width it covers is unusable. Below
 * this the fan scrolls instead, which beats the old approach of sliding the
 * leaves left to dodge the panel — that could slide them onto the account
 * cards, which is what made the threads double back.
 */
const MIN_FAN_WIDTH_WITH_PANEL = Math.ceil(
  (LEAF_W + PANEL_CLEARANCE) / (1 - LEAF_COLUMN_FRACTION),
)
/**
 * Matches the `max-width: 980px` rule in styles.css, below which the detail
 * panel becomes a full-width bottom sheet. Only the side-panel form takes
 * horizontal room, so only it needs clearing.
 */
const PANEL_BESIDE_QUERY = '(min-width: 981px)'

function useContainerSize(): [React.RefObject<HTMLDivElement>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setSize({ w: rect.width, h: rect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

export function AtomView({
  accounts,
  householdTotal,
  stage,
  selectedAccountId,
  selectedClass,
  onAtomToggle,
  onSelectAccount,
  onSelectClass,
  isPanelOpen,
}: AtomViewProps) {
  const [containerRef, { w, h }] = useContainerSize()
  const isOpen = stage !== 'atom'
  const isNarrow = w > 0 && w < NARROW_BREAKPOINT
  const midY = h * 0.48

  /* Only the open, horizontal fan needs the extra room — the closed atom and the
     phone spine both fit whatever they are given. */
  const isFan = isOpen && !isNarrow
  /* Only the side-panel form steals horizontal space; the bottom sheet does not. */
  const isPanelBeside = useMediaQuery(PANEL_BESIDE_QUERY)
  const isSidePanelOpen = isPanelOpen && isPanelBeside
  const minFanWidth = isSidePanelOpen ? MIN_FAN_WIDTH_WITH_PANEL : MIN_FAN_WIDTH
  const layoutW = isFan ? Math.max(w, minFanWidth) : w
  const isScrollable = layoutW > w
  useDragScroll(containerRef, isScrollable)

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null
  const categories = selectedAccount === null ? [] : categoriesOf(selectedAccount)
  const selectedIndex = accounts.findIndex((a) => a.id === selectedAccountId)

  const spine =
    isNarrow && isOpen
      ? spineLayout({
          width: w,
          accountCount: accounts.length,
          selectedIndex: stage === 'categories' && selectedIndex >= 0 ? selectedIndex : null,
          leafCount: stage === 'categories' ? categories.length : 0,
        })
      : null

  const atomX = spine !== null ? spine.atom.x : !isOpen || isNarrow ? layoutW * 0.5 : layoutW * 0.15
  const atomY = spine !== null ? spine.atom.y : isNarrow ? h * 0.42 : midY
  const atomScale = spine !== null ? spine.atom.scale : 1

  const cardX = layoutW * 0.31
  const cardsTop = midY - (accounts.length * CARD_H + (accounts.length - 1) * CARD_GAP) / 2
  const cardBox = (index: number): Box =>
    spine !== null
      ? spine.cards[index]
      : { x: cardX, y: cardsTop + index * (CARD_H + CARD_GAP), w: CARD_W, h: CARD_H }

  const wideLeafX = layoutW * LEAF_COLUMN_FRACTION
  const leavesTop = midY - (categories.length * LEAF_H + (categories.length - 1) * LEAF_GAP) / 2
  const leafBox = (index: number): Box =>
    spine !== null
      ? spine.leaves[index]
      : { x: wideLeafX, y: leavesTop + index * (LEAF_H + LEAF_GAP), w: LEAF_W, h: LEAF_H }

  /* Drilling down puts the new column off-screen once the canvas is panned, so
     follow the selection instead of leaving the user to go and find it. The
     leaves are the newly revealed level; before that it is the account cards. */
  const focusFrom = stage === 'categories' ? wideLeafX : cardX
  const focusTo = stage === 'categories' ? wideLeafX + LEAF_W : cardX + CARD_W
  useScrollRangeIntoView(containerRef, {
    from: focusFrom,
    to: focusTo,
    rightInset: isSidePanelOpen ? PANEL_CLEARANCE : 0,
    isEnabled: isScrollable,
  })

  const isReady = w > 0 && h > 0

  return (
    <div
      ref={containerRef}
      className={`atom-canvas stage-${stage} ${isScrollable ? 'is-scrollable' : ''}`}
      style={{ height: spine?.height }}
    >
      {isReady && (
        <svg className="atom-svg" width={layoutW} height={h} aria-hidden="true">
          <defs>
            <radialGradient id="atom-core-gold" cx="42%" cy="38%" r="70%">
              <stop offset="0%" stopColor="#FFF3D6" />
              <stop offset="45%" stopColor={GOLD} />
              <stop offset="100%" stopColor="#B8860B" />
            </radialGradient>
            <radialGradient id="atom-core-idle" cx="42%" cy="38%" r="70%">
              <stop offset="0%" stopColor="#FFE7D2" />
              <stop offset="45%" stopColor="#FFA37E" />
              <stop offset="100%" stopColor="#E85C38" />
            </radialGradient>
            <radialGradient id="atom-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={GOLD} stopOpacity="0.3" />
              <stop offset="70%" stopColor={GOLD} stopOpacity="0.06" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
            <filter id="atom-fuzz" x="-60%" y="-60%" width="220%" height="220%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" />
            </filter>
            <filter id="comet-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <SolarBackground width={layoutW} height={h} />

          {spine !== null ? (
            <SpineThreads
              spine={spine}
              accounts={accounts}
              categories={categories}
              selectedAccountId={selectedAccountId}
              selectedClass={selectedClass}
            />
          ) : (
            <>
              {/* Level 1 threads: atom → account cards */}
              {isOpen &&
                accounts.map((account, index) => {
                  const card = cardBox(index)
                  const d = threadPath(atomX + ATOM_CORE_R + 10, atomY, card.x, card.y + card.h / 2)
                  const isActive = account.id === selectedAccountId
                  return (
                    <Thread
                      key={account.id}
                      d={d}
                      index={index}
                      stroke={isActive ? GOLD : 'rgba(241, 237, 228, 0.28)'}
                      isActive={isActive}
                      glow={GOLD}
                    />
                  )
                })}

              {/* Level 2 threads: selected account card → category leaves */}
              {stage === 'categories' &&
                selectedIndex >= 0 &&
                categories.map((category, index) => {
                  const card = cardBox(selectedIndex)
                  const leaf = leafBox(index)
                  const d = threadPath(card.x + card.w, card.y + card.h / 2, leaf.x, leaf.y + leaf.h / 2)
                  const isActive = category.assetClass === selectedClass
                  return (
                    <Thread
                      key={`${selectedAccountId}-${category.assetClass}`}
                      d={d}
                      index={index}
                      stroke={isActive ? GOLD : 'rgba(242, 193, 78, 0.35)'}
                      isActive={isActive}
                      glow={CLASS_COLORS[category.assetClass]}
                    />
                  )
                })}
            </>
          )}

          {/* The household atom */}
          <g
            className="atom"
            style={{ transform: `translate(${atomX}px, ${atomY}px) scale(${atomScale})` }}
          >
            <circle r={ATOM_CORE_R * 3.2} fill="url(#atom-halo)" className="sun-breathe" />
            <circle
              r={ATOM_CORE_R + 15}
              fill="none"
              stroke={isOpen ? GOLD : '#FF9B7E'}
              strokeOpacity={0.6}
              strokeWidth={9}
              filter="url(#atom-fuzz)"
              className="atom-shell"
            />
            <circle
              r={ATOM_CORE_R + 22}
              fill="none"
              stroke={isOpen ? GOLD : '#FFD9C4'}
              strokeOpacity={0.3}
              strokeWidth={0.8}
              strokeDasharray="3 6"
              className="sun-ring-slow"
            />
            <circle
              r={ATOM_CORE_R}
              fill={isOpen ? 'url(#atom-core-gold)' : 'url(#atom-core-idle)'}
              data-tour="household"
            />
          </g>
        </svg>
      )}

      {/* Atom hit area + label (DOM, so it is a real button) */}
      {isReady && (
        <button
          type="button"
          className={`atom-button ${isOpen ? 'is-open' : ''} ${spine !== null ? 'is-beside' : ''}`}
          style={{ left: atomX, top: atomY }}
          onClick={onAtomToggle}
          aria-expanded={isOpen}
          aria-label={`Household assets, ${fmtUsd(householdTotal)}. ${isOpen ? 'Close the account view' : 'Open the four accounts'}`}
        >
          <span className="atom-title">Household assets</span>
          <span className="atom-value mono">{fmtUsd(householdTotal)}</span>
          {!isOpen && <span className="atom-chip">{accounts.length} accounts · tap to open</span>}
        </button>
      )}

      {/* Level 1: account cards */}
      {isReady &&
        isOpen &&
        accounts.map((account, index) => {
          const card = cardBox(index)
          const isActive = account.id === selectedAccountId
          return (
            <button
              key={account.id}
              type="button"
              className={`glass-card account-card ${isActive ? 'is-gold' : ''}`}
              style={
                {
                  left: card.x,
                  top: card.y,
                  width: card.w,
                  height: card.h,
                  '--i': index,
                } as React.CSSProperties
              }
              onClick={() => onSelectAccount(account.id)}
              aria-pressed={isActive}
            >
              <span className="card-value mono">{fmtUsd(account.total)}</span>
              <span className="card-label">{account.name}</span>
              <span className="card-count">
                {account.positions.length}{' '}
                {account.positions.length === 1 ? 'holding' : 'holdings'}
              </span>
            </button>
          )
        })}

      {/* Level 2: category leaves */}
      {isReady &&
        stage === 'categories' &&
        categories.map((category, index) => {
          const isActive = category.assetClass === selectedClass
          const leaf = leafBox(index)
          return (
            <button
              key={`${selectedAccountId}-${category.assetClass}`}
              type="button"
              className={`glass-card leaf-card ${isActive ? 'is-gold' : ''}`}
              style={
                {
                  left: leaf.x,
                  top: leaf.y,
                  width: leaf.w,
                  height: leaf.h,
                  '--i': index,
                } as React.CSSProperties
              }
              onClick={() => onSelectClass(category.assetClass)}
              aria-pressed={isActive}
            >
              <span
                className="leaf-dot"
                style={{ background: CLASS_COLORS[category.assetClass] }}
                aria-hidden="true"
              />
              <span className="leaf-text">
                <span className="card-label">{CLASS_LABELS[category.assetClass]}</span>
                <span className="card-count">
                  {category.count} {category.count === 1 ? 'holding' : 'holdings'}
                </span>
              </span>
              <span className="leaf-value mono">{fmtUsd(category.value)}</span>
            </button>
          )
        })}
    </div>
  )
}

interface ThreadProps {
  d: string
  index: number
  stroke: string
  isActive: boolean
  glow: string
  /** Spine threads animate their shape; the wide fan keeps plain attributes. */
  isGliding?: boolean
}

/** One thread plus the bright head that rides it while it draws. */
function Thread({ d, index, stroke, isActive, glow, isGliding = false }: ThreadProps) {
  const shape = isGliding ? pathProps(d) : { d }
  return (
    <g style={{ '--i': index } as React.CSSProperties}>
      <path
        {...shape}
        fill="none"
        stroke={stroke}
        strokeWidth={isActive ? 1.6 : 1}
        className={`thread thread-draw ${isGliding ? 'thread-glide' : ''}`}
      />
      <path
        {...shape}
        fill="none"
        stroke={glow}
        filter="url(#comet-glow)"
        className={`thread-glowhead ${isGliding ? 'thread-glide' : ''}`}
      />
    </g>
  )
}

interface SpineThreadsProps {
  spine: SpineLayout
  accounts: readonly Account[]
  categories: readonly CategoryEntry[]
  selectedAccountId: string | null
  selectedClass: AssetClass | null
}

const FAINT_LEVEL_1 = 'rgba(241, 237, 228, 0.28)'
const FAINT_LEVEL_2 = 'rgba(242, 193, 78, 0.35)'

/**
 * Phone threads: a trunk in the left gutter with a branch into each card. Like
 * the desktop fan, every thread is faint except the path to the selection,
 * which is drawn gold on top and stops at the selected card. The faint threads
 * stay mounted under the gold ones, so deselecting never replays their draw-in.
 */
function SpineThreads({ spine, accounts, categories, selectedAccountId, selectedClass }: SpineThreadsProps) {
  const selectedIndex = accounts.findIndex((a) => a.id === selectedAccountId)
  const selectedCard = selectedIndex >= 0 ? spine.cards[selectedIndex] : undefined
  const subTrunk = spine.subTrunk
  const leafIndex = categories.findIndex((c) => c.assetClass === selectedClass)
  const selectedLeaf = leafIndex >= 0 ? spine.leaves[leafIndex] : undefined
  return (
    <>
      <Thread d={trunkPath(spine.trunk)} index={0} stroke={FAINT_LEVEL_1} isActive={false} glow={GOLD} isGliding />
      {accounts.map((account, index) => (
        <Thread
          key={account.id}
          d={branchPath(spine.trunk.x, spine.cards[index])}
          index={index + 1}
          stroke={FAINT_LEVEL_1}
          isActive={false}
          glow={GOLD}
          isGliding
        />
      ))}
      {subTrunk !== null && (
        <Thread
          key={`${selectedAccountId}-trunk`}
          d={trunkPath(subTrunk)}
          index={0}
          stroke={FAINT_LEVEL_2}
          isActive={false}
          glow={GOLD}
          isGliding
        />
      )}
      {subTrunk !== null &&
        categories.map((category, index) => (
          <Thread
            key={`${selectedAccountId}-${category.assetClass}`}
            d={branchPath(subTrunk.x, spine.leaves[index])}
            index={index + 1}
            stroke={FAINT_LEVEL_2}
            isActive={false}
            glow={CLASS_COLORS[category.assetClass]}
            isGliding
          />
        ))}
      {selectedCard !== undefined && (
        <>
          <Thread
            key={`${selectedAccountId}-path`}
            d={trunkPath(trunkUpTo(spine.trunk, selectedCard))}
            index={0}
            stroke={GOLD}
            isActive
            glow={GOLD}
            isGliding
          />
          <Thread
            key={`${selectedAccountId}-active`}
            d={branchPath(spine.trunk.x, selectedCard)}
            index={1}
            stroke={GOLD}
            isActive
            glow={GOLD}
            isGliding
          />
        </>
      )}
      {subTrunk !== null && selectedLeaf !== undefined && (
        <>
          <Thread
            key={`${selectedAccountId}-${selectedClass}-path`}
            d={trunkPath(trunkUpTo(subTrunk, selectedLeaf))}
            index={0}
            stroke={GOLD}
            isActive
            glow={GOLD}
            isGliding
          />
          <Thread
            key={`${selectedAccountId}-${selectedClass}-active`}
            d={branchPath(subTrunk.x, selectedLeaf)}
            index={1}
            stroke={GOLD}
            isActive
            glow={CLASS_COLORS[categories[leafIndex].assetClass]}
            isGliding
          />
        </>
      )}
    </>
  )
}
