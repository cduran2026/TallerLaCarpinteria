begin;
-- Owned by the migration role (postgres). private is NOT an exposed API schema.
-- No caller-supplied user_id: membership always uses the authenticated JWT identity.
create function private.is_workshop_member(wid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workshop_members m
    where m.workshop_id = wid and m.user_id = (select auth.uid()));
$$;
create function private.is_workshop_admin(wid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workshop_members m
    where m.workshop_id = wid and m.user_id = (select auth.uid()) and m.role = 'admin');
$$;
revoke all on function private.is_workshop_member(uuid), private.is_workshop_admin(uuid) from public, anon;
grant execute on function private.is_workshop_member(uuid), private.is_workshop_admin(uuid) to authenticated;

grant select on public.profiles, public.workshops, public.workshop_members,
  public.clients, public.projects, public.designs to authenticated;
grant update(full_name, phone) on public.profiles to authenticated;
grant update(name) on public.workshops to authenticated;
grant insert(workshop_id, name, phone, email, commune, address) on public.clients to authenticated;
grant update(name, phone, email, commune, address) on public.clients to authenticated;
grant insert(workshop_id, client_id, name, observations, project_date, status, site_commune, site_address) on public.projects to authenticated;
grant update(name, observations, project_date, status, site_commune, site_address) on public.projects to authenticated;
grant insert(workshop_id, project_id, name, type, position, configuration, schema_version, generator_version) on public.designs to authenticated;
grant update(name, type, position, configuration, schema_version, generator_version) on public.designs to authenticated;
-- No DELETE, workshop INSERT, or membership mutations from the browser.

create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy workshop_read on public.workshops for select to authenticated using (private.is_workshop_member(id));
create policy workshop_update on public.workshops for update to authenticated
  using (private.is_workshop_admin(id)) with check (private.is_workshop_admin(id));
create policy member_read on public.workshop_members for select to authenticated using (private.is_workshop_member(workshop_id));

create policy client_read on public.clients for select to authenticated using (private.is_workshop_member(workshop_id));
create policy client_insert on public.clients for insert to authenticated with check (private.is_workshop_member(workshop_id));
create policy client_update on public.clients for update to authenticated
  using (private.is_workshop_member(workshop_id)) with check (private.is_workshop_member(workshop_id));
create policy project_read on public.projects for select to authenticated using (private.is_workshop_member(workshop_id));
create policy project_insert on public.projects for insert to authenticated with check (private.is_workshop_member(workshop_id));
create policy project_update on public.projects for update to authenticated
  using (private.is_workshop_member(workshop_id)) with check (private.is_workshop_member(workshop_id));
create policy design_read on public.designs for select to authenticated using (private.is_workshop_member(workshop_id));
create policy design_insert on public.designs for insert to authenticated with check (private.is_workshop_member(workshop_id));
create policy design_update on public.designs for update to authenticated
  using (private.is_workshop_member(workshop_id)) with check (private.is_workshop_member(workshop_id));
commit;
