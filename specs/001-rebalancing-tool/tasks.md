# Tasks: Household Portfolio Rebalancing Tool

**Parent spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Ordered by dependency. `[P]` = parallelizable with the previous task.
Engine tasks follow TDD: fixture/test first, implementation second.

---

## Phase 1 — Project setup

- [x] **T001** Scaffold Vite + React + TypeScript app; add Vitest; commit the
      CSV to `src/data/portfolio.csv`; empty `styles.css` with token stubs.
- [x] **T002** Vercel project config (`vercel.json` if needed, `/api` folder
      wired). Definition of done: `npm run dev` and `npm test` both run.
      _(No `vercel.json` needed — Vite build and `/api` are auto-detected.)_

## Phase 2 — Engine (deterministic layer)

- [x] **T003** Write parser tests from data-model.md fixtures: five account
      totals, junk-row dropping, money parsing (`$`, commas, `(x)`, `--`),
      `**` cash-row handling. Tests fail (no impl yet).
- [x] **T004** Implement `engine/parse.ts` until T003 is green.
- [x] **T005 [P]** Implement `engine/mapping.ts` (fixed table + hard error on
      unknown symbol) with tests.
- [x] **T006** Write allocation tests (household + per-account class totals;
      Joint fixture from data-model.md). Implement `engine/allocate.ts`.
- [x] **T007** Write rebalance tests for the reference target
      (40/20/10/20/10): cash placement (Joint $53,313.75 − $0.21 dust,
      IRAs $0), per-account class targets, gap math.
- [x] **T008** Rebalance tests for trades: proportional split within class,
      3-decimal shares, reason strings, SELL-before-BUY ordering.
- [x] **T009** Edge-case tests: sum ≠ 100 rejected · cash 20% overflow ·
      cash 0% · class at 0% · $0.21 account never trades · cent residues.
- [x] **T010** Implement `engine/rebalance.ts` until T007–T009 green.
- [x] **T011** Invariant property test: for a spread of random valid targets
      and cash orders, every account balances to the cent and no account
      total changes. Coverage check ≥ 80% on engine. _(60 random targets ×
      all 6 cash orders; engine coverage 93%.)_

## Phase 3 — UI

- [x] **T012** `Header.tsx`: household + account totals + data date, from
      the live engine.
- [x] **T013** `Allocation.tsx`: five class rows, paired CSS bars,
      current $ / % / target % / gap $.
- [x] **T014** `TargetEditor.tsx`: five % inputs, live sum ✓/✗ that blocks
      the trade list, cash-order control; edits recompute instantly.
- [x] **T015** `TradeList.tsx`: per-account cards, trade rows with reasons,
      balance footer, Joint ending-cash line, overflow notice.
- [x] **T016** Wire `App.tsx` state (target, cashOrder) through all sections.

## Phase 4 — AI assist

- [x] **T017** `api/chat.ts`: reads `AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`,
      forwards question + engine context in OpenAI-compatible format,
      returns answer; clean error on missing key.
- [x] **T018** `AiBox.tsx`: question input, loading/error/unconfigured
      states; context assembled from engine output only (never the CSV).

## Phase 5 — Polish & ship

- [x] **T019** Styling pass on the agreed visual direction (research.md
      D11: dark/minimal/sharp per user brief); a11y: labels, focus states,
      `prefers-reduced-motion`; mobile single-column.
- [x] **T020** Run the full quickstart.md checklist locally; fix findings.
      _(Sections 1–6 + 8 verified in-browser; AI checks (7) need a deploy.)_
- [ ] **T021** Deploy to Vercel, set env vars, re-run quickstart checklist
      on the deployed URL; verify no key/secret in bundle or repo.
      _(Local bundle scan clean; deployment itself pending — needs a git
      repo connected to Vercel.)_

## Dependency notes

- T003→T004, T007/T008/T009→T010 (tests precede implementation).
- Phase 3 needs T004–T010 green; T012–T015 can proceed in parallel once
  T016's state shape is agreed.
- T019 blocks on the visual-direction decision with the user.