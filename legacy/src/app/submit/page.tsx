import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser,getEvent,getCategories,decorateProjects,formatDate} from '@/lib/data';
import {PageHeading,Empty} from '@/components/ui';
import {ProjectEditor} from '@/components/project-editor';
import {idSchema} from '@/lib/validation';
export default async function Submit({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const s=await requireUser('/submit');const p=await searchParams;const [event,categories]=await Promise.all([getEvent(),getCategories()]);let project;
 if(p.id){if(!idSchema.safeParse(p.id).success)notFound();const {data,error}=await s.db.from('projects').select('*').eq('id',p.id).eq('owner_id',s.user.id).maybeSingle();if(error)throw new Error('Draft could not be loaded');if(!data)notFound();[project]=await decorateProjects([data]);}
 const editable=!project||(project.event_id===event?.id&&['draft','rejected'].includes(project.status));const open=event?.submission_deadline&&Date.now()<Date.parse(event.submission_deadline);
 return <div className="page-shell"><PageHeading eyebrow="from idea to internet" title={project?'Keep making it yours.':'What have you been making?'}><p>Save a draft, add screenshots, then send your creation for review.</p></PageHeading><div className="notice">Submission deadline: {formatDate(event?.submission_deadline,event?.timezone)}</div>{!open?<Empty title="Submissions aren’t open right now."><p>The organisers will announce the next submission window.</p><Link className="button" href="/dashboard">Back to dashboard</Link></Empty>:!editable?<Empty title="This project is locked for review."><p>Pending and published projects cannot be edited. Contact the organisers if you need a correction.</p><Link className="button" href="/dashboard">Back to dashboard</Link></Empty>:<div style={{maxWidth:780,margin:'auto'}}><ProjectEditor key={project?.id??'new'} project={project} categories={categories}/></div>}</div>;
}
