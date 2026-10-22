'use client';
import {useActionState, useEffect, useId, useRef, useState, type ReactNode} from 'react';
import type {ActionState} from '@/lib/types';

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function toast(message: string, ok = true) {
  window.dispatchEvent(new CustomEvent('bb-toast', {detail: {message, ok}}));
}

/** A server-action form with pending, inline and toast feedback. */
export function ActionForm({action, children, label = 'Save', className = '', variant = '', onDone, hideButton = false}: {
  action: Action; children?: ReactNode; label?: string; className?: string; variant?: string;
  onDone?: (state: ActionState) => void; hideButton?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {message: ''});
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current || !state.message) return;
    last.current = state;
    toast(state.message, Boolean(state.ok));
    onDone?.(state);
  }, [state, onDone]);
  return (
    <form action={formAction} className={'stack action-form ' + className} aria-busy={pending}>
      <fieldset disabled={pending}>
        {children}
        {!hideButton && <SubmitButton pending={pending} variant={variant}>{label}</SubmitButton>}
      </fieldset>
      <p key={state.message} className={'form-message ' + (state.ok ? 'success' : '')} role="status" aria-live="polite">{state.message}</p>
    </form>
  );
}

export function SubmitButton({children, pending, variant = '', name, value}: {children: ReactNode; pending?: boolean; variant?: string; name?: string; value?: string}) {
  return (
    <button className={'button ' + variant} type="submit" name={name} value={value} data-pending={pending || undefined}>
      {pending ? <><span className="spinner" aria-hidden="true"/>One moment…</> : children}
    </button>
  );
}

export function Field({label, name, value = '', type = 'text', required = false, maxLength, placeholder, hint, autoComplete}: {
  label: string; name: string; value?: string | number; type?: string; required?: boolean; maxLength?: number;
  placeholder?: string; hint?: string; autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value} required={required} maxLength={maxLength} placeholder={placeholder} autoComplete={autoComplete}/>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TextArea({label, name, value = '', maxLength = 2000, required = false, rows = 4, placeholder}: {
  label: string; name: string; value?: string; maxLength?: number; required?: boolean; rows?: number; placeholder?: string;
}) {
  const [length, setLength] = useState(value.length);
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} defaultValue={value} maxLength={maxLength} required={required} rows={rows} placeholder={placeholder}
        onChange={e => setLength(e.currentTarget.value.length)} data-lenis-prevent/>
      <small className={'counter' + (length > maxLength * 0.9 ? ' near' : '')}>{length} / {maxLength}</small>
    </label>
  );
}

export function Select({label, name, value = '', options, required = false}: {
  label: string; name: string; value?: string; options: {value: string; label: string}[]; required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value} required={required}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/**
 * Sensitive organizer actions: opens a dialog that explains the consequence and
 * requires typing a confirmation word before the server action can run.
 */
export function ConfirmAction({action, label, title, children, phrase, fields, variant = '', disabled = false}: {
  action: Action; label: string; title: string; children: ReactNode; phrase?: string;
  fields?: ReactNode; variant?: string; disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const id = useId();
  return (
    <>
      <button type="button" className={'button ' + variant} disabled={disabled} onClick={() => { setTyped(''); dialog.current?.showModal(); }}>{label}</button>
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby={id} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }} data-lenis-prevent>
        <div className="window tone-pink">
          <div className="window-bar"><span className="window-title" id={id}>{title}</span>
            <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button></div>
          <div className="window-body">
            <div className="confirm-copy">{children}</div>
            <ActionForm action={action} label={label} variant={variant} onDone={s => { if (s.ok) dialog.current?.close(); }}>
              {fields}
              {phrase && (
                <label className="field">
                  <span>Type <code>{phrase}</code> to confirm</span>
                  <input value={typed} onChange={e => setTyped(e.currentTarget.value)} autoComplete="off" required pattern={phrase}/>
                </label>
              )}
            </ActionForm>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function Toaster() {
  const [items, setItems] = useState<{id: number; message: string; ok: boolean}[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const {message, ok} = (e as CustomEvent).detail;
      const id = ++n;
      setItems(list => [...list.slice(-2), {id, message, ok}]);
      setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 4200);
    };
    window.addEventListener('bb-toast', onToast);
    return () => window.removeEventListener('bb-toast', onToast);
  }, []);
  return (
    <div className="toaster" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={'toast ' + (t.ok ? 'ok' : 'err')}>
          <span aria-hidden="true">{t.ok ? '✦' : '!'}</span>{t.message}
        </div>
      ))}
    </div>
  );
}
