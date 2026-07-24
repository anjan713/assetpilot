# Research & Decisions: Household Portfolio Rebalancing Tool

**Parent spec**: [spec.md](spec.md)

Each decision: what was chosen, why, and what was rejected.

---

## D1 — Asset classes: the five named in the problem statement

- **Decision**: US Equity, International, Gold, Treasuries, Cash. Nothing invented.
- **Rationale**: The problem statement names exactly these as how the user
  thinks ("US Equity, International, Gold, Cash, Treasuries, etc.").
- **Rejected**: A separate "Thematic" class for NUKZ/SHLD — nothing in the
  problem supports it; adds a sixth number to the target editor for no
  requirement.

## D2 — Symbol classification: evidence from the CSV Description column only

- **Decision**: classify strictly by words in the file's own Description
  column; no external market knowledge.
- **Evidence trail**: FZILX "ZERO INTERNATIONAL INDEX"; VGK "INTL EQUITY …
  FTSE EUROPE ETF"; IAU "ISHARES GOLD TR"; BIL "1-3 MONTH T-BILL ETF";
  SPAXX/FZFXX "HELD IN MONEY MARKET"; FCASH "HELD IN FCASH"; FRGXX fixed
  $1.00 price with value = quantity (parked-cash signature); FNILX "LARGE
  CAP INDEX FUND" (not labeled international); NUKZ "NUCLEAR RENAISSANCE
  INDEX ETF" and SHLD "DEFENSE TECH ETF" — stock funds, no country named.
- **Judgment call (stated, not hidden)**: NUKZ and SHLD default to US Equity
  because in this file every international fund says so in its name and
  these don't. This is an assumption, recorded as such.

## D3 — Mapping is a fixed constant, not user-editable

- **Decision**: one constants table in `engine/mapping.ts`.
- **Rationale**: the problem asks us to *design* the mapping, not to make it
  editable ("that design is part of the challenge"). Scope is one CSV with
  11 known symbols. Unknown symbol → hard error, never a silent guess.
- **Rejected**: mapping-editor UI + "Unclassified" bucket — gold-plating for
  a requirement that doesn't exist; noted as the natural extension if scope
  ever grew to new files.

## D4 — Target percentages are live user input (required)

- **Decision**: five editable inputs + must-sum-to-100 validation.
- **Rationale**: explicitly required — "be able to change that target over
  time"; deliverable: "edit a target allocation."

## D5 — Rebalancing is computed per account, self-funded

- **Decision**: all gap math runs inside each account; buys funded only by
  that account's sells and its own cash.
- **Rationale**: hard constraint — "Cash cannot move between accounts, so
  each account must be rebalanced independently, funded and absorbed only by
  its own money-market/cash position."
- **Consequence (invariant)**: no trade ever changes an account's total:
  Joint $62,364.09 · IRA (Alex) $375,481.22 · IRA (Jordan) $95,291.95 ·
  old brokerage $0.21. Enforced in code on every run (FR-008).

## D6 — Cash location: preference order, Joint first

- **Decision**: household cash target is placed by walking a user-orderable
  account list (default Joint first), capped by each account's own total;
  overflow spills onward. IRAs end fully invested when cash fits in Joint.
- **Rationale**: Gap 4 — "maximize cash in a brokerage account rather than a
  retirement account) because that account is more accessible"; the Joint
  WROS is the only funded brokerage account in the data.
- **Boundary**: Joint capacity is $62,364.09 = 11.6976% of household; above
  that the overflow case must be handled and explained in the UI.

## D7 — Frontend-only architecture

- **Decision**: React + Vite SPA, CSV bundled and parsed in the browser; no
  backend, no database. Deployed on Vercel.
- **Rationale**: one fixed 26-row file, nothing to persist, single user.
  Parsing cost is sub-millisecond — "loading time" is not a real concern.
- **Rejected**: FastAPI/Node backend + OpenAPI docs — adds moving parts with
  zero user-visible benefit at this scope.

## D8 — AI assist: narrator, not calculator

- **Decision**: optional Q&A over engine-computed results, via the
  OpenAI-compatible API format so providers/models swap by env var
  (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`). One Vercel serverless function
  holds the key; the browser never sees it; the key carries a provider-side
  spending cap. The LLM never receives the raw CSV and computes nothing.
- **Rationale**: money math must be exact, repeatable, testable — LLMs are
  unreliable at arithmetic; deterministic code does 100% of calculations.
  Key-in-bundle was rejected because client-side env vars are readable by
  any visitor.

## D9 — Display: numbers, CSS bars, and a table — no chart library

- **Decision**: totals as plain numbers; current-vs-target as paired
  horizontal CSS bars; trades as a table.
- **Rationale**: bars answer "how far off am I" at a glance; pies were
  rejected (humans compare slice angles poorly, and two pies force eye
  jumps); chart libraries rejected (hundreds of KB for five categories).

## D10 — Fractional shares supported

- **Decision**: trade quantities to 3 decimal places.
- **Rationale**: the source data itself holds fractional quantities
  (e.g., VGK 117.581 shares), proving the broker supports them; whole-share
  rounding would add residue-handling complexity for no requirement.

## D11 — Visual design: soft dark, app-like, dot-pair chart (user choice)

- **Decision** (picked by the user from presented options): dark app look —
  rounded cards (#1A1F27) on deep charcoal (#101318), Manrope type
  throughout with tabular figures, IBM Plex Mono only in trade tables,
  one warm accent (muted gold #E3B558 — household total, target %, primary
  button). Allocation graph is a **dot pair** per class on one shared
  scale: colored dot = today, white ring = target, a line between them
  shows the move; the buy/sell dollar gap sits beside it as a colored
  chip. Faint ticks every 10% make the track read as a scale.
- **Rationale**: user brief history — dark theme, simple, no learning
  curve; user explicitly chose "softer dark, app-like" + "dot pair" from
  three previewed graph options.
- **Rejected**: ledger/double-rule aesthetic (v1); flat sharp dark with
  segmented household strip + tick bars (v2 — user disliked the strip
  graph); paired labeled bars and no-graph big-number options (offered,
  not chosen).

## D12 — No-scroll shell: one step at a time (user brief)

- **Decision**: fixed 100dvh app shell, page scrolling removed. Numbered
  step tabs — 1 Today · 2 Set target · 3 Trade list — plus Ask; one panel
  visible at a time. Trade list shows one account at a time via sub-tabs
  with trade counts. Tab badges (sum ✓/!, trade count) carry state across
  panels. Fallback: on very short viewports a panel scrolls internally.
- **Rationale**: user brief — "remove scrolling … limit the fatigue, a lot
  of details are shown when the website is loaded". The numbering is a
  true sequence (see → decide → act), not decoration.
- **Rejected**: dashboard grid cramming all sections into one viewport
  (still shows everything at once — the fatigue the user named); internal
  scrolling of the full trade list (hides the balance footer).

## Open items

- None. Remaining work is deployment only (tasks.md T021).