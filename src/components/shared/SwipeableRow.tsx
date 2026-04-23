/**
 * components/shared/SwipeableRow.tsx
 *
 * A swipe-to-reveal row wrapper for mobile list items.
 *
 * Implemented with pointer events (covers both touch and mouse) — no external
 * gesture library required. The revealed action sits in a fixed-width layer
 * behind the content. Swiping left slides the content to expose it.
 *
 * Critical for Capacitor Android: `touch-action: pan-y` on the wrapper ensures
 * vertical scrolling continues to work while horizontal swipe is handled here.
 */

import { useRef } from 'react';

type SwipeableRowProps = {
  /** The main content — rendered on top, slides left on swipe */
  children: React.ReactNode;
  /** The revealed action element (e.g. an archive button) */
  action: React.ReactNode;
  /** Width of the action area in pixels. Defaults to 80. */
  actionWidth?: number;
  /** When false, swiping is disabled (e.g. for archived cards). Defaults to true. */
  enabled?: boolean;
};

export function SwipeableRow({
  children,
  action,
  actionWidth = 80,
  enabled = true,
}: SwipeableRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasCapturedRef = useRef(false);

  // Horizontal movement required before we commit to a swipe gesture.
  // Keeps taps from being swallowed by pointer capture.
  const SWIPE_THRESHOLD = 8;

  function applyOffset(offset: number, animate: boolean) {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 200ms ease-out' : 'none';
    el.style.transform = `translateX(${-offset}px)`;
    currentOffsetRef.current = offset;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    // Ignore multi-touch secondary pointers
    if (e.isPrimary === false) return;
    isDraggingRef.current = true;
    hasCapturedRef.current = false;
    startXRef.current = e.clientX + currentOffsetRef.current;
    // Do NOT capture here — wait for movement threshold so taps pass through
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current || !enabled) return;
    const rawDelta = startXRef.current - e.clientX;
    if (!hasCapturedRef.current) {
      if (Math.abs(rawDelta) < SWIPE_THRESHOLD) return;
      // Committed to a horizontal swipe — capture the pointer now
      e.currentTarget.setPointerCapture(e.pointerId);
      hasCapturedRef.current = true;
    }
    // Only allow left swipe (positive delta), cap at actionWidth + 8px overscroll
    const clamped = Math.max(0, Math.min(rawDelta, actionWidth + 8));
    applyOffset(clamped, false);
  }

  function handlePointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    hasCapturedRef.current = false;
    const offset = currentOffsetRef.current;
    if (offset >= actionWidth * 0.5) {
      // Snap open
      applyOffset(actionWidth, true);
    } else {
      // Snap closed
      applyOffset(0, true);
    }
  }

  function handlePointerCancel() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    hasCapturedRef.current = false;
    applyOffset(0, true);
  }

  return (
    <div
      className="relative overflow-hidden"
      // pan-y: let the browser handle vertical scroll; we intercept horizontal
      style={{ touchAction: 'pan-y' }}
    >
      {/* Action layer — sits behind, right-aligned, full height */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: actionWidth }}
        aria-hidden="true"
      >
        {action}
      </div>

      {/* Content layer — solid background ensures the action never bleeds through */}
      <div
        ref={contentRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="bg-background"
        style={{ transform: 'translateX(0)', willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}
