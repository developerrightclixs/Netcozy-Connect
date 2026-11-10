begin;
do $$begin if to_regclass('public.nc_market_listings') is null then raise exception 'Apply Phase 3 migration 006 successfully before migration 007';end if;end $$;
create function nc_private.validate_listing(kind text,f jsonb,amount bigint) returns void language plpgsql set search_path='' as $$
declare k text; allowed text[];
begin
 if jsonb_typeof(f) is distinct from 'object' then raise exception 'Module facts required'; end if;
 allowed=case kind when 'TALENT' then array['kind','skills','remote','engagement'] when 'YACHT' then array['length_m','year','guests','offer'] when 'AVIATION' then array['make','model','year','seats','hours','offer'] when 'VEHICLE' then array['make','model','year','mileage_km','fuel','seller_type'] when 'EVENT' then array['starts_at','ends_at','closes_at','venue','capacity'] end;
 if allowed is null then raise exception 'Unsupported module'; end if;
 if (select count(*) from jsonb_object_keys(f))<>cardinality(allowed) then raise exception 'All module facts required'; end if;
 for k in select jsonb_object_keys(f) loop
  if not k=any(allowed) or f->k='null'::jsonb then raise exception 'Unsupported module field'; end if;
  if jsonb_typeof(f->k) is distinct from (case when k in ('length_m','year','guests','seats','hours','mileage_km','capacity') then 'number' when k='remote' then 'boolean' when k='skills' then 'array' else 'string' end) then raise exception 'Invalid module field type';end if;
 end loop;
 if kind='TALENT' then
  if f->>'kind' not in ('JOB','TESTER','COMMISSION') or jsonb_typeof(f->'remote')<>'boolean' or jsonb_typeof(f->'skills')<>'array' or jsonb_array_length(f->'skills') not between 1 and 20 or length(btrim(f->>'engagement')) not between 3 and 240 or amount is null then raise exception 'Invalid recruitment facts'; end if;
  if exists(select 1 from jsonb_array_elements(f->'skills') s where jsonb_typeof(s)<>'string') then raise exception 'Skills must be text';end if;
  for k in select jsonb_array_elements_text(f->'skills') loop if length(btrim(k)) not between 1 and 50 then raise exception 'Invalid skill'; end if;end loop;
 elsif kind in ('YACHT','AVIATION','VEHICLE') then
  if jsonb_typeof(f->'year')<>'number' or (f->>'year')::int not between 1900 and 2100 then raise exception 'Invalid year'; end if;
  if kind='YACHT' and (jsonb_typeof(f->'length_m')<>'number' or (f->>'length_m')::numeric not between 1 and 300 or (f->>'guests')::int not between 1 and 1000 or f->>'offer' not in ('SALE','CHARTER')) then raise exception 'Invalid yacht facts';end if;
  if kind in ('AVIATION','VEHICLE') and (length(btrim(f->>'make')) not between 1 and 80 or length(btrim(f->>'model')) not between 1 and 100) then raise exception 'Make and model required';end if;
  if kind='AVIATION' and ((f->>'seats')::int not between 1 and 1000 or (f->>'hours')::numeric not between 0 and 1000000 or f->>'offer' not in ('SALE','CHARTER')) then raise exception 'Invalid aircraft facts';end if;
  if kind='VEHICLE' and ((f->>'mileage_km')::numeric not between 0 and 10000000 or f->>'seller_type' not in ('DEALER','BROKER') or length(btrim(f->>'fuel')) not between 2 and 40) then raise exception 'Invalid vehicle facts';end if;
 elsif kind='EVENT' then
  if amount is null or (f->>'capacity')::int not between 1 and 10000 or jsonb_typeof(f->'capacity')<>'number' or length(btrim(f->>'venue')) not between 3 and 240 or (f->>'ends_at')::timestamptz<=(f->>'starts_at')::timestamptz or (f->>'closes_at')::timestamptz>(f->>'starts_at')::timestamptz or (f->>'starts_at')::timestamptz<=now() then raise exception 'Invalid event capacity, venue or dates';end if;
 end if;
