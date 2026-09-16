-- Run after all migrations, in an isolated Supabase test project, as postgres.
-- Transaction rolls back all fixtures. A failed assertion aborts the test.
begin;
insert into auth.users(id, email) values
 ('a0000000-0000-4000-8000-000000000001','phase2a-a@example.invalid'),
 ('b0000000-0000-4000-8000-000000000002','phase2a-b@example.invalid');
select private.provision_workshop('a0000000-0000-4000-8000-000000000001','Prueba Taller A','Maestro A');
select private.provision_workshop('b0000000-0000-4000-8000-000000000002','Prueba Taller B','Maestro B');
select set_config('test.workshop_a',(select id::text from public.workshops where created_by='a0000000-0000-4000-8000-000000000001'),true);
select set_config('test.workshop_b',(select id::text from public.workshops where created_by='b0000000-0000-4000-8000-000000000002'),true);
insert into public.clients(id,workshop_id,name,phone,commune) values
 ('a1000000-0000-4000-8000-000000000001',current_setting('test.workshop_a')::uuid,'Cliente A','+56911111111','Santiago'),
 ('b1000000-0000-4000-8000-000000000002',current_setting('test.workshop_b')::uuid,'Cliente B','+56922222222','Santiago');
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.projects(id,workshop_id,client_id,name,site_commune) values
 ('b2000000-0000-4000-8000-000000000002',current_setting('test.workshop_b')::uuid,'b1000000-0000-4000-8000-000000000002','Proyecto B','Santiago');
select set_config('test.config','{"type":"kitchen","kitchenLayout":"l","width":280,"secondLeg":180,"height":240,"depth":65,"upper":true,"lower":true,"rod":true,"shelves":3,"drawers":0,"sink":true,"oven":true,"hood":true,"material":"premium","color":"#8a6a46","unit":"cm"}',true);
insert into public.designs(id,workshop_id,project_id,name,type,configuration,schema_version,generator_version) values
 ('b3000000-0000-4000-8000-000000000002',current_setting('test.workshop_b')::uuid,'b2000000-0000-4000-8000-000000000002','Diseño B','kitchen',current_setting('test.config')::jsonb,1,'1.0.0');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare n integer; p uuid; code1 text; code2 text;
begin
  if (select count(*) from public.workshops) <> 1 then raise exception 'FAIL workshop isolation'; end if;
  if (select count(*) from public.workshop_members) <> 1 then raise exception 'FAIL membership isolation'; end if;
  if (select count(*) from public.clients) <> 1 then raise exception 'FAIL client isolation'; end if;
  if exists(select 1 from public.projects) or exists(select 1 from public.designs) then raise exception 'FAIL project/design isolation'; end if;
  update public.clients set name='Intrusión' where id='b1000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL cross update client'; end if;
  update public.projects set name='Intrusión' where id='b2000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL cross update project'; end if;
  update public.designs set name='Intrusión' where id='b3000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL cross update design'; end if;
  begin
    insert into public.clients(workshop_id,name,phone,commune) values(current_setting('test.workshop_b')::uuid,'Intrusión','1','Santiago');
    raise exception 'FAIL cross insert';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.projects(workshop_id,client_id,name,site_commune) values(current_setting('test.workshop_a')::uuid,'b1000000-0000-4000-8000-000000000002','Cruce','Santiago');
    raise exception 'FAIL cross client relation';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.designs(workshop_id,project_id,name,type,configuration,schema_version,generator_version)
      values(current_setting('test.workshop_a')::uuid,'b2000000-0000-4000-8000-000000000002','Cruce','kitchen',current_setting('test.config')::jsonb,1,'1.0.0');
    raise exception 'FAIL cross project relation';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.workshop_members(workshop_id,user_id,role) values(current_setting('test.workshop_b')::uuid,auth.uid(),'admin');
    raise exception 'FAIL membership escalation';
  exception when insufficient_privilege then null; end;
  insert into public.projects(workshop_id,client_id,name,site_commune)
    values(current_setting('test.workshop_a')::uuid,'a1000000-0000-4000-8000-000000000001','Casa A','Santiago') returning id,code into p,code1;
  insert into public.projects(workshop_id,client_id,name,site_commune)
    values(current_setting('test.workshop_a')::uuid,'a1000000-0000-4000-8000-000000000001','Casa A2','Santiago') returning code into code2;
  if code1=code2 or code1 !~ '^LC-[0-9]{4}-[0-9]{4,}$' then raise exception 'FAIL code generation'; end if;
  insert into public.designs(workshop_id,project_id,name,type,configuration,schema_version,generator_version)
    values(current_setting('test.workshop_a')::uuid,p,'Cocina','kitchen',current_setting('test.config')::jsonb,1,'1.0.0');
  insert into public.designs(workshop_id,project_id,name,type,configuration,schema_version,generator_version)
    values(current_setting('test.workshop_a')::uuid,p,'Clóset','closet',current_setting('test.config')::jsonb || '{"type":"closet","sink":false,"oven":false}'::jsonb,1,'1.0.0');
  if (select count(*) from public.designs where project_id=p) <> 2 then raise exception 'FAIL multiple designs'; end if;
  begin
    insert into public.designs(workshop_id,project_id,name,type,configuration,schema_version,generator_version)
      values(current_setting('test.workshop_a')::uuid,p,'Inválido','kitchen','{}'::jsonb,1,'1.0.0');
    raise exception 'FAIL invalid configuration';
  exception when check_violation then null; end;
  raise notice 'PASS authenticated isolation, ownership relations, codes, multiple designs and validation';
end $$;
reset role;
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['profiles','workshops','workshop_members','clients','projects','designs'] loop
    begin
      execute format('select count(*) from public.%I',t);
      raise exception 'FAIL anonymous access to %',t;
    exception when insufficient_privilege then null; end;
  end loop;
  raise notice 'PASS anonymous access denied';
end $$;
reset role;
rollback;
