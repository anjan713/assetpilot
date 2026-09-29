import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { placeBubble } from './placement'
import type { BubblePlacement, Rect } from './placement'
import { TOUR_ORDER, tourCopy } from './tourSteps'
import type { TourAnchor, TourStep } from './tourSteps'

interface OnboardingProps {
  step: TourStep
  householdTotal: number
  accountCount: number
  onPrimary: (step: TourStep) => void
  onSecondary: () => void
}

const SPOT_PADDING = 8
/** The sun's glow and ring reach well past its core, so its spotlight is wider. */
const SUN_PADDING = 26
/** Lets a scroll or the atom's opening glide finish before the bubble lands. */
const SETTLE_MS = 650
const BUBBLE_MAX_WIDTH = 400
const VIEWPORT_MARGIN = 16

function anchorRect(anchor: TourAnchor): Rect | null {
  const elements = [...document.querySelectorAll(`[data-tour="${anchor}"]`)]
  const rects = elements.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0)
  if (rects.length === 0) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return { left, top, width: right - left, height: bottom - top }
}

function spotlightFor(anchor: TourAnchor, rect: Rect): Rect & { isRound: boolean } {
  if (anchor === 'household') {
    const size = Math.max(rect.width, rect.height) + SUN_PADDING * 2
    return {
      left: rect.left + rect.width / 2 - size / 2,
      top: rect.top + rect.height / 2 - size / 2,
      width: size,
      height: size,
      isRound: true,
    }
  }
  return {
    left: rect.left - SPOT_PADDING,
    top: rect.top - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
    isRound: false,
  }
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a !== null &&
  b !== null &&
  Math.round(a.left) === Math.round(b.left) &&
  Math.round(a.top) === Math.round(b.top) &&
  Math.round(a.width) === Math.round(b.width) &&
  Math.round(a.height) === Math.round(b.height)

/** Follows the anchor every frame: it moves while the atom opens and the page scrolls. */
function useAnchorRect(anchor: TourAnchor | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)
  useEffect(() => {
    if (anchor === null) return
    let frame = 0
    const tick = () => {
      const next = anchorRect(anchor)
      setRect((prev) => (sameRect(prev, next) ? prev : next))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [anchor])
  return rect
}

/**
 * Swallows taps everywhere except the lit area, so the thing the step points
 * at stays usable: the user can tap the real sun or the real Trade list.
 */
function TourBlocker({ hole }: { hole: Rect | null }) {
  if (hole === null) return <div className="tour-blocker" style={{ inset: 0 }} />
  const right = hole.left + hole.width
  const bottom = hole.top + hole.height
  return (
    <>
      <div className="tour-blocker" style={{ left: 0, right: 0, top: 0, height: Math.max(0, hole.top) }} />
      <div className="tour-blocker" style={{ left: 0, right: 0, top: bottom, bottom: 0 }} />
      <div className="tour-blocker" style={{ left: 0, width: Math.max(0, hole.left), top: hole.top, height: hole.height }} />
      <div className="tour-blocker" style={{ left: right, right: 0, top: hole.top, height: hole.height }} />
    </>
  )
}

export function Onboarding({ step, householdTotal, accountCount, onPrimary, onSecondary }: OnboardingProps) {
  const copy = tourCopy(step, { householdTotal, accountCount })
  const anchor = step === 'intro' ? null : step
  const rect = useAnchorRect(anchor)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const [isSettled, setIsSettled] = useState(false)
  const [placement, setPlacement] = useState<BubblePlacement | null>(null)

  useEffect(() => {
    setIsSettled(false)
    if (anchor !== null) {
      const first = document.querySelector(`[data-tour="${anchor}"]`)
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    const timer = window.setTimeout(() => setIsSettled(true), anchor === null ? 0 : SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [anchor])

  useEffect(() => {
    if (isSettled) primaryRef.current?.focus({ preventScroll: true })
  }, [isSettled, step])

  useLayoutEffect(() => {
    const bubble = bubbleRef.current
    if (bubble === null || rect === null) return
    const target = spotlightFor(anchor ?? 'household', rect)
    setPlacement(
      placeBubble(
        target,
        { w: bubble.offsetWidth, h: bubble.offsetHeight },
        { w: window.innerWidth, h: window.innerHeight },
      ),
    )
  }, [rect, anchor, step])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') onPrimary(step)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onPrimary, step])

  if (step === 'intro') {
    return (
      <div className="tour-intro" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className="tour-intro-card">
          <span className="tour-orb" aria-hidden="true" />
          <h2 className="tour-intro-name">AssetPilot</h2>
          <p id="tour-title" className="tour-intro-tag">{copy.title}</p>
          {copy.body.map((line) => (
            <p key={line} className="tour-intro-body">{line}</p>
          ))}
          <button ref={primaryRef} type="button" className="tour-primary tour-primary-wide" onClick={() => onPrimary(step)}>
            {copy.primary}
          </button>
          <button type="button" className="tour-secondary" onClick={onSecondary}>
            {copy.secondary}
          </button>
        </div>
      </div>
    )
  }

  const position = TOUR_ORDER.indexOf(step)
  const stepCount = TOUR_ORDER.length - 1
  const spot = rect === null ? null : spotlightFor(anchor ?? 'household', rect)
  const isVisible = isSettled && placement !== null && spot !== null

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <TourBlocker hole={spot} />
      {spot !== null && (
        <div
          className={`tour-spot ${spot.isRound ? 'is-round' : ''}`}
          style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }}
        />
      )}
      <div
        ref={bubbleRef}
        className={`tour-bubble side-${placement?.side ?? 'below'} ${isVisible ? 'is-visible' : ''}`}
        style={{
          left: placement?.left ?? 0,
          top: placement?.top ?? 0,
          width: Math.min(BUBBLE_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
          '--arrow': `${placement?.arrow ?? 0}px`,
        } as React.CSSProperties}
      >
        <span className="tour-arrow" aria-hidden="true" />
        <p className="tour-progress">
          <span>
            {position} of {stepCount}
          </span>
          {Array.from({ length: stepCount }, (_, i) => (
            <i key={i} className={i + 1 === position ? 'is-on' : i + 1 < position ? 'is-done' : ''} />
          ))}
        </p>
        <h2 id="tour-title" className="tour-title">{copy.title}</h2>
        {copy.body.map((line) => (
          <p key={line} className="tour-body">{line}</p>
        ))}
        {copy.example !== undefined && <p className="tour-example">{copy.example}</p>}
        {copy.after !== undefined && <p className="tour-body">{copy.after}</p>}
        <div className="tour-actions">
          <button type="button" className={`tour-secondary ${step === 'trades' ? 'is-outlined' : ''}`} onClick={onSecondary}>
            {copy.secondary}
          </button>
          <button ref={primaryRef} type="button" className="tour-primary" onClick={() => onPrimary(step)}>
            {copy.primary}
          </button>
        </div>
      </div>
    </div>
  )
}
