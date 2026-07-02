import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface DraggableFloatingProps {
  storageKey: string;
  defaultPosition?: { right: number; bottom: number };
  className?: string;
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
  children: React.ReactNode;
}

/**
 * Floating element draggable from anywhere on itself.
 * Click only fires if pointer moved less than 5px (no drag).
 * Position persisted in localStorage per storageKey.
 */
export function DraggableFloating({
  storageKey,
  defaultPosition = { right: 24, bottom: 24 },
  className,
  onClick,
  title,
  'aria-label': ariaLabel,
  children,
}: DraggableFloatingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const start = useRef({ offX: 0, offY: 0, moved: false });

  useEffect(() => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 64;
    const h = el?.offsetHeight ?? 64;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const stored = localStorage.getItem(`floating:${storageKey}`);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setPos({
          x: Math.min(Math.max(0, p.x), vw - w),
          y: Math.min(Math.max(0, p.y), vh - h),
        });
        return;
      } catch { /* fallthrough */ }
    }
    setPos({
      x: vw - w - defaultPosition.right,
      y: vh - h - defaultPosition.bottom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!pos) return;
    dragging.current = true;
    start.current = { offX: clientX - pos.x, offY: clientY - pos.y, moved: false };
  };

  const move = (clientX: number, clientY: number) => {
    if (!dragging.current) return;
    const el = ref.current;
    if (!el) return;
    let x = clientX - start.current.offX;
    let y = clientY - start.current.offY;
    if (Math.abs(clientX - (pos!.x + start.current.offX)) > 5 ||
        Math.abs(clientY - (pos!.y + start.current.offY)) > 5) {
      start.current.moved = true;
    }
    const maxX = window.innerWidth - el.offsetWidth;
    const maxY = window.innerHeight - el.offsetHeight;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    setPos({ x, y });
  };

  const release = () => {
    if (!dragging.current) return;
    if (start.current.moved && pos) {
      localStorage.setItem(`floating:${storageKey}`, JSON.stringify(pos));
    } else {
      onClick?.();
    }
    dragging.current = false;
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    const mu = () => release();
    const tm = (e: TouchEvent) => {
      if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tu = () => release();
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', tu);
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', tu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  if (!pos) return null;

  return (
    <div
      ref={ref}
      onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        touchAction: 'none',
        cursor: 'grab',
      }}
      className={cn('z-[9999] select-none', className)}
    >
      {children}
    </div>
  );
}
