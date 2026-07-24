# User Persona — The Hands-On Household Planner

## Summary

A two-person US household (Alex and Jordan) with roughly $533,000 spread across a joint
brokerage account and two individual retirement accounts (IRAs), all at one broker. They
self-manage a deliberate, low-cost, diversified investment strategy without a financial
advisor. They think in asset classes and target percentages — not individual symbols — and
currently work out rebalancing math by hand from a flat CSV export, which is tedious and
error-prone. They need a simple tool that turns "here's my data, here's my target" into
"here's exactly what to buy and sell in each account."

## Who they are

| Trait | Detail | Source |
|---|---|---|
| Household of two | Accounts named "IRA (Alex)", "IRA (Jordan)", plus a shared "Joint WROS" account | CSV account names |
| US-based | IRAs are US retirement accounts | CSV account types |
| Financially comfortable | ~$533k total across accounts ($375k IRA Alex, $95k IRA Jordan, $62k Joint) | CSV values |
| Long-term savers | Bulk of wealth sits in retirement accounts | CSV values |
| Self-directed (no advisor) | They download raw CSV exports and do the math themselves; they hold ultra-low-cost do-it-yourself index funds | CSV + problem statement ("tedious and error-prone by hand") |
| Strategy-driven | All accounts hold nearly the same funds in similar proportions — one household-wide recipe | CSV holdings |
| Thinks in categories, not symbols | "The user thinks in terms of asset classes (US Equity, International, Gold, Cash, Treasuries, etc.) and target percentages" | Problem statement (quoted) |
| Wants the target to be changeable | Given a current allocation and a target allocation, figure out exactly which symbols to buy and sell — and how much — to reach the target. | Problem statement (quoted) |

## What they are NOT

- **Not a programmer.** The assignment demands "a working tool — not a script or notebook."
  The interface must work for someone comfortable with a spreadsheet, not a terminal.
- **Not a finance professional.** They understand real concepts (asset classes, rebalancing)
  but the tool should use plain labels and clear numbers, not expert vocabulary.
- **Not a trader.** The portfolio is broad, diversified baskets held long-term. The request
  is about maintenance (staying aligned to a plan), not picking winners.

## Their core problem

1. The broker gives them a flat, symbol-level CSV — not organized the way they think.
2. There is no place to define asset-class targets.
3. Computing the exact buy/sell trades per account by hand is tedious and error-prone —
   especially since cash cannot move between accounts, so each account must be
   rebalanced independently using only its own cash.

## What success looks like for them

- Open the tool and immediately see: total value, and current allocation by asset class
  (household-wide and per account).
- Edit target percentages in one obvious place.
- Get back a clear, reviewable list of trades — account by account, symbol by symbol,
  buy/sell, quantity, and dollar amount — that reaches the target.
- Understand *why* each trade is suggested (which category was over or under target).
  The tool proposes; the human reviews and executes.

## Questions this user will ask the tool

These ten questions are the acceptance checklist — the tool succeeds if every one is
answerable on screen.

**When they open the tool ("show me where I stand"):**

1. How much do we have in total? And per account?
2. How is our money split across the five categories right now?
3. How far off are we from our target — which categories are over, which under,
   by how many dollars and percent?

**When they set a target ("let me express my wish"):**

4. Can I change the percentages and see the effect immediately?
5. Does my target add up to 100%? (Tool must stop them if not.)
6. What if I ask for more cash than the Joint account can hold — what happens?
   (The overflow case: tool must explain, not error out.)

**When they get the trade list ("tell me exactly what to do"):**

7. What exactly do I buy and sell — in which account, which fund, how many shares,
   how many dollars?
8. WHY is it telling me to sell this? (Show the reason: e.g., "International is
   $10,231.17 over target in this account." Trades without reasons won't be trusted.)
9. After these trades, how much reachable cash will sit in the Joint account?
10. Can I double-check nothing weird happened — does each account still total the
    same? (The invariant, shown as a "balanced ✓" line.)

Screen mapping: current allocation view answers Q1–3 · target editor answers Q4–6 ·
trade list with reasons answers Q7–10.

## Inferences vs. evidence (honesty note)

Everything sourced to "CSV" or "problem statement" above is directly observable.
The following are reasonable inferences, not stated facts: the two account holders are a
couple; their approximate age/career stage; that they designed the strategy themselves.
The problem statement does not state how often they rebalance, and only one CSV is
provided — the tool operates on this single file.