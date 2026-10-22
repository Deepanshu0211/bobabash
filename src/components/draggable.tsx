'use client';
import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';

let topLayer = 10;

/**
 * Makes its single child window movable like a desktop window: drag it by any
 * `[data-drag-handle]` inside (mouse, pen or touch), or focus the handle and use the
 * arrow keys (Shift for bigger steps, Escape to reset). Double-click the handle to snap
 * it back. The wrapper is `display: contents`, so the window keeps its own layout and
 * only gets `--dx` / `--dy` (applied as a transform in CSS). It stays inside `.hero`.
 */
export function Draggable({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({x: 0, y: 0});
  const [layer, setLayer] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{px: number; py: number; ox: number; oy: number; bounds: DOMRect; box: DOMRect} | null>(null);

  const win = () => ref.current?.firstElementChild as HTMLElement | null;

  useLayoutEffect(() => {
    const el = win();
    if (!el) return;
    el.style.setProperty('--dx', offset.x + 'px');
    el.style.setProperty('--dy', offset.y + 'px');
    if (layer !== null) el.style.zIndex = String(layer);
    el.classList.toggle('is-dragging', dragging);
    el.classList.toggle('is-moved', offset.x !== 0 || offset.y !== 0);
  }, [offset, layer, dragging]);

  const raise = () => setLayer(++topLayer);
  const fromHandle = (e: {target: EventTarget}) => (e.target as HTMLElement).closest('[data-drag-handle]');

  function clamp(x: number, y: number) {
    const d = drag.current;
    if (!d) return {x, y};
    // Keep at least 90px of the window inside the hero so it can always be grabbed again.
    const homeLeft = d.box.left - d.ox, homeTop = d.box.top - d.oy;
    return {
      x: Math.min(d.bounds.right - homeLeft - 90, Math.max(d.bounds.left - homeLeft - d.box.width + 90, x)),
      y: Math.min(d.bounds.bottom - homeTop - 60, Math.max(d.bounds.top - homeTop, y))
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    const handle = fromHandle(e);
    if (!handle || (e.target as HTMLElement).closest('a, button, input') || e.button > 0) return;
    const el = win()!;
    const section = el.closest('.hero') ?? document.body;
    drag.current = {px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y, bounds: section.getBoundingClientRect(), box: el.getBoundingClientRect()};
    (handle as HTMLElement).setPointerCapture(e.pointerId);
    raise();
    setDragging(true);
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (d) setOffset(clamp(d.ox + e.clientX - d.px, d.oy + e.clientY - d.py));
  }
  function stop() {
    drag.current = null;
    setDragging(false);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (!fromHandle(e)) return;
    const step = e.shiftKey ? 40 : 12;
    const move = ({ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]} as Record<string, number[]>)[e.key];
    if (move) { e.preventDefault(); raise(); setOffset(o => ({x: o.x + move[0], y: o.y + move[1]})); }
    if (e.key === 'Escape') setOffset({x: 0, y: 0});
  }

  return (
    <div ref={ref} className="draggable-slot"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stop} onPointerCancel={stop}
      onDoubleClick={e => { if (fromHandle(e)) setOffset({x: 0, y: 0}); }}
      onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
