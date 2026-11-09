import type { Goal, Person, Weights } from "./domain";
export type Profile = {
  id: string;
  display_name: string;
  headline: string;
  region: string;
  skills: string[];
  linkedin_url: string;
  onboarding_complete: boolean;
};
export type Consent = {
  id: string;
  purpose: string;
  channel: string;
  granted: boolean;
  created_at: string;
  policy_version: string;
};
export type Draft = {
  id: string;
  goal_id: string;
  directory_id: string;
  template_id: string;
  body: string;
  reviewed_at: string | null;
};
export type Lead = {
  id: string;
  goal_id: string;
  directory_id: string;
  draft_id: string | null;
  pipeline: string;
  stage: string;
  notes: string;
};
export type Template = {
  id: string;
  template_key: string;
  version: number;
  title: string;
  body: string;
  approved: boolean;
};
export type Identity = {
  id: string;
  owner_id: string;
  provider: string;
  status: string;
  reference: string;
};
export type Privacy = {
  id: string;
  owner_id: string;
  kind: string;
  status: string;
  created_at: string;
};
export type Audit = {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
};
export type Filters = { industry: string; region: string; saved: boolean };
export type Match = Person & {
  score: number;
  reasons: string[];
  goal_id: string;
  goal_title: string;
};
export type WorkspaceData = {
  user: { id: string; email: string };
  roles: string[];
  profile: Profile | null;
  goals: Goal[];
  consents: Consent[];
  identity: Identity[];
  directory: Person[];
  templates: Template[];
  feedback: { goal_id: string; directory_id: string; status: string }[];
  drafts: Draft[];
  leads: Lead[];
  searches: { id: string; label: string; filters: Filters }[];
  matches: Match[];
  privacy: Privacy[];
  audit: Audit[];
  weights: Weights;
  admin: null | {
    users: Profile[];
    roles: { user_id: string; role: string }[];
    checks: Identity[];
    requests: Privacy[];
    audit: Audit[];
    templates: Template[];
    weights: Weights;
  };
};
export type Run = (action: string, data: unknown) => Promise<boolean>;
