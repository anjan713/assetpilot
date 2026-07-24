import type { AssetClass } from '../engine/types'

/** One hue per asset class — threads, dots, and panel accents all derive from these. */
export const CLASS_COLORS: Record<AssetClass, string> = {
  US_EQUITY: '#FF7E5F',
  INTERNATIONAL: '#7D8CFF',
  GOLD: '#E9C46A',
  TREASURIES: '#86BFF2',
  CASH: '#C9CBDD',
}

/** Selection gold — the atom and the active card glow with this. */
export const GOLD = '#F2C14E'
