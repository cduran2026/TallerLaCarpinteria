begin;

create or replace function private.valid_v2_configuration(c jsonb, expected_type text)
returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  component jsonb;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return false; end if;
  if c->>'type' <> expected_type or expected_type not in ('kitchen', 'closet') then return false; end if;
  if c->>'units' <> 'mm' then return false; end if;
  if jsonb_typeof(c->'dimensions') <> 'object'
     or jsonb_typeof(c->'materials') <> 'object'
     or jsonb_typeof(c->'standards') <> 'object'
     or jsonb_typeof(c->'layout') <> 'object'
     or jsonb_typeof(c->'layout'->'runs') <> 'array'
     or jsonb_array_length(c->'layout'->'runs') = 0
     or jsonb_typeof(c->'modules') <> 'array'
     or jsonb_typeof(c->'provenance') <> 'object' then return false; end if;

  for item in select value from jsonb_array_elements(c->'modules') loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item->>'id', '') = ''
       or coalesce(item->>'runId', '') = ''
       or coalesce(item->>'zone', '') = ''
       or jsonb_typeof(item->'dimensions') <> 'object'
       or coalesce((item->'dimensions'->>'widthMm')::integer, 0) <= 0
       or coalesce((item->'dimensions'->>'heightMm')::integer, 0) <= 0
       or coalesce((item->'dimensions'->>'depthMm')::integer, 0) <= 0
       or jsonb_typeof(item->'components') <> 'array'
       or jsonb_typeof(item->'locks') <> 'object'
       or jsonb_typeof(item->'locks'->'width') <> 'boolean' then return false; end if;
    for component in select value from jsonb_array_elements(item->'components') loop
      if jsonb_typeof(component) <> 'object'
         or coalesce(component->>'id', '') = ''
         or coalesce(component->>'type', '') = ''
         or jsonb_typeof(component->'quantity') <> 'object'
         or component->'quantity'->>'mode' not in ('automatic', 'manual')
         or jsonb_typeof(component->'quantity'->'recommended') <> 'number'
         or jsonb_typeof(component->'quantity'->'applied') <> 'number'
         or jsonb_typeof(component->'quantity'->'resolved') <> 'number' then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end $$;

revoke all on function private.valid_v2_configuration(jsonb, text) from public, anon;
grant execute on function private.valid_v2_configuration(jsonb, text) to authenticated;

alter table public.designs drop constraint designs_schema_version_check;
alter table public.designs drop constraint designs_generator_version_check;
alter table public.designs drop constraint designs_configuration_check;

alter table public.designs
  add constraint designs_schema_version_check check (schema_version in (1, 2)),
  add constraint designs_generator_version_check check (
    (schema_version = 1 and generator_version = '1.0.0')
    or (schema_version = 2 and generator_version = '2.0.0')
  ),
  add constraint designs_configuration_check check (
    (schema_version = 1 and private.valid_configuration(configuration))
    or (schema_version = 2 and private.valid_v2_configuration(configuration, type))
  );

commit;
