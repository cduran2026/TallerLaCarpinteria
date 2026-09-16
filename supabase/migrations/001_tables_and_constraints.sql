begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workshop_members (
  workshop_id uuid not null references public.workshops(id),
  user_id uuid not null references public.profiles(id),
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workshop_id, user_id)
);
create index workshop_members_user_idx on public.workshop_members(user_id, workshop_id);
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text not null check (length(btrim(phone)) between 1 and 40),
  email text,
  commune text not null check (length(btrim(commune)) between 1 and 200),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id),
  client_id uuid not null,
  code text not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  observations text,
  project_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'in_design', 'approved', 'archived')),
  site_commune text not null check (length(btrim(site_commune)) between 1 and 200),
  site_address text,
  client_snapshot jsonb not null check (jsonb_typeof(client_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, id),
  unique (workshop_id, code),
  foreign key (workshop_id, client_id) references public.clients(workshop_id, id)
);
create index projects_client_idx on public.projects(workshop_id, client_id);
create index projects_recent_idx on public.projects(workshop_id, updated_at desc);

-- Same admissible state as Fase 1. All lengths are cm; unit is display-only.
create function private.valid_configuration(c jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; spec record; n numeric;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(c)) <> 17 or not c ?& array[
    'type','kitchenLayout','width','secondLeg','height','depth','upper','lower','rod',
    'shelves','drawers','sink','oven','hood','material','color','unit'] then return false; end if;
  foreach k in array array['type','kitchenLayout','material','color','unit'] loop
    if jsonb_typeof(c->k) <> 'string' then return false; end if;
  end loop;
  if c->>'type' not in ('kitchen','closet') or c->>'kitchenLayout' not in ('straight','l')
     or c->>'material' not in ('standard','premium') or c->>'unit' not in ('cm','mm')
     or c->>'color' not in ('#333936','#8a6a46','#f2ede4','#5c1a24','#1b2a4a','#cbb896') then return false; end if;
  foreach k in array array['upper','lower','rod','sink','oven','hood'] loop
    if jsonb_typeof(c->k) <> 'boolean' then return false; end if;
  end loop;
  for spec in select * from (values ('width',120,400,10), ('secondLeg',100,300,10),
    ('height',200,260,10), ('depth',45,75,5)) as r(key, lo, hi, step) loop
    if jsonb_typeof(c->spec.key) <> 'number' then return false; end if;
    n := (c->>spec.key)::numeric;
    if n < spec.lo or n > spec.hi or mod(n-spec.lo, spec.step) <> 0 then return false; end if;
  end loop;
  if jsonb_typeof(c->'shelves') <> 'number' or jsonb_typeof(c->'drawers') <> 'number'
     or (c->>'shelves')::numeric not in (0,3) or (c->>'drawers')::numeric not in (0,2) then return false; end if;
  if not (c->>'upper')::boolean and not (c->>'lower')::boolean then return false; end if;
  if (c->>'type' <> 'kitchen' or not (c->>'lower')::boolean)
     and ((c->>'sink')::boolean or (c->>'oven')::boolean) then return false; end if;
  return true;
exception when others then return false;
end $$;

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id),
  project_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  type text not null check (type in ('kitchen','closet')),
  position integer not null default 0 check (position >= 0),
  configuration jsonb not null,
  schema_version integer not null check (schema_version = 1),
  generator_version text not null check (generator_version = '1.0.0'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workshop_id, project_id) references public.projects(workshop_id, id),
  check (private.valid_configuration(configuration)),
  check (configuration->>'type' = type)
);
create index designs_project_idx on public.designs(workshop_id, project_id, position);

-- Private counter: atomic UPSERT locks one row per workshop/year. No JS counts.
create table private.project_counters (
  workshop_id uuid not null references public.workshops(id),
  year integer not null,
  value bigint not null,
  primary key (workshop_id, year)
);

-- Secure from the first migration, before any client grants/policies exist.
alter table public.profiles enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.designs enable row level security;
alter table private.project_counters enable row level security;
revoke all on public.profiles, public.workshops, public.workshop_members, public.clients,
  public.projects, public.designs from anon, authenticated;
revoke all on private.project_counters from public, anon, authenticated;
revoke all on function private.valid_configuration(jsonb) from public, anon;
grant execute on function private.valid_configuration(jsonb) to authenticated;
commit;
