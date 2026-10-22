'use client';
import {useEffect, useState} from 'react';
import {ActionForm, TextArea} from './form';
import {Icon} from './icons';
import {reviewAction, startReviewAction} from '@/app/actions';
import type {Review} from '@/lib/types';

const CHOICES = [
  {value: 'shortlist', label: 'Shortlist', hint: 'Meets the criteria, send it to voting', icon: 'check'},
  {value: 'reject', label: 'Don’t shortlist', hint: 'Eligible, but not ready for the vote', icon: 'x'},
  {value: 'flag', label: 'Flag issue', hint: 'Eligibility concern for organizers', icon: 'flag'}
];
const CRITERIA = [
  ['functionality', 'Works as described'], ['originality', 'Original idea'], ['presentation', 'Presentation'], ['effort', 'Effort & craft']
] as const;

function Rating({name, label, initial}: {name: string; label: string; initial?: number}) {
  const [value, setValue] = useState(initial ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <fieldset className="rating" onMouseLeave={() => setHover(0)}>
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} className={(hover || value) >= n ? 'lit' : ''} onMouseEnter={() => setHover(n)}>
            <input type="radio" name={'c_' + name} value={n} defaultChecked={initial === n} onChange={() => setValue(n)}/>
            <span className="sr-only">{n} of 5</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({assignmentId, review, status, locked}: {assignmentId: string; review: Review | null; status: string; locked: boolean}) {
  const [choice, setChoice] = useState(review?.recommendation ?? '');
  useEffect(() => { if (status === 'assigned' && !locked) void startReviewAction(assignmentId); }, [assignmentId, status, locked]);
  if (locked) return <p className="notice"><Icon name="lock" size={14}/> Reviews are closed. Your recommendation{review ? ` (${review.recommendation})` : ''} is on record.</p>;
  return (
    <ActionForm action={reviewAction} label={review ? 'Update my review' : 'Submit review'} variant="coral">
      <input type="hidden" name="assignment_id" value={assignmentId}/>
      <div className="choice-group" role="radiogroup" aria-label="Recommendation">
        {CHOICES.map(c => (
          <label key={c.value} className={'choice choice-' + c.value + (choice === c.value ? ' on' : '')}>
            <input type="radio" name="recommendation" value={c.value} required defaultChecked={review?.recommendation === c.value} onChange={() => setChoice(c.value)}/>
            <span className="choice-icon"><Icon name={c.icon} size={18}/></span>
            <strong>{c.label}</strong>
            <small>{c.hint}</small>
          </label>
        ))}
      </div>
      <div className="rubric">
        {CRITERIA.map(([key, label]) => <Rating key={key} name={key} label={label} initial={review?.criteria?.[key]}/>)}
      </div>
      <TextArea name="note" label={choice === 'flag' ? 'What is the eligibility concern? (required)' : 'Private note for organizers (optional)'}
        value={review?.note ?? ''} maxLength={2000} required={choice === 'flag'} rows={3}/>
      {review && <small className="muted">Revision {review.revision}. Updates are recorded in the audit log.</small>}
    </ActionForm>
  );
}
