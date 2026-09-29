import { describe, expect, it } from 'vitest'
import { branchPath, spineLayout, trunkUpTo } from './spineLayout'

const PHONE_WIDTH = 390
const MARGIN = 16

describe('spineLayout', () => {
  it('keeps every account card to the right of the trunk, so no thread runs under a card', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: null, leafCount: 0 })

    for (const card of layout.cards) {
      expect(card.x).toBeGreaterThan(layout.trunk.x)
    }
  })

  it('stacks cards top to bottom without overlapping', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: null, leafCount: 0 })

    layout.cards.slice(1).forEach((card, i) => {
      const above = layout.cards[i]
      expect(card.y).toBeGreaterThanOrEqual(above.y + above.h)
    })
  })

  it('runs the trunk from below the atom to the last card', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: null, leafCount: 0 })
    const last = layout.cards[layout.cards.length - 1]

    expect(layout.trunk.fromY).toBeGreaterThan(layout.atom.y)
    expect(layout.trunk.toY).toBeLessThanOrEqual(last.y + last.h / 2)
    expect(layout.trunk.toY).toBeGreaterThan(last.y)
  })

  it('fits every card and leaf inside the side margins', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: 2, leafCount: 5 })

    for (const box of [...layout.cards, ...layout.leaves]) {
      expect(box.x).toBeGreaterThanOrEqual(MARGIN)
      expect(box.x + box.w).toBeLessThanOrEqual(PHONE_WIDTH - MARGIN)
    }
  })

  it('has no leaves and no sub-trunk when no account is selected', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: null, leafCount: 0 })

    expect(layout.leaves).toEqual([])
    expect(layout.subTrunk).toBeNull()
  })

  it('opens the leaves between the selected card and the next one, pushing later cards down', () => {
    const closed = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: null, leafCount: 0 })
    const open = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: 1, leafCount: 3 })
    const selected = open.cards[1]
    const next = open.cards[2]

    expect(open.leaves).toHaveLength(3)
    expect(open.leaves[0].y).toBeGreaterThanOrEqual(selected.y + selected.h)
    const lastLeaf = open.leaves[open.leaves.length - 1]
    expect(next.y).toBeGreaterThanOrEqual(lastLeaf.y + lastLeaf.h)
    expect(open.cards[0].y).toBe(closed.cards[0].y)
    expect(open.cards[2].y).toBeGreaterThan(closed.cards[2].y)
  })

  it('keeps every leaf to the right of its sub-trunk, and the sub-trunk right of the main trunk', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: 3, leafCount: 5 })
    const subTrunk = layout.subTrunk

    expect(subTrunk).not.toBeNull()
    if (subTrunk === null) return
    expect(subTrunk.x).toBeGreaterThan(layout.trunk.x)
    for (const leaf of layout.leaves) {
      expect(leaf.x).toBeGreaterThan(subTrunk.x)
    }
    const selected = layout.cards[3]
    expect(subTrunk.fromY).toBe(selected.y + selected.h)
    const lastLeaf = layout.leaves[layout.leaves.length - 1]
    expect(subTrunk.toY).toBeLessThanOrEqual(lastLeaf.y + lastLeaf.h / 2)
  })

  it('reports a height that contains everything plus bottom padding', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: 3, leafCount: 5 })
    const bottoms = [...layout.cards, ...layout.leaves].map((box) => box.y + box.h)

    expect(layout.height).toBeGreaterThan(Math.max(...bottoms))
  })

  it('stops the highlighted trunk exactly where the selected card\'s branch starts, not at the last card', () => {
    const layout = spineLayout({ width: PHONE_WIDTH, accountCount: 4, selectedIndex: 0, leafCount: 5 })
    const selected = layout.cards[0]

    const highlighted = trunkUpTo(layout.trunk, selected)

    expect(highlighted.x).toBe(layout.trunk.x)
    expect(highlighted.fromY).toBe(layout.trunk.fromY)
    expect(branchPath(layout.trunk.x, selected)).toContain(`M ${highlighted.x} ${highlighted.toY} `)
    expect(highlighted.toY).toBeLessThan(layout.trunk.toY)
  })
})
