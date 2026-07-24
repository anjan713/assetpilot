import { describe, expect, test } from 'vitest'
import csvText from '../data/portfolio.csv?raw'
import { classOf, SYMBOL_CLASS } from './mapping'
import { parsePortfolioCsv } from './parse'

describe('fixed symbol → asset class mapping', () => {
  test('classifies every symbol per the design decision (research.md D2)', () => {
    expect(classOf('FNILX')).toBe('US_EQUITY')
    expect(classOf('NUKZ')).toBe('US_EQUITY')
    expect(classOf('SHLD')).toBe('US_EQUITY')
    expect(classOf('FZILX')).toBe('INTERNATIONAL')
    expect(classOf('VGK')).toBe('INTERNATIONAL')
    expect(classOf('IAU')).toBe('GOLD')
    expect(classOf('BIL')).toBe('TREASURIES')
    expect(classOf('SPAXX')).toBe('CASH')
    expect(classOf('FZFXX')).toBe('CASH')
    expect(classOf('FRGXX')).toBe('CASH')
    expect(classOf('FCASH')).toBe('CASH')
  })

  test('throws a hard error on unknown symbols — never a silent guess', () => {
    expect(() => classOf('TSLA')).toThrow(/Unknown symbol "TSLA"/)
  })

  test('covers every symbol that appears in the data file', () => {
    const { positions } = parsePortfolioCsv(csvText)
    const symbols = [...new Set(positions.map((p) => p.symbol))]
    symbols.forEach((symbol) => expect(SYMBOL_CLASS[symbol]).toBeDefined())
    expect(symbols).toHaveLength(11)
  })
})
