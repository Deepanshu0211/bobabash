// Integration tests only against a disposable, local Supabase database.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const connectionString=process.env.TEST_DATABASE_URL;
if(!connectionString){console.error('NOT RUN: set TEST_DATABASE_URL to a disposable local Supabase database with schema.sql applied.');process.exit(2);}
const url=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){console.error('Refusing non-local database. These tests create and remove fixtures.');process.exit(2);}
const {default:pg}=await import('pg');
const pool=new pg.Pool({connectionString,max:12});
const uid=randomUUID(),owner=randomUUID(),admin=randomUUID(),eventId=randomUUID();
const projectIds=Array.from({length:5},()=>randomUUID());
let previous=[];let passed=0;
async function asUser(id,sql,args=[]){const c=await pool.connect();try{await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);const result=await c.query(sql,args);await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
async function expectReject(label,fn,pattern){await assert.rejects(fn,pattern);console.log('PASS',label);passed++;}
async function pass(label,fn){await fn();console.log('PASS',label);passed++;}
try{
 previous=(await pool.query('select id from public.event_settings where is_current')).rows;
 await pool.query('update public.event_settings set is_current=false where is_current');
 await pool.query("insert into public.event_settings(id,name,is_current,submission_deadline,voting_enabled,voting_starts_at,voting_ends_at) values($1,'TEST ONLY',true,now()+interval '1 day',true,now()-interval '1 day',now()+interval '1 day')",[eventId]);
 for(const id of [uid,owner,admin])await pool.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"role\":\"admin\"}')",[id,`${id}@example.test`]);
 await pass('signup provisions a regular profile despite malicious metadata',async()=>assert.equal((await pool.query('select role from public.profiles where id=$1',[uid])).rows[0].role,'user'));
 await pool.query("update public.profiles set role='admin' where id=$1",[admin]);
 for(let i=0;i<projectIds.length;i++)await pool.query("insert into public.projects(id,event_id,owner_id,title,slug,short_description,description,status) values($1,$2,$3,'Test project',$4,'A test description','A test project description with enough content','published')",[projectIds[i],eventId,owner,`test-${projectIds[i]}`]);
 const vote=i=>asUser(uid,'select public.cast_vote($1,false)',[projectIds[i]]);
 await pass('first, second and third votes succeed',async()=>{for(let i=0;i<3;i++)assert.equal((await vote(i)).rows[0].cast_vote,2-i);});
 await expectReject('fourth vote rejected',()=>vote(3),/No votes remaining/);
 await expectReject('duplicate vote rejected',()=>vote(0),/already voted/);
 await expectReject('self vote rejected',()=>asUser(owner,'select public.cast_vote($1,false)',[projectIds[0]]),/own project/);
 await expectReject('direct vote writes denied',()=>asUser(uid,'insert into public.votes(event_id,voter_id,project_id) values($1,$2,$3)',[eventId,uid,projectIds[4]]),/permission denied|row-level security/);
 await expectReject('unauthorised deletion denied',()=>asUser(owner,'delete from public.votes where voter_id=$1',[uid]),/permission denied|row-level security/);
 await expectReject('cannot remove somebody else’s vote via RPC',()=>asUser(owner,'select public.cast_vote($1,true)',[projectIds[0]]),/not voted/);
 await expectReject('role promotion denied',()=>asUser(uid,"update public.profiles set role='admin' where id=$1",[uid]),/permission denied|row-level security/);
 await expectReject('self-publishing denied',()=>asUser(uid,"update public.projects set status='published' where id=$1",[projectIds[0]]),/permission denied|row-level security/);
 await expectReject('editing another user’s project denied',()=>asUser(uid,"select public.save_project('{}'::jsonb,$1)",[projectIds[0]]),/cannot be edited/);
 await expectReject('editing moderated project denied',()=>asUser(owner,"select public.save_project('{}'::jsonb,$1)",[projectIds[0]]),/cannot be edited/);
 await expectReject('admin operation denied to regular user',()=>asUser(uid,"select public.admin_action('moderate',$1,'{\"status\":\"rejected\"}'::jsonb)",[projectIds[0]]),/Administrator access/);
 await expectReject('audit mutations denied',()=>asUser(uid,'delete from public.audit_logs'),/permission denied|row-level security/);
 await pool.query('update public.event_settings set vote_changes_enabled=false where id=$1',[eventId]);
 await expectReject('vote changes disabled',()=>asUser(uid,'select public.cast_vote($1,true)',[projectIds[0]]),/changes are disabled/);
 await pool.query('update public.event_settings set vote_changes_enabled=true where id=$1',[eventId]);
 await pass('removal frees a slot',async()=>assert.equal((await asUser(uid,'select public.cast_vote($1,true)',[projectIds[0]])).rows[0].cast_vote,1));
 await pool.query('delete from public.votes where event_id=$1',[eventId]);
 await pass('concurrent requests cannot exceed quota',async()=>{const results=await Promise.allSettled(projectIds.map((_,i)=>vote(i)));assert.equal(results.filter(r=>r.status==='fulfilled').length,3);assert.equal(Number((await pool.query('select count(*) from public.votes where voter_id=$1 and event_id=$2',[uid,eventId])).rows[0].count),3);});
 await pool.query('update public.event_settings set voting_enabled=false where id=$1',[eventId]);
 await expectReject('disabled voting rejected',()=>vote(4),/Voting is closed/);
 await pool.query("update public.event_settings set voting_enabled=true,voting_ends_at=now()-interval '1 hour' where id=$1",[eventId]);
 await expectReject('deadline enforced',()=>vote(4),/Voting is closed/);
 await pool.query("update public.event_settings set voting_ends_at=now()+interval '1 day' where id=$1",[eventId]);
 await pass('admin moderation succeeds and is audited',async()=>{await asUser(admin,"select public.admin_action('moderate',$1,'{\"status\":\"rejected\"}'::jsonb)",[projectIds[4]]);assert.equal((await pool.query('select status from public.projects where id=$1',[projectIds[4]])).rows[0].status,'rejected');assert.ok((await pool.query("select id from public.audit_logs where target_id=$1 and action='moderate'",[projectIds[4]])).rows.length);});
 await expectReject('unpublished project cannot receive votes',()=>asUser(admin,'select public.cast_vote($1,false)',[projectIds[4]]),/not eligible/);
 await pass('public aggregate has no voter IDs',async()=>{const r=await pool.query('select * from public.project_totals() limit 1');assert.deepEqual(r.fields.map(f=>f.name),['project_id','vote_count']);});
 console.log(`${passed} integration cases passed.`);
}finally{
 await pool.query('delete from public.projects where event_id=$1',[eventId]);
 await pool.query('delete from public.audit_logs where actor_id=any($1::uuid[]) or target_id=$2',[ [uid,owner,admin],eventId]);
 await pool.query('delete from auth.users where id=any($1::uuid[])',[[uid,owner,admin]]);
 await pool.query('delete from public.event_settings where id=$1',[eventId]);
 for(const row of previous)await pool.query('update public.event_settings set is_current=true where id=$1',[row.id]);
 await pool.end();
}
