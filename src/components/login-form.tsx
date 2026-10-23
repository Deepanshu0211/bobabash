'use client';
import {useActionState, useEffect, useRef, useState} from 'react';
import type {ActionState} from '@/lib/types';
import {SubmitButton, toast} from './form';
import {enterPortal} from '@/app/actions';

/**
 * Two-step entry: everyone starts with their email. Participants go straight in; when the
 * server says the email needs a code (the team code, or a participant's personal code once
 * organizers have handed them out), the code step appears.
 */
export function LoginForm({next, direct, eventCode}: {next: string; direct: boolean; eventCode: boolean}) {
  const [state, formAction, pending] = useActionState(enterPortal, {message: ''});
  const [email, setEmail] = useState('');
  // 'Not you?' dismisses the code step for the answer that asked for it.
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current || !state.message) return;
    last.current = state;
    if (!state.needCode) toast(state.message, Boolean(state.ok));
  }, [state]);
  const step2 = direct && Boolean(state.needCode) && dismissed !== state;
  return (
    <form action={formAction} className="stack action-form login-form" aria-busy={pending}>
      <fieldset disabled={pending}>
        <input type="hidden" name="next" value={next}/>
        <label className="field">
          <span>Registered email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="you@email.com" value={email}
            readOnly={step2} onChange={e => setEmail(e.currentTarget.value)}/>
        </label>
        {step2 ? (
          <div className="login-step">
            {state.codeFor === 'email' ? (
              <label className="field">
                <span>Code from your email</span>
                <input name="code" type="text" required inputMode="numeric" autoComplete="one-time-code" spellCheck={false} maxLength={10} placeholder="Enter the code" autoFocus className="code-input"/>
                <small>Didn’t get it? Check spam, or <button type="submit" name="resend" value="1" formNoValidate className="link-button">send a new code</button>.</small>
              </label>
            ) : (
              <label className="field">
                <span>Team access code</span>
                <input name="code" type="password" required autoComplete="off" autoFocus/>
                <small>Volunteers and organizers only. Ask the organizing team if you don’t have it.</small>
              </label>
            )}
            <button type="button" className="link-button" onClick={() => { setDismissed(state); setEmail(''); }}>Not you? Use another email</button>
          </div>
        ) : direct && eventCode && (
          <label className="field">
            <span>Access code</span>
            <input name="code" type="password" autoComplete="off"/>
            <small>The code announced at the venue.</small>
          </label>
        )}
        <SubmitButton pending={pending} variant="coral">{!direct ? 'Email me a sign-in link →' : step2 ? 'Unlock the portal →' : 'Enter the portal →'}</SubmitButton>
      </fieldset>
      <p key={state.message} className={'form-message ' + (state.ok ? 'success' : state.id === 'ask' ? 'info' : '')} role="status" aria-live="polite">{state.message}</p>
    </form>
  );
}
