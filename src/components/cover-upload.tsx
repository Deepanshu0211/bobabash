'use client';
import {useActionState, useEffect, useRef, useState} from 'react';
import {toast} from './form';
import {Cover} from './ui';
import {Icon} from './icons';
import {uploadCoverAction} from '@/app/actions';
import type {ActionState} from '@/lib/types';

const MAX = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * One big target: click it (or drop an image on it) and the cover uploads right away.
 * No separate "upload" button to forget, and no tiny native file picker to find.
 */
export function CoverUpload({id, current, title}: {id: string; current: string | null; title: string}) {
  const [state, formAction, pending] = useActionState(uploadCoverAction, {message: ''} as ActionState);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef(state);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (state === last.current || !state.message) return;
    last.current = state;
    toast(state.message, Boolean(state.ok));
    if (input.current) input.current.value = '';
  }, [state]);

  // Checks the file here, shows it at once, then sends the form.
  function take(file: File | undefined) {
    if (!file || !input.current) return;
    if (file.size > MAX) { toast(`That image is ${(file.size / 1048576).toFixed(1)} MB. Use one of 5 MB or less.`, false); input.current.value = ''; return; }
    if (file.type && !TYPES.includes(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      toast('Use a PNG, JPEG or WebP image. HEIC photos and GIFs aren’t supported.', false); input.current.value = ''; return;
    }
    setPreview(URL.createObjectURL(file));
    form.current?.requestSubmit();
  }

  return (
    <form ref={form} action={formAction} className="stack cover-upload" aria-busy={pending}>
      <div className="cover-preview">
        <Cover id={id} src={preview ?? current} title={title}/>
        {pending && <span className="cover-busy"><span className="spinner" aria-hidden="true"/>Uploading…</span>}
      </div>
      <label className={'file-drop' + (over ? ' over' : '') + (pending ? ' busy' : '')}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault(); setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && input.current) { const dt = new DataTransfer(); dt.items.add(file); input.current.files = dt.files; take(file); }
        }}>
        <input ref={input} className="sr-only" type="file" name="image" accept="image/png,image/jpeg,image/webp"
          onChange={e => take(e.currentTarget.files?.[0])}/>
        <span className="file-drop-icon" aria-hidden="true"><Icon name="upload" size={22}/></span>
        <span className="file-drop-text">
          <strong>{pending ? 'Uploading your cover…' : current || preview ? 'Change cover image' : 'Choose a cover image'}</strong>
          <small>Click or drop a picture here · PNG, JPEG or WebP, up to 5 MB · shown at 16:10</small>
        </span>
      </label>
      <p key={state.message} className={'form-message ' + (state.ok ? 'success' : '')} role="status" aria-live="polite">{state.message}</p>
    </form>
  );
}
