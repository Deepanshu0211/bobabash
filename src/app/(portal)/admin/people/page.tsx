import {listRoster, listStaff, requireRole} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, Select, TextArea} from '@/components/form';
import {Badge, PageHeading, Window} from '@/components/ui';
import {initials} from '@/lib/rules.mjs';

export const metadata = {title: 'People'};

export default async function People() {
  const s = await requireRole('organizer', '/admin/people');
  const [roster, staff] = await Promise.all([listRoster(s), listStaff(s)]);
  const linked = roster.filter(p => p.user_id).length;
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
            <small className="muted">Existing emails update their display name. Re-importing is safe.</small>
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
      <Window title={`roster.csv · ${roster.length} participants, ${linked} signed in`} icon="list" reveal>
        <ul className="people-list roster" data-lenis-prevent>
          {roster.map(p => (
            <li key={p.id} className={p.active ? '' : 'inactive'}>
              <span className="avatar small" aria-hidden="true">{initials(p.display_name)}</span>
              <span><strong>{p.display_name}</strong><small>{p.email}</small></span>
              {p.user_id ? <Badge tone="lime">signed in</Badge> : <Badge tone="muted">not yet</Badge>}
              <ActionForm action={adminAction} label={p.active ? 'Deactivate' : 'Reactivate'} variant="small-button secondary">
                <input type="hidden" name="op" value="active"/><input type="hidden" name="id" value={p.id}/><input type="hidden" name="active" value={String(!p.active)}/>
              </ActionForm>
              <ConfirmAction action={adminAction} label="Remove" title="remove_participant.exe" phrase="REMOVE" variant="small-button secondary"
                fields={<><input type="hidden" name="op" value="remove"/><input type="hidden" name="id" value={p.id}/></>}>
                <p>Removes <strong>{p.display_name}</strong> ({p.email}) from the roster{p.project ? <>, together with their project <strong>{p.project}</strong> and its reviews</> : ''}. They can no longer enter the portal.</p>
                <p className="muted small">Not allowed once they have voted or their project has votes. Deactivate them instead. Every removal is logged.</p>
              </ConfirmAction>
            </li>
          ))}
        </ul>
      </Window>
    </div>
  );
}
