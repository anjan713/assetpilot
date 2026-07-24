import type { Position } from './types'

export interface ParsedFile {
  positions: readonly Position[]
  /** Raw text of the "Date downloaded …" footer row, if present. */
  downloadedAt: string | null
}

/**
 * Minimal RFC-4180 CSV reader: handles quoted fields containing commas
 * and doubled quotes; splits on \n or \r\n.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row = [...row, field]
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      rows.push([...row, field])
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) rows.push([...row, field])
  return rows
}

/**
 * Money string → number. `"$7,673.66 "` → 7673.66, `($0.54)` → −0.54,
 * `--` / empty → null. Throws on anything else unexpected.
 */
export function parseMoney(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '--') return null
  const isNegative = trimmed.startsWith('(') && trimmed.endsWith(')')
  const inner = isNegative ? trimmed.slice(1, -1) : trimmed
  const cleaned = inner.replace(/[$,\s]/g, '')
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Cannot parse money value: "${raw}"`)
  }
  const value = Number(cleaned)
  return isNegative ? -value : value
}

/**
 * Percent string → number. `"-0.14%"` → −0.14, `--` / empty → null.
 */
export function parsePercent(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '--') return null
  const cleaned = trimmed.replace(/%$/, '')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Cannot parse percent value: "${raw}"`)
  }
  return Number(cleaned)
}

const REQUIRED_COLUMNS = [
  'Account Number',
  'Account Name',
  'Symbol',
  'Description',
  'Quantity',
  'Last Price',
  'Current Value',
] as const

/** Display-only columns — tolerated if absent so older exports still parse. */
const GAIN_DOLLAR_COLUMN = 'Total Gain/Loss Dollar'
const GAIN_PERCENT_COLUMN = 'Total Gain/Loss Percent'

const CASH_ROW_SUFFIX = '**'
const CASH_ROW_PRICE = 1.0

/**
 * Normalize a broker cash position into a synthetic $1-unit representation.
 *
 * Broker cash rows carry a `**` symbol suffix with blank price and quantity.
 * We represent the balance as `quantity` units priced at exactly $1.00, so the
 * rest of the engine can treat cash like any other holding. The unit values are
 * synthetic, but the dollar balance stays exactly what the broker reported
 * (price × quantity === value). Returns null for non-cash rows.
 */
function normalizeCashPosition(
  rawSymbol: string,
  value: number,
): { symbol: string; price: number; quantity: number } | null {
  if (!rawSymbol.endsWith(CASH_ROW_SUFFIX)) return null
  return {
    symbol: rawSymbol.slice(0, -CASH_ROW_SUFFIX.length),
    price: CASH_ROW_PRICE,
    quantity: value,
  }
}

/**
 * Parse the broker CSV export into positions.
 * Rules (data-model.md): drop rows with empty Account Number or Current
 * Value; `**` symbols are cash rows, normalized to $1 units (see
 * normalizeCashPosition).
 */
export function parsePortfolioCsv(text: string): ParsedFile {
  const rows = parseCsvRows(text)
  if (rows.length === 0) throw new Error('CSV file is empty')

  const header = rows[0].map((cell) => cell.trim())
  const columnIndex = Object.fromEntries(
    REQUIRED_COLUMNS.map((name) => [name, header.indexOf(name)]),
  ) as Record<(typeof REQUIRED_COLUMNS)[number], number>
  const missing = REQUIRED_COLUMNS.filter((name) => columnIndex[name] === -1)
  if (missing.length > 0) {
    throw new Error(`CSV is missing expected columns: ${missing.join(', ')}`)
  }
  const gainDollarIndex = header.indexOf(GAIN_DOLLAR_COLUMN)
  const gainPercentIndex = header.indexOf(GAIN_PERCENT_COLUMN)

  const dataRows = rows.slice(1)
  const downloadedRow = dataRows.find((cells) =>
    (cells[0] ?? '').trim().startsWith('Date downloaded'),
  )
  const downloadedAt = downloadedRow
    ? downloadedRow[0].trim().replace(/^Date downloaded\s*/, '')
    : null

  const positions = dataRows
    .filter((cells) => {
      const accountId = (cells[columnIndex['Account Number']] ?? '').trim()
      const valueRaw = (cells[columnIndex['Current Value']] ?? '').trim()
      return accountId !== '' && valueRaw !== '' && valueRaw !== '--'
    })
    .map((cells): Position => {
      const accountId = cells[columnIndex['Account Number']].trim()
      const accountName = cells[columnIndex['Account Name']].trim()
      const rawSymbol = cells[columnIndex['Symbol']].trim()
      const description = cells[columnIndex['Description']].trim()
      const value = parseMoney(cells[columnIndex['Current Value']])
      if (value === null) {
        throw new Error(`Row for "${rawSymbol}" has an unreadable Current Value`)
      }

      const cash = normalizeCashPosition(rawSymbol, value)
      const symbol = cash?.symbol ?? rawSymbol
      const price = cash
        ? cash.price
        : parseMoney(cells[columnIndex['Last Price']])
      const quantityRaw = cells[columnIndex['Quantity']]?.trim() ?? ''
      const quantity = cash ? cash.quantity : Number(quantityRaw)

      if (price === null || !Number.isFinite(price) || price <= 0) {
        throw new Error(`Row for "${symbol}" has an unreadable Last Price`)
      }
      if (!Number.isFinite(quantity)) {
        throw new Error(`Row for "${symbol}" has an unreadable Quantity`)
      }

      const gainDollar =
        gainDollarIndex === -1 ? null : parseMoney(cells[gainDollarIndex])
      const gainPercent =
        gainPercentIndex === -1 ? null : parsePercent(cells[gainPercentIndex])
      return {
        accountId,
        accountName,
        symbol,
        description,
        quantity,
        price,
        value,
        ...(gainDollar !== null ? { gainDollar } : {}),
        ...(gainPercent !== null ? { gainPercent } : {}),
      }
    })

  if (positions.length === 0) throw new Error('CSV contains no position rows')
  return { positions, downloadedAt }
}
