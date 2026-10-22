import Link from 'next/link';
import {castVote} from '@/app/actions';
import {ActionForm} from './form';
import type {EventSettings,Project} from '@/lib/types';
export function VoteSlots({max,used}:{max:number;used:number}){return <div className="vote-slots"><div aria-hidden="true">{Array.from({length:max},(_,i)=><span key={i} className={i<used?'used':''}>●</span>)}</div><strong>{Math.max(0,max-used)} of {max} votes left</strong><small>One vote per project. Make them count.</small></div>;}
export function VoteButton({project,event,userId,selected=false,used=0}:{project:Project;event:EventSettings|null;userId?:string;selected?:boolean;used?:number}){
 if(!userId)return <Link className="button secondary" href={'/auth?next='+encodeURIComponent('/projects/'+project.slug)}>Sign in to vote</Link>;
 if(userId===project.owner_id)return <span className="muted">Your creation</span>;
 const open=event?.voting_enabled&&!event.results_published&&event.voting_starts_at&&event.voting_ends_at&&Date.now()>=Date.parse(event.voting_starts_at)&&Date.now()<Date.parse(event.voting_ends_at);
 if(!open)return <span className="muted">Voting is closed</span>;
 if(selected&&!event?.vote_changes_enabled)return <span className="badge">Your vote is locked in</span>;
 if(!selected&&used>=(event?.max_votes??3))return <span className="muted">All your votes are placed</span>;
 return <ActionForm action={castVote} label={selected?'Remove vote':'♡ Vote for this project'}><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="remove" value={String(selected)}/></ActionForm>;
}
