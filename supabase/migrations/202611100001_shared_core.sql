-- Phase 1: additive shared-core schema. Apply to a development Supabase project.
-- No application tables outside the nc_ namespace are altered.
begin;
create schema if not exists nc_private;
revoke all on schema nc_private from public;
grant usage on schema nc_private to authenticated;

create table public.nc_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 headline text not null default '' check(length(headline)<=240),
 region text not null default '' check(length(region)<=100),
 skills text[] not null default '{}' check(cardinality(skills)<=30),
 linkedin_url text not null default '' check(length(linkedin_url)<=300 and (linkedin_url='' or linkedin_url ~ '^https://(www\.)?linkedin\.com/in/[A-Za-z0-9_-]+/?$')),
 onboarding_complete boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nc_roles (
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('MEMBER','RECRUITER','SELLER','AGENT','PARTNER_COMPANY','ORGANIZER','ADMIN','SUPER_ADMIN')),
 primary key(user_id,role)
);
create function nc_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nc_roles where user_id=auth.uid() and role in ('ADMIN','SUPER_ADMIN'))
$$;
create function nc_private.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nc_roles where user_id=auth.uid() and role='SUPER_ADMIN')
$$;
create table public.nc_goals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 industry text not null check(industry in ('talent','business','real-estate','yachts-aviation','vehicles','events','marketing')),
 intent text not null check(intent in ('hire','work','buy','sell','partner','attend','organize','promote')),
 target_intent text not null check(target_intent in ('hire','work','buy','sell','partner','attend','organize','promote')),
 title text not null check(length(title) between 3 and 160), region text not null default '' check(length(region)<=100),
 skills text[] not null default '{}' check(cardinality(skills)<=30), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nc_identity_checks (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('DEMO','BLOCKED')), status text not null check(status in ('DEMO_PASSED','PENDING','REJECTED')),
 reference text not null check(length(reference)<=100), created_at timestamptz not null default now()
);
create table public.nc_consents (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null check(purpose in ('matching','contact-sharing','marketing')),
 channel text not null check(channel in ('platform','email','sms','whatsapp')),
 granted boolean not null, method text not null default 'settings-form' check(method='settings-form'),
 policy_version text not null default '2026-11-v1' check(policy_version='2026-11-v1'),
 created_at timestamptz not null default now()
);
create table public.nc_directory (
 id uuid primary key default gen_random_uuid(), name text not null, headline text not null,
 industry text not null, intent text not null, region text not null, skills text[] not null default '{}',
 available boolean not null default true, opted_in boolean not null default true,
 is_demo boolean not null default true check(is_demo), created_at timestamptz not null default now()
);
create table public.nc_match_feedback (
 owner_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null references public.nc_goals(id) on delete cascade,
 directory_id uuid not null references public.nc_directory(id) on delete cascade,
 status text not null check(status in ('SAVED','DISMISSED')), created_at timestamptz not null default now(),
 primary key(owner_id,goal_id,directory_id)
);
create table public.nc_saved_searches (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(label) between 1 and 100), filters jsonb not null default '{}' check(jsonb_typeof(filters)='object'),
 created_at timestamptz not null default now()
);
create table public.nc_templates (
 id uuid primary key default gen_random_uuid(), template_key text not null check(length(template_key)<=100),
 version int not null check(version>0), title text not null check(length(title) between 1 and 100),
 body text not null check(length(body) between 10 and 3000), purpose text not null default 'networking' check(purpose='networking'),
 channel text not null default 'manual-social' check(channel='manual-social'), approved boolean not null default false,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(template_key,version)
);
create table public.nc_drafts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null references public.nc_goals(id) on delete cascade,
 directory_id uuid not null references public.nc_directory(id), template_id uuid not null references public.nc_templates(id),
 body text not null check(length(body) between 10 and 3000), reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nc_leads (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null references public.nc_goals(id) on delete cascade,
 directory_id uuid not null references public.nc_directory(id), draft_id uuid references public.nc_drafts(id) on delete set null,
 pipeline text not null check(pipeline in ('PERSONAL','B2B','RECRUITMENT')),
 stage text not null default 'SUGGESTED' check(stage in ('SUGGESTED','DRAFTED','SENT','ACCEPTED','REPLIED','QUALIFIED','CLOSED_WON','CLOSED_LOST')),
 notes text not null default '' check(length(notes)<=3000), is_demo boolean not null default true check(is_demo),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,goal_id,directory_id)
);
create table public.nc_privacy_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('EXPORT','DELETE')), status text not null default 'PENDING' check(status in ('PENDING','IN_REVIEW','FULFILLED')),
 created_at timestamptz not null default now()
);
create table public.nc_matching_rules (
 id int primary key check(id=1), weights jsonb not null check(jsonb_typeof(weights)='object'), updated_at timestamptz not null default now()
);
create table public.nc_audit (
 id bigint generated always as identity primary key, actor_id uuid, action text not null,
 entity text not null, entity_id text not null, created_at timestamptz not null default now()
);
create index nc_goals_owner on public.nc_goals(owner_id);
create index nc_consents_latest on public.nc_consents(owner_id,purpose,channel,created_at desc,id desc);
create index nc_identity_owner on public.nc_identity_checks(owner_id,created_at desc);
create index nc_drafts_owner on public.nc_drafts(owner_id);
create index nc_leads_owner on public.nc_leads(owner_id,pipeline);
create index nc_privacy_owner on public.nc_privacy_requests(owner_id);
create index nc_search_owner on public.nc_saved_searches(owner_id);
create index nc_audit_actor on public.nc_audit(actor_id,created_at desc);

