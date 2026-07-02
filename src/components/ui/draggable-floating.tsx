import { useEffect, useRef, useState, PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

interface DraggableFloatingProps {
  storageKey: string;
  defaultPosition?: { right: number; bottom: number };
  className?: string;
  children: React.ReactNode;
}

/**
 * Floating container that can be dragged around the viewport.
 * Position is persisted in localStorage per storageKey.
 * Uses left/top with clamping so it stays inside the viewport on resize.
 */
export function DraggableFloating({
  storageKey,
  defaultPosition = { right: 24, bottom: 24 },
  className,
  children,
}: DraggableFloatingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{
    startX: number; startY: number;
    origX: number; origY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  // Initialize from storage or default (bottom-right)
  useEffect(() => {
    const stored = localStorage.getItem(`floating:${storageKey}`);
    const compute = () => {
      const el = ref.current;
      const w = el?.offsetWidth ?? 140;
      const h = el?.offsetHeight ?? 140;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (stored) {
        try {
          const p = JSON.parse(stored);
          return {
            x: Math.min(Math.max(0, p.x), vw - w),
            y: Math.min(Math.max(0, p.y), vh - h),
          };
        } catch { /* fallthrough */ }
      }
      return {
        x: vw - w - defaultPosition.right,
        y: vh - h - defaultPosition.bottom,
      };
    };
    setPos(compute());
    const onResize = () => setPos(p => (p ? compute() : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pos) return;
    // Only initiate drag from the handle (data-drag-handle) area
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    st.moved = true;
    const el = ref.current;
    const w = el?.offsetWidth ?? 140;
    const h = el?.offsetHeight ?? 140;
    const nx = Math.min(Math.max(0, st.origX + dx), window.innerWidth - w);
    const ny = Math.min(Math.max(0, st.origY + dy), window.innerHeight - h);
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(st.pointerId); } catch { /* ignore */ }
    if (st.moved && pos) {
      localStorage.setItem(`floating:${storageKey}`, JSON.stringify(pos));
    }
    dragState.current = null;
  };

  if (!pos) return null;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ position: 'fixed', left: pos.x, top: pos.y, touchAction: 'none' }}
      className={cn('z-50 select-none', className)}
    >
      {children}
    </div>
  );
}
