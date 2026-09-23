-- SOLO LOCAL / TEST PROJECT. NUNCA ejecutar contra Supabase Cloud real.
-- Ejecutar exclusivamente mediante run-instagram-local.ps1, que usa el contenedor local.
-- La transacción revierte todos los fixtures y no crea conexiones reales con Meta.
begin;
do $$ begin
  if current_setting('taller.instagram_local_test', true) is distinct from 'enabled' then
    raise exception 'SOLO LOCAL / TEST PROJECT: use run-instagram-local.ps1';
  end if;
end $$;

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
do $$ begin
  begin
    insert into public.social_publications(workshop_id,connection_id,provider,content_type,status,created_by)
      values(current_setting('test.workshop_a')::uuid,'d1000000-0000-4000-8000-000000000002','instagram','story_image','processing','c0000000-0000-4000-8000-000000000001');
    raise exception 'FAIL cross-workshop connection foreign key';
  exception when foreign_key_violation then null; end;
  if not has_table_privilege('service_role','public.social_connections','INSERT, UPDATE, DELETE')
    or not has_table_privilege('service_role','public.social_publications','INSERT, UPDATE, DELETE')
    or not has_function_privilege('service_role','public.server_get_social_token(uuid)','EXECUTE') then
    raise exception 'FAIL backend privileges';
  end if;
  raise notice 'PASS database rejects cross-workshop connection';
end $$;

set local role service_role;
do $$ begin
  perform public.server_store_social_token('c1000000-0000-4000-8000-000000000001', 'local-only-' || repeat('x', 24));
  if public.server_get_social_token('c1000000-0000-4000-8000-000000000001') <> 'local-only-' || repeat('x', 24) then
    raise exception 'FAIL backend token storage';
  end if;
  perform public.server_create_instagram_oauth_state('local-state-once', current_setting('test.workshop_a')::uuid,
    'c0000000-0000-4000-8000-000000000001', now() + interval '10 minutes');
  if (select count(*) from public.server_consume_instagram_oauth_state('local-state-once')) <> 1
    or (select count(*) from public.server_consume_instagram_oauth_state('local-state-once')) <> 0 then
    raise exception 'FAIL OAuth state one-time use';
  end if;
  begin
    perform public.server_create_instagram_oauth_state('local-state-cross', current_setting('test.workshop_b')::uuid,
      'c0000000-0000-4000-8000-000000000001', now() + interval '10 minutes');
    raise exception 'FAIL cross-workshop OAuth state';
  exception when insufficient_privilege then null; end;
  perform public.server_create_instagram_oauth_state('local-state-revoked', current_setting('test.workshop_a')::uuid,
    'c0000000-0000-4000-8000-000000000001', now() + interval '10 minutes');
  raise notice 'PASS backend token storage and OAuth one-time/cross-workshop checks';
end $$;
reset role;
insert into private.social_oauth_states(state_hash, workshop_id, user_id, expires_at)
  values('local-state-expired', current_setting('test.workshop_a')::uuid,
    'c0000000-0000-4000-8000-000000000001', now() - interval '1 minute');
update public.workshop_members set role='member'
  where workshop_id=current_setting('test.workshop_a')::uuid and user_id='c0000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ begin
  if (select count(*) from public.server_consume_instagram_oauth_state('local-state-revoked')) <> 0 then
    raise exception 'FAIL revoked admin consumed OAuth state';
  end if;
  if (select count(*) from public.server_consume_instagram_oauth_state('local-state-expired')) <> 0 then
    raise exception 'FAIL expired OAuth state consumed';
  end if;
  raise notice 'PASS revoked admin and expired OAuth state cannot be consumed';
end $$;
reset role;
update public.workshop_members set role='admin'
  where workshop_id=current_setting('test.workshop_a')::uuid and user_id='c0000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
do $$
begin
  if (select count(*) from public.social_connections) <> 1 then raise exception 'FAIL connection isolation'; end if;
  if exists(select 1 from public.social_connections where username='taller_b') then raise exception 'FAIL cross-workshop connection read'; end if;
  if (select count(*) from public.social_publications) <> 1 then raise exception 'FAIL publication isolation'; end if;
  begin
    perform count(*) from private.social_connection_secrets;
    raise exception 'FAIL browser private token table access';
  exception when insufficient_privilege then null; end;
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
    update public.social_connections set workshop_id=current_setting('test.workshop_b')::uuid
      where id='c1000000-0000-4000-8000-000000000001';
    raise exception 'FAIL browser workshop_id update';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.social_publications(workshop_id,connection_id,provider,content_type,status,created_by)
      values(current_setting('test.workshop_b')::uuid,'d1000000-0000-4000-8000-000000000002','instagram','story_image','processing',auth.uid());
    raise exception 'FAIL browser publication insert';
  exception when insufficient_privilege then null; end;
  begin
    perform public.server_get_social_token('c1000000-0000-4000-8000-000000000001');
    raise exception 'FAIL browser token access';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS social connection RLS and server-only mutations';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.social_connections) <> 1 then raise exception 'FAIL reverse connection isolation'; end if;
  if exists (select 1 from public.social_connections where username='taller_a') then raise exception 'FAIL reverse cross-workshop read'; end if;
  if (select count(*) from public.social_publications) <> 1 then raise exception 'FAIL reverse publication isolation'; end if;
  raise notice 'PASS Taller B cannot read Taller A';
end $$;
reset role;

set local role anon;
do $$
begin
  begin perform count(*) from public.social_connections; raise exception 'FAIL anonymous connection read';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.social_publications; raise exception 'FAIL anonymous publication read';
  exception when insufficient_privilege then null; end;
  begin perform public.server_get_social_token('c1000000-0000-4000-8000-000000000001'); raise exception 'FAIL anonymous token access';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS anonymous social access denied';
end $$;
reset role;
rollback;
