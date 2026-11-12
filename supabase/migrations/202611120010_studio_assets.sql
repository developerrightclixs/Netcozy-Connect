begin;
create table public.nc_studio_assets (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 label text not null check(length(btrim(label)) between 3 and 120),
 object_key text not null unique, mime_type text not null check(mime_type in ('image/png','image/jpeg')),
 byte_size integer not null check(byte_size between 1 and 2097152),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 rights_note text not null check(length(btrim(rights_note)) between 5 and 500),
 status text not null default 'PENDING_UPLOAD' check(status in ('PENDING_UPLOAD','FAILED','UPLOADED_UNSCANNED')),
 created_at timestamptz not null default now()
);
alter table public.nc_studio_creatives add column asset_id uuid references public.nc_studio_assets(id);
alter table public.nc_studio_assets enable row level security;
revoke all on public.nc_studio_assets from public,anon,authenticated;
grant select on public.nc_studio_assets to authenticated;
create policy nc_studio_assets_private on public.nc_studio_assets for select to authenticated using(owner_id=auth.uid() or nc_private.is_admin());
create trigger nc_studio_asset_audit after insert or update or delete on public.nc_studio_assets for each row execute function nc_private.audit_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('netcozy-studio-assets','netcozy-studio-assets',false,2097152,array['image/png','image/jpeg']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='netcozy-studio-assets' and (public or file_size_limit is null or file_size_limit>2097152 or allowed_mime_types is null or not allowed_mime_types<@array['image/png','image/jpeg'])) then raise exception 'Review existing studio bucket settings';end if;
end $$;
create function public.nc_studio_asset(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.nc_studio_assets; c public.nc_studio_creatives; b public.nc_studio_brands; act text:=input->>'action';
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if act='register' then
  if input->>'acknowledge' is distinct from 'true' then raise exception 'Usage rights acknowledgement required';end if;
  insert into public.nc_studio_assets(id,owner_id,label,object_key,mime_type,byte_size,sha256,rights_note)
  values((input->>'id')::uuid,auth.uid(),input->>'label',auth.uid()::text||'/'||(input->>'id'),input->>'mime_type',(input->>'byte_size')::int,input->>'sha256',input->>'rights_note') returning * into a;
 elsif act='complete' then
  select * into a from public.nc_studio_assets where id=(input->>'id')::uuid and owner_id=auth.uid() for update;
  if a.id is null or a.status<>'PENDING_UPLOAD' then raise exception 'Pending owned asset required';end if;
  if input->>'failed'='true' then
   update public.nc_studio_assets set status='FAILED' where id=a.id returning * into a;
  else
   if not exists(select 1 from storage.objects where bucket_id='netcozy-studio-assets' and name=a.object_key and metadata->>'mimetype'=a.mime_type and (metadata->>'size')::bigint=a.byte_size) then raise exception 'Matching private storage object required';end if;
   update public.nc_studio_assets set status='UPLOADED_UNSCANNED' where id=a.id returning * into a;
  end if;
 elsif act='attach' then
  select sb.* into b from public.nc_studio_brands sb join public.nc_studio_creatives sc on sc.brand_id=sb.id where sc.id=(input->>'creative_id')::uuid and sc.owner_id=auth.uid() for update of sb;
  if b.id is null then raise exception 'Owned creative required';end if;
  select * into c from public.nc_studio_creatives where id=(input->>'creative_id')::uuid for update;
  if c.revision is distinct from (input->>'revision')::int or c.kind='TEXT' then raise exception 'Current image/video creative required';end if;
  select * into a from public.nc_studio_assets where id=(input->>'id')::uuid and owner_id=auth.uid() and status='UPLOADED_UNSCANNED';
  if a.id is null then raise exception 'Owned uploaded asset required';end if;
  update public.nc_studio_creatives set asset_id=a.id,revision=revision+1,status='DRAFT',approved_revision=null,updated_at=now() where id=c.id returning * into c;
  return to_jsonb(c);
 else raise exception 'Unsupported asset action';
 end if;
 return to_jsonb(a);
end $$;
create policy nc_studio_storage_read on storage.objects for select to authenticated using(bucket_id='netcozy-studio-assets' and exists(select 1 from public.nc_studio_assets a where a.object_key=name and (a.owner_id=auth.uid() or nc_private.is_admin())));
create policy nc_studio_storage_insert on storage.objects for insert to authenticated with check(bucket_id='netcozy-studio-assets' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.nc_studio_assets a where a.object_key=name and a.owner_id=auth.uid() and a.status='PENDING_UPLOAD'));
revoke all on function public.nc_studio_asset(jsonb) from public,anon,authenticated;
grant execute on function public.nc_studio_asset(jsonb) to authenticated;
commit;
