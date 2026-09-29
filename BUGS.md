# Bugs

Known defects in AssetPilot, newest first. Each entry says where it shows, what
went wrong, why, and how the fix was checked.

Status: **Open**, **Fixed (uncommitted)**, or **Fixed** with the commit.

---

## B008 · Phones replayed the thread animation when the sheet closed

- **Status**: Fixed (uncommitted)
- **Where**: Phones, closing the transactions sheet, or deselecting an account.
- **What happened**: The thread to the box you had selected drew itself in
  again, glowing head and all, as if it were new.
- **Why**: While a box was selected, its faint thread was removed and a gold
  one drawn instead. On close the faint thread was added back as a new element,
  so its draw-in animation started over.
- **Fix**: The faint threads now stay in place the whole time, and the gold
  path is laid over them. Closing just removes the gold layer. See
  `SpineThreads` in `src/ui/atom/AtomView.tsx`.
- **Checked**: Animations that start at the moment of closing, measured in a
  phone-sized browser. Before the fix, the thread's draw-in and glow were
  among them. After it, only the selected box's 0.3s gold-border fade runs,
  which desktop does too. The gold path still ends at the selected boxes.

## B007 · Phone sheet: scrolling inside it could scroll the page instead

- **Status**: Fixed (uncommitted)
- **Where**: Phones, the transactions bottom sheet.
- **What happened**: Once the sheet's list reached its top or bottom, the
  scroll carried on into the page behind it. iPhones chain scrolls this way by
  default.
- **Fix**: The sheet sets `overscroll-behavior: contain`, and the page behind is
  frozen while the sheet is open (see B006).
- **Checked**: A touch swipe inside the sheet scrolls the sheet 275px and the
  page 0px. Swiping down past the sheet's top leaves the page where it was.
  Chrome didn't show the leak before the fix, so this is only confirmed fixed
  there. A real iPhone check is still to do.

## B006 · Phone sheet: the page behind it scrolled

- **Status**: Fixed (uncommitted)
- **Where**: Phones, a swipe anywhere outside the open transactions sheet.
- **What happened**: The page underneath scrolled away while the sheet stayed
  on top.
- **Why**: On phones the whole page scrolls, and nothing stopped it while the
  sheet was open. There was no backdrop.
- **Fix**: A dimmed backdrop now sits behind the sheet, and tapping it closes
  the sheet. The page is pinned in place while the sheet is open, and returns
  to the same scroll spot on close. iPhones ignore the usual
  `overflow: hidden`, so the page is pinned instead. See `useBodyScrollLock` in
  `src/ui/sheetDrag.ts`.
- **Checked**: A swipe above the sheet used to scroll the page 303px. Now it
  scrolls 0px. Scrolled to 477px, opened a sheet, closed it, and the page was
  back at 477px. Desktop gets no backdrop and no lock.

## B005 · Phone sheet: dragging the grab strip didn't close it

- **Status**: Fixed (uncommitted)
- **Where**: Phones, the thin strip at the top of the transactions sheet.
- **What happened**: Dragging the strip down scrolled the page instead of
  closing the sheet. The strip was drawn on, with no drag handling behind it.
- **Fix**: The sheet's header (strip, title and top padding) is now a drag area.
  The sheet follows your finger and closes past a quarter of its height, or on
  a quick flick down. Otherwise it springs back. The ✕ button is left out of
  the drag area. Without that, the drag took over the tap and the ✕ stopped
  working, which came up while testing this fix. See `useSheetDrag` and
  `shouldDismissSheet` in `src/ui/sheetDrag.ts`.
- **Checked**: Unit tests cover the close rule: far drag, fast flick, slow
  nudge, upward drag, tap. In a phone-sized browser, a long drag closes the
  sheet, a short slow nudge doesn't, and the ✕ still closes it.

## B004 · iPhone Safari: phone threads snap instead of gliding

- **Status**: Open (cosmetic)
- **Where**: Phones, iOS Safari, when an account opens or closes.
- **What happens**: The cards slide to their new places, but the threads jump
  straight to their new shape.
- **Why**: The threads animate with the CSS `d` property. Chrome and Firefox
  support it. Safari does not, so it falls back to the plain `d` attribute.
- **Next step**: Only fix this if it looks wrong on a real iPhone. It has not
  been checked on a device yet.

## B003 · Phones highlighted every thread gold, not just the selection

- **Status**: Fixed (uncommitted)
- **Where**: Phones, after picking an account or an asset type.
- **What happened**: The whole left trunk turned gold as soon as any account was
  picked, and so did the whole sub-trunk under it. The asset-type branches
  took their category colours, so the colour changed where each one met its
  box. It was hard to see what was selected. Desktop only lights the path to
  the selection.
- **Fix**: Every phone thread is faint by default. A gold copy is drawn on top
  only from the atom to the selected account, and from there to the selected
  asset type, and it stops at the selected box. Asset-type branches use
  desktop's faint gold. See `SpineThreads` in `src/ui/atom/AtomView.tsx` and
  `trunkUpTo` in `src/ui/atom/spineLayout.ts`.
- **Checked**: A unit test asserts the gold trunk ends where the selected card's
  branch begins. In a phone-sized browser the gold ends at the centre of each
  selected box (y 223 and 433), and no thread is gold before a selection.

## B002 · Phones opened the transactions sheet as soon as an account was tapped

- **Status**: Fixed (uncommitted)
- **Where**: Phones, tapping an account card.
- **What happened**: Picking an account also picked its first asset type, so
  the transactions sheet slid up at once and covered the categories you had
  just opened.
- **Why**: `App.tsx` preselects the first held asset class. That suits the
  desktop side panel, but not a phone bottom sheet.
- **Fix**: On screens up to 699px wide, picking an account no longer preselects
  an asset class. The sheet opens only when you tap one. Desktop behaviour is
  unchanged.
- **Checked**: On iPhone SE, iPhone 14 and Pixel 7 sizes, no sheet appears after
  tapping an account. It appears after tapping US Equity and shows the planned
  trades (FNILX buy +$7,352.69).

## B001 · Phones hid the threads behind the account cards

- **Status**: Fixed (uncommitted)
- **Where**: Phones (screens under 700px wide), with the atom open.
- **What happened**: Each thread ran from the atom, centred above the list, to
  the top-centre of its card. The cards are full width and stacked, so every
  thread to a lower card passed behind the cards above it. You couldn't tell
  which line led where.
- **Fix**: A new phone layout, the "spine". A trunk runs down the left gutter
  and each card hangs off it on its own short branch. Asset types open under
  their account on a smaller trunk. The transactions open in the existing
  bottom sheet. The layout maths lives in `src/ui/atom/spineLayout.ts`, and the
  old phone fan code was removed from `AtomView.tsx`.
- **Checked**: Unit tests cover the layout: cards sit right of the trunk,
  nothing overlaps, everything fits the margins. In a browser, points were
  sampled along every thread to see if any fell inside a card. On the old code
  117 of 266 did. On the new code 0 did, on iPhone SE, iPhone 14 and Pixel 7
  sizes. Desktop is unchanged.
