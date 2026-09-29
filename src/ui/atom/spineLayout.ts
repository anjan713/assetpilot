/**
 * Phone layout for the drill-down: a trunk runs down the left gutter from the
 * atom and each card hangs off it on its own short branch. Every thread stays
 * in the gutter, so none can pass behind a card the way the old centred fan did.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Trunk {
  x: number
  fromY: number
  toY: number
}

export interface SpineLayout {
  atom: { x: number; y: number; scale: number }
  trunk: Trunk
  cards: Box[]
  leaves: Box[]
  subTrunk: Trunk | null
  height: number
}

interface SpineInput {
  width: number
  accountCount: number
  selectedIndex: number | null
  leafCount: number
}

const MARGIN = 16
export const SPINE_ATOM_SCALE = 0.6
const ATOM_X = MARGIN + 28
const ATOM_Y = 64
/** Clears the scaled atom's fuzzy shell before the trunk starts. */
const ATOM_CLEARANCE = 36
const CARD_INDENT = 28
const CARD_H = 78
const CARD_GAP = 12
const FIRST_CARD_GAP = 24
/** The sub-trunk drops from this far inside the selected card's left edge. */
const SUB_TRUNK_INSET = 16
const LEAF_INDENT = 32
const LEAF_H = 58
const LEAF_GAP = 8
const LEAVES_TOP_GAP = 10
const LEAVES_BOTTOM_GAP = 14
const BOTTOM_PADDING = 24
/** Radius of the curve where a trunk turns into a branch. */
export const SPINE_BEND = 10

export function spineLayout({ width, accountCount, selectedIndex, leafCount }: SpineInput): SpineLayout {
  const cardX = ATOM_X + CARD_INDENT
  const cardW = width - MARGIN - cardX
  const leafX = cardX + LEAF_INDENT
  const leafW = width - MARGIN - leafX

  const cards: Box[] = []
  const leaves: Box[] = []
  let y = ATOM_Y + ATOM_CLEARANCE + FIRST_CARD_GAP
  for (let i = 0; i < accountCount; i++) {
    cards.push({ x: cardX, y, w: cardW, h: CARD_H })
    y += CARD_H
    if (i === selectedIndex && leafCount > 0) {
      y += LEAVES_TOP_GAP
      for (let j = 0; j < leafCount; j++) {
        leaves.push({ x: leafX, y, w: leafW, h: LEAF_H })
        y += LEAF_H + (j < leafCount - 1 ? LEAF_GAP : 0)
      }
      y += LEAVES_BOTTOM_GAP
    } else {
      y += CARD_GAP
    }
  }

  const lastCard = cards[cards.length - 1]
  const trunk: Trunk = {
    x: ATOM_X,
    fromY: ATOM_Y + ATOM_CLEARANCE,
    toY: lastCard === undefined ? ATOM_Y + ATOM_CLEARANCE : lastCard.y + CARD_H / 2 - SPINE_BEND,
  }

  const selectedCard = selectedIndex === null ? undefined : cards[selectedIndex]
  const lastLeaf = leaves[leaves.length - 1]
  const subTrunk: Trunk | null =
    selectedCard === undefined || lastLeaf === undefined
      ? null
      : {
          x: cardX + SUB_TRUNK_INSET,
          fromY: selectedCard.y + CARD_H,
          toY: lastLeaf.y + LEAF_H / 2 - SPINE_BEND,
        }

  const contentBottom = Math.max(
    ATOM_Y + ATOM_CLEARANCE,
    ...[...cards, ...leaves].map((box) => box.y + box.h),
  )

  return {
    atom: { x: ATOM_X, y: ATOM_Y, scale: SPINE_ATOM_SCALE },
    trunk,
    cards,
    leaves,
    subTrunk,
    height: contentBottom + BOTTOM_PADDING,
  }
}

/** A trunk segment that curves out into a branch ending at a card's left edge. */
export function branchPath(trunkX: number, box: Box): string {
  const cy = box.y + box.h / 2
  return `M ${trunkX} ${cy - SPINE_BEND} Q ${trunkX} ${cy}, ${trunkX + SPINE_BEND} ${cy} L ${box.x} ${cy}`
}

/** The part of a trunk that leads to one box: where that box's branch begins. */
export function trunkUpTo(trunk: Trunk, box: Box): Trunk {
  return { ...trunk, toY: box.y + box.h / 2 - SPINE_BEND }
}

export function trunkPath(trunk: Trunk): string {
  return `M ${trunk.x} ${trunk.fromY} L ${trunk.x} ${trunk.toY}`
}
