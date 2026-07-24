import type { AssetClass } from './types'

/**
 * Fixed symbol → asset-class mapping (research.md D2/D3).
 * Every assignment is evidenced by the CSV's own Description column;
 * NUKZ/SHLD default to US Equity (stated judgment call, see PROBLEM.md).
 * Deliberately NOT user-editable — the problem asks us to design the
 * mapping, and this file covers all 11 symbols in the one data file.
 */
export const SYMBOL_CLASS: Readonly<Record<string, AssetClass>> = {
  FNILX: 'US_EQUITY', // "Acme ZERO LARGE CAP INDEX FUND"
  NUKZ: 'US_EQUITY', // "RANGE NUCLEAR RENAISSANCE INDEX ETF"
  SHLD: 'US_EQUITY', // "GLOBAL X FDS DEFENSE TECH ETF"
  FZILX: 'INTERNATIONAL', // "Acme ZERO INTERNATIONAL INDEX"
  VGK: 'INTERNATIONAL', // "VANGUARD INTL EQUITY INDEX FDS FTSE EUROPE ETF"
  IAU: 'GOLD', // "ISHARES GOLD TR"
  BIL: 'TREASURIES', // "1-3 MONTH T-BILL ETF"
  SPAXX: 'CASH', // "HELD IN MONEY MARKET"
  FZFXX: 'CASH', // "HELD IN MONEY MARKET"
  FRGXX: 'CASH', // "FIMM GOVERNMENT PORTFOLIO" — $1.00 fixed price, value = quantity
  FCASH: 'CASH', // "HELD IN FCASH"
}

/** Preferred symbol to BUY when an account holds nothing in a class yet. */
export const DEFAULT_BUY_SYMBOL: Readonly<Record<Exclude<AssetClass, 'CASH'>, string>> = {
  US_EQUITY: 'FNILX',
  INTERNATIONAL: 'FZILX',
  GOLD: 'IAU',
  TREASURIES: 'BIL',
}

/** Classify a symbol; unknown symbols are a hard error, never a guess. */
export function classOf(symbol: string): AssetClass {
  const assetClass = SYMBOL_CLASS[symbol]
  if (assetClass === undefined) {
    throw new Error(
      `Unknown symbol "${symbol}" — it is not in the fixed mapping table. ` +
        'Add it to src/engine/mapping.ts with evidence before rebalancing.',
    )
  }
  return assetClass
}
