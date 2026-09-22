-- Ejecutar después de la migración 005 en un proyecto aislado, como postgres.
-- La transacción revierte todos los fixtures y no crea conexiones reales con Meta.
begin;

insert into auth.users(id, email) values
 ('c0000000-0000-4000-8000-000000000001','instagram-a@example.invalid'),
 ('d0000000-0000-4000-8000-000000000002','instagram-b@example.invalid');
select private.provision_workshop('c0000000-0000-4000-8000-000000000001','Instagram Taller A','Admin A');
select private.provision_workshop('d0000000-0000-4000-8000-000000000002','Instagram Taller B','Admin B');
select set_config('test.workshop_a',(select id::text from public.workshops where created_by='c0000000-0000-4000-8000-000000000001'),true);
select set_config('test.workshop_b',(select id::text from public.workshops where created_by='d0000000-0000-4000-8000-000000000002'),true);

insert into public.social_connections(id,workshop_id,provider,external_account_id,username,account_type,status,connected_at,permissions,created_by) values
 ('c1000000-0000-4000-8000-000000000001',current_setting('test.workshop_a')::uuid,'instagram','ig-a','taller_a','BUSINESS','connected',now(),array['instagram_business_basic','instagram_business_content_publish'],'c0000000-0000-4000-8000-000000000001'),
 ('d1000000-0000-4000-8000-000000000002',current_setting('test.workshop_b')::uuid,'instagram','ig-b','taller_b','BUSINESS','connected',now(),array['instagram_business_basic','instagram_business_content_publish'],'d0000000-0000-4000-8000-000000000002');
insert into public.social_publications(workshop_id,connection_id,provider,content_type,status,created_by) values
 (current_setting('test.workshop_a')::uuid,'c1000000-0000-4000-8000-000000000001','instagram','story_image','published','c0000000-0000-4000-8000-000000000001'),
 (current_setting('test.workshop_b')::uuid,'d1000000-0000-4000-8000-000000000002','instagram','story_image','published','d0000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.social_connections) <> 1 then raise exception 'FAIL connection isolation'; end if;
  if exists(select 1 from public.social_connections where username='taller_b') then raise exception 'FAIL cross-workshop connection read'; end if;
  if (select count(*) from public.social_publications) <> 1 then raise exception 'FAIL publication isolation'; end if;
  begin
    update public.social_connections set username='intrusion' where id='d1000000-0000-4000-8000-000000000002';
    raise exception 'FAIL browser connection update';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.social_connections(workshop_id,provider,status,created_by)
      values(current_setting('test.workshop_a')::uuid,'instagram','connecting',auth.uid());
    raise exception 'FAIL browser connection insert';
  exception when insufficient_privilege then null; end;
  begin
    perform public.server_get_social_token('c1000000-0000-4000-8000-000000000001');
    raise exception 'FAIL browser token access';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS social connection RLS and server-only mutations';
end $$;
reset role;

set local role anon;
do $$
begin
  begin perform count(*) from public.social_connections; raise exception 'FAIL anonymous connection read';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.social_publications; raise exception 'FAIL anonymous publication read';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS anonymous social access denied';
end $$;
reset role;
rollback;
