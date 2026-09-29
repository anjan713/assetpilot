export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

interface Size {
  w: number
  h: number
}

export type BubbleSide = 'right' | 'below' | 'above'

export interface BubblePlacement {
  left: number
  top: number
  side: BubbleSide
  /** Where the arrow sits along the bubble's edge, in px from its start. */
  arrow: number
}

const MARGIN = 16
const GAP = 18
/** Keeps the arrow off the bubble's rounded corners. */
const ARROW_INSET = 24

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/**
 * Picks where a tour bubble goes around the thing it points at: beside it when
 * the screen is wide enough, otherwise below, otherwise above. That one rule
 * gives the desktop layout (sun → right, bottom bar → above, corner → below)
 * and the phone layout (everything below, bottom bar → above).
 */
export function placeBubble(target: Rect, bubble: Size, viewport: Size): BubblePlacement {
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2
  const right = target.left + target.width

  if (right + GAP + bubble.w <= viewport.w - MARGIN) {
    const top = clamp(cy - bubble.h / 2, MARGIN, viewport.h - MARGIN - bubble.h)
    return {
      side: 'right',
      left: right + GAP,
      top,
      arrow: clamp(cy - top, ARROW_INSET, bubble.h - ARROW_INSET),
    }
  }

  const left = clamp(cx - bubble.w / 2, MARGIN, viewport.w - MARGIN - bubble.w)
  const arrow = clamp(cx - left, ARROW_INSET, bubble.w - ARROW_INSET)
  const spaceBelow = viewport.h - (target.top + target.height) - GAP - MARGIN
  const spaceAbove = target.top - GAP - MARGIN

  if (spaceBelow >= bubble.h || spaceBelow >= spaceAbove) {
    const top = clamp(target.top + target.height + GAP, MARGIN, viewport.h - MARGIN - bubble.h)
    return { side: 'below', left, top, arrow }
  }
  const top = clamp(target.top - GAP - bubble.h, MARGIN, viewport.h - MARGIN - bubble.h)
  return { side: 'above', left, top, arrow }
}
