# Implementation Plan: Household Portfolio Rebalancing Tool

**Parent spec**: [spec.md](spec.md)

---

## Technical context

| Aspect | Choice |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite (SPA) |
| Backend | None — one Vercel serverless function for the AI proxy only |
| Storage | None — CSV bundled with the app, parsed in the browser |
| Charts | None — allocation bars are plain CSS divs |
| Styling | Hand-written CSS, design tokens as custom properties |
| Testing | Vitest (engine unit tests) |
| Deploy | Vercel (static build + `/api` function) |
| AI | OpenAI-compatible API via env vars (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`) |

## Architecture: two strict layers

**Deterministic engine (pure TS, no React, unit-tested).** All parsing,
mapping, allocation math, trade generation, invariant checking. Every number
shown in the UI comes from here.

**UI layer.** Renders engine output; forwards user edits (target percentages,
cash order) back into the engine. Holds no business logic.

**AI proxy (`api/chat.ts`).** Holds the key server-side; receives the user's
question + compact engine-computed context; forwards to the configured
OpenAI-compatible endpoint. The LLM never sees the raw CSV, never computes a
number, and cannot modify state.

## Project structure

```
src/
  engine/
    parse.ts          CSV text → Position[]      (data-model.md rules)
    mapping.ts        fixed symbol→class table
    allocate.ts       totals + current allocation
    rebalance.ts      target math, cash placement, trades, invariant
    *.test.ts         Vitest suites incl. fixtures
  ui/
    App.tsx           page assembly + state (target, cashOrder)
    Header.tsx        household + account totals
    Allocation.tsx    section 1: current vs target bars
    TargetEditor.tsx  section 2: five % inputs + cash order
    TradeList.tsx     section 3: per-account trade cards
    AiBox.tsx         optional Q&A
  styles.css
  data/portfolio.csv  the provided file, bundled
api/
  chat.ts             AI proxy (Vercel function)
specs/001-rebalancing-tool/   this spec
```

## Engine algorithm (FR-006)

Inputs: `Position[]`, `Target` (percents sum to 100, cashOrder).

**Step 0 — validate.** Percent sum must equal 100 exactly; else return a
validation error (UI blocks section 3).

**Step 1 — cash placement.**
`householdCashTarget = cash% × householdTotal`. Walk accounts in `cashOrder`:
each takes `min(remaining, accountTotal)` as its cash target; remainder
spills onward. The $0.21 account never trades; its cents count as placed cash.

**Step 2 — per-account class targets.**
`invested = accountTotal − cashTarget`. Split `invested` across the four
non-cash classes proportionally to their target ratios. Summed over accounts
this reproduces household class targets exactly (cash was removed exactly).

**Step 3 — gaps.** Per account, per class:
`gap = classTarget − classCurrent`. Positive → buy; negative → sell.

**Step 4 — trades.** Split a class gap across its symbols proportionally to
current values in that account; if the account holds none, buy the class's
first-listed symbol. `shares = amount ÷ price` (3 dp). Attach reason string.

**Step 5 — invariant (FR-008).** Per account, to the cent:
`sellProceeds + cashDecrease === buyCosts + cashIncrease` and
`totalAfter === totalBefore`. Failure → throw; UI shows error, never a wrong
trade list.

## UI layout (revised per user: no page scrolling, low fatigue)

Fixed full-viewport shell — the page itself never scrolls. A slim header
(title, data date, gold household total) and a numbered step nav sit on
top; exactly one panel shows at a time:

1. **Today** — dot-pair chart per class (colored dot = today, ring =
   target, chip = buy/sell gap $) + account-total chips.
2. **Set target** — five % inputs, live sum ✓/✗, cash-order list;
   every valid edit recomputes instantly (no submit).
3. **Trade list** — one account at a time via account sub-tabs (with trade
   counts); SELLs then BUYs with reasons; cash change, ending cash, and a
   money-in = money-out balance line. Overflow note when cash spills.
- **Ask** — the AI box, as its own panel.

Step badges surface state without opening a panel: target sum ✓/!, total
trade count. On very short screens a panel scrolls inside itself; the page
never does. Visual system: research.md D11/D12.

## Constitution check (simplicity gates)

- Two layers only (engine, UI) + one proxy function — no speculative layers.
- No database, no state management library (React state suffices), no chart
  or CSS framework.
- Every displayed value traces to a persona question; nothing else rendered.