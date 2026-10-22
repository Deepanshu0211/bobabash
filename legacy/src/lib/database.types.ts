// Hand-maintained schema contract. Regenerate against the applied Supabase schema
// using the documented CLI command before production deployment.
import type {Profile,Category,EventSettings,Project} from './types';
export type Json=string|number|boolean|null|{[key:string]:Json|undefined}|Json[];
type Relation<Name extends string,Columns extends string[],Target extends string,TargetColumns extends string[]>={foreignKeyName:Name;columns:Columns;isOneToOne:false;referencedRelation:Target;referencedColumns:TargetColumns};
type Table<Row,Relationships extends {foreignKeyName:string;columns:string[];isOneToOne:boolean;referencedRelation:string;referencedColumns:string[]}[]=[]>={Row:Row;Insert:Partial<Row>;Update:Partial<Row>;Relationships:Relationships};
type ProjectRow=Omit<Project,'cover'|'creator'|'category'|'vote_count'>&{updated_at:string};
type EventRow=EventSettings&{is_current:boolean;created_at:string;updated_at:string};
type ProfileRow=Profile&{created_at:string;updated_at:string};
type ImageRow={id:string;project_id:string;storage_path:string;alt_text:string;sort_order:number;created_at:string};
type FeedbackRow={id:string;project_id:string;author_id:string;message:string;status:'visible'|'hidden';created_at:string;updated_at:string};
type AwardRow={id:string;name:string;description:string;project_id:string;created_by:string|null;awarded_at:string};
export type Database={public:{
 Tables:{
  profiles:Table<ProfileRow>;
  categories:Table<Category&{created_at:string}>;
  event_settings:Table<EventRow>;
  projects:Table<ProjectRow,[Relation<'projects_owner_id_fkey',['owner_id'],'profiles',['id']>,Relation<'projects_category_id_fkey',['category_id'],'categories',['id']>,Relation<'projects_event_id_fkey',['event_id'],'event_settings',['id']>]>;
  project_images:Table<ImageRow,[Relation<'project_images_project_id_fkey',['project_id'],'projects',['id']>]>;
  votes:Table<{id:string;event_id:string;voter_id:string;project_id:string;created_at:string}>;
  feedback:Table<FeedbackRow,[Relation<'feedback_author_id_fkey',['author_id'],'profiles',['id']>,Relation<'feedback_project_id_fkey',['project_id'],'projects',['id']>]>;
  reports:Table<{id:string;reporter_id:string;project_id:string|null;feedback_id:string|null;reason:string;status:'open'|'resolved'|'dismissed';created_at:string;updated_at:string}>;
  awards:Table<AwardRow,[Relation<'awards_project_id_fkey',['project_id'],'projects',['id']>]>;
  audit_logs:Table<{id:string;actor_id:string|null;action:string;target_id:string|null;details:Json;created_at:string}>;
 };
 Views:{project_directory:{Row:ProjectRow&{vote_count:number};Relationships:[]}};
 Functions:{
  project_totals:{Args:Record<string,never>;Returns:{project_id:string;vote_count:number}[]};
  save_profile:{Args:{payload:Json};Returns:undefined};
  save_project:{Args:{payload:Json;project_id?:string|null};Returns:string};
  attach_image:{Args:{project_id:string;object_path:string;alt:string;is_cover?:boolean};Returns:undefined};
  delete_project:{Args:{project_id:string};Returns:undefined};
  cast_vote:{Args:{project_id:string;remove_vote?:boolean};Returns:number};
  add_feedback:{Args:{project_id:string;message:string};Returns:undefined};
  delete_feedback:{Args:{feedback_id:string};Returns:undefined};
  report_content:{Args:{target_id:string;target_type:string;reason:string};Returns:undefined};
  admin_action:{Args:{operation:string;target_id:string|null;payload:Json};Returns:undefined};
 };
 Enums:Record<string,never>;CompositeTypes:Record<string,never>;
}};
