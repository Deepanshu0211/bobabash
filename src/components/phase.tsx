import {PHASES, phaseIndex} from '@/lib/rules.mjs';
import type {EventSettings} from '@/lib/types';

export function PhaseTimeline({phase}: {phase: EventSettings['phase']}) {
  const current = phaseIndex(phase);
  return (
    <div className="timeline-wrap" data-lenis-prevent>
      <ol className="timeline" style={{'--progress': (current / (PHASES.length - 1)) * 100 + '%'} as React.CSSProperties}>
        {PHASES.map((p, i) => (
          <li key={p.id} className={i < current ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
            <span className="pearl" aria-hidden="true"/>
            <strong>{p.short}</strong>
            <small>{p.label}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PhaseChip({event}: {event: EventSettings | null}) {
  if (!event) return <span className="phase-chip">event not configured</span>;
  const info = PHASES[phaseIndex(event.phase)];
  return (
    <span className={'phase-chip phase-' + event.phase}>
      <i aria-hidden="true"/>{info.label}
    </span>
  );
}
