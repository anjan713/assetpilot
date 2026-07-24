import { useEffect, useRef, useState } from 'react'
import { classOf } from '../../engine/mapping'
import { ASSET_CLASSES, CLASS_LABELS } from '../../engine/types'
import type { Account, AssetClass } from '../../engine/types'
import { CLASS_COLORS, GOLD } from '../colors'
import { fmtUsd } from '../format'
import { SolarBackground } from './SolarBackground'

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

/** Vertical variant for narrow screens; `bow` arcs the curve sideways. */
function threadPathV(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow: number,
): string {
  const pull = Math.max((y2 - y1) * 0.45, 30)
  return `M ${x1} ${y1} C ${x1 + bow} ${y1 + pull}, ${x2 + bow} ${y2 - pull}, ${x2} ${y2}`
}

/** Below this container width the drill-down flows top-to-bottom instead. */
const NARROW_BREAKPOINT = 700
const NARROW_MARGIN = 16
const NARROW_CARD_GAP = 12
const NARROW_ATOM_TOP = 96
/** Vertical space between the atom's center and the first card. */
const NARROW_FAN_OFFSET = 132

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

  const atomX = isNarrow || !isOpen ? w * 0.5 : w * 0.15
  const atomY = isNarrow && isOpen ? NARROW_ATOM_TOP : isNarrow ? h * 0.42 : midY

  const cardW = isNarrow ? w - NARROW_MARGIN * 2 : CARD_W
  const cardX = isNarrow ? NARROW_MARGIN : w * 0.31
  const narrowFanTop = atomY + NARROW_FAN_OFFSET
  const cardsTop = isNarrow
    ? narrowFanTop
    : midY - (accounts.length * CARD_H + (accounts.length - 1) * CARD_GAP) / 2
  const cardGap = isNarrow ? NARROW_CARD_GAP : CARD_GAP

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null
  const categories = selectedAccount === null ? [] : categoriesOf(selectedAccount)
  const selectedIndex = accounts.findIndex((a) => a.id === selectedAccountId)

  /* Narrow + categories: only the selected account stays, pinned as a breadcrumb. */
  const isBreadcrumbMode = isNarrow && stage === 'categories'
  const isAccountVisible = (id: string) => !isBreadcrumbMode || id === selectedAccountId
  const cardY = (index: number) =>
    isBreadcrumbMode ? cardsTop : cardsTop + index * (CARD_H + cardGap)

  /* Panel width (480) + right margin (20) + breathing room (24). */
  const PANEL_CLEARANCE = 480 + 20 + 24
  /* Narrow: categories sit two-up in a staggered grid instead of full-width rows. */
  const NARROW_LEAF_GAP = 12
  const NARROW_LEAF_STAGGER = 24
  const leafW = isNarrow
    ? (w - NARROW_MARGIN * 2 - NARROW_LEAF_GAP) / 2
    : LEAF_W
  const leafH = isNarrow ? 78 : LEAF_H
  const wideLeafX = isPanelOpen
    ? Math.min(w * 0.56, w - PANEL_CLEARANCE - LEAF_W)
    : w * 0.56
  const leavesTop = isNarrow
    ? narrowFanTop + CARD_H + 30
    : midY - (categories.length * LEAF_H + (categories.length - 1) * LEAF_GAP) / 2
  const leafPos = (index: number): { x: number; y: number } => {
    if (!isNarrow) {
      return { x: wideLeafX, y: leavesTop + index * (LEAF_H + LEAF_GAP) }
    }
    const column = index % 2
    const row = Math.floor(index / 2)
    return {
      x: NARROW_MARGIN + column * (leafW + NARROW_LEAF_GAP),
      y:
        leavesTop +
        row * (leafH + 18) +
        (column === 1 ? NARROW_LEAF_STAGGER : 0),
    }
  }

  const isReady = w > 0 && h > 0

  return (
    <div ref={containerRef} className={`atom-canvas stage-${stage}`}>
      {isReady && (
        <svg className="atom-svg" width={w} height={h} aria-hidden="true">
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

          <SolarBackground width={w} height={h} />

          {/* Level 1 threads: atom → account cards */}
          {isOpen &&
            accounts.map((account, index) => {
              if (!isAccountVisible(account.id)) return null
              const d = isNarrow
                ? threadPathV(
                    atomX,
                    atomY + ATOM_CORE_R + 12,
                    cardX + cardW / 2,
                    cardY(index),
                    -(28 + index * 12),
                  )
                : threadPath(
                    atomX + ATOM_CORE_R + 10,
                    atomY,
                    cardX,
                    cardY(index) + CARD_H / 2,
                  )
              const isActive = account.id === selectedAccountId
              return (
                <g key={account.id} style={{ '--i': index } as React.CSSProperties}>
                  <path
                    d={d}
                    fill="none"
                    stroke={isActive ? GOLD : 'rgba(241, 237, 228, 0.28)'}
                    strokeWidth={isActive ? 1.6 : 1}
                    className="thread thread-draw"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={GOLD}
                    filter="url(#comet-glow)"
                    className="thread-glowhead"
                  />
                </g>
              )
            })}

          {/* Level 2 threads: selected account card → category leaves */}
          {stage === 'categories' &&
            selectedIndex >= 0 &&
            categories.map((category, index) => {
              const pos = leafPos(index)
              const d = isNarrow
                ? threadPathV(
                    cardX + cardW / 2,
                    cardY(selectedIndex) + CARD_H,
                    pos.x + leafW / 2,
                    pos.y,
                    (index % 2 === 0 ? -1 : 1) * (22 + index * 6),
                  )
                : threadPath(
                    cardX + CARD_W,
                    cardY(selectedIndex) + CARD_H / 2,
                    pos.x,
                    pos.y + LEAF_H / 2,
                  )
              const isActive = category.assetClass === selectedClass
              return (
                <g
                  key={`${selectedAccountId}-${category.assetClass}`}
                  style={{ '--i': index } as React.CSSProperties}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke={isActive ? GOLD : 'rgba(242, 193, 78, 0.35)'}
                    strokeWidth={isActive ? 1.6 : 1}
                    className="thread thread-draw"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={CLASS_COLORS[category.assetClass]}
                    filter="url(#comet-glow)"
                    className="thread-glowhead"
                  />
                </g>
              )
            })}

          {/* The household atom */}
          <g
            className="atom"
            style={{ transform: `translate(${atomX}px, ${atomY}px)` }}
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
            />
          </g>
        </svg>
      )}

      {/* Atom hit area + label (DOM, so it is a real button) */}
      {isReady && (
        <button
          type="button"
          className={`atom-button ${isOpen ? 'is-open' : ''}`}
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
          if (!isAccountVisible(account.id)) return null
          const isActive = account.id === selectedAccountId
          return (
            <button
              key={account.id}
              type="button"
              className={`glass-card account-card ${isActive ? 'is-gold' : ''}`}
              style={
                {
                  left: cardX,
                  top: cardY(index),
                  width: cardW,
                  height: CARD_H,
                  '--i': isBreadcrumbMode ? 0 : index,
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
          const pos = leafPos(index)
          return (
            <button
              key={`${selectedAccountId}-${category.assetClass}`}
              type="button"
              className={`glass-card leaf-card ${isNarrow ? 'leaf-narrow' : ''} ${isActive ? 'is-gold' : ''}`}
              style={
                {
                  left: pos.x,
                  top: pos.y,
                  width: leafW,
                  height: leafH,
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
