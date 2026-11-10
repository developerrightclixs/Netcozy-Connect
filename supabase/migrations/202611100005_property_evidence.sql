-- Phase 2 private evidence storage and independent claim review. Supabase Storage must already exist.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('netcozy-property-evidence','netcozy-property-evidence',false,2097152,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='netcozy-property-evidence' and (public or file_size_limit is null or file_size_limit>2097152 or allowed_mime_types is null or not allowed_mime_types<@array['application/pdf','image/jpeg','image/png'])) then raise exception 'Existing property evidence bucket settings must be reviewed before migration'; end if;
end $$;
create function public.nc_demo_property_evidence(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.nc_properties; result public.nc_property_evidence;
begin
 select * into p from public.nc_properties where id=(input->>'property_id')::uuid and owner_id=auth.uid();
 if not found or not p.is_demo then raise exception 'Demo evidence requires an owned demo property'; end if;
 insert into public.nc_property_evidence(owner_id,property_id,label,content_note,status,is_demo)
 values(auth.uid(),p.id,input->>'label',input->>'content_note','DEMO',true) returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_register_property_evidence(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.nc_properties; result public.nc_property_evidence; doc uuid:=(input->>'id')::uuid;
begin
 select * into p from public.nc_properties where id=(input->>'property_id')::uuid and owner_id=auth.uid();
 if not found then raise exception 'Property ownership required'; end if;
 insert into public.nc_property_evidence(id,owner_id,property_id,label,object_key,mime_type,byte_size,sha256,status,is_demo)
 values(doc,auth.uid(),p.id,input->>'label',auth.uid()::text||'/'||p.id::text||'/'||doc::text,input->>'mime_type',(input->>'byte_size')::int,input->>'sha256','PENDING_UPLOAD',false) returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_complete_property_evidence(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.nc_property_evidence; result public.nc_property_evidence;
begin
 select * into e from public.nc_property_evidence where id=(input->>'id')::uuid and owner_id=auth.uid() and not is_demo for update;
 if not found or e.status not in ('PENDING_UPLOAD','FAILED') then raise exception 'Pending owned evidence required'; end if;
 if input->>'failed'='true' then
  update public.nc_property_evidence set status='FAILED' where id=e.id returning * into result;
 else
  if not exists(select 1 from storage.objects where bucket_id='netcozy-property-evidence' and name=e.object_key and metadata->>'mimetype'=e.mime_type and (metadata->>'size')::bigint=e.byte_size) then raise exception 'Matching private storage object required'; end if;
  update public.nc_property_evidence set status='UPLOADED_UNSCANNED' where id=e.id returning * into result;
 end if;
 return to_jsonb(result);
end $$;
create function public.nc_request_claim_review(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.nc_properties; e public.nc_property_evidence; result public.nc_property_claims;
begin
 select * into p from public.nc_properties where id=(input->>'property_id')::uuid and owner_id=auth.uid() for update;
 if not found then raise exception 'Property ownership required'; end if;
 select * into e from public.nc_property_evidence where id=(input->>'evidence_id')::uuid and property_id=p.id and status in ('DEMO','UPLOADED_UNSCANNED');
 if not found or (e.is_demo and not p.is_demo) then raise exception 'Matching evidence is required; demo evidence cannot verify real claims'; end if;
 update public.nc_property_claims set status='NEEDS_REVIEW',evidence_id=e.id,reviewed_by=null,reviewed_at=null,review_note='' where property_id=p.id and claim_key=input->>'claim_key' returning * into result;
 if not found then raise exception 'Claim not found'; end if;
 update public.nc_properties set revision=revision+1 where id=p.id;
 return to_jsonb(result);
end $$;
create function public.nc_review_property_claim(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.nc_property_claims; p public.nc_properties; e public.nc_property_evidence; result public.nc_property_claims; decision text:=input->>'decision';
begin
 if not nc_private.is_admin() then raise exception 'Administrator required'; end if;
 select * into c from public.nc_property_claims where id=(input->>'id')::uuid;
 if not found then raise exception 'Claim not found'; end if;
 select * into p from public.nc_properties where id=c.property_id for update;
 if p.owner_id=auth.uid() then raise exception 'An independent administrator must review claims'; end if;
 select * into c from public.nc_property_claims where id=c.id for update;
 if c.status<>'NEEDS_REVIEW' then raise exception 'Claim must be submitted for review'; end if;
 if decision not in ('VERIFIED','REJECTED','UNVERIFIED') or length(btrim(input->>'note')) not between 5 and 2000 then raise exception 'Review decision and explanation required'; end if;
 if decision='VERIFIED' then
  select * into e from public.nc_property_evidence where id=c.evidence_id and property_id=p.id;
  if not found or e.status not in ('DEMO','UPLOADED_UNSCANNED') or (e.is_demo and not p.is_demo) then raise exception 'Valid claim evidence required'; end if;
  if not e.is_demo and not exists(select 1 from storage.objects where bucket_id='netcozy-property-evidence' and name=e.object_key) then raise exception 'Evidence object is missing'; end if;
 end if;
 update public.nc_property_claims set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=input->>'note' where id=c.id returning * into result;
 update public.nc_properties set revision=revision+1 where id=p.id;
 return to_jsonb(result);
end $$;
create policy nc_evidence_storage_read on storage.objects for select to authenticated using(
 bucket_id='netcozy-property-evidence' and exists(select 1 from public.nc_property_evidence e where e.object_key=name and nc_private.can_read_property(e.property_id))
);
create policy nc_evidence_storage_insert on storage.objects for insert to authenticated with check(
 bucket_id='netcozy-property-evidence' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.nc_property_evidence e where e.object_key=name and e.owner_id=auth.uid() and e.status='PENDING_UPLOAD' and not e.is_demo)
);
-- No overwrite/delete policy: registered objects are immutable evidence.
do $$ declare name text; begin
 foreach name in array array['nc_demo_property_evidence(jsonb)','nc_register_property_evidence(jsonb)','nc_complete_property_evidence(jsonb)','nc_request_claim_review(jsonb)','nc_review_property_claim(jsonb)'] loop
  execute 'revoke all on function public.'||name||' from public,anon,authenticated';
  execute 'grant execute on function public.'||name||' to authenticated';
 end loop;
end $$;
commit;
