import Link from 'next/link';
import {formatDate, getEvent, getMySubmission, requireRole} from '@/lib/portal';
import {saveSubmissionAction, withdrawAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, Select, SubmitButton, TextArea} from '@/components/form';
import {Badge, Cover, ExternalLinks, PageHeading, Window} from '@/components/ui';
import {CoverUpload} from '@/components/cover-upload';
import {Icon} from '@/components/icons';
import {CATEGORIES} from '@/lib/validation';
import type {Submission} from '@/lib/types';

export const metadata = {title: 'My submission'};

const steps = ['draft', 'submitted', 'eligible', 'shortlisted'] as const;
function Journey({s}: {s: Submission | null}) {
  const reached = !s ? -1 : s.shortlist_status === 'shortlisted' ? 3 : s.status === 'eligible' ? 2 : s.status === 'submitted' ? 1 : s.status === 'draft' ? 0 : -1;
  return (
    <ol className="journey" aria-label="Submission progress">
      {steps.map((step, i) => <li key={step} className={i <= reached ? 'on' : ''}><span aria-hidden="true">{i + 1}</span>{step}</li>)}
    </ol>
  );
}

export default async function SubmissionPage() {
  const s = await requireRole('participant', '/submission');
  const [event, mine] = await Promise.all([getEvent(), getMySubmission(s)]);
  const tz = event?.timezone ?? 'Asia/Kolkata';
  // Manual control: the form is open exactly while organizers keep submissions open.
  const open = event?.phase === 'submissions';
  const restarting = open && mine?.status === 'withdrawn';
  const editable = open && (!mine || restarting || mine.status === 'draft' || mine.status === 'submitted');
  // After a withdrawal the form starts blank: it is a brand new project in the same slot.
  const draft = restarting ? null : mine;
  const canWithdraw = mine && mine.status !== 'withdrawn' && event?.phase !== 'results_published';

  return (
    <div className="stack-lg">
      <PageHeading eyebrow="from idea to internet" title={restarting ? 'Start a new project' : mine ? 'Your project' : 'What have you been making?'} art="step-signup">
        <p>One submission per participant. Save drafts as often as you like; submit before the deadline.</p>
      </PageHeading>
      <div className="notice deadline-notice" data-reveal>
        {open ? 'Submissions are open. Organizers will announce when they close.' : 'Organizers open and close submissions on the day.'}
      </div>
      <Journey s={draft}/>

      <div className="detail-grid">
        <div className="stack">
          {editable ? (
            <Window title={draft ? 'edit_project.exe' : 'new_project.exe'} reveal>
              <ActionForm action={saveSubmissionAction} hideButton>
                <Field label="Project title" name="title" value={draft?.title} maxLength={100} required/>
                <Select label="Category" name="category" value={draft?.category ?? 'website'} options={CATEGORIES.map(c => ({value: c, label: c}))}/>
                <TextArea label="What did you build, and how? (20–4000 characters)" name="description" value={draft?.description ?? ''} maxLength={4000} rows={7} required/>
                <div className="field-pair">
                  <Field label="Live demo (HTTPS)" name="demo_url" type="url" value={draft?.demo_url ?? ''} placeholder="https://…" hint="Required to submit."/>
                  <Field label="Repository (GitHub, GitLab, Codeberg, Bitbucket)" name="repository_url" type="url" value={draft?.repository_url ?? ''} placeholder="https://github.com/…" hint="Required to submit."/>
                </div>
                <div className="button-row sticky-actions">
                  <SubmitButton variant="secondary" name="intent" value="draft">Save draft</SubmitButton>
                  <SubmitButton variant="coral" name="intent" value="submit">{draft?.status === 'submitted' ? 'Save changes' : 'Submit project →'}</SubmitButton>
                </div>
              </ActionForm>
            </Window>
          ) : mine ? (
            <Window title="project.txt" reveal>
              <h2>{mine.title}</h2>
              <p className="prose">{mine.description}</p>
              <ExternalLinks demo={mine.demo_url} repo={mine.repository_url}/>
            </Window>
          ) : (
            event?.phase === 'setup' ? (
              <Window title="opening_soon.exe" tone="yellow" reveal>
                <h2>Submissions open when the bash starts.</h2>
                <p>An organizer opens the submission form when the bash starts. It appears right here.</p>
                <h3>Have these ready</h3>
                <ul className="ready-list">
                  <li>A project title and a short description of what you built</li>
                  <li>A live demo link (HTTPS)</li>
                  <li>A public repository on GitHub, GitLab, Codeberg or Bitbucket</li>
                  <li>A cover image (PNG, JPEG or WebP, up to 5 MB)</li>
                </ul>
              </Window>
            ) : (
              <Window title="closed.txt" tone="pink" reveal>
                <h2>Submissions are closed.</h2>
                <p>The submission window has ended for this edition.</p>
                <Link className="button secondary" href="/projects">Browse the project wall</Link>
              </Window>
            )
          )}
        </div>

        <aside className="stack detail-aside">
          {mine && (
            <Window title="status.exe" tone="yellow" reveal>
              <p className="badge-row"><Badge status={mine.status}/>{mine.shortlist_status !== 'pending' && <Badge status={mine.shortlist_status}/>}</p>
              {mine.status === 'submitted' && <p>Submitted {formatDate(mine.submitted_at, tz)}. You can still edit until submissions close.</p>}
              {mine.status === 'draft' && <p>Only you can see this draft. Add both links, then submit.</p>}
              {mine.status === 'eligible' && <p>Confirmed eligible. Volunteers are on it.</p>}
              {mine.status === 'ineligible' && <p>Marked ineligible{mine.eligibility_reason ? `: ${mine.eligibility_reason}` : '.'} Talk to an organizer if you think this is wrong.</p>}
              {mine.status === 'withdrawn' && <p>You withdrew <strong>{mine.title}</strong>.{restarting ? ' Your slot is free again: start a new project before the deadline.' : ''}</p>}
            </Window>
          )}
          {editable && !draft && (
            <Window title="cover.png" reveal>
              <div className="cover-locked">
                <span className="task-icon"><Icon name="upload"/></span>
                <p><strong>Add a cover image</strong><br/>Save your draft first, then upload the cover here.</p>
              </div>
            </Window>
          )}
          {!draft && editable && (
            <Window title="cover.png" reveal>
              <div className="cover-locked"><Icon name="upload"/><p>Save your draft first (title and description), then you can add a cover image here.</p></div>
            </Window>
          )}
          {draft && (
            <Window title="cover.png" reveal>
              {editable ? <CoverUpload id={draft.id} current={draft.cover ?? null} title={draft.title}/>
                : <div className="cover-preview"><Cover id={draft.id} src={draft.cover} title={draft.title}/></div>}
              {!editable && <small className="muted">Covers lock with the submission.</small>}
            </Window>
          )}
          {canWithdraw && (
            <div className="danger-zone" data-reveal>
              <p className="small">Want to swap projects or pull out? Withdrawing removes this project from review and voting.</p>
              <ConfirmAction action={withdrawAction} label="Withdraw project" title="withdraw.exe" variant="danger" phrase="WITHDRAW"
                fields={<TextArea name="reason" label="Reason (optional, shared with organizers)" maxLength={500} rows={2}/>}>
                <p>This withdraws <strong>{mine.title}</strong> from review and voting. {open ? 'While submissions are open you can start a new project afterwards.' : 'Submissions are closed, so this is final.'}</p>
              </ConfirmAction>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