create function nc_private.consent_ok(subject uuid, wanted_purpose text, wanted_channel text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select granted from public.nc_consents where owner_id=subject and purpose=wanted_purpose and channel=wanted_channel order by created_at desc,id desc limit 1),false)
$$;
create function nc_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.nc_audit(actor_id,action,entity,entity_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id',to_jsonb(old)->>'id','record'));
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create function nc_private.touch() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create function nc_private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.nc_profiles(id) values(new.id);
 insert into public.nc_roles(user_id,role) values(new.id,'MEMBER');
 return new;
end $$;
create trigger nc_create_profile after insert on auth.users for each row execute function nc_private.new_user();
-- Backfill existing Auth users without changing their records.
insert into public.nc_profiles(id) select id from auth.users on conflict do nothing;
insert into public.nc_roles(user_id,role) select id,'MEMBER' from auth.users on conflict do nothing;

-- All ownership relations are checked in the database, even for direct API clients.
create function nc_private.guard_relations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.nc_goals where id=new.goal_id and owner_id=new.owner_id) then raise exception 'Goal ownership required'; end if;
 if TG_TABLE_NAME in ('nc_drafts','nc_leads') and not exists(select 1 from public.nc_directory where id=new.directory_id and opted_in) then raise exception 'Recipient opted out'; end if;
 if TG_TABLE_NAME='nc_drafts' then
  if not nc_private.consent_ok(new.owner_id,'matching','platform') then raise exception 'Matching consent required'; end if;
  if not exists(select 1 from public.nc_templates where id=new.template_id and approved) then raise exception 'Approved template required'; end if;
  if TG_OP='INSERT' then new.reviewed_at=null;
  elsif (new.body,new.goal_id,new.directory_id,new.template_id) is distinct from (old.body,old.goal_id,old.directory_id,old.template_id) then new.reviewed_at=null;
  elsif new.reviewed_at is distinct from old.reviewed_at and new.reviewed_at is not null then new.reviewed_at=now(); end if;
 end if;
 if TG_TABLE_NAME='nc_leads' then
 if new.draft_id is not null then
  if not exists(select 1 from public.nc_drafts where id=new.draft_id and owner_id=new.owner_id and goal_id=new.goal_id and directory_id=new.directory_id) then raise exception 'Draft ownership required'; end if;
 end if;
 if new.stage in ('SENT','ACCEPTED','REPLIED','QUALIFIED','CLOSED_WON') then
  if not nc_private.consent_ok(new.owner_id,'matching','platform') then raise exception 'Matching consent required'; end if;
  if not exists(select 1 from public.nc_drafts where id=new.draft_id and owner_id=new.owner_id and reviewed_at is not null) then raise exception 'Human-reviewed draft required'; end if;
 end if;
 end if;
 return new;
