import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Breathing room left between the focused range and the visible edge. */
const EDGE_PADDING_PX = 24

interface ScrollRangeOptions {
  /** Start of the x range, in the scroll container's own coordinates. */
  from: number
  /** End of that x range. */
  to: number
  /** Width of any overlay covering the right edge, e.g. the detail panel. */
  rightInset: number
  isEnabled: boolean
}

/**
 * Keeps a horizontal range visible in a scroll container.
 *
 * Drilling down reveals a new column that is often off-screen once the canvas
 * is being panned, so the view follows the selection rather than leaving the
 * user to go looking for what they just opened. When an overlay covers the
 * right edge, the range is brought clear of it instead of underneath it.
 */
export function useScrollRangeIntoView(
  ref: RefObject<HTMLElement>,
  { from, to, rightInset, isEnabled }: ScrollRangeOptions,
): void {
  useEffect(() => {
    const el = ref.current
    if (el === null || !isEnabled) return

    const currentLeft = el.scrollLeft
    const usableWidth = el.clientWidth - rightInset
    let nextLeft = currentLeft

    // Pull the right edge of the range into view, then the left edge — so a
    // range wider than the usable width still shows its start.
    if (to + EDGE_PADDING_PX > currentLeft + usableWidth) {
      nextLeft = to + EDGE_PADDING_PX - usableWidth
    }
    if (from - EDGE_PADDING_PX < nextLeft) {
      nextLeft = from - EDGE_PADDING_PX
    }

    const maxLeft = el.scrollWidth - el.clientWidth
    nextLeft = Math.max(0, Math.min(nextLeft, maxLeft))
    if (Math.abs(nextLeft - currentLeft) < 1) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    el.scrollTo({
      left: nextLeft,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [ref, from, to, rightInset, isEnabled])
}
