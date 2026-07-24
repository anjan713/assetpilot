import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Movement past this many pixels counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4

/**
 * Click-and-drag horizontal scrolling for a scroll container.
 *
 * Touch devices already pan natively, so touch pointers are left alone; this
 * adds the same gesture for a mouse. Because the canvas is covered in clickable
 * cards, a drag that starts on a card must not also select it — once the
 * pointer passes the threshold the following click is swallowed in the capture
 * phase, before it reaches the card.
 */
export function useDragScroll(
  ref: RefObject<HTMLElement>,
  isEnabled: boolean,
): void {
  useEffect(() => {
    const el = ref.current
    if (el === null || !isEnabled) return

    let activePointerId: number | null = null
    let startX = 0
    let startScrollLeft = 0
    let hasDragged = false

    const onPointerDown = (event: PointerEvent) => {
      // Touch pans natively; only the primary mouse button starts a drag.
      if (event.pointerType === 'touch' || event.button !== 0) return
      activePointerId = event.pointerId
      startX = event.clientX
      startScrollLeft = el.scrollLeft
      hasDragged = false
    }

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return
      const dx = event.clientX - startX
      if (!hasDragged) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
        hasDragged = true
        el.classList.add('is-dragging')
        try {
          // Capture keeps the drag alive when the cursor leaves the canvas.
          el.setPointerCapture(event.pointerId)
        } catch {
          // Some pointers cannot be captured. The drag still tracks normally,
          // it just ends early if the cursor leaves — so carry on rather than
          // losing the gesture entirely.
        }
      }
      el.scrollLeft = startScrollLeft - dx
    }

    const onPointerEnd = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId)
      }
      el.classList.remove('is-dragging')
      activePointerId = null
      // `hasDragged` has to outlive pointerup so the click it produced can be
      // swallowed below; clear it once that click has been dispatched.
      if (hasDragged) {
        window.setTimeout(() => {
          hasDragged = false
        }, 0)
      }
    }

    const onClickCapture = (event: MouseEvent) => {
      if (!hasDragged) return
      event.preventDefault()
      event.stopPropagation()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
    el.addEventListener('click', onClickCapture, true)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerEnd)
      el.removeEventListener('pointercancel', onPointerEnd)
      el.removeEventListener('click', onClickCapture, true)
      el.classList.remove('is-dragging')
    }
  }, [ref, isEnabled])
}
