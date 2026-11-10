-- Phase 2 bounded imports, contacts, partner form approval and demo delivery.
begin;
alter table public.nc_property_permissions add column contact_revision int not null;
create function public.nc_import_properties(meta jsonb, records jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); run public.nc_property_imports; item jsonb; oldp public.nc_properties; pid uuid; pos int:=0; row_disposition text; k text;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if meta->>'attested' is distinct from 'true' or length(btrim(meta->>'source')) not between 3 and 200 or length(btrim(meta->>'license_evidence')) not between 5 and 2000 then raise exception 'Source authorization and license evidence required'; end if;
 if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) not between 1 and 200 then raise exception 'Import requires 1 to 200 rows'; end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into run from public.nc_property_imports where owner_id=actor and request_key=(meta->>'request_key')::uuid;
 if found then return to_jsonb(run); end if;
 insert into public.nc_property_imports(owner_id,request_key,source,license_evidence,is_demo,status,total_rows)
 values(actor,(meta->>'request_key')::uuid,meta->>'source',meta->>'license_evidence',(meta->>'is_demo')::boolean,'RUNNING',jsonb_array_length(records)) returning * into run;
 begin
  for item in select value from jsonb_array_elements(records) loop
   pos=pos+1;
   k=lower(regexp_replace(btrim(item->>'address')||'|'||btrim(item->>'region')||'|'||btrim(coalesce(item->>'postal_code','')),'\s+',' ','g'));
   select * into oldp from public.nc_properties where owner_id=actor and dedupe_key=k for update;
   if not found then
    insert into public.nc_properties(owner_id,address,region,postal_code,lot_acres,zoning,utilities,road_access,asking_price,listing_status,source,license_evidence,is_demo)
    values(actor,item->>'address',item->>'region',coalesce(item->>'postal_code',''),(item->>'lot_acres')::numeric,coalesce(item->>'zoning',''),coalesce(item->>'utilities',''),coalesce(item->>'road_access',''),(item->>'asking_price')::numeric,item->>'listing_status',meta->>'source',meta->>'license_evidence',(meta->>'is_demo')::boolean) returning id into pid;
    row_disposition='INSERTED';
   else
    pid=oldp.id;
    if oldp.is_demo is distinct from (meta->>'is_demo')::boolean then raise exception 'Cannot replace a real record with demo data or vice versa'; end if;
    if (oldp.lot_acres,oldp.zoning,oldp.utilities,oldp.road_access,oldp.asking_price,oldp.listing_status,oldp.source,oldp.license_evidence) is not distinct from ((item->>'lot_acres')::numeric,coalesce(item->>'zoning',''),coalesce(item->>'utilities',''),coalesce(item->>'road_access',''),(item->>'asking_price')::numeric,item->>'listing_status',meta->>'source',meta->>'license_evidence') then
     row_disposition='UNCHANGED';
     update public.nc_properties set source_updated_at=clock_timestamp() where id=pid;
    else
     row_disposition='UPDATED';
     update public.nc_properties set lot_acres=(item->>'lot_acres')::numeric,zoning=coalesce(item->>'zoning',''),utilities=coalesce(item->>'utilities',''),road_access=coalesce(item->>'road_access',''),asking_price=(item->>'asking_price')::numeric,listing_status=item->>'listing_status',source=meta->>'source',license_evidence=meta->>'license_evidence',source_updated_at=clock_timestamp() where id=pid;
    end if;
   end if;
   insert into public.nc_property_import_rows(import_id,owner_id,row_number,property_id,disposition) values(run.id,actor,pos+1,pid,row_disposition);
  end loop;
  update public.nc_property_imports set status='COMPLETED',completed_at=clock_timestamp(),
   inserted_count=(select count(*) from public.nc_property_import_rows where import_id=run.id and disposition='INSERTED'),
   updated_count=(select count(*) from public.nc_property_import_rows where import_id=run.id and disposition='UPDATED'),
   unchanged_count=(select count(*) from public.nc_property_import_rows where import_id=run.id and disposition='UNCHANGED') where id=run.id returning * into run;
 exception when others then
  update public.nc_property_imports set status='FAILED',error_code='IMPORT_REJECTED',completed_at=clock_timestamp() where id=run.id returning * into run;
 end;
 return to_jsonb(run);
