import Link from 'next/link';
import {getEvent, listRoster, listStaff, requireRole} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, Select, TextArea} from '@/components/form';
import {Badge, PageHeading, Window} from '@/components/ui';
import {initials} from '@/lib/rules.mjs';

export const metadata = {title: 'People'};

const TRACKS = [{id: '', label: 'everyone'}, {id: 'competing', label: 'competition'}, {id: 'showcase', label: 'showcase'}] as const;

export default async function People({searchParams}: {searchParams: Promise<{track?: string}>}) {
  const s = await requireRole('organizer', '/admin/people');
  const track = (await searchParams).track ?? '';
  const [everyone, staff, event] = await Promise.all([listRoster(s), listStaff(s), getEvent()]);
  const roster = track ? everyone.filter(p => p.track === track) : everyone;
  const linked = everyone.filter(p => p.user_id).length;
  const showcase = everyone.filter(p => p.track === 'showcase').length;
  // Tracks freeze with the shortlist, like eligibility.
  const movable = ['setup', 'submissions', 'review'].includes(event?.phase ?? 'setup');
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk" title="Roster & roles">
        <p>Only emails on this roster can participate. Volunteers and organizers are invited by email; roles are granted the moment they sign in.</p>
      </PageHeading>
      <div className="two-col">
        <Window title="import_roster.csv" tone="yellow" icon="upload" reveal>
          <h2>Import participants</h2>
          <ActionForm action={adminAction} label="Import roster">
            <input type="hidden" name="op" value="roster"/>
            <TextArea label="One per line: email, display name" name="roster" rows={6} maxLength={60000} required placeholder={'ana@example.com, Ana\nleo@example.com, Leo'}/>
            <Select label="Import as" name="track" options={[
              {value: 'competing', label: 'Competition: judged, votes and can win'},
              {value: 'showcase', label: 'Showcase (hidden from them): looks normal and votes, but never shortlisted and their votes don’t count'}
            ]}/>
            <small className="muted">Existing emails update their display name and move to the chosen track. Re-importing is safe.</small>
          </ActionForm>
        </Window>
        <Window title="staff.exe" tone="lime" icon="people" reveal>
          <h2>Volunteers & organizers</h2>
          <ActionForm action={adminAction} label="Invite">
            <input type="hidden" name="op" value="invite"/>
            <div className="field-pair">
              <Field label="Email" name="email" type="email" required/>
              <Field label="Display name" name="display_name" maxLength={80}/>
            </div>
            <Select label="Role" name="role" options={[{value: 'reviewer', label: 'Volunteer reviewer'}, {value: 'organizer', label: 'Organizer'}]}/>
          </ActionForm>
          <ul className="people-list">
            {staff.map(p => (
              <li key={p.email + p.role}>
                <span className="avatar small" aria-hidden="true">{initials(p.display_name)}</span>
                <span><strong>{p.display_name}</strong><small>{p.email}</small></span>
                <Badge status={p.role}/>{!p.joined && <Badge tone="muted">invited</Badge>}
                <ActionForm action={adminAction} label="Remove" variant="small-button secondary">
                  <input type="hidden" name="op" value="revoke"/><input type="hidden" name="email" value={p.email}/><input type="hidden" name="role" value={p.role}/>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Window>
      </div>
      <Window title={`roster.csv · ${everyone.length} participants (${everyone.length - showcase} competing, ${showcase} showcase), ${linked} signed in`} icon="list" reveal>
        <div className="segmented" role="group" aria-label="Track filter">
          {TRACKS.map(t => <Link key={t.id || 'all'} href={t.id ? '?track=' + t.id : '/admin/people'} className={track === t.id ? 'on' : ''}>{t.label}</Link>)}
        </div>
        {!movable && <p className="muted small">Tracks are frozen now that the shortlist is final.</p>}
        <ul className="people-list roster" data-lenis-prevent>
          {roster.map(p => (
            <li key={p.id} className={p.active ? '' : 'inactive'}>
              <span className="avatar small" aria-hidden="true">{initials(p.display_name)}</span>
              <span><strong>{p.display_name}</strong><small>{p.email}</small></span>
              <span className="badge-row">
                {p.track === 'showcase' ? <Badge tone="cream">showcase</Badge> : <Badge tone="blue">competing</Badge>}
                {p.user_id ? <Badge tone="lime">signed in</Badge> : <Badge tone="muted">not yet</Badge>}
              </span>
              <span className="roster-actions">
                {movable && (
                  <ConfirmAction action={adminAction} label={p.track === 'showcase' ? 'To competition' : 'To showcase'} title="change_track.exe" variant="small-button secondary"
                    fields={<><input type="hidden" name="op" value="track"/><input type="hidden" name="id" value={p.id}/><input type="hidden" name="track" value={p.track === 'showcase' ? 'competing' : 'showcase'}/></>}>
                    {p.track === 'showcase'
                      ? <p>Moves <strong>{p.display_name}</strong> into the competition. Their project can be shortlisted and their ballot will count.</p>
                      : <p>Moves <strong>{p.display_name}</strong> to the showcase. They aren’t told, and nothing changes on their screen. {p.project ? <>Their project <strong>{p.project}</strong> stays exactly as it is, but</> : 'Their project'} will never be shortlisted, and their ballot won’t count.</p>}
                  </ConfirmAction>
                )}
                <ActionForm action={adminAction} label={p.active ? 'Deactivate' : 'Reactivate'} variant="small-button secondary">
                  <input type="hidden" name="op" value="active"/><input type="hidden" name="id" value={p.id}/><input type="hidden" name="active" value={String(!p.active)}/>
                </ActionForm>
                <ConfirmAction action={adminAction} label="Remove" title="remove_participant.exe" phrase="REMOVE" variant="small-button secondary"
                  fields={<><input type="hidden" name="op" value="remove"/><input type="hidden" name="id" value={p.id}/></>}>
                  <p>Removes <strong>{p.display_name}</strong> ({p.email}) from the roster{p.project ? <>, together with their project <strong>{p.project}</strong> and its reviews</> : ''}. They can no longer enter the portal.</p>
                  <p className="muted small">Not allowed once they have voted or their project has votes. Deactivate them instead. Every removal is logged.</p>
                </ConfirmAction>
              </span>
            </li>
          ))}
          {!roster.length && <li className="muted">Nobody here yet.</li>}
        </ul>
      </Window>
    </div>
  );
}
