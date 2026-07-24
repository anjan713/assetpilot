import { describe, expect, test } from 'vitest'
import csvText from '../data/portfolio.csv?raw'
import { classTotals, groupAccounts, householdTotal } from './allocate'
import { parsePortfolioCsv } from './parse'

const { positions } = parsePortfolioCsv(csvText)
const accounts = groupAccounts(positions)

describe('groupAccounts', () => {
  test('finds the four accounts in file order with exact totals', () => {
    expect(accounts.map((a) => a.id)).toEqual([
      'X483920176',
      'XQMTVRWK',
      '8043672915',
      '2957816403',
    ])
    expect(accounts[0].total).toBeCloseTo(62364.09, 2)
    expect(accounts[1].total).toBeCloseTo(0.21, 2)
    expect(accounts[2].total).toBeCloseTo(375481.22, 2)
    expect(accounts[3].total).toBeCloseTo(95291.95, 2)
  })

  test('household total is $533,137.47', () => {
    expect(householdTotal(accounts)).toBeCloseTo(533137.47, 2)
  })
})

describe('classTotals', () => {
  test('Joint WROS per-class fixture (data-model.md)', () => {
    const joint = classTotals(accounts[0].positions)
    expect(joint.US_EQUITY).toBeCloseTo(20612.03, 2)
    expect(joint.INTERNATIONAL).toBeCloseTo(22703.99, 2)
    expect(joint.GOLD).toBeCloseTo(4728.44, 2)
    expect(joint.TREASURIES).toBeCloseTo(7673.66, 2)
    expect(joint.CASH).toBeCloseTo(6645.97, 2)
  })

  test('class totals add back up to the account total', () => {
    accounts.forEach((account) => {
      const totals = classTotals(account.positions)
      const sum = Object.values(totals).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(account.total, 6)
    })
  })
})
