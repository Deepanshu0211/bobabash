'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useMemo, useRef, useState} from 'react';
import {ProjectCard} from './project-card';
import {Icon} from './icons';
import {toast} from './form';
import {ballotProblem} from '@/lib/rules.mjs';
import type {WallProject} from '@/lib/types';

export function BobaCup({filled, max = 3}: {filled: number; max?: number}) {
  const spots = [[44, 92], [62, 98], [80, 92]].slice(0, max);
  return (
    <svg className="boba-cup" viewBox="0 0 124 124" aria-hidden="true">
      <path className="cup-straw" d="M74 4 84 6 74 46 66 44z"/>
      <path className="cup-lid" d="M24 34h76a6 6 0 0 1 0 12H24a6 6 0 0 1 0-12z"/>
      <path className="cup-body" d="M28 46h68l-7 66a8 8 0 0 1-8 7H43a8 8 0 0 1-8-7z"/>
      <path className="cup-tea" d={`M${31 + (3 - filled) * 0.4} ${78 - filled * 7}h${62 - (3 - filled) * 0.8}l-4 34a8 8 0 0 1-8 7H43a8 8 0 0 1-8-7z`}/>
      {spots.map(([x, y], i) => (
        <circle key={i + (i < filled ? 'on' : 'off')} className={'cup-pearl' + (i < filled ? ' on' : '')} cx={x} cy={y} r="7.5"/>
      ))}
    </svg>
  );
}

export function BallotPicker({projects, max}: {projects: WallProject[]; max: number}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<'pick' | 'sending' | 'done'>('pick');
  const [error, setError] = useState<{status: number; message: string} | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const own = projects.find(p => p.is_mine)?.id ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : projects;
  }, [projects, query]);
  const problem = ballotProblem(selected, {max, ownId: own, allowed: projects.map(p => p.id)});
  const chosen = selected.map(id => projects.find(p => p.id === id)!).filter(Boolean);

  function toggle(id: string) {
    setError(null);
    setSelected(list => list.includes(id) ? list.filter(x => x !== id) : list.length >= max ? list : [...list, id]);
  }

  async function submit() {
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/voting/ballot', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({submission_ids: selected})});
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setState('done');
        toast('Ballot recorded. Thank you for voting!');
        setTimeout(() => { router.push('/voting/receipt'); router.refresh(); }, 1700);
        return;
      }
      setError({status: res.status, message: body.error ?? 'Your ballot could not be submitted.'});
      setState('pick');
      if (res.status === 422) router.refresh();
    } catch {
      setError({status: 0, message: 'Network problem: your ballot was not sent. Please try again.'});
      setState('pick');
    }
  }

  return (
    <div className="ballot">
      <div className="ballot-tools">
        <label className="search-field">
          <Icon name="search" size={16}/>
          <span className="sr-only">Search the shortlist</span>
          <input value={query} onChange={e => setQuery(e.currentTarget.value)} placeholder="Search the shortlist…" maxLength={100}/>
        </label>
        <p className="muted">{projects.length} shortlisted projects · pick exactly {max}</p>
      </div>

      <div className="project-grid" data-stagger>
        {visible.map(p => {
          const on = selected.includes(p.id);
          const full = !on && selected.length >= max;
          return (
            <ProjectCard key={p.id} project={p} selected={on} href={null} footer={
              p.is_mine ? <span className="muted"><Icon name="lock" size={14}/> You can’t vote for your own project</span> :
                <button type="button" className={'pick-button' + (on ? ' on' : '')} aria-pressed={on} disabled={full || state !== 'pick'} onClick={() => toggle(p.id)}>
                  <span className="pick-pearl" aria-hidden="true"/>{on ? 'In your cup' : full ? 'Cup is full' : 'Add to cup'}
                </button>
            }/>
          );
        })}
      </div>
      {!visible.length && <p className="empty-inline">No shortlisted project matches “{query}”.</p>}

      <div className={'cup-tray' + (selected.length === max ? ' ready' : '')} role="region" aria-label="Your ballot">
        <BobaCup filled={selected.length} max={max}/>
        <div className="tray-info">
          <strong aria-live="polite">{selected.length} of {max} picked</strong>
          <div className="tray-chips">
            {chosen.map(p => (
              <button key={p.id} type="button" className="chip" onClick={() => toggle(p.id)} disabled={state !== 'pick'} aria-label={`Remove ${p.title}`}>
                {p.title}<Icon name="x" size={12}/>
              </button>
            ))}
            {!chosen.length && <small className="muted">Tap “Add to cup” on three projects you love.</small>}
          </div>
        </div>
        <button type="button" className="button coral" disabled={Boolean(problem) || state !== 'pick'} onClick={() => { setAgreed(false); dialog.current?.showModal(); }}>
          Review ballot →
        </button>
      </div>

      <dialog ref={dialog} className="confirm-dialog" aria-labelledby="ballot-title" data-lenis-prevent onClose={() => state === 'sending' || setAgreed(false)}>
        <div className="window tone-pink">
          <div className="window-bar"><span className="window-title" id="ballot-title">final_ballot.exe</span>
            <button type="button" className="dialog-close" aria-label="Close" disabled={state !== 'pick'} onClick={() => dialog.current?.close()}>×</button></div>
          <div className="window-body">
            {state === 'done' ? (
              <div className="ballot-done" role="status">
                <div className="burst" aria-hidden="true">{Array.from({length: 14}, (_, i) => <i key={i} style={{'--i': i} as React.CSSProperties}/>)}</div>
                <BobaCup filled={max} max={max}/>
                <h2>Ballot recorded!</h2>
                <p>Taking you to your receipt…</p>
              </div>
            ) : (
              <>
                <h2>Your three picks</h2>
                <ol className="final-picks">
                  {chosen.map((p, i) => <li key={p.id}><span className="pick-num">{i + 1}</span><strong>{p.title}</strong>{p.creator_name && <small>by {p.creator_name}</small>}</li>)}
                </ol>
                <p className="notice">Each pick gets exactly one point. <strong>You can submit only one ballot, and it can’t be changed afterwards.</strong> Totals stay hidden until organizers publish results. Organizers can see each ballot to keep voting fair.</p>
                <label className="check"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.currentTarget.checked)}/> I understand this ballot is final.</label>
                {error && (
                  <p className="form-message" role="alert">
                    {error.message} {error.status === 409 && <Link href="/voting/receipt">View your receipt →</Link>}
                  </p>
                )}
                <div className="button-row">
                  <button type="button" className="button secondary" onClick={() => dialog.current?.close()} disabled={state === 'sending'}>Keep choosing</button>
                  <button type="button" className="button coral" disabled={!agreed || state === 'sending'} onClick={submit}>
                    {state === 'sending' ? <><span className="spinner" aria-hidden="true"/>Sending…</> : 'Submit final ballot'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
