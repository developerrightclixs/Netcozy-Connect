-- Atomic capacity, immutable price snapshots, no live payment integration.
begin;
do $$begin if to_regprocedure('public.nc_save_market_listing(jsonb)') is null then raise exception 'Apply Phase 3 migrations 006 and 007 successfully before migration 008';end if;end $$;
create function public.nc_register_event(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.nc_market_listings;o public.nc_event_orders;actor uuid:=auth.uid();n int:=(input->>'quantity')::int;used int;i int;
begin
 if actor is null or input->>'attested' is distinct from 'true' then raise exception 'Authentication and registration acknowledgement required';end if;
 -- Buyer request-key serialization plus a shared event row lock prevents duplicate orders and overbooking.
 perform pg_advisory_xact_lock(hashtext('event-order:'||actor::text));
 select * into o from public.nc_event_orders where buyer_id=actor and request_key=(input->>'request_key')::uuid;
 if found then return to_jsonb(o);end if;
 select * into l from public.nc_market_listings where id=(input->>'listing_id')::uuid for update;
 if not found or l.module<>'EVENT' or l.status<>'PUBLISHED' or not nc_private.listing_owner_role(l) or (l.facts->>'closes_at')::timestamptz<=now() or (l.facts->>'starts_at')::timestamptz<=now() then raise exception 'Published event with open registration required';end if;
 if n is null or n not between 1 and 5 then raise exception 'Register 1-5 tickets';end if;
 if l.price_minor>0 and not l.is_demo then raise exception 'CHECKOUT_BLOCKED: live payment provider is not configured';end if;
 if l.is_demo and input->>'demo_attestation' is distinct from 'true' then raise exception 'Explicit DEMO checkout acknowledgement required';end if;
 if exists(select 1 from public.nc_event_orders where listing_id=l.id and buyer_id=actor and status='CONFIRMED') then raise exception 'An active registration already exists';end if;
 select coalesce(sum(quantity),0)::int into used from public.nc_event_orders where listing_id=l.id and status='CONFIRMED';
 if used+n>(l.facts->>'capacity')::int then raise exception 'Event capacity exceeded';end if;
 insert into public.nc_event_orders(listing_id,buyer_id,organizer_id,request_key,quantity,unit_price_minor,total_minor,currency,mode,status,event_snapshot)
 values(l.id,actor,l.owner_id,(input->>'request_key')::uuid,n,l.price_minor,l.price_minor*n,l.currency,case when l.is_demo then 'DEMO' else 'FREE' end,'CONFIRMED',jsonb_build_object('title',l.title,'region',l.region,'facts',l.facts,'revision',l.revision,'is_demo',l.is_demo)) returning * into o;
 for i in 1..n loop insert into public.nc_event_tickets(order_id,listing_id,buyer_id,organizer_id) values(o.id,l.id,actor,l.owner_id);end loop;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id,details) values(actor,l.id,l.owner_id,actor,'EVENT_REGISTERED',o.id::text,jsonb_build_object('quantity',n,'mode',o.mode,'total_minor',o.total_minor));
 return to_jsonb(o);
end $$;
create function public.nc_cancel_event_order(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.nc_event_orders;l public.nc_market_listings;
begin
 select * into o from public.nc_event_orders where id=(input->>'id')::uuid;
 if not found then raise exception 'Order not found';end if;
 select * into l from public.nc_market_listings where id=o.listing_id for update;
 select * into o from public.nc_event_orders where id=o.id for update;
 if auth.uid() is null or (o.buyer_id<>auth.uid() and o.organizer_id is distinct from auth.uid()) then raise exception 'Buyer or event organizer required';end if;
 if o.status='CANCELLED' then return to_jsonb(o);end if;
 if exists(select 1 from public.nc_event_tickets where order_id=o.id and status='CHECKED_IN') then raise exception 'Checked-in orders cannot be cancelled';end if;
 update public.nc_event_orders set status='CANCELLED' where id=o.id returning * into o;
 update public.nc_event_tickets set status='CANCELLED' where order_id=o.id;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id) values(auth.uid(),l.id,o.organizer_id,o.buyer_id,'EVENT_CANCELLED',o.id::text);
 return to_jsonb(o);
