/** Display formatting only — the engine always keeps full precision. */

export function fmtUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function fmtSignedUsd(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${fmtUsd(Math.abs(value))}`
}

export function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`
}

export function fmtShares(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}
