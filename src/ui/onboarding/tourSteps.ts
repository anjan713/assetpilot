export const TOUR_ORDER = ['intro', 'household', 'target', 'trades'] as const

export type TourStep = (typeof TOUR_ORDER)[number]

/** The page element each step lights up, marked in the DOM with `data-tour`. */
export type TourAnchor = Exclude<TourStep, 'intro'>

interface TourFacts {
  householdTotal: number
  accountCount: number
}

export interface TourCopy {
  title: string
  body: readonly string[]
  /** Quoted example shown as its own line. */
  example?: string
  after?: string
  primary: string
  /** Label for the quiet way out: skip early on, done at the end. */
  secondary: string
}

const STORAGE_KEY = 'assetpilot:tour'
const SEEN = 'done'
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export function nextTourStep(step: TourStep): TourStep | null {
  return TOUR_ORDER[TOUR_ORDER.indexOf(step) + 1] ?? null
}

function roundedThousands(value: number): string {
  return `$${Math.round(value / 1000).toLocaleString('en-US')}k`
}

export function tourCopy(step: TourStep, facts: TourFacts): TourCopy {
  switch (step) {
    case 'intro':
      return {
        title: 'Four accounts. One household portfolio.',
        body: ['Set the mix you want, and AssetPilot shows the exact buys and sells to get there.'],
        primary: 'Show me how',
        secondary: 'Skip',
      }
    case 'household': {
      const count = NUMBER_WORDS[facts.accountCount] ?? String(facts.accountCount)
      return {
        title: 'Your portfolio, in one place',
        body: [
          'This sun represents your entire household portfolio.',
          `${roundedThousands(facts.householdTotal)} across ${count} broker accounts.`,
          'Tap it to see where the money lives.',
        ],
        primary: 'Open portfolio',
        secondary: 'Skip tour',
      }
    }
    case 'target':
      return {
        title: 'Choose where you want to go',
        body: [
          'Set the percentage you want in US stocks, international stocks, gold, treasuries, and cash.',
          'Or describe a goal like:',
        ],
        example: '“Keep $300k in cash.”',
        after: 'AssetPilot turns that into a target for you.',
        primary: 'Set my target',
        secondary: 'Skip tour',
      }
    case 'trades':
      return {
        title: 'See exactly what to change',
        body: [
          'AssetPilot calculates the buys and sells needed to move each account toward your target.',
          'Money never moves between accounts. Every trade is funded inside the account where it happens.',
        ],
        primary: 'View trades',
        secondary: 'Done',
      }
  }
}

/**
 * Storage that throws (private mode, blocked site data) counts as seen, so a
 * visitor is never shown the tour on every single load.
 */
export function hasSeenTour(storage: Storage | null): boolean {
  if (storage === null) return true
  try {
    return storage.getItem(STORAGE_KEY) === SEEN
  } catch {
    return true
  }
}

export function markTourSeen(storage: Storage | null): void {
  if (storage === null) return
  try {
    storage.setItem(STORAGE_KEY, SEEN)
  } catch {
    /* Nothing to remember it in; the tour simply shows again next visit. */
  }
}

/** Even reading `window.localStorage` can throw when site data is blocked. */
export function tourStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
