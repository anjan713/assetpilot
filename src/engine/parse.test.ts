import { describe, expect, test } from 'vitest'
import csvText from '../data/portfolio.csv?raw'
import { parseCsvRows, parseMoney, parsePortfolioCsv } from './parse'

describe('parseMoney', () => {
  test('strips dollar sign, commas, and trailing spaces', () => {
    expect(parseMoney('"$7,673.66 "'.slice(1, -1))).toBe(7673.66)
    expect(parseMoney('$91.51 ')).toBe(91.51)
  })

  test('parses parenthesised values as negative', () => {
    expect(parseMoney('($0.54)')).toBe(-0.54)
    expect(parseMoney('($10.07)')).toBe(-10.07)
  })

  test('returns null for -- and empty strings', () => {
    expect(parseMoney('--')).toBeNull()
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
    expect(parseMoney(undefined)).toBeNull()
  })

  test('throws on garbage input instead of guessing', () => {
    expect(() => parseMoney('N/A')).toThrow(/Cannot parse/)
  })
})

describe('parseCsvRows', () => {
  test('keeps commas inside quoted fields', () => {
    expect(parseCsvRows('a,"1,234.56",b')).toEqual([['a', '1,234.56', 'b']])
  })
})

describe('parsePortfolioCsv on the real file', () => {
  const { positions, downloadedAt } = parsePortfolioCsv(csvText)

  test('keeps exactly the 26 position rows, drops disclaimers and blanks', () => {
    expect(positions).toHaveLength(26)
  })

  test('extracts the download date footer', () => {
    expect(downloadedAt).toBe('Jun-1-2026 21:23 p.m ET')
  })

  test('cash rows (** symbols) become quantity = value at price $1.00', () => {
    const fzfxx = positions.find((p) => p.symbol === 'FZFXX')
    expect(fzfxx).toBeDefined()
    expect(fzfxx?.price).toBe(1)
    expect(fzfxx?.quantity).toBe(6645.97)
    expect(fzfxx?.value).toBe(6645.97)
    expect(positions.some((p) => p.symbol.includes('*'))).toBe(false)
  })

  test('regular rows keep fractional quantities and prices', () => {
    const vgkJoint = positions.find(
      (p) => p.symbol === 'VGK' && p.accountId === 'X483920176',
    )
    expect(vgkJoint?.quantity).toBe(117.581)
    expect(vgkJoint?.price).toBe(89.87)
    expect(vgkJoint?.value).toBe(10567.0)
  })

  test('account totals match the verified fixtures to the cent', () => {
    const totalOf = (accountId: string) =>
      positions
        .filter((p) => p.accountId === accountId)
        .reduce((sum, p) => sum + p.value, 0)
    expect(totalOf('X483920176')).toBeCloseTo(62364.09, 2)
    expect(totalOf('8043672915')).toBeCloseTo(375481.22, 2)
    expect(totalOf('2957816403')).toBeCloseTo(95291.95, 2)
    expect(totalOf('XQMTVRWK')).toBeCloseTo(0.21, 2)
  })
})