end $$;
create function public.nc_save_market_listing(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); l public.nc_market_listings; result public.nc_market_listings; kind text:=input->>'module'; desired_agent uuid:=nullif(input->>'agent_id','')::uuid; wanted_role text;
begin
 if actor is null then raise exception 'Authentication required';end if;
 wanted_role=case kind when 'TALENT' then 'RECRUITER' when 'YACHT' then 'SELLER' when 'AVIATION' then 'SELLER' when 'VEHICLE' then case when input->'facts'->>'seller_type'='BROKER' then 'AGENT' else 'SELLER' end when 'EVENT' then 'ORGANIZER' end;
 if wanted_role is null or not (nc_private.module_role(actor,wanted_role) or (kind in ('YACHT','AVIATION') and nc_private.module_role(actor,'AGENT'))) then raise exception 'Approved module role required';end if;
 perform nc_private.validate_listing(kind,input->'facts',(input->>'price_minor')::bigint);
 if kind in ('YACHT','AVIATION') then
  if desired_agent is null or not exists(select 1 from public.nc_market_agents where owner_id=desired_agent and active and nc_private.module_role(owner_id,'AGENT')) then raise exception 'An opted-in authorized agent must be assigned';end if;
 elsif desired_agent is not null then raise exception 'Agent assignments are only for yachts and aviation';end if;
 if input->>'id' is not null then
  select * into l from public.nc_market_listings where id=(input->>'id')::uuid and owner_id=actor for update;
  if not found or l.module<>kind or l.is_demo is distinct from (input->>'is_demo')::boolean then raise exception 'Listing ownership and immutable module/mode required';end if;
  if kind='EVENT' and exists(select 1 from public.nc_event_orders where listing_id=l.id and status='CONFIRMED') then raise exception 'Cancel active event orders before editing event facts';end if;
  update public.nc_market_listings set title=input->>'title',region=input->>'region',summary=input->>'summary',facts=input->'facts',price_minor=(input->>'price_minor')::bigint,currency=input->>'currency',agent_id=desired_agent,agent_accepted_revision=null,revision=revision+1,status='DRAFT',updated_at=now() where id=l.id returning * into result;
 else
  insert into public.nc_market_listings(owner_id,module,title,region,summary,facts,price_minor,currency,is_demo,agent_id) values(actor,kind,input->>'title',input->>'region',input->>'summary',input->'facts',(input->>'price_minor')::bigint,input->>'currency',(input->>'is_demo')::boolean,desired_agent) returning * into result;
 end if;
 return to_jsonb(result);
