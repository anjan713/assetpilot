# Household Portfolio Rebalancing Tool — Assessment Problem Statement

Someone manages their household's investments across multiple broker accounts and wants to keep their portfolio aligned to a chosen asset-allocation target — and to be able to change that target over time. Their broker only gives them a flat CSV export of raw positions (symbol-level holdings), not a view organized the way they actually think about their money.

**Data file:** `Portfolio_Positions_Jun-15-2026(in).csv` (in this folder)

## Your job is to close four gaps

### 1. The data isn't in a usable shape

The provided CSV is a flat, symbol-level export across multiple accounts. Turn it into something organized the way the user actually thinks about their money.

### 2. There's no concept of a target

The user thinks in terms of asset classes (US Equity, International, Gold, Cash, Treasuries, etc.) and target percentages, but the brokerage only shows individual ticker holdings. You'll need to design how tickers map to asset classes — the sample data does not come with this mapping; that design is part of the challenge.

### 3. Rebalancing math is tedious and error-prone by hand

Given a current allocation and a target allocation, figure out exactly which symbols to buy and sell — and how much — to reach the target.

### 4. Some accounts are more liquid than others

The user may prefer to hold more cash in certain accounts (e.g., maximize cash in a brokerage account rather than a retirement account) because that account is more accessible. Your solution should account for this preference.

## Constraints

- **Cash cannot move between accounts.** Each account must be rebalanced independently.
- **Each account is self-funded.** Buys and sells within an account must be funded and absorbed only by that account's own money-market/cash position.
- **The ticker → asset class mapping is not provided.** Designing it is part of the challenge.
- **Liquidity preference must be supported.** The user may prefer to hold more cash in more accessible accounts (e.g., brokerage over retirement).
- **The target allocation is editable.** The user must be able to change the target over time, not have it fixed.
- **It must be a working tool — not a script or notebook.**

## Design decision: symbol → asset class mapping

Five categories, exactly the ones named in the problem statement. Every assignment is
traceable to a word in the CSV's own Description column — no external knowledge used.

| Category | Symbols | Evidence (CSV Description column) |
|---|---|---|
| US Equity | FNILX, NUKZ, SHLD | "LARGE CAP INDEX FUND"; "NUCLEAR RENAISSANCE INDEX ETF"; "DEFENSE TECH ETF" — all stock funds, none labeled international |
| International | FZILX, VGK | "ZERO INTERNATIONAL INDEX"; "INTL EQUITY INDEX FDS FTSE EUROPE ETF" |
| Gold | IAU | "ISHARES GOLD TR" |
| Treasuries | BIL | "1-3 MONTH T-BILL ETF" (T-Bill = short-term US government loan) |
| Cash | SPAXX, FZFXX, FRGXX, FCASH | "HELD IN MONEY MARKET" (SPAXX, FZFXX); "HELD IN FCASH"; FRGXX: fixed $1.00 price with value = quantity, the signature of parked cash |

Notes:

- **NUKZ and SHLD** are the judgment call: their descriptions prove they are stock funds
  but name no country. Default: US Equity — in this file every international fund says so
  in its name; these don't. This is a stated assumption, not a certainty.
- **The mapping is FIXED, not user-editable.** The problem only asks us to *design* the
  mapping ("that design is part of the challenge"); it never asks for it to be editable.
  It lives in one clearly-marked constants table in the code, with this justification.
- **The TARGET is user-editable — explicitly required.** ("be able to change that target
  over time"; deliverable: "edit a target allocation"). Do not confuse the two:
  mapping = fixed by design; target percentages = live user input.
- Scope: one CSV, 11 known symbols, no future files. If scope ever grew to new files,
  the mapping would move from a constant to editable data with an "Unclassified"
  bucket for unknown symbols — noted as out of scope, not built.

## Design decision: cash location

The cash-location preference (Gap 4) is set to the **Joint WROS brokerage account**.

**Invariant this operates under:** every trade is a swap inside one account — a sell
turns a holding into cash, a buy turns cash into a holding. No money ever enters or
leaves an account, so **each account's total value never changes**:

- Joint WROS stays $62,364.09
- IRA (Alex) stays $375,481.22
- IRA (Jordan) stays $95,291.95
- Alex's old brokerage stays $0.21
- Household total stays $533,137.47

What the preference actually does:

- The household Cash target is satisfied by choosing, per account, how much of that
  account's OWN money sits as cash versus invested.
- The Joint account keeps as much of its own money in cash as the household cash
  target allows (by selling its own holdings and leaving the proceeds uninvested).
- The IRAs invest their own money as fully as possible, keeping only minimal
  leftover cash (e.g., rounding residue from whole-share trades).
- No dollars are ever transferred between accounts — the preference only shifts
  which account holds its money in cash FORM, not where money lives.
- **Ceiling:** the Joint account can never hold more cash than its own total value
  of $62,364.09 (11.6976% of the household). If the user sets a cash target above
  that, the overflow cash must sit in the next account in the preference order —
  the tool must handle this case explicitly.
- This is a setting, not hardcoded: the user can change the preferred account order.

**Correctness check derived from the invariant:** after computing any trade list,
each account's total before must equal its total after (per account: sell proceeds
+ starting cash = buy costs + ending cash). If not, the rebalancing math has a bug.

## Design decision: architecture

**Frontend-only single-page web app. No backend server of our own. Deployed on Vercel.**

- Stack: React + Vite. The CSV ships with the app and is parsed in the browser.
- Why no backend: the data is one fixed 26-row CSV — parsing takes under a
  millisecond, there is nothing to persist, and no multi-user concern. Keeping
  scope small is a deliberate choice, not a limitation.
- Deployment: Vercel. The AI API key lives in a Vercel environment variable
  (never hardcoded, never committed to the repository), and the key carries a
  small spending cap since it exists only for testing.
- Engine/UI separation: the parser, mapping, allocation math, and rebalance
  engine live in plain modules with unit tests, imported by the UI — core logic
  is testable and readable independent of React.

## Design decision: AI assist (OpenAI-API-compatible)

An AI chat/Q&A feature where the user can ask questions about their portfolio and
rebalance plan in plain English. Built on the **OpenAI-compatible API standard**
(the request format most AI providers accept), so models are swappable by changing
the base URL / model name — no code changes.

**Hard boundary between the two layers:**

- **Deterministic layer (code we write):** parses the CSV, maps symbols to
  categories, computes allocations, gaps, and the full trade list. ALL numbers
  come from this layer. Its output is exact, repeatable, and unit-tested.
- **AI layer (LLM):** only answers the user's questions, in plain language,
  using the deterministic layer's already-computed results as context. The LLM
  never reads the raw CSV, never computes a number, never changes any value,
  and has no ability to modify anything in the app.

Rationale: LLMs are good at explaining and bad at arithmetic reliability; money
math must be exact and testable. The AI is a narrator, not a calculator.

## Deliverable

Build a working tool where a user can:

- see their current allocation,
- edit a target allocation, and
- get back the exact set of transactions needed to reach it.
