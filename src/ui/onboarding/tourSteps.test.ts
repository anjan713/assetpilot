import { beforeEach, describe, expect, it } from 'vitest'
import { TOUR_ORDER, hasSeenTour, markTourSeen, nextTourStep, tourCopy } from './tourSteps'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

describe('tour order', () => {
  it('runs intro, household, target, trades, then ends', () => {
    expect(TOUR_ORDER).toEqual(['intro', 'household', 'target', 'trades'])
    expect(nextTourStep('intro')).toBe('household')
    expect(nextTourStep('household')).toBe('target')
    expect(nextTourStep('target')).toBe('trades')
    expect(nextTourStep('trades')).toBeNull()
  })
})

describe('tour copy', () => {
  it('states the real household total and account count in step 1', () => {
    const copy = tourCopy('household', { householdTotal: 533137.47, accountCount: 4 })

    expect(copy.body.join(' ')).toContain('$533k across four broker accounts.')
    expect(copy.primary).toBe('Open portfolio')
  })

  it('ends on the rule that money never moves between accounts', () => {
    const copy = tourCopy('trades', { householdTotal: 1, accountCount: 4 })

    expect(copy.body.join(' ')).toContain('Money never moves between accounts.')
    expect(copy.primary).toBe('View trades')
  })
})

describe('seen flag', () => {
  let storage: Storage
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('is unseen on a first visit and seen after marking', () => {
    expect(hasSeenTour(storage)).toBe(false)
    markTourSeen(storage)
    expect(hasSeenTour(storage)).toBe(true)
  })

  it('treats a storage that throws as already seen, so the tour never loops', () => {
    const broken = {
      ...storage,
      getItem: () => {
        throw new Error('blocked')
      },
    } as Storage

    expect(hasSeenTour(broken)).toBe(true)
  })
})