end $$;
create function public.nc_save_property_contact(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.nc_properties; result public.nc_property_contacts;
begin
 select * into p from public.nc_properties where id=(input->>'property_id')::uuid and owner_id=auth.uid() for update;
 if not found then raise exception 'Property ownership required'; end if;
 insert into public.nc_property_contacts(owner_id,property_id,name,email,phone,source,is_demo)
 values(auth.uid(),p.id,input->>'name',coalesce(input->>'email',''),coalesce(input->>'phone',''),input->>'source',p.is_demo)
 on conflict(property_id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,source=excluded.source,
 revision=case when (public.nc_property_contacts.name,public.nc_property_contacts.email,public.nc_property_contacts.phone,public.nc_property_contacts.source) is distinct from (excluded.name,excluded.email,excluded.phone,excluded.source) then public.nc_property_contacts.revision+1 else public.nc_property_contacts.revision end,updated_at=now() returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_record_property_permission(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.nc_property_contacts; result public.nc_property_permissions;
begin
 select * into c from public.nc_property_contacts where id=(input->>'contact_id')::uuid and owner_id=auth.uid() for update;
 if not found then raise exception 'Contact ownership required'; end if;
 insert into public.nc_property_permissions(owner_id,contact_id,contact_revision,channel,granted,evidence)
 values(auth.uid(),c.id,c.revision,input->>'channel',(input->>'granted')::boolean,input->>'evidence') returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_log_property_outreach(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.nc_property_contacts; allowed boolean; result public.nc_property_outreach; requested_channel text:=input->>'channel';
begin
 select * into c from public.nc_property_contacts where id=(input->>'contact_id')::uuid and owner_id=auth.uid() for update;
 if not found then raise exception 'Contact ownership required'; end if;
 if requested_channel<>'NOTE' then
  select granted into allowed from public.nc_property_permissions where contact_id=c.id and contact_revision=c.revision and nc_property_permissions.channel=requested_channel order by id desc limit 1;
  if allowed is distinct from true or input->>'manual_attestation' is distinct from 'true' then raise exception 'Current contact permission and manual action attestation required'; end if;
  if requested_channel in ('SMS','WHATSAPP','CALL') and c.phone='' then raise exception 'A supplied phone number is required'; end if;
  if requested_channel='EMAIL' and c.email='' then raise exception 'A supplied email address is required'; end if;
 end if;
 insert into public.nc_property_outreach(owner_id,property_id,contact_id,channel,notes,manual_attestation,is_demo,mode)
 values(auth.uid(),c.property_id,c.id,requested_channel,input->>'notes',coalesce((input->>'manual_attestation')::boolean,false),c.is_demo,case when requested_channel='NOTE' then 'NOTE' when c.is_demo then 'DEMO_LOG' else 'MANUAL_LOG' end) returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_demo_developers() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.nc_developers(owner_id,name,region,min_acres,max_acres,max_price,zoning,preferences,email,email_opt_in,permission_evidence,is_demo) values
 (auth.uid(),'Cedar Land Partners (Demo)','Texas',1,20,750000,array['Residential','Mixed use'],'Fictitious residential land networking','cedar@example.test',true,'Fictitious demo opt-in; not real consent',true),
 (auth.uid(),'Harbor Development (Demo)','Florida',2,50,1500000,array['Commercial','Mixed use'],'Fictitious mixed-use land networking','harbor@example.test',true,'Fictitious demo opt-in; not real consent',true),
 (auth.uid(),'Vista Community Builders (Demo)','Texas',0.5,8,400000,array['Residential'],'Fictitious community project networking','vista@example.test',true,'Fictitious demo opt-in; not real consent',true)
 on conflict(owner_id,name) do nothing;
end $$;
create function nc_private.form_payload(p public.nc_properties, mapping jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare output jsonb:='{}'; target text; source_field text; summary text;
begin
 select string_agg(claim_key||': '||status,', ' order by claim_key) into summary from public.nc_property_claims where property_id=p.id;
 for target,source_field in select key,value from jsonb_each_text(mapping) loop
  output=output||jsonb_build_object(target,case when source_field='verification_summary' then coalesce(summary,'UNVERIFIED') else coalesce(to_jsonb(p)->>source_field,'Not provided') end);
 end loop;
 -- Mandatory metadata cannot be removed through editable template fields.
 return output||jsonb_build_object('_verification',coalesce(summary,'UNVERIFIED'),'_source',p.source,'_license',p.license_evidence,'_demo',p.is_demo);
end $$;
create function public.nc_create_partner_form(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.nc_properties; d public.nc_developers; t public.nc_partner_templates; result public.nc_partner_forms;
begin
 if not nc_private.consent_ok(auth.uid(),'matching','platform') then raise exception 'Matching consent required'; end if;
 select * into p from public.nc_properties where id=(input->>'property_id')::uuid and owner_id=auth.uid() for update;
 if not found then raise exception 'Property ownership required'; end if;
 select * into d from public.nc_developers where id=(input->>'partner_id')::uuid and owner_id=auth.uid() and active;
 if not found then raise exception 'An active owned partner is required'; end if;
 select * into t from public.nc_partner_templates where id=(input->>'template_id')::uuid and approved and (partner_id=d.id or (partner_id is null and is_demo and p.is_demo and d.is_demo));
 if not found or t.is_demo is distinct from p.is_demo or p.is_demo is distinct from d.is_demo then raise exception 'An approved partner-specific template and matching demo mode are required'; end if;
 insert into public.nc_partner_forms(owner_id,property_id,partner_id,template_id,payload,property_revision,partner_revision)
 values(auth.uid(),p.id,d.id,t.id,nc_private.form_payload(p,t.field_mapping),p.revision,d.revision) returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_edit_partner_form(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.nc_partner_forms; p public.nc_properties; d public.nc_developers; t public.nc_partner_templates; fields jsonb; k text; result public.nc_partner_forms;
begin
 select * into f from public.nc_partner_forms where id=(input->>'id')::uuid and owner_id=auth.uid() for update;
 if not found or f.status='SIMULATED_SENT' then raise exception 'An unsent owned form is required'; end if;
 select * into p from public.nc_properties where id=f.property_id;
 select * into d from public.nc_developers where id=f.partner_id;
 select * into t from public.nc_partner_templates where id=f.template_id;
 fields=nc_private.form_payload(p,t.field_mapping);
 if input->>'regenerate' is distinct from 'true' then
  if jsonb_typeof(input->'fields') is distinct from 'object' then raise exception 'Mapped fields required'; end if;
  for k in select jsonb_object_keys(input->'fields') loop
   if not (t.field_mapping ? k) or jsonb_typeof(input->'fields'->k)<>'string' or length(input->'fields'->>k)>2000 then raise exception 'Only mapped string fields are editable'; end if;
  end loop;
  fields=fields||(input->'fields');
 end if;
 update public.nc_partner_forms set payload=fields,version=version+1,property_revision=p.revision,partner_revision=d.revision,status='DRAFT',invalid_reason='',submitted_at=null,updated_at=now() where id=f.id returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_submit_partner_form(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.nc_partner_forms; result public.nc_partner_forms;
begin
 select * into f from public.nc_partner_forms where id=(input->>'id')::uuid and owner_id=auth.uid() for update;
 if not found or f.status not in ('DRAFT','REJECTED') then raise exception 'An owned draft form is required'; end if;
 if not nc_private.consent_ok(auth.uid(),'matching','platform') then raise exception 'Matching consent required'; end if;
 if not exists(select 1 from public.nc_properties where id=f.property_id and revision=f.property_revision) or not exists(select 1 from public.nc_developers where id=f.partner_id and revision=f.partner_revision and active) then raise exception 'Form is stale; regenerate before review'; end if;
 -- Rejected revisions must be edited/regenerated before a new review.
 if exists(select 1 from public.nc_form_reviews where form_id=f.id and version=f.version) then raise exception 'Edit or regenerate the rejected revision before resubmitting'; end if;
 update public.nc_partner_forms set status='PENDING_REVIEW',submitted_at=now(),updated_at=now() where id=f.id returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_review_partner_form(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.nc_partner_forms; result public.nc_partner_forms; decision text:=input->>'decision';
begin
 if not nc_private.is_admin() then raise exception 'Administrator required'; end if;
 select * into f from public.nc_partner_forms where id=(input->>'id')::uuid for update;
 if not found or f.owner_id=auth.uid() or f.status<>'PENDING_REVIEW' then raise exception 'An independent reviewer and pending form are required'; end if;
 if input->>'acknowledge_unverified' is distinct from 'true' then raise exception 'Reviewer must acknowledge the verification disclosures'; end if;
 if decision not in ('APPROVED','REJECTED') then raise exception 'Invalid review decision'; end if;
 if not exists(select 1 from public.nc_properties where id=f.property_id and revision=f.property_revision) or not exists(select 1 from public.nc_developers where id=f.partner_id and revision=f.partner_revision and active) then raise exception 'Form is stale'; end if;
 insert into public.nc_form_reviews(form_id,owner_id,reviewer_id,version,decision,note,payload_snapshot) values(f.id,f.owner_id,auth.uid(),f.version,decision,input->>'note',f.payload);
 update public.nc_partner_forms set status=decision,updated_at=now() where id=f.id returning * into result;
 return to_jsonb(result);
end $$;
create function public.nc_simulate_partner_delivery(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.nc_partner_forms; p public.nc_properties; d public.nc_developers; t public.nc_partner_templates; review public.nc_form_reviews; result public.nc_form_deliveries;
begin
 -- Match edit-trigger locking order: property, partner, then form. Re-read the locked snapshot.
 select * into f from public.nc_partner_forms where id=(input->>'id')::uuid and owner_id=auth.uid();
 if not found then raise exception 'Form ownership required'; end if;
 select * into p from public.nc_properties where id=f.property_id for update;
 select * into d from public.nc_developers where id=f.partner_id for update;
 select * into f from public.nc_partner_forms where id=f.id for update;
 select * into result from public.nc_form_deliveries where form_id=f.id;
 if found then return to_jsonb(result); end if;
 if input->>'demo_attestation' is distinct from 'true' then raise exception 'Explicit simulation acknowledgement required'; end if;
 if f.status<>'APPROVED' then raise exception 'Reviewer approval required before delivery'; end if;
 if not nc_private.consent_ok(auth.uid(),'matching','platform') then raise exception 'Matching consent revoked'; end if;
 select * into t from public.nc_partner_templates where id=f.template_id;
 select * into review from public.nc_form_reviews where form_id=f.id and version=f.version and decision='APPROVED';
 if not found or review.reviewer_id=f.owner_id or review.payload_snapshot is distinct from f.payload then raise exception 'Approved snapshot does not match'; end if;
 if p.revision<>f.property_revision or d.revision<>f.partner_revision or not d.active or not t.approved then raise exception 'Approval is stale'; end if;
 if not d.email_opt_in or length(btrim(d.permission_evidence))<5 or d.email='' then raise exception 'Current partner email permission required'; end if;
 if not p.is_demo or not d.is_demo or not t.is_demo then raise exception 'Live delivery blocked: no authorized-domain provider is configured'; end if;
 insert into public.nc_form_deliveries(form_id,owner_id,reviewer_id,form_version,payload_snapshot,recipient_snapshot,provider_reference)
 values(f.id,f.owner_id,review.reviewer_id,f.version,f.payload,jsonb_build_object('name',d.name,'email',d.email,'permission',d.permission_evidence,'mode','DEMO'),'demo-'||gen_random_uuid()) returning * into result;
 update public.nc_partner_forms set status='SIMULATED_SENT',updated_at=now() where id=f.id;
 return to_jsonb(result);
end $$;
revoke all on function nc_private.form_payload(public.nc_properties,jsonb) from public,anon,authenticated;
do $$ declare name text; begin
 foreach name in array array['nc_import_properties(jsonb,jsonb)','nc_save_property_contact(jsonb)','nc_record_property_permission(jsonb)','nc_log_property_outreach(jsonb)','nc_demo_developers()','nc_create_partner_form(jsonb)','nc_edit_partner_form(jsonb)','nc_submit_partner_form(jsonb)','nc_review_partner_form(jsonb)','nc_simulate_partner_delivery(jsonb)'] loop
  execute 'revoke all on function public.'||name||' from public,anon,authenticated';
  execute 'grant execute on function public.'||name||' to authenticated';
 end loop;
end $$;
commit;