end $$;
create trigger nc_guard_feedback before insert or update on public.nc_match_feedback for each row execute function nc_private.guard_relations();
create trigger nc_guard_drafts before insert or update on public.nc_drafts for each row execute function nc_private.guard_relations();
create trigger nc_guard_leads before insert or update on public.nc_leads for each row execute function nc_private.guard_relations();

-- Immutable consent, template versions, identity outcomes and audit history: no update/delete grants.
-- Identity demo results are generated only by this narrow RPC, never supplied by the browser.
create function public.nc_demo_identity() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.nc_identity_checks(owner_id,provider,status,reference) values(auth.uid(),'DEMO','DEMO_PASSED','demo-'||gen_random_uuid()) returning id into result;
 return result;
end $$;
create function public.nc_assign_role(subject uuid, wanted_role text, remove_role boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not nc_private.is_super_admin() then raise exception 'Super admin required'; end if;
 if wanted_role='SUPER_ADMIN' then raise exception 'Super-admin bootstrap is operator-managed'; end if;
 if remove_role then delete from public.nc_roles where user_id=subject and role=wanted_role and role<>'MEMBER';
 else insert into public.nc_roles(user_id,role) values(subject,wanted_role) on conflict do nothing; end if;
end $$;
revoke all on function public.nc_demo_identity() from public,anon;
revoke all on function public.nc_assign_role(uuid,text,boolean) from public,anon;
grant execute on function public.nc_demo_identity(),public.nc_assign_role(uuid,text,boolean) to authenticated;
revoke all on all functions in schema nc_private from public,anon,authenticated;
grant execute on function nc_private.is_admin(),nc_private.is_super_admin() to authenticated;

-- RLS: no anonymous table access; all personal records remain owner scoped.
do $$ declare t text; begin
 foreach t in array array['nc_profiles','nc_roles','nc_goals','nc_identity_checks','nc_consents','nc_directory','nc_match_feedback','nc_saved_searches','nc_templates','nc_drafts','nc_leads','nc_privacy_requests','nc_matching_rules','nc_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
 foreach t in array array['nc_profiles','nc_goals','nc_consents','nc_identity_checks','nc_leads','nc_drafts','nc_privacy_requests','nc_roles','nc_templates','nc_matching_rules'] loop
  execute format('create trigger nc_audit_change after insert or update or delete on public.%I for each row execute function nc_private.audit_change()',t);
 end loop;
 foreach t in array array['nc_profiles','nc_goals','nc_drafts','nc_leads','nc_matching_rules'] loop
  execute format('create trigger nc_touch before update on public.%I for each row execute function nc_private.touch()',t);
 end loop;
end $$;
grant select,update on public.nc_profiles to authenticated;
create policy nc_profiles_read on public.nc_profiles for select to authenticated using(id=auth.uid() or nc_private.is_admin());
create policy nc_profiles_update on public.nc_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select on public.nc_roles to authenticated;
create policy nc_roles_read on public.nc_roles for select to authenticated using(user_id=auth.uid() or nc_private.is_admin());
grant select on public.nc_identity_checks to authenticated;
create policy nc_identity_read on public.nc_identity_checks for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin());
grant select on public.nc_consents to authenticated;
grant insert(owner_id,purpose,channel,granted) on public.nc_consents to authenticated;
create policy nc_consent_read on public.nc_consents for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin());
create policy nc_consent_insert on public.nc_consents for insert to authenticated with check(owner_id=auth.uid());
grant select,insert,update,delete on public.nc_goals,public.nc_match_feedback,public.nc_saved_searches,public.nc_drafts,public.nc_leads to authenticated;
do $$ declare t text; begin
 foreach t in array array['nc_goals','nc_match_feedback','nc_saved_searches','nc_drafts','nc_leads'] loop
  execute format('create policy nc_owner on public.%I for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())',t);
 end loop;
