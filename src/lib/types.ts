export type Role = 'participant' | 'reviewer' | 'organizer';
export type Phase = 'setup' | 'submissions' | 'review' | 'shortlist_frozen' | 'voting' | 'closed' | 'results_published';
export type SubmissionStatus = 'draft' | 'submitted' | 'eligible' | 'ineligible' | 'withdrawn';
export type ShortlistStatus = 'pending' | 'shortlisted' | 'not_shortlisted';
export type Recommendation = 'shortlist' | 'reject' | 'flag';
export type AwardType = 'creative' | 'best_github';

export type EventSettings = {
  name: string; timezone: string; phase: Phase;
  starts_at: string | null; ends_at: string | null;
  submission_deadline: string | null; review_deadline: string | null;
  voting_open_at: string | null; voting_close_at: string | null;
  max_selections: number; show_creator_names: boolean;
  venue_name: string | null; venue_address: string | null; announcement: string | null;
  shortlist_finalized_at: string | null; results_published_at: string | null; updated_at: string;
};
export type Participant = {id: string; email: string; display_name: string; active: boolean; user_id: string | null};
export type Submission = {
  id: string; participant_id: string; title: string; description: string;
  demo_url: string | null; repository_url: string | null; category: string; cover_image_path: string | null;
  status: SubmissionStatus; shortlist_status: ShortlistStatus; eligibility_reason: string | null;
  resolution: ShortlistStatus | null; resolution_reason: string | null;
  submitted_at: string | null; updated_at: string; cover?: string | null;
  participants?: {display_name: string; email: string} | null;
};
export type WallProject = {
  id: string; title: string; description: string; demo_url: string | null; repository_url: string | null;
  category: string; cover_image_path: string | null; creator_name: string | null;
  status: 'submitted' | 'eligible' | 'ineligible'; is_shortlisted: boolean; is_mine: boolean;
  standing: number | null; prizes: AwardType[] | null; cover?: string | null;
};
export type WallView = 'all' | 'eligible' | 'shortlisted' | 'winners';
export type Review = {id: string; recommendation: Recommendation; criteria: Record<string, number>; note: string; revision: number; submitted_at: string};
export type Assignment = {
  id: string; submission_id: string; reviewer_id: string; status: 'assigned' | 'in_progress' | 'completed'; assigned_at: string;
  submissions: Submission | null; reviews: Review | null;
};
export type TallyRow = {
  submission_id: string; title: string; assigned: number; completed: number;
  shortlist_votes: number; reject_votes: number; flag_votes: number;
  outcome: 'pending' | 'flagged' | 'pass' | 'fail'; resolution: ShortlistStatus | null; resolution_reason: string | null;
  shortlist_status: ShortlistStatus;
};
export type ResultRow = {submission_id: string; title: string; creator_name: string | null; votes: number; standing: number};
export type Award = {award_type: AwardType; submission_id: string; judged_by: string; rationale: string; published_at: string | null; submissions?: {title: string} | null};
export type Decision = {id: string; position: number; tied_submission_ids: string[]; winner_submission_id: string | null; shared: boolean; rationale: string; created_at: string};
export type Staff = {user_id: string | null; email: string; display_name: string; role: Role; joined: boolean; assigned: number; completed: number};
export type BallotRow = {id: string; status: 'valid' | 'invalidated'; submitted_at: string; invalidated_reason: string | null; participants: {display_name: string; email: string} | null;
  ballot_selections?: {submission_id: string; submissions: {title: string} | null}[]};
export type AuditRow = {id: number; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown>; created_at: string};
export type Receipt = {ballot_id: string; submitted_at: string; status: 'valid' | 'invalidated'; selections: {id: string; title: string}[]};
export type VotingStatus = {eligible: boolean; reason: 'ok' | 'already_voted' | 'voting_closed' | 'not_participant'; has_ballot: boolean};
export type Overview = {
  participants: number; linked: number; submissions: Partial<Record<SubmissionStatus, number>>;
  assignments: number; completed_reviews: number; reviewers: number; shortlisted: number; ballots: number; invalidated_ballots: number;
};
export type ActionState = {ok?: boolean; message: string; id?: string; needCode?: boolean};
