/**
 * Plain-English display names for the funds in the broker CSV. Display only —
 * the engine always works with symbols. Names are hand-written (one per
 * ticker, not from the CSV); anything unknown falls back to the tidied CSV
 * Description text.
 */

/** What the fund actually holds, in plain words. */
export const FUND_PLAIN_NAMES: Record<string, string> = {
  BIL: 'Short-term US government bills',
  FCASH: 'Cash waiting in the account',
  FNILX: 'Big US companies index fund',
  FRGXX: 'Cash held in a government money fund',
  FZFXX: 'Cash held in a money market fund',
  FZILX: 'International companies index fund',
  IAU: 'Fund that holds physical gold',
  NUKZ: 'Nuclear energy companies fund',
  SHLD: 'Defense technology companies fund',
  SPAXX: 'Cash held in a money market fund',
  VGK: 'European companies index fund',
}

/** Words kept fully uppercase when tidying the broker's all-caps text. */
const KEEP_UPPERCASE = new Set(['ETF', 'SPDR', 'FTSE', 'FIMM', 'ZERO', 'US'])

/**
 * Auto-clean the CSV Description: drop ISIN/SEDOL reference tails and
 * title-case the broker's all-caps text, keeping known acronyms uppercase.
 */
export function tidyDescription(description: string): string {
  const withoutIds = description.replace(/\s*(ISIN|SEDOL)\s*#.*$/i, '')
  return withoutIds
    .toLowerCase()
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          const upper = part.toUpperCase()
          if (KEEP_UPPERCASE.has(upper)) return upper
          return part.charAt(0).toUpperCase() + part.slice(1)
        })
        .join('-'),
    )
    .join(' ')
}
