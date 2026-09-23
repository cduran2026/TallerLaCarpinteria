-- CLOUD SAFE: catalog and configuration checks only. No fixtures or writes.
-- Run after migration 005 with: npx supabase db query --linked --file supabase/tests/instagram_cloud_smoke.sql
begin transaction read only;
with checks(name, ok) as (values
  ('social_connections table', to_regclass('public.social_connections') is not null),
  ('social_publications table', to_regclass('public.social_publications') is not null),
  ('private token mapping', to_regclass('private.social_connection_secrets') is not null),
  ('private OAuth states', to_regclass('private.social_oauth_states') is not null),
  ('Vault extension', exists(select 1 from pg_extension where extname='supabase_vault')),
  ('workshop indexes', to_regclass('public.social_connections_workshop_idx') is not null
    and to_regclass('public.social_publications_workshop_idx') is not null
    and to_regclass('private.social_oauth_states_expiry_idx') is not null),
  ('connection/workshop composite FK', exists(select 1 from pg_constraint
    where conname='social_publications_connection_workshop_fk'
      and conrelid=to_regclass('public.social_publications')
      and confrelid=to_regclass('public.social_connections')
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (connection_id, workshop_id) REFERENCES %(id, workshop_id)%')),
  ('social tables have RLS', (select count(*)=2 from pg_class
    where oid in (to_regclass('public.social_connections'),to_regclass('public.social_publications')) and relrowsecurity)),
  ('member-only read policies', (select count(*)=2 from pg_policies
    where schemaname='public' and tablename in ('social_connections','social_publications')
      and cmd='SELECT' and 'authenticated'=any(roles)
      and qual like '%is_workshop_member(workshop_id)%')),
  ('authenticated metadata read only', coalesce(has_table_privilege('authenticated',to_regclass('public.social_connections'),'SELECT'),false)
    and coalesce(has_table_privilege('authenticated',to_regclass('public.social_publications'),'SELECT'),false)
    and not coalesce(has_table_privilege('authenticated',to_regclass('public.social_connections'),'INSERT, UPDATE, DELETE'),false)
    and not coalesce(has_table_privilege('authenticated',to_regclass('public.social_publications'),'INSERT, UPDATE, DELETE'),false)),
  ('anon denied', not coalesce(has_table_privilege('anon',to_regclass('public.social_connections'),'SELECT'),false)
    and not coalesce(has_table_privilege('anon',to_regclass('public.social_publications'),'SELECT'),false)),
  ('private tables denied to browser', not coalesce(has_table_privilege('authenticated',to_regclass('private.social_connection_secrets'),'SELECT'),false)
    and not coalesce(has_table_privilege('authenticated',to_regclass('private.social_oauth_states'),'SELECT'),false)
    and not coalesce(has_table_privilege('anon',to_regclass('private.social_connection_secrets'),'SELECT'),false)),
  ('token RPC server only', to_regprocedure('public.server_get_social_token(uuid)') is not null
    and coalesce(has_function_privilege('service_role',to_regprocedure('public.server_get_social_token(uuid)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.server_get_social_token(uuid)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.server_get_social_token(uuid)'),'EXECUTE'),false)),
  ('OAuth RPCs server only', (select count(*)=4 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'server_create_instagram_oauth_state','server_consume_instagram_oauth_state',
      'server_store_social_token','server_delete_social_token')
      and has_function_privilege('service_role',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE'))),
  ('temporary image bucket is private', exists(select 1 from storage.buckets
    where id='instagram-publish-temp' and public=false and file_size_limit=10485760
      and allowed_mime_types @> array['image/jpeg','image/png']::text[]))
)
select name, case when ok then 'PASS' else 'FAIL' end as result from checks order by name;
rollback;
