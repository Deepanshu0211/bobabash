'use client';
import {useEffect, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';
import Lenis from 'lenis';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * App-wide smooth scrolling with Lenis. Scroll reveals and parallax are pure CSS
 * scroll-driven animations (see portal.css), so nothing touches server-rendered
 * markup before React hydrates it. Skipped entirely for reduced motion.
 */
export function MotionProvider() {
  const pathname = usePathname();
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    if (reduced()) return;
    const instance = new Lenis({autoRaf: true, lerp: 0.11, wheelMultiplier: 0.95, anchors: {offset: -90},
      prevent: node => node.closest?.('[data-lenis-prevent], dialog') !== null});
    lenis.current = instance;
    return () => { instance.destroy(); lenis.current = null; };
  }, []);

  useEffect(() => { lenis.current?.scrollTo(0, {immediate: true}); }, [pathname]);

  return null;
}

export function CountUp({value, duration = 1100}: {value: number; duration?: number}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (reduced() || !el) return;
    // The real number is rendered; the animation only rewrites it once frames actually run.
    let raf = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = String(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); el.textContent = String(value); };
  }, [value, duration]);
  return <span ref={ref} className="count-up">{value}</span>;
}

/** Drops empty leading units (no "00d" for a same-day event) but always keeps minutes and seconds. */
function trimmed<T extends readonly [string, number]>(units: readonly T[]) {
  let i = 0;
  while (i < 2 && units[i][1] === 0) i++;
  return units.slice(i);
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [['d', Math.floor(s / 86400)], ['h', Math.floor(s / 3600) % 24], ['m', Math.floor(s / 60) % 60], ['s', s % 60]] as const;
}

export function Countdown({to, label, compact = false}: {to: string | null; label?: string; compact?: boolean}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  if (!to) return null;
  const left = now === null ? null : Date.parse(to) - now;
  if (left !== null && left <= 0) return <span className="countdown done">{label ? label + ' · ' : ''}now</span>;
  return (
    <span className={'countdown' + (compact ? ' compact' : '')} aria-label={label ? `${label} in ${left === null ? '…' : Math.ceil(left / 60000) + ' minutes'}` : undefined}>
      {label && <em>{label}</em>}
      {left === null ? <b>…</b> : trimmed(parts(left)).map(([unit, n]) => (
        <b key={unit}><span key={n} className="tick">{String(n).padStart(2, '0')}</span><i>{unit}</i></b>
      ))}
    </span>
  );
}
