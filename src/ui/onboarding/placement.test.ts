import { describe, expect, it } from 'vitest'
import { placeBubble } from './placement'

const PHONE = { w: 390, h: 844 }
const DESKTOP = { w: 1440, h: 900 }
const BUBBLE = { w: 360, h: 220 }

describe('placeBubble', () => {
  it('puts the bubble to the right of a centred target on a wide screen', () => {
    const sun = { left: 620, top: 332, width: 200, height: 200 }

    const placed = placeBubble(sun, BUBBLE, DESKTOP)

    expect(placed.side).toBe('right')
    expect(placed.left).toBeGreaterThanOrEqual(sun.left + sun.width)
  })

  it('drops below the target on a phone, where there is no room beside it', () => {
    const sun = { left: 131, top: 196, width: 128, height: 128 }

    const placed = placeBubble(sun, BUBBLE, PHONE)

    expect(placed.side).toBe('below')
    expect(placed.top).toBeGreaterThanOrEqual(sun.top + sun.height)
  })

  it('goes above a target that sits at the bottom of the screen', () => {
    const targets = { left: 206, top: 760, width: 1029, height: 126 }

    const placed = placeBubble(targets, BUBBLE, DESKTOP)

    expect(placed.side).toBe('above')
    expect(placed.top + BUBBLE.h).toBeLessThanOrEqual(targets.top)
  })

  it('keeps the bubble inside the screen for a target in the top-right corner', () => {
    const trades = { left: 1290, top: 8, width: 136, height: 50 }

    const placed = placeBubble(trades, BUBBLE, DESKTOP)

    expect(placed.side).toBe('below')
    expect(placed.left + BUBBLE.w).toBeLessThanOrEqual(DESKTOP.w - 16)
  })

  it('points the arrow at the target even when the bubble is pushed sideways', () => {
    const trades = { left: 1290, top: 8, width: 136, height: 50 }

    const placed = placeBubble(trades, BUBBLE, DESKTOP)

    expect(placed.left + placed.arrow).toBeCloseTo(trades.left + trades.width / 2, 0)
  })

  it('never lets the bubble spill off either edge of a narrow phone', () => {
    const wide = { left: 8, top: 300, width: 374, height: 100 }
    const phoneBubble = { w: PHONE.w - 32, h: 220 }

    const placed = placeBubble(wide, phoneBubble, PHONE)

    expect(placed.left).toBeGreaterThanOrEqual(16)
    expect(placed.left + phoneBubble.w).toBeLessThanOrEqual(PHONE.w - 16)
    expect(placed.top).toBeGreaterThanOrEqual(16)
    expect(placed.top + phoneBubble.h).toBeLessThanOrEqual(PHONE.h - 16)
  })
})
