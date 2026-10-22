import 'server-only';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import {serverClient} from './supabase/server';
import {configured} from './supabase/config';
import type {EventSettings,Profile,Project,Category,Vote} from './types';
export const getSession=cache(async()=>{
 if(!configured)return null;
 const db=await serverClient(); const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return null;
 const {data:profile,error:pe}=await db.from('profiles').select('*').eq('id',user.id).single();
 if(pe)throw new Error('Your profile could not be loaded. Please try signing in again.');
 return {db,user,profile:profile as Profile};
});
export async function requireUser(next='/dashboard'){const session=await getSession();if(!session)redirect('/auth?next='+encodeURIComponent(next));return session;}
export async function requireAdmin(){const s=await requireUser('/admin');if(s.profile.role!=='admin')redirect('/dashboard');return s;}
export const getEvent=cache(async():Promise<EventSettings|null>=>{if(!configured)return null;const db=await serverClient();const {data,error}=await db.from('event_settings').select('*').eq('is_current',true).maybeSingle();if(error)throw new Error('Event details could not be loaded.');return data;});
export const getCategories=cache(async():Promise<Category[]>=>{if(!configured)return [];const db=await serverClient();const {data,error}=await db.from('categories').select('*').order('name');if(error)throw new Error('Categories could not be loaded.');return data??[];});
export async function decorateProjects(projects:Project[]):Promise<Project[]>{
 if(!projects.length)return [];const db=await serverClient();
 const [{data:profiles,error},categories]=await Promise.all([db.from('profiles').select('*').in('id',[...new Set(projects.map(p=>p.owner_id))]),getCategories()]);
 if(error)throw new Error('Creators could not be loaded.');
 const paths=projects.flatMap(p=>p.cover_image_path?[p.cover_image_path]:[]);
 const {data:urls}=paths.length?await db.storage.from('project-images').createSignedUrls(paths,600):{data:[]};
 return projects.map(p=>({...p,creator:profiles?.find(c=>c.id===p.owner_id),category:categories.find(c=>c.id===p.category_id),cover:urls?.find(u=>u.path===p.cover_image_path)?.signedUrl}));
}
export async function discover({search='',category='',sort='newest',page=1,owner}:{search?:string;category?:string;sort?:string;page?:number;owner?:string}={}){
 if(!configured)return {projects:[],count:0};const db=await serverClient();const event=await getEvent();
 if(!event)return {projects:[],count:0};
 let query=db.from('project_directory').select('*',{count:'exact'}).eq('status','published').eq('event_id',event.id);
 if(search)query=query.ilike('title','%'+search.replace(/[%_\\]/g,'').slice(0,100)+'%');
 if(category)query=query.eq('category_id',category);if(owner)query=query.eq('owner_id',owner);
 if(sort==='votes')query=query.order('vote_count',{ascending:false}).order('published_at',{ascending:true});
 else query=query.order('created_at',{ascending:false});
 const {data,error,count}=await query.order('id').range((page-1)*12,page*12-1);if(error)throw new Error('Projects could not be loaded. Please try again.');
 return {projects:await decorateProjects(data??[]),count:count??0};
}
export async function getVotes():Promise<Vote[]>{const s=await getSession();const event=await getEvent();if(!s||!event)return [];const {data,error}=await s.db.from('votes').select('id,project_id,event_id').eq('voter_id',s.user.id).eq('event_id',event.id);if(error)throw new Error('Your votes could not be loaded.');return data??[];}
export function formatDate(value:string|null|undefined,timezone='Asia/Kolkata'){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:timezone}).format(new Date(value)):'To be announced';}
