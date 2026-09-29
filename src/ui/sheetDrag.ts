import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/** A drag past this share of the sheet's height closes it at any speed. */
const DISMISS_FRACTION = 0.25
/** A downward flick faster than this (px per ms) closes it even when short. */
const FLICK_SPEED = 0.5
/** Movement below this is a tap, never a dismiss. */
const MIN_MOVE = 10
const SETTLE_MS = 220
const SETTLE_EASING = 'cubic-bezier(0.2, 0.8, 0.3, 1)'

interface DragResult {
  /** Positive is downward, in px. */
  distance: number
  durationMs: number
  sheetHeight: number
}

export function shouldDismissSheet({ distance, durationMs, sheetHeight }: DragResult): boolean {
  if (distance < MIN_MOVE) return false
  if (distance > sheetHeight * DISMISS_FRACTION) return true
  return distance / Math.max(durationMs, 1) > FLICK_SPEED
}

/**
 * Lets the user drag a bottom sheet down by its grab zone. Releasing past the
 * dismiss rule slides it off-screen and then calls `onDismiss`; otherwise it
 * springs back.
 */
export function useSheetDrag(
  sheetRef: RefObject<HTMLElement>,
  zoneRef: RefObject<HTMLElement>,
  onDismiss: () => void,
  isEnabled: boolean,
): void {
  /* Read at release time, so a new callback identity never re-binds mid-drag. */
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const sheet = sheetRef.current
    const zone = zoneRef.current
    if (!isEnabled || sheet === null || zone === null) return

    let startY = 0
    let startTime = 0
    let pointerId: number | null = null

    const slideTo = (y: string) => {
      sheet.style.transition = `transform ${SETTLE_MS}ms ${SETTLE_EASING}`
      sheet.style.transform = `translateY(${y})`
    }

    const onDown = (event: PointerEvent) => {
      if (pointerId !== null) return
      /* Capturing the pointer would retarget the click away from the close button. */
      if (event.target instanceof Element && event.target.closest('button') !== null) return
      pointerId = event.pointerId
      startY = event.clientY
      startTime = event.timeStamp
      /* The entry animation's fill would otherwise override the inline transform. */
      sheet.style.animation = 'none'
      sheet.style.transition = 'none'
      zone.setPointerCapture(event.pointerId)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      const distance = Math.max(0, event.clientY - startY)
      sheet.style.transform = `translateY(${distance}px)`
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      pointerId = null
      const isDismissed = shouldDismissSheet({
        distance: event.clientY - startY,
        durationMs: event.timeStamp - startTime,
        sheetHeight: sheet.offsetHeight,
      })
      if (!isDismissed) {
        slideTo('0')
        return
      }
      slideTo('100%')
      window.setTimeout(() => onDismissRef.current(), SETTLE_MS)
    }

    zone.addEventListener('pointerdown', onDown)
    zone.addEventListener('pointermove', onMove)
    zone.addEventListener('pointerup', onUp)
    zone.addEventListener('pointercancel', onUp)
    return () => {
      zone.removeEventListener('pointerdown', onDown)
      zone.removeEventListener('pointermove', onMove)
      zone.removeEventListener('pointerup', onUp)
      zone.removeEventListener('pointercancel', onUp)
    }
  }, [sheetRef, zoneRef, isEnabled])
}

/**
 * Freezes the page behind an open sheet. iOS Safari ignores `overflow: hidden`
 * on the body for touch scrolling, so the body is pinned in place instead and
 * the scroll position restored on release.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return
    const { body } = document
    const scrollY = window.scrollY
    const previous = body.getAttribute('style') ?? ''
    Object.assign(body.style, {
      position: 'fixed',
      top: `-${scrollY}px`,
      left: '0',
      right: '0',
      overflow: 'hidden',
    })
    return () => {
      body.setAttribute('style', previous)
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}
