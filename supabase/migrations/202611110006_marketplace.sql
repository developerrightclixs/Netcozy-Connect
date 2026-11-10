-- Phase 3: additive domain records. Requires migrations 001-005.
begin;
do $$begin if to_regclass('public.nc_properties') is null or to_regclass('public.nc_roles') is null or to_regprocedure('public.nc_review_property_claim(jsonb)') is null then raise exception 'Apply migrations 001-005 successfully in this development project before Phase 3 migration 006';end if;end $$;
create function nc_private.valid_talent_skills(items text[]) returns boolean language sql immutable set search_path='' as $$select cardinality(items) between 1 and 20 and not exists(select 1 from unnest(items) s where s is null or length(btrim(s)) not between 1 and 50)$$;
create table public.nc_market_listings(
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id),
 module text not null check(module in ('TALENT','YACHT','AVIATION','VEHICLE','EVENT')),
 title text not null check(length(btrim(title)) between 3 and 140), region text not null check(length(btrim(region)) between 2 and 100),
 summary text not null check(length(btrim(summary)) between 10 and 2000), facts jsonb not null check(jsonb_typeof(facts)='object' and octet_length(facts::text)<=10000),
 price_minor bigint check(price_minor between 0 and 100000000000), currency text not null default 'USD' check(currency in ('USD','PKR','EUR','GBP')),
 is_demo boolean not null default false, revision int not null default 1 check(revision>0),
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED','ARCHIVED')),
 agent_id uuid references auth.users(id), agent_accepted_revision int,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(owner_id is not null or is_demo),check(module not in ('EVENT','TALENT') or price_minor is not null)
);
create table public.nc_market_reviews(
 id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.nc_market_listings(id),owner_id uuid not null references auth.users(id),
 reviewer_id uuid not null references auth.users(id), revision int not null,decision text not null check(decision in ('PUBLISHED','REJECTED')),
 note text not null check(length(btrim(note)) between 5 and 2000), snapshot jsonb not null,created_at timestamptz not null default now(),
 unique(listing_id,revision),check(owner_id<>reviewer_id)
);
create table public.nc_market_agents(
 owner_id uuid primary key references auth.users(id),display_name text not null check(length(btrim(display_name)) between 2 and 100),
 business_name text not null check(length(business_name)<=140),active boolean not null,updated_at timestamptz not null default now()
);
create table public.nc_talent_candidates(
 id uuid primary key default gen_random_uuid(),owner_id uuid unique references auth.users(id),
 name text not null check(length(btrim(name)) between 2 and 100),headline text not null check(length(btrim(headline)) between 3 and 180),
 region text not null check(length(btrim(region)) between 2 and 100),skills text[] not null check(nc_private.valid_talent_skills(skills)),
 kind text not null check(kind in ('JOB','TESTER','COMMISSION')),remote boolean not null,available boolean not null,
 bio text not null check(length(bio)<=1500),discoverable boolean not null,is_demo boolean not null,revision int not null default 1,
 updated_at timestamptz not null default now(),check(owner_id is not null or is_demo)
);
create table public.nc_talent_optins(
 id bigint generated always as identity primary key,owner_id uuid not null references auth.users(id),candidate_id uuid not null references public.nc_talent_candidates(id),
 granted boolean not null,evidence text not null check(length(btrim(evidence)) between 5 and 1000),policy_version text not null default '2026-11-v1',created_at timestamptz not null default clock_timestamp()
);
create table public.nc_talent_applications(
 id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.nc_market_listings(id),candidate_id uuid not null references public.nc_talent_candidates(id),
 applicant_id uuid not null references auth.users(id),recruiter_id uuid not null references auth.users(id),
 message text not null check(length(btrim(message)) between 10 and 2000),status text not null default 'APPLIED' check(status in ('APPLIED','SHORTLISTED','DECLINED','WITHDRAWN')),
 listing_revision int not null,candidate_revision int not null,profile_snapshot jsonb not null,listing_snapshot jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(listing_id,applicant_id),check(applicant_id<>recruiter_id)
);
create table public.nc_market_inquiries(
 id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.nc_market_listings(id),sender_id uuid not null references auth.users(id),
 owner_id uuid not null references auth.users(id),agent_id uuid references auth.users(id),listing_revision int not null,
 message text not null check(length(btrim(message)) between 10 and 2000),status text not null default 'REQUESTED' check(status in ('REQUESTED','ACCEPTED','DECLINED','WITHDRAWN')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(listing_id,sender_id),check(sender_id<>owner_id)
);
create table public.nc_event_orders(
 id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.nc_market_listings(id),buyer_id uuid not null references auth.users(id),
 organizer_id uuid references auth.users(id),request_key uuid not null,quantity int not null check(quantity between 1 and 5),unit_price_minor bigint not null check(unit_price_minor>=0),
 total_minor bigint not null check(total_minor>=0),currency text not null,mode text not null check(mode in ('FREE','DEMO')),
 status text not null check(status in ('CONFIRMED','CANCELLED')),event_snapshot jsonb not null,created_at timestamptz not null default now(),unique(buyer_id,request_key),check(total_minor=unit_price_minor*quantity)
);
create unique index nc_one_active_event_order on public.nc_event_orders(listing_id,buyer_id) where status='CONFIRMED';
create table public.nc_event_tickets(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.nc_event_orders(id),listing_id uuid not null references public.nc_market_listings(id),
 buyer_id uuid not null references auth.users(id),organizer_id uuid references auth.users(id),reference text not null unique default replace(gen_random_uuid()::text,'-',''),
 status text not null default 'VALID' check(status in ('VALID','CHECKED_IN','CANCELLED')),checked_in_at timestamptz,created_at timestamptz not null default now()
);
create table public.nc_module_history(
 id bigint generated always as identity primary key,actor_id uuid not null references auth.users(id),listing_id uuid references public.nc_market_listings(id),
 owner_id uuid references auth.users(id),participant_id uuid references auth.users(id),action text not null,entity_id text not null,details jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index nc_market_browse on public.nc_market_listings(module,status,updated_at desc,id);
create index nc_market_owner on public.nc_market_listings(owner_id,updated_at desc);
create index nc_market_agent on public.nc_market_listings(agent_id);
create index nc_applications_recruiter on public.nc_talent_applications(recruiter_id,updated_at desc);
create index nc_applications_applicant on public.nc_talent_applications(applicant_id);
create index nc_inquiries_owner on public.nc_market_inquiries(owner_id,updated_at desc);
create index nc_inquiries_sender on public.nc_market_inquiries(sender_id);
create index nc_event_orders_capacity on public.nc_event_orders(listing_id,status);
create index nc_tickets_buyer on public.nc_event_tickets(buyer_id);
create index nc_tickets_organizer on public.nc_event_tickets(organizer_id);
create index nc_history_participants on public.nc_module_history(owner_id,participant_id,id desc);

create function nc_private.module_role(subject uuid,wanted text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nc_roles where user_id=subject and role in (wanted,'ADMIN','SUPER_ADMIN'))
$$;
create function nc_private.candidate_visible(subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nc_talent_candidates c where c.id=subject and c.discoverable and c.available and nc_private.consent_ok(auth.uid(),'matching','platform') and (c.owner_id is null or nc_private.consent_ok(c.owner_id,'matching','platform')))
$$;
create function nc_private.listing_owner_role(l public.nc_market_listings) returns boolean language sql stable security definer set search_path='' as $$
 select (l.owner_id is null and l.is_demo) or nc_private.module_role(l.owner_id,case l.module when 'TALENT' then 'RECRUITER' when 'EVENT' then 'ORGANIZER' when 'VEHICLE' then case when l.facts->>'seller_type'='BROKER' then 'AGENT' else 'SELLER' end else 'SELLER' end) or (l.module in ('YACHT','AVIATION') and nc_private.module_role(l.owner_id,'AGENT'))
$$;
create function nc_private.listing_read(subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nc_market_listings l where l.id=subject and (
 l.owner_id=auth.uid() or (l.agent_id=auth.uid() and nc_private.module_role(auth.uid(),'AGENT') and exists(select 1 from public.nc_market_agents where owner_id=auth.uid() and active)) or nc_private.is_admin() or
 (l.status='PUBLISHED' and nc_private.listing_owner_role(l) and (l.module not in ('YACHT','AVIATION') or (l.is_demo and l.owner_id is null) or (l.agent_accepted_revision=l.revision and exists(select 1 from public.nc_market_agents a where a.owner_id=l.agent_id and a.active and nc_private.module_role(a.owner_id,'AGENT'))))) or
 exists(select 1 from public.nc_event_orders o where o.listing_id=l.id and o.buyer_id=auth.uid() and o.status='CONFIRMED' and (o.event_snapshot->>'revision')::int=l.revision)))
$$;
do $$ declare t text;begin
 foreach t in array array['nc_market_listings','nc_market_reviews','nc_market_agents','nc_talent_candidates','nc_talent_optins','nc_talent_applications','nc_market_inquiries','nc_event_orders','nc_event_tickets','nc_module_history'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger nc_phase3_audit after insert or update or delete on public.%I for each row execute function nc_private.audit_change()',t);
 end loop;
end $$;
create policy nc_market_read on public.nc_market_listings for select to authenticated using(nc_private.listing_read(id));
create policy nc_market_reviews_read on public.nc_market_reviews for select to authenticated using(owner_id=auth.uid() or reviewer_id=auth.uid() or nc_private.is_admin());
create policy nc_agents_read on public.nc_market_agents for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin() or (active and nc_private.module_role(owner_id,'AGENT')));
create policy nc_candidates_read on public.nc_talent_candidates for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin() or nc_private.candidate_visible(id));
create policy nc_optins_read on public.nc_talent_optins for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin());
create policy nc_applications_read on public.nc_talent_applications for select to authenticated using(applicant_id=auth.uid() or recruiter_id=auth.uid() or nc_private.is_admin());
create policy nc_inquiries_read on public.nc_market_inquiries for select to authenticated using(sender_id=auth.uid() or owner_id=auth.uid() or nc_private.is_admin() or (agent_id=auth.uid() and nc_private.module_role(auth.uid(),'AGENT') and exists(select 1 from public.nc_market_agents where owner_id=auth.uid() and active) and exists(select 1 from public.nc_market_listings l where l.id=listing_id and l.agent_id=auth.uid() and l.agent_accepted_revision=l.revision)));
create policy nc_orders_read on public.nc_event_orders for select to authenticated using(buyer_id=auth.uid() or organizer_id=auth.uid() or nc_private.is_admin());
create policy nc_tickets_read on public.nc_event_tickets for select to authenticated using(buyer_id=auth.uid() or organizer_id=auth.uid() or nc_private.is_admin());
create policy nc_module_history_read on public.nc_module_history for select to authenticated using(owner_id=auth.uid() or participant_id=auth.uid() or actor_id=auth.uid() or nc_private.is_admin());
revoke all on function nc_private.module_role(uuid,text),nc_private.candidate_visible(uuid),nc_private.listing_read(uuid),nc_private.listing_owner_role(public.nc_market_listings) from public,anon;
revoke all on function nc_private.valid_talent_skills(text[]) from public,anon,authenticated;
grant execute on function nc_private.module_role(uuid,text),nc_private.candidate_visible(uuid),nc_private.listing_read(uuid) to authenticated;
commit;
