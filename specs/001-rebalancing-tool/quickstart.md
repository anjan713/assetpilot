# Quickstart & Validation: Household Portfolio Rebalancing Tool

**Parent spec**: [spec.md](spec.md)

How to run the app and manually verify every requirement in minutes.

---

## Run locally

```bash
npm install
npm test        # engine suites must be green
npm run dev     # open the printed localhost URL
```

Deploy: push to the connected repo — Vercel builds the SPA and the
`api/chat.ts` function. Set env vars `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
in Vercel project settings (optional — app must work without them).

## Validation walkthrough

### 1. On load (no interaction)

- [x] Household total reads **$533,137.47**
- [x] Account totals read Joint **$62,364.09** · IRA (Alex) **$375,481.22** ·
      IRA (Jordan) **$95,291.95** · old brokerage **$0.21**
- [x] Five class rows show current $ and % (Joint-level spot check:
      US Equity $20,612.03 · International $22,703.99 · Gold $4,728.44 ·
      Treasuries $7,673.66 · Cash $6,645.97)

### 2. The reference target (worked example)

Enter: US Equity 40 · International 20 · Gold 10 · Treasuries 20 · Cash 10.

- [x] Sum shows 100 ✓ and the trade list appears with no submit button
- [x] With default cash order, Joint holds the household cash
      (**$53,313.75** minus the old account's $0.21); both IRAs end with
      $0 cash
- [x] Every account card ends with a balance line that reconciles to the cent
- [x] Each account's total is unchanged by its trades

### 3. Validation blocking

- [x] Change Gold to 15 (sum 105): trade list is replaced by a message
      showing the actual sum; sections 1–2 still work

### 4. Cash overflow case

- [x] Set Cash to 20% (household cash $106,627.49 > Joint capacity
      $62,364.09): Joint becomes 100% cash and the UI states the overflow
      landed in the next account in the order

### 5. Extremes

- [x] Cash 0%: every money-market position is fully spent; all accounts
      fully invested; still balanced
- [x] Any class at 0%: that class fully sold in every account

### 6. Trade rows

- [x] Each row: action, symbol, shares (3 dp), price, dollars (2 dp), and a
      reason naming the class and its over/under amount in that account
- [x] SELLs listed before BUYs within each account

### 7. AI box

- [x] With env vars set: ask "why am I selling international?" — the answer
      reflects the computed gap, no invented numbers
- [x] Without env vars: box explains it's unavailable; everything else works
- [x] Browser dev tools: no API key visible in any bundle or network request
      from the browser (only `/api/chat` calls)

### 8. Quality floor

- [x] Keyboard: all inputs and the cash-order control reachable and operable
- [x] Mobile width: single column, nothing clipped
- [x] No console errors

## Acceptance tie-back

Section 1 answers persona Q1–Q3 · section 2 answers Q4–Q6 · section 3 answers
Q7–Q10 (see PERSONA.md). All 7 acceptance scenarios in spec.md map to the
checks above.