end $$;
create function public.nc_save_market_agent(input jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not nc_private.module_role(auth.uid(),'AGENT') then raise exception 'Approved AGENT role required';end if;
 insert into public.nc_market_agents(owner_id,display_name,business_name,active) values(auth.uid(),input->>'display_name',input->>'business_name',(input->>'active')::boolean)
 on conflict(owner_id) do update set display_name=excluded.display_name,business_name=excluded.business_name,active=excluded.active,updated_at=now();
end $$;
create function public.nc_market_listing_action(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.nc_market_listings; act text:=input->>'action'; decision text:=input->>'decision';
begin
 select * into l from public.nc_market_listings where id=(input->>'id')::uuid for update;
 if not found or auth.uid() is null then raise exception 'Listing not found';end if;
 if act='accept-agent' then
  if l.agent_id is distinct from auth.uid() or not nc_private.module_role(auth.uid(),'AGENT') or not exists(select 1 from public.nc_market_agents where owner_id=auth.uid() and active) then raise exception 'Current assigned active agent required';end if;
  update public.nc_market_listings set agent_accepted_revision=revision where id=l.id returning * into l;
 elsif act='submit' then
  if l.owner_id is distinct from auth.uid() or l.status<>'DRAFT' then raise exception 'Owned draft required';end if;
  if l.module in ('YACHT','AVIATION') and l.agent_accepted_revision is distinct from l.revision then raise exception 'Agent must accept current listing revision';end if;
  update public.nc_market_listings set status='PENDING_REVIEW',updated_at=now() where id=l.id returning * into l;
 elsif act='review' then
  if not nc_private.is_admin() or l.owner_id=auth.uid() or l.owner_id is null or l.status<>'PENDING_REVIEW' or decision is null or decision not in ('PUBLISHED','REJECTED') then raise exception 'Independent administrator and pending listing required';end if;
  if input->>'acknowledge' is distinct from 'true' then raise exception 'Acknowledge demo and unverified disclosures';end if;
  if not nc_private.listing_owner_role(l) then raise exception 'Listing owner no longer holds the required role';end if;
  perform nc_private.validate_listing(l.module,l.facts,l.price_minor);
  if l.module in ('YACHT','AVIATION') and (l.agent_accepted_revision is distinct from l.revision or not exists(select 1 from public.nc_market_agents where owner_id=l.agent_id and active and nc_private.module_role(owner_id,'AGENT'))) then raise exception 'Current active agent acceptance required';end if;
  insert into public.nc_market_reviews(listing_id,owner_id,reviewer_id,revision,decision,note,snapshot) values(l.id,l.owner_id,auth.uid(),l.revision,decision,input->>'note',to_jsonb(l));
  update public.nc_market_listings set status=decision,updated_at=now() where id=l.id returning * into l;
 elsif act='archive' then
  if l.owner_id is distinct from auth.uid() then raise exception 'Owner required';end if;
  if l.module='EVENT' and exists(select 1 from public.nc_event_orders where listing_id=l.id and status='CONFIRMED') then raise exception 'Cancel active event orders before archiving';end if;
  update public.nc_market_listings set status='ARCHIVED',updated_at=now() where id=l.id returning * into l;
 else raise exception 'Unsupported listing action';end if;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id,details) values(auth.uid(),l.id,l.owner_id,l.agent_id,act,l.id::text,jsonb_build_object('revision',l.revision,'status',l.status));
 return to_jsonb(l);
end $$;
create function public.nc_save_talent_candidate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.nc_talent_candidates; result public.nc_talent_candidates;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if input->>'discoverable'='true' and (input->>'attested' is distinct from 'true' or not nc_private.consent_ok(auth.uid(),'matching','platform')) then raise exception 'Explicit profile publication and platform matching consent required';end if;
 select * into c from public.nc_talent_candidates where owner_id=auth.uid() for update;
 if found and c.is_demo is distinct from (input->>'is_demo')::boolean then raise exception 'Demo mode cannot change';end if;
 insert into public.nc_talent_candidates(owner_id,name,headline,region,skills,kind,remote,available,bio,discoverable,is_demo)
 values(auth.uid(),input->>'name',input->>'headline',input->>'region',array(select jsonb_array_elements_text(input->'skills')),input->>'kind',(input->>'remote')::boolean,(input->>'available')::boolean,input->>'bio',(input->>'discoverable')::boolean,(input->>'is_demo')::boolean)
 on conflict(owner_id) do update set name=excluded.name,headline=excluded.headline,region=excluded.region,skills=excluded.skills,kind=excluded.kind,remote=excluded.remote,available=excluded.available,bio=excluded.bio,discoverable=excluded.discoverable,revision=public.nc_talent_candidates.revision+1,updated_at=now() returning * into result;
 insert into public.nc_talent_optins(owner_id,candidate_id,granted,evidence) values(auth.uid(),result.id,result.discoverable,case when result.discoverable then 'Self-service publication of supplied talent profile; policy 2026-11-v1' else 'Self-service withdrawal of talent profile publication' end);
 return to_jsonb(result);
end $$;
create function public.nc_apply_talent(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.nc_market_listings;c public.nc_talent_candidates;result public.nc_talent_applications;
begin
 select * into l from public.nc_market_listings where id=(input->>'listing_id')::uuid for update;
 select * into c from public.nc_talent_candidates where owner_id=auth.uid() for update;
 if c.id is null or l.id is null or l.module<>'TALENT' or l.status<>'PUBLISHED' or not nc_private.listing_owner_role(l) or l.owner_id is null or l.owner_id=auth.uid() or c.is_demo<>l.is_demo or c.kind<>l.facts->>'kind' or not nc_private.candidate_visible(c.id) then raise exception 'Published matching role, owned opted-in profile and matching consent required';end if;
 insert into public.nc_talent_applications(listing_id,candidate_id,applicant_id,recruiter_id,message,listing_revision,candidate_revision,profile_snapshot,listing_snapshot) values(l.id,c.id,auth.uid(),l.owner_id,input->>'message',l.revision,c.revision,jsonb_build_object('name',c.name,'headline',c.headline,'region',c.region,'skills',to_jsonb(c.skills),'bio',c.bio,'is_demo',c.is_demo),jsonb_build_object('title',l.title,'region',l.region,'facts',l.facts,'revision',l.revision,'price_minor',l.price_minor,'currency',l.currency,'is_demo',l.is_demo)) returning * into result;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id) values(auth.uid(),l.id,l.owner_id,auth.uid(),'APPLIED',result.id::text);
 return to_jsonb(result);
end $$;
create function public.nc_talent_application_action(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.nc_talent_applications; wanted text:=input->>'status';
begin
 select * into a from public.nc_talent_applications where id=(input->>'id')::uuid for update;
 if not found or a.status in ('DECLINED','WITHDRAWN') then raise exception 'Active application required';end if;
 if wanted='WITHDRAWN' then if a.applicant_id is distinct from auth.uid() then raise exception 'Applicant required';end if;
 elsif wanted in ('SHORTLISTED','DECLINED') then
  if a.recruiter_id is distinct from auth.uid() or not nc_private.module_role(auth.uid(),'RECRUITER') then raise exception 'Listing recruiter required';end if;
  if wanted='SHORTLISTED' and (not nc_private.candidate_visible(a.candidate_id) or not exists(select 1 from public.nc_market_listings where id=a.listing_id and status='PUBLISHED' and revision=a.listing_revision)) then raise exception 'Current consent and published revision required';end if;
 else raise exception 'Invalid application status';end if;
 update public.nc_talent_applications set status=wanted,updated_at=now() where id=a.id returning * into a;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id) values(auth.uid(),a.listing_id,a.recruiter_id,a.applicant_id,wanted,a.id::text);
 return to_jsonb(a);
end $$;
create function public.nc_market_inquiry(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.nc_market_listings;result public.nc_market_inquiries;
begin
 select * into l from public.nc_market_listings where id=(input->>'listing_id')::uuid for update;
 if not found or l.module not in ('YACHT','AVIATION','VEHICLE') or l.status<>'PUBLISHED' or not nc_private.listing_owner_role(l) or l.owner_id is null or l.owner_id=auth.uid() or not nc_private.listing_read(l.id) or not nc_private.consent_ok(auth.uid(),'matching','platform') or input->>'attested' is distinct from 'true' then raise exception 'Published listing, matching consent and explicit inquiry permission required';end if;
 if l.module in ('YACHT','AVIATION') and (l.agent_accepted_revision is distinct from l.revision or not exists(select 1 from public.nc_market_agents where owner_id=l.agent_id and active and nc_private.module_role(owner_id,'AGENT'))) then raise exception 'Current active assigned agent required';end if;
 insert into public.nc_market_inquiries(listing_id,sender_id,owner_id,agent_id,listing_revision,message) values(l.id,auth.uid(),l.owner_id,l.agent_id,l.revision,input->>'message') returning * into result;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id) values(auth.uid(),l.id,l.owner_id,auth.uid(),'INQUIRY_REQUESTED',result.id::text);
 return to_jsonb(result);
end $$;
create function public.nc_market_inquiry_action(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.nc_market_inquiries;l public.nc_market_listings;wanted text:=input->>'status';
begin
 select * into r from public.nc_market_inquiries where id=(input->>'id')::uuid;
 if not found then raise exception 'Inquiry not found';end if;
 select * into l from public.nc_market_listings where id=r.listing_id for update;
 select * into r from public.nc_market_inquiries where id=r.id for update;
 if r.status<>'REQUESTED' then raise exception 'Pending inquiry required';end if;
 if wanted='WITHDRAWN' then if r.sender_id is distinct from auth.uid() then raise exception 'Sender required';end if;
 elsif wanted in ('ACCEPTED','DECLINED') then
  if l.owner_id is distinct from auth.uid() and (l.agent_id is distinct from auth.uid() or l.agent_accepted_revision is distinct from l.revision or not nc_private.module_role(auth.uid(),'AGENT') or not exists(select 1 from public.nc_market_agents where owner_id=auth.uid() and active)) then raise exception 'Owner or current accepted agent required';end if;
  if wanted='ACCEPTED' and (l.status<>'PUBLISHED' or not nc_private.listing_owner_role(l) or r.listing_revision<>l.revision or not nc_private.consent_ok(r.sender_id,'matching','platform')) then raise exception 'Current listing revision and sender consent required';end if;
  if wanted='ACCEPTED' and l.module in ('YACHT','AVIATION') and (l.agent_accepted_revision is distinct from l.revision or not exists(select 1 from public.nc_market_agents where owner_id=l.agent_id and active and nc_private.module_role(owner_id,'AGENT'))) then raise exception 'Current active assigned agent required';end if;
 else raise exception 'Invalid inquiry status';end if;
 update public.nc_market_inquiries set status=wanted,updated_at=now() where id=r.id returning * into r;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id) values(auth.uid(),l.id,l.owner_id,r.sender_id,'INQUIRY_'||wanted,r.id::text);
 return to_jsonb(r);
end $$;
do $$ declare sig text;begin
 foreach sig in array array['nc_save_market_listing(jsonb)','nc_save_market_agent(jsonb)','nc_market_listing_action(jsonb)','nc_save_talent_candidate(jsonb)','nc_apply_talent(jsonb)','nc_talent_application_action(jsonb)','nc_market_inquiry(jsonb)','nc_market_inquiry_action(jsonb)'] loop
 execute 'revoke all on function public.'||sig||' from public,anon,authenticated';execute 'grant execute on function public.'||sig||' to authenticated';end loop;
end $$;
revoke all on function nc_private.validate_listing(text,jsonb,bigint) from public,anon,authenticated;
commit;
