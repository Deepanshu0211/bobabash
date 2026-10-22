'use client';
import {useEffect, useRef} from 'react';
import {ActionForm, Field} from './form';
import {Icon} from './icons';
import {saveNameAction} from '@/app/actions';

/**
 * Asks for the person's name the first time they open the portal (`required`), and lets
 * anyone change it later from the pencil button next to their name in the topbar.
 */
export function NameDialog({required, suggestion}: {required: boolean; suggestion: string}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (required && !dialog.current?.open) dialog.current?.showModal(); }, [required]);
  return (
    <>
      <button type="button" className="icon-button" aria-label="Change your name" title="Change your name" onClick={() => dialog.current?.showModal()}>
        <Icon name="pencil" size={16}/>
      </button>
      <dialog ref={dialog} className="confirm-dialog name-dialog" aria-labelledby="name-title" data-lenis-prevent>
        <div className="window tone-yellow">
          <div className="window-bar"><span className="window-title" id="name-title">hello_there.exe</span>
            <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button></div>
          <div className="window-body">
            <div className="name-hello">
              <img src="/assets/step-signup.png" alt="" width="84" height="84"/>
              <div>
                <h2>{required ? 'What should we call you?' : 'Change your name'}</h2>
                <p className="muted small">This is shown on your dashboard{required ? '' : ' and to organizers'}. Participants’ names also appear on their project.</p>
              </div>
            </div>
            <ActionForm action={saveNameAction} label="Save my name" variant="coral" onDone={s => { if (s.ok) dialog.current?.close(); }}>
              <Field label="Your name" name="name" value={suggestion} required maxLength={60} autoComplete="name" placeholder="e.g. Deepanshu"/>
            </ActionForm>
          </div>
        </div>
      </dialog>
    </>
  );
}
