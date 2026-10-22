'use client';
import {useState} from 'react';
import {SHORT_EVENT_PLAN} from '@/lib/rules.mjs';
import {Icon} from './icons';

/** Adds minutes to a "YYYY-MM-DDTHH:mm" wall-clock value without involving any timezone. */
function addMinutes(local: string, minutes: number) {
  const [d, t] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, day, h, min + minutes)).toISOString().slice(0, 16);
}

/** Fills the schedule fields from the event start using the suggested short-event plan. */
export function ScheduleHelper() {
  const [note, setNote] = useState('');
  function fill(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest('form');
    const start = form?.querySelector<HTMLInputElement>('input[name="starts_at"]')?.value;
    if (!form || !start) { setNote('Set when the event starts first.'); return; }
    for (const [name, offset] of SHORT_EVENT_PLAN) {
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input) input.value = addMinutes(start, offset as number);
    }
    setNote('Filled a 5 hour plan. Check each time, then save.');
  }
  return (
    <div className="schedule-helper">
      <button type="button" className="button secondary" onClick={fill}><Icon name="clock" size={15}/>Plan a 5 hour day</button>
      <small className="muted" aria-live="polite">{note || 'Build 3h, review 45m, vote 45m, results at the end.'}</small>
    </div>
  );
}
