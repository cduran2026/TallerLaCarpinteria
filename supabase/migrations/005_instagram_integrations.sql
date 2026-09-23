begin;

create extension if not exists supabase_vault with schema vault;

create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  provider text not null check (provider in ('instagram')),
  external_account_id text,
  username text,
  account_type text,
  status text not null default 'connecting'
    check (status in ('connecting', 'connected', 'token_expired', 'error', 'disconnected')),
  connected_at timestamptz,
  token_expires_at timestamptz,
  permissions text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, provider),
  unique (id, workshop_id)
);
create index social_connections_workshop_idx on public.social_connections(workshop_id);

create table public.social_publications (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  connection_id uuid not null,
  provider text not null check (provider in ('instagram')),
  content_type text not null check (content_type in ('story_image')),
  status text not null check (status in ('processing', 'published', 'error')),
  external_media_id text,
  error_code text,
  error_message text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint social_publications_connection_workshop_fk
    foreign key (connection_id, workshop_id)
    references public.social_connections(id, workshop_id) on delete cascade
);
create index social_publications_workshop_idx on public.social_publications(workshop_id, created_at desc);

create table private.social_connection_secrets (
  connection_id uuid primary key references public.social_connections(id) on delete cascade,
  vault_secret_id uuid not null unique,
  updated_at timestamptz not null default now()
);
create table private.social_oauth_states (
  state_hash text primary key,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index social_oauth_states_expiry_idx on private.social_oauth_states(expires_at);

alter table public.social_connections enable row level security;
alter table public.social_publications enable row level security;

revoke all on public.social_connections, public.social_publications from anon, authenticated;
revoke all on private.social_connection_secrets, private.social_oauth_states from public, anon, authenticated;
grant select on public.social_connections, public.social_publications to authenticated;
grant all on public.social_connections, public.social_publications to service_role;

create policy social_connection_read on public.social_connections for select to authenticated
  using (private.is_workshop_member(workshop_id));
create policy social_publication_read on public.social_publications for select to authenticated
  using (private.is_workshop_member(workshop_id));

create trigger social_connection_touch before update on public.social_connections
  for each row execute function private.touch_record();
create trigger social_connection_workshop before update on public.social_connections
  for each row execute function private.keep_workshop();

create function public.server_create_instagram_oauth_state(
  state_hash text, workshop_id uuid, user_id uuid, expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if expires_at <= now() or expires_at > now() + interval '15 minutes' then
    raise exception 'Expiración OAuth inválida';
  end if;
  if not exists (select 1 from public.workshop_members m
    where m.workshop_id = server_create_instagram_oauth_state.workshop_id
      and m.user_id = server_create_instagram_oauth_state.user_id and m.role = 'admin') then
    raise exception 'El usuario no es administrador del taller' using errcode = '42501';
  end if;
  delete from private.social_oauth_states s where s.expires_at < now() or s.used_at is not null;
  insert into private.social_oauth_states(state_hash, workshop_id, user_id, expires_at)
    values(state_hash, workshop_id, user_id, expires_at);
end $$;

create function public.server_consume_instagram_oauth_state(state_hash text)
returns table(workshop_id uuid, user_id uuid) language plpgsql security definer set search_path = '' as $$
begin
  return query
    update private.social_oauth_states s set used_at = now()
      where s.state_hash = server_consume_instagram_oauth_state.state_hash
        and s.used_at is null and s.expires_at > now()
        and exists (select 1 from public.workshop_members m
          where m.workshop_id = s.workshop_id and m.user_id = s.user_id and m.role = 'admin')
      returning s.workshop_id, s.user_id;
end $$;

create function public.server_store_social_token(connection_id uuid, access_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare secret_id uuid;
begin
  if access_token is null or length(access_token) < 20 then raise exception 'Token inválido'; end if;
  select s.vault_secret_id into secret_id from private.social_connection_secrets s
    where s.connection_id = server_store_social_token.connection_id;
  if secret_id is null then
    select vault.create_secret(access_token, 'social:' || connection_id::text, 'Token OAuth cifrado para conexión social') into secret_id;
    insert into private.social_connection_secrets(connection_id, vault_secret_id) values(connection_id, secret_id);
  else
    perform vault.update_secret(secret_id, access_token);
    update private.social_connection_secrets set updated_at = now()
      where private.social_connection_secrets.connection_id = server_store_social_token.connection_id;
  end if;
end $$;

create function public.server_get_social_token(connection_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select v.decrypted_secret
  from private.social_connection_secrets s
  join vault.decrypted_secrets v on v.id = s.vault_secret_id
  where s.connection_id = server_get_social_token.connection_id;
$$;

create function public.server_delete_social_token(connection_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare secret_id uuid;
begin
  delete from private.social_connection_secrets s
    where s.connection_id = server_delete_social_token.connection_id
    returning s.vault_secret_id into secret_id;
  if secret_id is not null then delete from vault.secrets where id = secret_id; end if;
end $$;

revoke all on function public.server_create_instagram_oauth_state(text,uuid,uuid,timestamptz),
  public.server_consume_instagram_oauth_state(text), public.server_store_social_token(uuid,text),
  public.server_get_social_token(uuid), public.server_delete_social_token(uuid) from public, anon, authenticated;
grant execute on function public.server_create_instagram_oauth_state(text,uuid,uuid,timestamptz),
  public.server_consume_instagram_oauth_state(text), public.server_store_social_token(uuid,text),
  public.server_get_social_token(uuid), public.server_delete_social_token(uuid) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('instagram-publish-temp', 'instagram-publish-temp', false, 10485760, array['image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
