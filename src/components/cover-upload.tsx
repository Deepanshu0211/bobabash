'use client';
import {useEffect, useState} from 'react';
import {ActionForm} from './form';
import {Cover} from './ui';
import {uploadCoverAction} from '@/app/actions';

export function CoverUpload({id, current, title}: {id: string; current: string | null; title: string}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <ActionForm action={uploadCoverAction} label="Upload cover" variant="secondary" onDone={s => s.ok && setPreview(null)}>
      <div className="cover-preview"><Cover id={id} src={preview ?? current} title={title}/></div>
      <label className="file-drop">
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" required
          onChange={e => { const f = e.currentTarget.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }}/>
        <span><strong>Choose an image</strong> · PNG, JPEG or WebP, up to 5 MB. Shown at 16:10.</span>
      </label>
    </ActionForm>
  );
}
