-- Phase 2 additive real-estate schema. Requires the Phase 1 migrations.
begin;
create table public.nc_properties (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 address text not null check(length(btrim(address)) between 3 and 240), region text not null check(length(btrim(region)) between 2 and 100),
 postal_code text not null default '' check(length(postal_code)<=20), lot_acres numeric(12,3) not null check(lot_acres>0 and lot_acres<=1000000),
 zoning text not null default '' check(length(zoning)<=100), utilities text not null default '' check(length(utilities)<=240),
 road_access text not null default '' check(length(road_access)<=240), asking_price numeric(14,2) not null check(asking_price>=0),
 listing_status text not null default 'AVAILABLE' check(listing_status in ('AVAILABLE','UNDER_REVIEW','CLOSED','WITHDRAWN')),
 source text not null check(length(btrim(source)) between 3 and 200), license_evidence text not null check(length(btrim(license_evidence)) between 5 and 2000),
 source_updated_at timestamptz not null default now(), is_demo boolean not null default false,
 revision int not null default 1 check(revision>0),
 dedupe_key text generated always as(lower(regexp_replace(btrim(address)||'|'||btrim(region)||'|'||btrim(postal_code),'\s+',' ','g'))) stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,dedupe_key)
);
create table public.nc_property_imports (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null, source text not null, license_evidence text not null, is_demo boolean not null,
 status text not null check(status in ('RUNNING','COMPLETED','FAILED')), total_rows int not null check(total_rows between 0 and 200),
 inserted_count int not null default 0, updated_count int not null default 0, unchanged_count int not null default 0,
 error_code text, created_at timestamptz not null default now(), completed_at timestamptz, unique(owner_id,request_key)
);
create table public.nc_property_import_rows (
 id uuid primary key default gen_random_uuid(), import_id uuid not null references public.nc_property_imports(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade, row_number int not null check(row_number>0),
 property_id uuid references public.nc_properties(id), disposition text not null check(disposition in ('INSERTED','UPDATED','UNCHANGED')), unique(import_id,row_number)
);
create table public.nc_property_evidence (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 property_id uuid not null references public.nc_properties(id) on delete cascade,
 label text not null check(length(label) between 3 and 120), content_note text not null default '' check(length(content_note)<=2000),
 object_key text unique, mime_type text check(mime_type in ('application/pdf','image/jpeg','image/png')),
 byte_size int check(byte_size between 1 and 2097152), sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('PENDING_UPLOAD','UPLOADED_UNSCANNED','DEMO','FAILED')),
 is_demo boolean not null, created_at timestamptz not null default now(),
 check((is_demo and status='DEMO' and object_key is null) or (not is_demo and object_key is not null and mime_type is not null and byte_size is not null and sha256 is not null))
);
create table public.nc_property_claims (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.nc_properties(id) on delete cascade,
 claim_key text not null check(claim_key in ('address','lot_acres','zoning','utilities','road_access','asking_price','listing_status','ownership')),
 claimed_value text not null, status text not null default 'UNVERIFIED' check(status in ('VERIFIED','UNVERIFIED','REJECTED','NEEDS_REVIEW')),
 evidence_id uuid references public.nc_property_evidence(id), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 review_note text not null default '' check(length(review_note)<=2000), unique(property_id,claim_key)
);
create table public.nc_property_contacts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 property_id uuid not null references public.nc_properties(id) on delete cascade,
 name text not null check(length(btrim(name)) between 2 and 120), email text not null default '' check(length(email)<=254),
 phone text not null default '' check(length(phone)<=40), source text not null check(length(btrim(source)) between 5 and 1000),
 is_demo boolean not null, revision int not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id)
);
create table public.nc_property_permissions (
 id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 contact_id uuid not null references public.nc_property_contacts(id) on delete cascade,
 channel text not null check(channel in ('EMAIL','SMS','WHATSAPP','CALL','POST')), granted boolean not null,
 purpose text not null default 'property-networking' check(purpose='property-networking'),
 evidence text not null check(length(btrim(evidence)) between 5 and 2000), policy_version text not null default '2026-11-v1',
 created_at timestamptz not null default clock_timestamp()
);
create table public.nc_property_outreach (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 property_id uuid not null references public.nc_properties(id), contact_id uuid not null references public.nc_property_contacts(id),
 channel text not null check(channel in ('NOTE','EMAIL','SMS','WHATSAPP','CALL','POST')),
 notes text not null check(length(btrim(notes)) between 5 and 3000), manual_attestation boolean not null,
 is_demo boolean not null, mode text not null check(mode in ('NOTE','MANUAL_LOG','DEMO_LOG')), created_at timestamptz not null default now()
);
create table public.nc_developers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 2 and 120), region text not null check(length(btrim(region)) between 2 and 100),
 min_acres numeric(12,3) not null default 0 check(min_acres>=0), max_acres numeric(12,3) not null check(max_acres>=min_acres),
 max_price numeric(14,2) not null check(max_price>0), zoning text[] not null default '{}' check(cardinality(zoning)<=20),
 preferences text not null default '' check(length(preferences)<=1000), email text not null default '' check(length(email)<=254),
 email_opt_in boolean not null default false, permission_evidence text not null default '' check(length(permission_evidence)<=2000),
 is_demo boolean not null default false, active boolean not null default true, revision int not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,name),
 check(not email_opt_in or length(btrim(permission_evidence))>=5)
);
create table public.nc_partner_templates (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade,
 partner_id uuid references public.nc_developers(id), template_key text not null check(template_key ~ '^[a-z0-9-]{1,100}$'),
 version int not null check(version>0), title text not null check(length(title) between 3 and 120),
 field_mapping jsonb not null check(jsonb_typeof(field_mapping)='object' and field_mapping<>'{}'::jsonb),
 approved boolean not null default false, is_demo boolean not null default false,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 check((partner_id is null and owner_id is null and is_demo) or (partner_id is not null and owner_id is not null)), unique(template_key,version,partner_id)
);
create unique index nc_global_partner_template_version on public.nc_partner_templates(template_key,version) where partner_id is null;
create table public.nc_partner_forms (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 property_id uuid not null references public.nc_properties(id), partner_id uuid not null references public.nc_developers(id),
 template_id uuid not null references public.nc_partner_templates(id), payload jsonb not null,
 version int not null default 1 check(version>0), property_revision int not null, partner_revision int not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','SIMULATED_SENT')),
 invalid_reason text not null default '', submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nc_form_reviews (
 id uuid primary key default gen_random_uuid(), form_id uuid not null references public.nc_partner_forms(id),
 owner_id uuid not null references auth.users(id), reviewer_id uuid not null references auth.users(id), version int not null,
 decision text not null check(decision in ('APPROVED','REJECTED')), note text not null check(length(btrim(note)) between 5 and 2000),
 payload_snapshot jsonb not null, created_at timestamptz not null default now(), check(owner_id<>reviewer_id), unique(form_id,version)
);
create table public.nc_form_deliveries (
 id uuid primary key default gen_random_uuid(), form_id uuid not null unique references public.nc_partner_forms(id),
 owner_id uuid not null references auth.users(id), reviewer_id uuid not null references auth.users(id),
 form_version int not null, payload_snapshot jsonb not null, recipient_snapshot jsonb not null,
 mode text not null default 'DEMO' check(mode='DEMO'), status text not null default 'SIMULATED_SENT' check(status='SIMULATED_SENT'),
 provider_reference text not null unique, created_at timestamptz not null default now()
);
create index nc_properties_owner on public.nc_properties(owner_id,updated_at desc);
create index nc_imports_owner on public.nc_property_imports(owner_id,created_at desc);
create index nc_import_rows_owner on public.nc_property_import_rows(owner_id,import_id);
create index nc_evidence_property on public.nc_property_evidence(property_id,owner_id);
create index nc_claims_property on public.nc_property_claims(property_id,status);
create index nc_contacts_owner on public.nc_property_contacts(owner_id);
create index nc_permissions_latest on public.nc_property_permissions(contact_id,channel,id desc);
create index nc_outreach_owner on public.nc_property_outreach(owner_id,property_id);
create index nc_developers_owner on public.nc_developers(owner_id);
create index nc_forms_owner on public.nc_partner_forms(owner_id,status);
create index nc_form_reviews_form on public.nc_form_reviews(form_id,version);
create index nc_deliveries_owner on public.nc_form_deliveries(owner_id);

create function nc_private.can_read_property(subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nc_properties where id=subject and (owner_id=auth.uid() or nc_private.is_admin()))
$$;
revoke all on function nc_private.can_read_property(uuid) from public,anon;
grant execute on function nc_private.can_read_property(uuid) to authenticated;
create function nc_private.guard_property() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.owner_id<>old.owner_id or new.is_demo<>old.is_demo then raise exception 'Property identity and demo mode are immutable'; end if;
  if (new.address,new.region,new.postal_code,new.lot_acres,new.zoning,new.utilities,new.road_access,new.asking_price,new.listing_status,new.source,new.license_evidence) is distinct from (old.address,old.region,old.postal_code,old.lot_acres,old.zoning,old.utilities,old.road_access,old.asking_price,old.listing_status,old.source,old.license_evidence) then new.revision=old.revision+1; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
create function nc_private.property_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare k text; val text; reset_source boolean:=false;
begin
 if TG_OP='UPDATE' then reset_source=(new.source,new.license_evidence) is distinct from (old.source,old.license_evidence); end if;
 foreach k in array array['address','lot_acres','zoning','utilities','road_access','asking_price','listing_status','ownership'] loop
  val=case when k='ownership' then 'Ownership evidence' when k='address' then new.address||', '||new.region||' '||new.postal_code else coalesce(nullif(to_jsonb(new)->>k,''),'Not provided') end;
  insert into public.nc_property_claims(property_id,claim_key,claimed_value) values(new.id,k,val)
  on conflict(property_id,claim_key) do update set claimed_value=excluded.claimed_value,status='UNVERIFIED',evidence_id=null,reviewed_by=null,reviewed_at=null,review_note=''
  where public.nc_property_claims.claimed_value is distinct from excluded.claimed_value or reset_source;
 end loop;
 if TG_OP='UPDATE' and new.revision<>old.revision then
  update public.nc_partner_forms set status='DRAFT',version=version+1,invalid_reason='Property or verification changed. Regenerate this form.',updated_at=now() where property_id=new.id and status<>'SIMULATED_SENT';
 end if;
 return new;
end $$;
create trigger nc_property_guard before update on public.nc_properties for each row execute function nc_private.guard_property();
create trigger nc_property_changed after insert or update on public.nc_properties for each row execute function nc_private.property_changed();
create function nc_private.developer_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.id<>old.id or new.owner_id<>old.owner_id or new.is_demo<>old.is_demo then raise exception 'Partner identity and demo mode are immutable'; end if;
 if (to_jsonb(new)-array['updated_at','revision']) is distinct from (to_jsonb(old)-array['updated_at','revision']) then
  new.revision=old.revision+1;
  update public.nc_partner_forms set status='DRAFT',version=version+1,invalid_reason='Partner preferences or permissions changed. Regenerate this form.',updated_at=now() where partner_id=new.id and status<>'SIMULATED_SENT';
 end if;
 new.updated_at=now(); return new;
end $$;
create trigger nc_developer_changed before update on public.nc_developers for each row execute function nc_private.developer_changed();
create function nc_private.guard_partner_template() returns trigger language plpgsql security definer set search_path='' as $$
declare source_field text; target_field text;
begin
 if not nc_private.is_admin() or new.created_by is distinct from auth.uid() then raise exception 'Administrator required'; end if;
 if new.partner_id is not null and not exists(select 1 from public.nc_developers where id=new.partner_id and owner_id=new.owner_id and is_demo=new.is_demo) then raise exception 'Partner ownership and mode must match'; end if;
 if (select count(*) from jsonb_object_keys(new.field_mapping))>20 then raise exception 'Too many mapped fields'; end if;
 for target_field,source_field in select key,value from jsonb_each_text(new.field_mapping) loop
  if target_field !~ '^[A-Za-z][A-Za-z0-9_]{0,49}$' or source_field is null or jsonb_typeof(new.field_mapping->target_field)<>'string' or source_field not in ('address','region','postal_code','lot_acres','zoning','utilities','road_access','asking_price','listing_status','source','license_evidence','verification_summary') then raise exception 'Unsupported template field mapping'; end if;
 end loop;
 return new;
end $$;
-- Global fictitious template is inserted before the administrator guard exists.
insert into public.nc_partner_templates(id,template_key,version,title,field_mapping,approved,is_demo) values
('f0000000-0000-4000-8000-000000000001','vacant-land-demo',1,'Vacant land introduction (Demo)','{"site_address":"address","region":"region","acres":"lot_acres","zoning":"zoning","asking_price":"asking_price"}',true,true);
create trigger nc_partner_template_guard before insert on public.nc_partner_templates for each row execute function nc_private.guard_partner_template();

do $$ declare t text; begin
 foreach t in array array['nc_properties','nc_property_imports','nc_property_import_rows','nc_property_evidence','nc_property_claims','nc_property_contacts','nc_property_permissions','nc_property_outreach','nc_developers','nc_partner_templates','nc_partner_forms','nc_form_reviews','nc_form_deliveries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger nc_phase2_audit after insert or update or delete on public.%I for each row execute function nc_private.audit_change()',t);
 end loop;
 foreach t in array array['nc_properties','nc_property_imports','nc_property_import_rows','nc_property_evidence','nc_property_contacts','nc_property_permissions','nc_property_outreach','nc_developers','nc_partner_forms','nc_form_reviews','nc_form_deliveries'] loop
  execute format('create policy nc_real_estate_read on public.%I for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin())',t);
 end loop;
end $$;
create policy nc_claim_read on public.nc_property_claims for select to authenticated using(nc_private.can_read_property(property_id));
create policy nc_partner_template_read on public.nc_partner_templates for select to authenticated using((partner_id is null and is_demo and approved) or owner_id=auth.uid() or nc_private.is_admin());
grant insert(owner_id,address,region,postal_code,lot_acres,zoning,utilities,road_access,asking_price,listing_status,source,license_evidence,is_demo) on public.nc_properties to authenticated;
grant update(address,region,postal_code,lot_acres,zoning,utilities,road_access,asking_price,listing_status,source,license_evidence) on public.nc_properties to authenticated;
create policy nc_property_insert on public.nc_properties for insert to authenticated with check(owner_id=auth.uid());
create policy nc_property_update on public.nc_properties for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant insert(owner_id,name,region,min_acres,max_acres,max_price,zoning,preferences,email,email_opt_in,permission_evidence,is_demo,active) on public.nc_developers to authenticated;
grant update(name,region,min_acres,max_acres,max_price,zoning,preferences,email,email_opt_in,permission_evidence,active) on public.nc_developers to authenticated;
create policy nc_developer_insert on public.nc_developers for insert to authenticated with check(owner_id=auth.uid());
create policy nc_developer_update on public.nc_developers for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant insert(owner_id,partner_id,template_key,version,title,field_mapping,approved,is_demo,created_by) on public.nc_partner_templates to authenticated;
create policy nc_template_admin_insert on public.nc_partner_templates for insert to authenticated with check(nc_private.is_admin() and created_by=auth.uid());
revoke all on function nc_private.guard_property(),nc_private.property_changed(),nc_private.developer_changed(),nc_private.guard_partner_template() from public,anon,authenticated;
commit;
