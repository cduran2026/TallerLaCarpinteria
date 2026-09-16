begin;
create function private.touch_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create function private.keep_workshop() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.workshop_id is distinct from old.workshop_id then
    raise exception 'No se puede cambiar el taller de un registro' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger profile_touch before update on public.profiles for each row execute function private.touch_record();
create trigger workshop_touch before update on public.workshops for each row execute function private.touch_record();
create trigger client_touch before update on public.clients for each row execute function private.touch_record();
create trigger project_touch before update on public.projects for each row execute function private.touch_record();
create trigger design_touch before update on public.designs for each row execute function private.touch_record();
create trigger client_workshop before update on public.clients for each row execute function private.keep_workshop();
create trigger project_workshop before update on public.projects for each row execute function private.keep_workshop();
create trigger design_workshop before update on public.designs for each row execute function private.keep_workshop();

create function private.prepare_project() returns trigger
language plpgsql security definer set search_path = '' as $$
declare yr integer; seq bigint;
begin
  if not private.is_workshop_member(new.workshop_id) then
    raise exception 'No perteneces a este taller' using errcode = '42501';
  end if;
  select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email,
    'commune', c.commune, 'address', c.address) into new.client_snapshot
    from public.clients c where c.id = new.client_id and c.workshop_id = new.workshop_id;
  if new.client_snapshot is null then
    raise exception 'El cliente no pertenece al taller del proyecto' using errcode = '23503';
  end if;
  yr := extract(year from now() at time zone 'America/Santiago')::integer;
  insert into private.project_counters as counters(workshop_id, year, value)
    values(new.workshop_id, yr, 1)
    on conflict (workshop_id, year) do update set value = counters.value + 1
    returning value into seq;
  new.code := 'LC-' || yr || '-' || lpad(seq::text, greatest(4, length(seq::text)), '0');
  return new;
end $$;
create trigger prepare_project before insert on public.projects for each row execute function private.prepare_project();

-- Run manually in SQL Editor as postgres AFTER creating/inviting the Auth user.
-- This function is deliberately not callable by authenticated/anon/API clients.
create function private.provision_workshop(user_id uuid, workshop_name text, user_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare wid uuid;
begin
  if not exists (select 1 from auth.users u where u.id = user_id) then
    raise exception 'Primero crea o invita al usuario en Supabase Auth';
  end if;
  insert into public.profiles(id, full_name) values(user_id, user_full_name)
    on conflict (id) do nothing;
  insert into public.workshops(name, created_by) values(workshop_name, user_id) returning id into wid;
  insert into public.workshop_members(workshop_id, user_id, role) values(wid, user_id, 'admin');
  return wid;
end $$;
revoke all on function private.touch_record(), private.keep_workshop(), private.prepare_project(),
  private.provision_workshop(uuid,text,text) from public, anon, authenticated;
commit;