end $$;
create function public.nc_checkin_event_ticket(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.nc_market_listings;t public.nc_event_tickets;
begin
 select * into l from public.nc_market_listings where id=(input->>'listing_id')::uuid for update;
 if not found or auth.uid() is null or not ((l.owner_id=auth.uid() and nc_private.module_role(auth.uid(),'ORGANIZER')) or (l.owner_id is null and l.is_demo and nc_private.is_admin())) then raise exception 'Current event organizer required';end if;
 if (l.facts->>'ends_at')::timestamptz<now() then raise exception 'Event has ended';end if;
 if not l.is_demo and now()<(l.facts->>'starts_at')::timestamptz-interval '2 hours' then raise exception 'Check-in opens two hours before the event';end if;
 select * into t from public.nc_event_tickets where listing_id=l.id and reference=input->>'reference' for update;
 if not found or t.status<>'VALID' or not exists(select 1 from public.nc_event_orders where id=t.order_id and status='CONFIRMED') then raise exception 'Unused valid ticket required';end if;
 update public.nc_event_tickets set status='CHECKED_IN',checked_in_at=now() where id=t.id returning * into t;
 insert into public.nc_module_history(actor_id,listing_id,owner_id,participant_id,action,entity_id) values(auth.uid(),l.id,l.owner_id,t.buyer_id,'TICKET_CHECKED_IN',t.id::text);
 return to_jsonb(t);
end $$;
do $$ declare sig text;begin
 foreach sig in array array['nc_register_event(jsonb)','nc_cancel_event_order(jsonb)','nc_checkin_event_ticket(jsonb)'] loop execute 'revoke all on function public.'||sig||' from public,anon,authenticated';execute 'grant execute on function public.'||sig||' to authenticated';end loop;
end $$;

-- Global fictitious catalog: no Auth users, real sellers, contacts or verification claims.
insert into public.nc_market_listings(id,module,title,region,summary,facts,price_minor,currency,is_demo,status) values
('a3000000-0000-4000-8000-000000000001','TALENT','Mobile QA testing opportunity (Demo)','Texas','Fictitious tester opportunity for exploring skills matching. No real recruitment or employer.', '{"kind":"TESTER","skills":["mobile QA","usability"],"remote":true,"engagement":"Fictitious paid project; no real compensation"}',25000,'USD',true,'PUBLISHED'),
('a3000000-0000-4000-8000-000000000002','YACHT','Serein 42m motor yacht (Demo)','Florida','Fictitious yacht listing. Demo agent: Harbor Marine. No real inventory, seller or agent.', '{"length_m":42,"year":2019,"guests":12,"offer":"CHARTER"}',null,'USD',true,'PUBLISHED'),
('a3000000-0000-4000-8000-000000000003','AVIATION','G450 business aircraft (Demo)','New Jersey','Fictitious aircraft listing. Demo agent: Vista Aviation. No real inventory, seller or agent.', '{"make":"Illustrative","model":"G450","year":2015,"seats":14,"hours":3200,"offer":"SALE"}',null,'USD',true,'PUBLISHED'),
('a3000000-0000-4000-8000-000000000004','VEHICLE','Executive electric SUV (Demo)','Florida','Fictitious dealer inventory to explore the vehicle marketplace. No real vehicle is offered.', '{"make":"Sample","model":"Executive EV","year":2025,"mileage_km":4200,"fuel":"Electric","seller_type":"DEALER"}',5890000,'USD',true,'PUBLISHED'),
('a3000000-0000-4000-8000-000000000005','EVENT','Buildnet networking evening (Demo)','Florida','Fictitious event for testing free demo registrations and tickets. No actual admission or event.', '{"starts_at":"2027-02-15T18:00:00Z","ends_at":"2027-02-15T22:00:00Z","closes_at":"2027-02-15T17:00:00Z","venue":"Fictitious Demo Hall","capacity":50}',0,'USD',true,'PUBLISHED'),
('a3000000-0000-4000-8000-000000000006','EVENT','Workaway rooftop gathering (Demo)','Florida','Fictitious paid event for simulated checkout only. No charge, payment collection or real ticket.', '{"starts_at":"2027-03-20T18:00:00Z","ends_at":"2027-03-20T22:00:00Z","closes_at":"2027-03-20T17:00:00Z","venue":"Fictitious Rooftop Venue","capacity":30}',4500,'USD',true,'PUBLISHED');
insert into public.nc_talent_candidates(id,name,headline,region,skills,kind,remote,available,bio,discoverable,is_demo) values
('c3000000-0000-4000-8000-000000000001','Maya Sample (Demo)','Mobile QA and usability tester','Texas',array['mobile QA','usability','regression'],'TESTER',true,true,'Fictitious demo profile. Not a real person, consent record or contact.',true,true),
('c3000000-0000-4000-8000-000000000002','Alex Example (Demo)','Frontend developer','Remote',array['React','TypeScript','accessibility'],'JOB',true,true,'Fictitious demo profile. No real candidate or contact information.',true,true),
('c3000000-0000-4000-8000-000000000003','Lena Sample (Demo)','Commission sales specialist','Florida',array['sales','partnerships'],'COMMISSION',false,true,'Fictitious demo profile. No real candidate or outreach permission.',true,true);
commit;
