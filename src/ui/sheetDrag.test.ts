import { describe, expect, it } from 'vitest'
import { shouldDismissSheet } from './sheetDrag'

const SHEET_HEIGHT = 600

describe('shouldDismissSheet', () => {
  it('closes when dragged down past a quarter of the sheet, however slowly', () => {
    expect(shouldDismissSheet({ distance: 160, durationMs: 2000, sheetHeight: SHEET_HEIGHT })).toBe(true)
  })

  it('stays open after a short, slow drag', () => {
    expect(shouldDismissSheet({ distance: 60, durationMs: 800, sheetHeight: SHEET_HEIGHT })).toBe(false)
  })

  it('closes on a short, fast downward flick', () => {
    expect(shouldDismissSheet({ distance: 60, durationMs: 80, sheetHeight: SHEET_HEIGHT })).toBe(true)
  })

  it('never closes on an upward drag, even a fast one', () => {
    expect(shouldDismissSheet({ distance: -200, durationMs: 50, sheetHeight: SHEET_HEIGHT })).toBe(false)
  })

  it('ignores a tap that barely moved', () => {
    expect(shouldDismissSheet({ distance: 4, durationMs: 10, sheetHeight: SHEET_HEIGHT })).toBe(false)
  })
})
