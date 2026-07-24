# Feature Specification: Household Portfolio Rebalancing Tool

**Feature Branch**: `001-rebalancing-tool`
**Status**: Draft
**Companion docs**: [plan.md](plan.md) · [data-model.md](data-model.md) ·
[research.md](research.md) · [quickstart.md](quickstart.md) · [tasks.md](tasks.md)
**Source requirements**: [../../PROBLEM.md](../../PROBLEM.md) ·
[../../PERSONA.md](../../PERSONA.md)

---

## User Scenarios & Testing

### Primary user story

A household manages ~$533k of investments across a joint brokerage account and
two IRAs at one broker. The broker only provides a flat CSV of positions. The
user wants to (1) see their money organized by asset class, (2) set and edit a
target allocation in percentages, and (3) receive the exact buy/sell
transactions — per account — that reach the target, respecting that money can
never move between accounts and that cash should sit in the most accessible
account.

### Acceptance scenarios

1. **Given** the app is opened, **When** no interaction has happened,
   **Then** household total ($533,137.47), per-account totals, and current
   allocation by asset class are visible.
2. **Given** the target editor, **When** the user enters percentages summing
   to 100, **Then** the allocation comparison and trade list update
   immediately without a submit action.
3. **Given** percentages not summing to 100, **When** the user views the
   trade list, **Then** it is blocked with a message showing the actual sum.
4. **Given** a valid target, **When** the trade list renders, **Then** every
   trade shows account, action, symbol, shares, dollars, and a plain-English
   reason, and every account's footer proves sells + cash used = buys.
5. **Given** a cash target within the Joint account's capacity (≤ 11.6976%),
   **When** trades are computed, **Then** all household cash sits in the
   Joint account and both IRAs end fully invested.
6. **Given** a cash target above the Joint capacity, **When** trades are
   computed, **Then** overflow cash sits in the next account in the
   preference order and the UI states where cash ended up.
7. **Given** the AI box with a configured key, **When** the user asks a
   question about the plan, **Then** the answer uses only the computed
   results; with no key, the box explains it is unavailable and the rest of
   the app works fully.

### Edge cases

- Target percentage of 0% for a class → class fully sold everywhere.
- Cash target 0% → money markets fully invested in every account.
- The $0.21 account → never trades; its 21 cents count as placed cash.
- Cent-rounding residues → absorbed into account cash; shown if ≥ $0.01.
- Unknown symbol reaches the engine → hard error (impossible with the fixed
  file; guards against silent misclassification).

## Requirements

### Functional requirements

- **FR-001**: System MUST parse the bundled CSV
  (`Portfolio_Positions_Jun-15-2026(in).csv`) per the rules in
  [data-model.md](data-model.md) and reproduce the five fixture totals exactly.
- **FR-002**: System MUST group positions into the five fixed asset classes
  (US Equity, International, Gold, Treasuries, Cash) using the mapping in
  [data-model.md](data-model.md). The mapping is NOT user-editable.
- **FR-003**: System MUST display current allocation in dollars and percent:
  household level and per account.
- **FR-004**: User MUST be able to edit five target percentages; system MUST
  validate they sum to exactly 100 and block trade output otherwise.
- **FR-005**: User MUST be able to set the cash-location order of the three
  funded accounts; default Joint → IRA (Alex) → IRA (Jordan).
- **FR-006**: System MUST compute per-account trades per the algorithm in
  [plan.md](plan.md) §Engine, such that no money ever moves between accounts
  and each account's total value is unchanged by its trades.
- **FR-007**: Every trade MUST carry a reason string naming the class and its
  over/under amount in that account.
- **FR-008**: System MUST verify the per-account invariant (sell proceeds +
  cash decrease = buy costs + cash increase, to the cent) on every
  computation and refuse to display a trade list that fails it.
- **FR-009**: Shares MUST be reported to 3 decimals (fractional shares are
  supported — source data itself has fractional quantities); dollars to
  2 decimals; percentages to 2 decimals. No hidden rounding.
- **FR-010**: The AI box MUST answer only from engine-computed context, never
  receive the raw CSV, never compute or alter numbers, and MUST be fully
  optional (app works without a key).
- **FR-011**: The AI integration MUST use the OpenAI-compatible API format
  with provider/model swappable via environment variables only.
- **FR-012**: No secret may appear in the repository or the served bundle;
  the key lives in a Vercel environment variable read by a serverless proxy.

### Non-functional requirements

- **NFR-001**: Frontend-only SPA (plus one serverless AI proxy); no database.
- **NFR-002**: No chart library; allocation bars are plain CSS.
- **NFR-003**: Usable on mobile (single column), keyboard-accessible,
  respects `prefers-reduced-motion`.
- **NFR-004**: Engine unit-test coverage ≥ 80%; UI behavior covered by the
  acceptance scenarios above.

### Out of scope (deliberate)

| Excluded | Reason |
|---|---|
| CSV upload / multiple files | Assignment provides exactly one file |
| Editable symbol→class mapping | Assignment only asks us to *design* the mapping |
| Backend server / database | Nothing to persist; one static file |
| Gain/loss, cost basis, performance views | No requirement needs them |
| Trade execution | Tool proposes; human executes at the broker |

## Review & acceptance checklist

- [X] All 7 acceptance scenarios pass on the deployed URL
- [X] The 10 persona questions (PERSONA.md) are each answerable on screen
- [X] All engine tests green, including the invariant property test
- [X] No console errors; no secrets in repo or bundle
- [X] App fully usable with AI unconfigured