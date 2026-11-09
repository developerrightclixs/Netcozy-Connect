begin;
-- Fictitious directory examples only. These are not real accounts or real-world consent evidence.
insert into public.nc_directory(id,name,headline,industry,intent,region,skills) values
('d0000000-0000-4000-8000-000000000001','Alex Morgan (Demo)','Product tester and UX researcher','talent','work','Texas',array['testing','ux','mobile']),
('d0000000-0000-4000-8000-000000000002','Sam Rivera (Demo)','Quality assurance specialist','talent','work','Texas',array['testing','qa','android']),
('d0000000-0000-4000-8000-000000000003','Jordan Lee (Demo)','Recruiting team seeking collaborators','talent','hire','California',array['testing','recruiting']),
('d0000000-0000-4000-8000-000000000004','Taylor Brooks (Demo)','Employee benefits partnerships','business','partner','Texas',array['benefits','sales']),
('d0000000-0000-4000-8000-000000000005','Casey Patel (Demo)','Small business partnerships','business','partner','California',array['marketing','sales']),
('d0000000-0000-4000-8000-000000000006','Avery Chen (Demo)','Land networking interests','real-estate','partner','Texas',array['land','development']),
('d0000000-0000-4000-8000-000000000007','Riley Diaz (Demo)','Property buyer networking','real-estate','buy','California',array['land']),
('d0000000-0000-4000-8000-000000000008','Quinn Ellis (Demo)','Marine and aviation networking','yachts-aviation','sell','Florida',array['marine','aviation']),
('d0000000-0000-4000-8000-000000000009','Drew Kim (Demo)','Vehicle market networking','vehicles','sell','California',array['vehicles','logistics']),
('d0000000-0000-4000-8000-000000000010','Rowan Park (Demo)','Community event organizer','events','organize','Texas',array['music','art']),
('d0000000-0000-4000-8000-000000000011','Skyler Adams (Demo)','Creative collaboration','marketing','partner','Texas',array['marketing','design']),
('d0000000-0000-4000-8000-000000000012','Emery Wilson (Demo)','Marketing support','marketing','promote','California',array['marketing','video']);
commit;