end $$;
grant select on public.nc_directory to authenticated;
create function nc_private.own_matching_consent() returns boolean language sql stable security definer set search_path='' as $$ select nc_private.consent_ok(auth.uid(),'matching','platform') $$;
revoke all on function nc_private.own_matching_consent() from public,anon;
grant execute on function nc_private.own_matching_consent() to authenticated;
create policy nc_directory_read on public.nc_directory for select to authenticated using(opted_in and nc_private.own_matching_consent());
grant select,insert on public.nc_templates to authenticated;
create policy nc_templates_read on public.nc_templates for select to authenticated using(approved or nc_private.is_admin());
create policy nc_templates_insert on public.nc_templates for insert to authenticated with check(nc_private.is_admin() and created_by=auth.uid());
grant select,insert on public.nc_privacy_requests to authenticated;
create policy nc_privacy_read on public.nc_privacy_requests for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin());
create policy nc_privacy_insert on public.nc_privacy_requests for insert to authenticated with check(owner_id=auth.uid() and status='PENDING');
grant select,update on public.nc_matching_rules to authenticated;
create policy nc_rules_read on public.nc_matching_rules for select to authenticated using(true);
create policy nc_rules_update on public.nc_matching_rules for update to authenticated using(nc_private.is_admin()) with check(nc_private.is_admin());
grant select on public.nc_audit to authenticated;
create policy nc_audit_read on public.nc_audit for select to authenticated using(actor_id=auth.uid() or nc_private.is_admin());

insert into public.nc_matching_rules(id,weights) values(1,'{"industry":35,"intent":30,"region":15,"skills":15,"available":5}');
insert into public.nc_templates(template_key,version,title,body,approved) values
('introduction',1,'A relevant introduction','Hi {{name}}, I noticed your interest in {{industry}}. I am working toward {{goal}} and thought there might be a relevant opportunity to connect. Would you be open to a conversation?',true);
grant update(status) on public.nc_privacy_requests to authenticated;
create policy nc_privacy_admin_update on public.nc_privacy_requests for update to authenticated using(nc_private.is_admin()) with check(nc_private.is_admin());

create function public.nc_complete_onboarding(input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid();
begin
 if subject is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.nc_identity_checks where owner_id=subject and provider='DEMO' and status='DEMO_PASSED') then raise exception 'Complete the clearly labelled demo identity step first'; end if;
 if input->>'matching_consent' is distinct from 'true' then raise exception 'Explicit matching consent required'; end if;
 update public.nc_profiles set display_name=input->>'display_name',headline=input->>'headline',region=input->>'region',skills=array(select jsonb_array_elements_text(input->'skills')),linkedin_url=input->>'linkedin_url',onboarding_complete=true where id=subject;
 insert into public.nc_goals(id,owner_id,industry,intent,target_intent,title,region,skills) values((input->>'goal_id')::uuid,subject,input->>'industry',input->>'intent',input->>'target_intent',input->>'title',input->>'region',array(select jsonb_array_elements_text(input->'skills'))) on conflict(id) do nothing;
 if not exists(select 1 from public.nc_goals where id=(input->>'goal_id')::uuid and owner_id=subject) then raise exception 'Goal ownership required'; end if;
 insert into public.nc_consents(owner_id,purpose,channel,granted) values(subject,'matching','platform',true);
end $$;
revoke all on function public.nc_complete_onboarding(jsonb) from public,anon;
grant execute on function public.nc_complete_onboarding(jsonb) to authenticated;

commit;
