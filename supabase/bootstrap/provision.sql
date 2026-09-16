begin;
-- Serializes this bootstrap and avoids duplicate workshop names during provisioning.
select pg_advisory_xact_lock(726104202);
lock table public.workshops, public.workshop_members in share row exclusive mode;
do $$
declare r record; uid uuid; wid uuid; owner_id uuid; n integer; existing_role text;
begin
  for r in select * from (values
    (1,'admin@lacarpinteria.demo','Admin La Carpintería','La Carpintería','admin@lacarpinteria.demo'),
    (2,'johan@lacarpinteria.demo','Johan','La Carpintería','admin@lacarpinteria.demo'),
    (3,'maestro.demo@lacarpinteria.demo','Maestro Demo','Taller Demo','maestro.demo@lacarpinteria.demo')
  ) as targets(position,email,full_name,workshop,owner_email) order by position loop
    select count(*), min(id::text)::uuid into n, uid from auth.users where lower(email)=r.email;
    if n <> 1 then raise exception 'Se requiere exactamente un usuario Auth para %', r.email; end if;
    if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
      raise exception 'Correo sin confirmar: %', r.email;
    end if;
    select id into strict owner_id from auth.users where lower(email)=r.owner_email;
    select count(*), min(id::text)::uuid into n, wid from public.workshops where name=r.workshop;
    if n > 1 then raise exception 'Taller ambiguo: %', r.workshop; end if;
    if n = 1 and not exists(select 1 from public.workshops where id=wid and created_by=owner_id) then
      raise exception 'El taller existente tiene otro creador: %', r.workshop;
    end if;
    if exists(select 1 from public.workshop_members where user_id=uid and workshop_id is distinct from wid) then
      raise exception 'El usuario ya pertenece a otro taller: %', r.email;
    end if;
    if wid is null then
      if uid <> owner_id then raise exception 'Primero debe aprovisionarse el administrador principal'; end if;
      wid := private.provision_workshop(uid,r.workshop,r.full_name);
    else
      insert into public.profiles(id,full_name) values(uid,r.full_name) on conflict(id) do nothing;
      select role into existing_role from public.workshop_members where workshop_id=wid and user_id=uid;
      if existing_role is not null and existing_role <> 'admin' then
        raise exception 'Rol existente distinto de admin: %', r.email;
      end if;
      insert into public.workshop_members(workshop_id,user_id,role) values(wid,uid,'admin')
        on conflict(workshop_id,user_id) do nothing;
    end if;
  end loop;
end $$;
select u.email,p.full_name,w.id as workshop_id,w.name as workshop,m.role
from auth.users u join public.profiles p on p.id=u.id
join public.workshop_members m on m.user_id=u.id join public.workshops w on w.id=m.workshop_id
where lower(u.email) in ('admin@lacarpinteria.demo','johan@lacarpinteria.demo','maestro.demo@lacarpinteria.demo')
order by u.email;
commit;
