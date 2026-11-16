-- Usuarios de la aplicación, rol admin y políticas RLS para las tablas de la matriz.
-- anon no tiene acceso; authenticated lee; solo admin escribe.

begin;

-- ---------------------------------------------------------------------------
-- Usuarios de la aplicación (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.usuario (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  nombre    text,
  rol       text not null default 'usuario' check (rol in ('admin', 'usuario')),
  creado_en timestamptz not null default now()
);

alter table public.usuario enable row level security;

-- Crea la fila de public.usuario al dar de alta un usuario en Auth.
create function public.crear_usuario_app()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuario (id, email, nombre)
  values (new.id, new.email, new.raw_user_meta_data ->> 'nombre');
  return new;
end;
$$;

revoke execute on function public.crear_usuario_app() from public, anon, authenticated;

create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute function public.crear_usuario_app();

-- ¿El usuario de la sesión actual es administrador?
create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuario
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------
create policy "usuario: ver la propia fila o todas si es admin"
  on public.usuario for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));

create policy "usuario: admin modifica"
  on public.usuario for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "usuario: admin elimina"
  on public.usuario for delete to authenticated
  using ((select public.es_admin()));

-- Matriz: lectura para autenticados, escritura solo admin.
do $$
declare
  t text;
begin
  foreach t in array array['tipo_cotizacion', 'tipo_flujo', 'tipo_ingreso', 'rango_ingreso',
                           'perfil', 'producto_credito', 'producto']
  loop
    execute format('create policy "%1$s: autenticados leen" on public.%1$I
                      for select to authenticated using (true)', t);
    execute format('create policy "%1$s: admin inserta" on public.%1$I
                      for insert to authenticated with check ((select public.es_admin()))', t);
    execute format('create policy "%1$s: admin modifica" on public.%1$I
                      for update to authenticated
                      using ((select public.es_admin())) with check ((select public.es_admin()))', t);
    execute format('create policy "%1$s: admin elimina" on public.%1$I
                      for delete to authenticated using ((select public.es_admin()))', t);
  end loop;
end $$;

commit;
