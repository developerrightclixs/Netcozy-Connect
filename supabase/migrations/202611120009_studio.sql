-- Phase 4: additive private LI3K workspace. No provider credentials or remote calls.
begin;
create table public.nc_studio_brands (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(btrim(name)) between 2 and 100),
 website text not null default '' check(length(website)<=300 and (website='' or website ~ '^https://[^[:space:]]+$')),
 industry text not null check(length(btrim(industry)) between 2 and 100),
 audience text not null check(length(btrim(audience)) between 5 and 1000),
 offer text not null check(length(btrim(offer)) between 5 and 1000),
 voice text not null check(length(btrim(voice)) between 2 and 200),
 color text not null default '#0f766e' check(color ~ '^#[0-9a-fA-F]{6}$'),
 revision integer not null default 1, updated_at timestamptz not null default now(), unique(owner_id)
);
create table public.nc_studio_creatives (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 brand_id uuid not null references public.nc_studio_brands(id), brand_revision integer not null,
 title text not null check(length(btrim(title)) between 3 and 150),
 kind text not null check(kind in ('IMAGE','VIDEO','TEXT')),
 channel text not null check(channel in ('LINKEDIN','INSTAGRAM','FACEBOOK','MANUAL')),
 caption text not null check(length(btrim(caption)) between 5 and 5000),
 script text not null default '' check(length(script)<=10000),
 audience text not null check(length(btrim(audience)) between 5 and 1000),
 scheduled_at timestamptz,
 source text not null check(source in ('MANUAL','DEMO_TEMPLATE')),
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','EXPORTED')),
 revision integer not null default 1, approved_revision integer,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index nc_studio_calendar on public.nc_studio_creatives(owner_id,scheduled_at);
create table public.nc_studio_reviews (
 id uuid primary key default gen_random_uuid(), creative_id uuid not null references public.nc_studio_creatives(id),
 owner_id uuid not null references auth.users(id), reviewer_id uuid not null references auth.users(id),
 revision integer not null, decision text not null check(decision in ('APPROVED','REJECTED')),
 note text not null check(length(btrim(note)) between 5 and 1000), created_at timestamptz not null default now(),
 check(owner_id<>reviewer_id), unique(creative_id,revision)
);
create table public.nc_studio_exports (
 id uuid primary key default gen_random_uuid(), creative_id uuid not null references public.nc_studio_creatives(id),
 owner_id uuid not null references auth.users(id), revision integer not null, snapshot jsonb not null,
 created_at timestamptz not null default now(), unique(creative_id,revision)
);
create table public.nc_studio_usage (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 creative_id uuid not null references public.nc_studio_creatives(id),
 operation text not null check(operation='DEMO_TEXT_PREPARATION'),
 provider_calls integer not null default 0 check(provider_calls=0),
 created_at timestamptz not null default now()
);
create table public.nc_studio_metrics (
 id uuid primary key default gen_random_uuid(), creative_id uuid not null references public.nc_studio_creatives(id),
 owner_id uuid not null references auth.users(id), request_key uuid not null,
 period_start date not null, period_end date not null check(period_end>=period_start),
 views integer not null check(views between 0 and 1000000000), clicks integer not null check(clicks between 0 and 1000000000),
 replies integer not null check(replies between 0 and 1000000000), conversions integer not null check(conversions between 0 and 1000000000),
 evidence text not null check(length(btrim(evidence)) between 5 and 500),
 source text not null default 'MANUAL_UNVERIFIED' check(source='MANUAL_UNVERIFIED'),
 created_at timestamptz not null default now(), unique(owner_id,request_key), unique(creative_id,period_start,period_end)
);
do $$ declare t text; begin
 foreach t in array array['nc_studio_brands','nc_studio_creatives','nc_studio_reviews','nc_studio_exports','nc_studio_usage','nc_studio_metrics'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy nc_studio_private on public.%I for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin())',t);
 execute format('create trigger nc_studio_audit after insert or update or delete on public.%I for each row execute function nc_private.audit_change()',t);
 end loop;
end $$;

create function public.nc_studio_mutate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); act text:=input->>'action'; d jsonb:=input->'data'; b public.nc_studio_brands; c public.nc_studio_creatives; e public.nc_studio_exports; result jsonb;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if act='brand-save' then
  if d->>'acknowledge' is distinct from 'true' then raise exception 'Authorized business information acknowledgement required';end if;
  insert into public.nc_studio_brands(owner_id,name,website,industry,audience,offer,voice,color)
  values(actor,d->>'name',d->>'website',d->>'industry',d->>'audience',d->>'offer',d->>'voice',d->>'color')
  on conflict(owner_id) do update set name=excluded.name,website=excluded.website,industry=excluded.industry,audience=excluded.audience,offer=excluded.offer,voice=excluded.voice,color=excluded.color,revision=nc_studio_brands.revision+1,updated_at=now() returning * into b;
  -- Serialize all creative operations on the brand first, then on the creative.
  update public.nc_studio_creatives set status='DRAFT',approved_revision=null,revision=revision+1,updated_at=now() where brand_id=b.id;
  return to_jsonb(b);
 end if;
 if act not in ('creative-save','demo-prepare','submit','review','export','metrics') or act is null then raise exception 'Unsupported studio action; live generation/publishing unavailable';end if;
 if act in ('creative-save','demo-prepare') then
  select * into b from public.nc_studio_brands where owner_id=actor for update;
 else
  select sb.* into b from public.nc_studio_brands sb join public.nc_studio_creatives sc on sc.brand_id=sb.id where sc.id=(d->>'id')::uuid for update of sb;
 end if;
 if b.id is null then raise exception 'Business profile required';end if;
 if act in ('creative-save','demo-prepare') then
  if d->>'id' is not null then
   select * into c from public.nc_studio_creatives where id=(d->>'id')::uuid and owner_id=actor for update;
   if c.id is null or c.revision is distinct from (d->>'revision')::integer then raise exception 'Owned current revision required';end if;
   update public.nc_studio_creatives set title=d->>'title',kind=d->>'kind',channel=d->>'channel',caption=d->>'caption',script=d->>'script',audience=d->>'audience',scheduled_at=(d->>'scheduled_at')::timestamptz,brand_revision=b.revision,status='DRAFT',approved_revision=null,revision=revision+1,updated_at=now() where id=c.id returning * into c;
  else
   insert into public.nc_studio_creatives(owner_id,brand_id,brand_revision,title,kind,channel,caption,script,audience,scheduled_at,source)
   values(actor,b.id,b.revision,d->>'title',d->>'kind',d->>'channel',
    case when act='demo-prepare' then b.name||': '||b.offer||E'\nLearn more about our services. Review all claims before publication.' else d->>'caption' end,
    case when act='demo-prepare' then 'DEMO storyboard / creative brief: Introduce '||b.name||'. Explain: '||b.offer||'. Close with a manually reviewed call to action. No image or video has been generated.' else d->>'script' end,
    b.audience,(d->>'scheduled_at')::timestamptz,case when act='demo-prepare' then 'DEMO_TEMPLATE' else 'MANUAL' end) returning * into c;
   if act='demo-prepare' then insert into public.nc_studio_usage(owner_id,creative_id,operation) values(actor,c.id,'DEMO_TEXT_PREPARATION');end if;
  end if;
  return to_jsonb(c);
 end if;
 select * into c from public.nc_studio_creatives where id=(d->>'id')::uuid for update;
 if c.id is null or c.revision is distinct from (d->>'revision')::integer then raise exception 'Current creative revision required';end if;
 if act='review' then
  if not nc_private.is_admin() or c.owner_id=actor or c.status<>'PENDING_REVIEW' or c.brand_revision<>b.revision or d->>'decision' is null or d->>'decision' not in ('APPROVED','REJECTED') or d->>'acknowledge' is distinct from 'true' then raise exception 'Independent administrator and current pending revision required';end if;
  insert into public.nc_studio_reviews(creative_id,owner_id,reviewer_id,revision,decision,note) values(c.id,c.owner_id,actor,c.revision,d->>'decision',d->>'note');
  update public.nc_studio_creatives set status=d->>'decision',approved_revision=case when d->>'decision'='APPROVED' then revision else null end,updated_at=now() where id=c.id returning * into c;
 else
  if c.owner_id<>actor then raise exception 'Creative ownership required';end if;
  if act='submit' then
   if c.status not in ('DRAFT','REJECTED') or c.brand_revision<>b.revision then raise exception 'Save a current draft before submitting';end if;
   -- A rejection must be revised before another review of the same version.
   if exists(select 1 from public.nc_studio_reviews where creative_id=c.id and revision=c.revision) then raise exception 'Revise rejected creative before resubmission';end if;
   update public.nc_studio_creatives set status='PENDING_REVIEW',updated_at=now() where id=c.id returning * into c;
  elsif act='export' then
   if c.status not in ('APPROVED','EXPORTED') or c.approved_revision is distinct from c.revision or c.brand_revision<>b.revision then raise exception 'Current independent approval required';end if;
   insert into public.nc_studio_exports(creative_id,owner_id,revision,snapshot) values(c.id,actor,c.revision,jsonb_build_object('creative',to_jsonb(c),'brand',to_jsonb(b),'delivery','MANUAL_EXPORT_ONLY','media','No generated image/video attached')) on conflict(creative_id,revision) do nothing;
   select * into e from public.nc_studio_exports where creative_id=c.id and revision=c.revision;
   update public.nc_studio_creatives set status='EXPORTED',updated_at=now() where id=c.id;
   return to_jsonb(e);
  elsif act='metrics' then
   if not exists(select 1 from public.nc_studio_exports where creative_id=c.id) or d->>'acknowledge' is distinct from 'true' then raise exception 'Export and manual-report acknowledgement required';end if;
   if (d->>'period_end')::date>current_date then raise exception 'Reporting period cannot be in the future';end if;
   insert into public.nc_studio_metrics(creative_id,owner_id,request_key,period_start,period_end,views,clicks,replies,conversions,evidence)
   values(c.id,actor,(d->>'request_key')::uuid,(d->>'period_start')::date,(d->>'period_end')::date,(d->>'views')::int,(d->>'clicks')::int,(d->>'replies')::int,(d->>'conversions')::int,d->>'evidence')
   on conflict(owner_id,request_key) do nothing;
   select to_jsonb(m) into result from public.nc_studio_metrics m where owner_id=actor and request_key=(d->>'request_key')::uuid;
   return result;
  end if;
 end if;
 return to_jsonb(c);
end $$;
revoke all on function public.nc_studio_mutate(jsonb) from public,anon,authenticated;
grant execute on function public.nc_studio_mutate(jsonb) to authenticated;
commit;
