# Data Model: Household Portfolio Rebalancing Tool

**Parent spec**: [spec.md](spec.md)

---

## Input contract

**File**: `Portfolio_Positions_Jun-15-2026(in).csv` — ships in the repo,
parsed in the browser. The only data source.

**Columns used** (all others ignored):

| Column | Meaning | Example raw value |
|---|---|---|
| Account Number | account ID | `X483920176` |
| Account Name | human name | `Joint WROS` |
| Symbol | fund code | `FNILX`, `SPAXX**` |
| Quantity | shares owned | `428.791` |
| Last Price | price per share | `$27.03 ` |
| Current Value | quantity × price | `"$11,590.22 "` |

## Parsing rules

1. Use a real CSV parser — quoted fields contain commas.
2. Drop any row with empty `Account Number` or `Current Value` (removes the
   blank row, two disclaimer rows, and the download-date row).
3. Money strings: strip `$`, `,`, whitespace; `(x)` = negative; `--` = null.
   `"$7,673.66 "` → `7673.66`.
4. Cash rows (symbols ending `**`) have empty Quantity/Price: set
   quantity = value, price = 1.00, strip the `**` suffix.
5. Precision: keep full precision internally; display dollars to 2 decimals,
   shares to 3, percentages to 2. Never round silently.

## Entities

### Position
One CSV row after parsing.

| Field | Type | Notes |
|---|---|---|
| accountId | string | from Account Number |
| accountName | string | from Account Name |
| symbol | string | `**` stripped |
| quantity | number | shares (fractional allowed) |
| price | number | dollars per share |
| value | number | dollars; equals quantity × price |

### Account
Derived: positions grouped by accountId.

| Field | Type | Notes |
|---|---|---|
| id, name | string | |
| positions | Position[] | |
| total | number | sum of position values — INVARIANT: never changed by trades |

### AssetClass
Enum: `US_EQUITY · INTERNATIONAL · GOLD · TREASURIES · CASH`.

### Target
| Field | Type | Notes |
|---|---|---|
| percents | Record<AssetClass, number> | must sum to exactly 100 |
| cashOrder | accountId[] | cash-location preference, default Joint → IRA (Alex) → IRA (Jordan) |

### Trade
| Field | Type | Notes |
|---|---|---|
| accountId | string | |
| action | `BUY` \| `SELL` | |
| symbol | string | |
| shares | number | 3 decimals |
| amount | number | dollars, 2 decimals |
| reason | string | "<Class> is $X over/under target in this account" |

## Fixed symbol → asset class mapping

Constant table in `engine/mapping.ts`. Evidence for each assignment is the
CSV's own Description column (full trail in
[research.md](research.md) and PROBLEM.md).

| AssetClass | Symbols |
|---|---|
| US_EQUITY | FNILX, NUKZ, SHLD |
| INTERNATIONAL | FZILX, VGK |
| GOLD | IAU |
| TREASURIES | BIL |
| CASH | SPAXX, FZFXX, FRGXX, FCASH |

Unknown symbol → hard error (guards against silent misclassification).

## Test fixtures (parser MUST reproduce exactly)

| Account | Total |
|---|---|
| Joint WROS (X483920176) | $62,364.09 |
| IRA (Alex) (8043672915) | $375,481.22 |
| IRA (Jordan) (2957816403) | $95,291.95 |
| Alex's old brokerage (XQMTVRWK) | $0.21 |
| **Household** | **$533,137.47** |

Per-class current allocation, Joint account (secondary fixture):

| Class | Current $ |
|---|---|
| US_EQUITY | $20,612.03 |
| INTERNATIONAL | $22,703.99 |
| GOLD | $4,728.44 |
| TREASURIES | $7,673.66 |
| CASH | $6,645.97 |