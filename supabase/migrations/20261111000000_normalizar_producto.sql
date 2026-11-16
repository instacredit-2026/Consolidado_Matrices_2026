-- Normaliza la tabla plana public.producto en catálogos + producto_credito.
-- La tabla original NO se modifica. Todo corre en una transacción.

begin;

-- ---------------------------------------------------------------------------
-- Comprobaciones previas: las dependencias funcionales que asume el modelo.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.producto
    group by tipo_cotizacion
    having count(distinct coalesce(relacion_cuota_ingreso, -1)) > 1
  ) then
    raise exception 'relacion_cuota_ingreso no depende solo de tipo_cotizacion';
  end if;

  if exists (
    select 1 from public.producto
    group by tipo_cotizacion, tipo_perfil
    having count(distinct tipo_flujo) > 1
        or count(distinct coalesce(nullif(tipo_ingreso, 'NULL'), '-')) > 1
        or count(distinct multiplicador) > 1
  ) then
    raise exception 'flujo/ingreso/multiplicador no dependen solo del perfil';
  end if;
  -- Los nombres repetidos los rechaza el UNIQUE de producto_credito.nombre.
end $$;

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------
create table public.tipo_cotizacion (
  codigo                 text primary key,
  descripcion            text not null,
  relacion_cuota_ingreso numeric check (relacion_cuota_ingreso between 0 and 1)
);

create table public.tipo_flujo (
  id     smallint generated always as identity primary key,
  nombre text not null unique
);

create table public.tipo_ingreso (
  id     smallint generated always as identity primary key,
  nombre text not null unique
);

create table public.rango_ingreso (
  id                smallint generated always as identity primary key,
  minimo            numeric not null check (minimo >= 0),
  maximo            numeric,               -- NULL = "en adelante"
  etiqueta_original text not null unique,
  unique nulls not distinct (minimo, maximo),
  check (maximo is null or minimo <= maximo)
);

create table public.perfil (
  id              smallint generated always as identity primary key,
  tipo_cotizacion text not null references public.tipo_cotizacion (codigo),
  nombre          text not null,
  tipo_flujo_id   smallint not null references public.tipo_flujo (id),
  tipo_ingreso_id smallint references public.tipo_ingreso (id),
  multiplicador   numeric not null check (multiplicador >= 0),
  unique (tipo_cotizacion, nombre)
);

create table public.producto_credito (
  id                  bigint primary key,   -- mismo id que public.producto
  perfil_id           smallint not null references public.perfil (id),
  nombre              text not null unique,
  rango_ingreso_id    smallint not null references public.rango_ingreso (id),
  score_min           integer,
  score_max           integer,              -- NULL con score_min = "en adelante"
  plazo               integer check (plazo > 0),
  tasa                numeric not null check (tasa >= 0),
  comision_desembolso numeric not null check (comision_desembolso >= 0),
  monto_al_cliente    numeric not null check (monto_al_cliente >= 0),
  monto_pagare        numeric not null check (monto_pagare >= 0),
  nivel_endeudamiento numeric check (nivel_endeudamiento between 0 and 1),
  seguro              numeric not null check (seguro >= 0),
  check (score_max is null or score_min <= score_max)
);

create index on public.perfil (tipo_flujo_id);
create index on public.perfil (tipo_ingreso_id);
create index on public.producto_credito (perfil_id);
create index on public.producto_credito (rango_ingreso_id);

-- ---------------------------------------------------------------------------
-- Datos
-- ---------------------------------------------------------------------------
insert into public.tipo_cotizacion (codigo, descripcion, relacion_cuota_ingreso)
select d.codigo, d.descripcion,
       (select max(p.relacion_cuota_ingreso) from public.producto p where p.tipo_cotizacion = d.codigo)
from (values ('PV',   'Préstamo Voluntario'),
             ('DD',   'Descuento Directo'),
             ('EP',   'Empleado Público'),
             ('PYME', 'PYME')) as d (codigo, descripcion);

insert into public.tipo_flujo (nombre)
select distinct tipo_flujo from public.producto where tipo_flujo is not null order by 1;

insert into public.tipo_ingreso (nombre)
select distinct nullif(tipo_ingreso, 'NULL') from public.producto
where nullif(tipo_ingreso, 'NULL') is not null order by 1;

insert into public.rango_ingreso (etiqueta_original, minimo, maximo)
values ('$337,84 - $563,02',    337.84,  563.02),
       ('$500,00 - $866,18',    500.00,  866.18),
       ('$519,76 - $866,18',    519.76,  866.18),
       ('$563,03 - $1044,02',   563.03, 1044.02),
       ('$600+',                600.00,     null),
       ('$866,19 - $1606,18',   866.19, 1606.18),
       ('$1000+',              1000.00,     null),
       ('$1044,03 - $1525,02', 1044.03, 1525.02),
       ('1525.03',             1525.03,     null),  -- se asume "1525.03 en adelante"
       ('$1606,19 - $2,346,18',1606.19, 2346.18),
       ('$2346,19 +',          2346.19,     null);

insert into public.perfil (tipo_cotizacion, nombre, tipo_flujo_id, tipo_ingreso_id, multiplicador)
select distinct p.tipo_cotizacion, p.tipo_perfil, f.id, i.id, p.multiplicador
from public.producto p
join public.tipo_flujo f on f.nombre = p.tipo_flujo
left join public.tipo_ingreso i on i.nombre = nullif(p.tipo_ingreso, 'NULL');

insert into public.producto_credito (
  id, perfil_id, nombre, rango_ingreso_id, score_min, score_max, plazo, tasa,
  comision_desembolso, monto_al_cliente, monto_pagare, nivel_endeudamiento, seguro)
select p.id, pf.id,
       -- La fila 2 del original repite el nombre de la fila 1; por sus condiciones
       -- (plazo 24, tasa 0.50, monto 1000) es la variante "P.".
       case when p.id = 2 and p.producto = 'Asalariado Básico Score 580-624'
            then 'P. ' || p.producto else p.producto end,
       r.id,
       coalesce((regexp_match(p.producto, 'Score (\d+)-(\d+)'))[1],
                (regexp_match(p.producto, 'Score (\d+)\+'))[1])::int,
       (regexp_match(p.producto, 'Score (\d+)-(\d+)'))[2]::int,
       p.plazo, p.tasa_pv, p.comision_desembolso, p.monto_al_cliente,
       p.monto_pagare, p.nivel_endeudamiento, p.seguro
from public.producto p
join public.perfil pf on pf.tipo_cotizacion = p.tipo_cotizacion and pf.nombre = p.tipo_perfil
join public.rango_ingreso r on r.etiqueta_original = trim(p.rango_ingreso_neto_mensual);

do $$
begin
  if (select count(*) from public.producto_credito) <> (select count(*) from public.producto) then
    raise exception 'no se migraron todas las filas (¿rango de ingreso sin equivalencia?)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Vista que reproduce el formato plano original
-- ---------------------------------------------------------------------------
create view public.v_producto_credito with (security_invoker = true) as
select pc.id,
       pf.tipo_cotizacion,
       f.nombre               as tipo_flujo,
       pf.nombre              as tipo_perfil,
       i.nombre               as tipo_ingreso,
       r.etiqueta_original    as rango_ingreso_neto_mensual,
       pc.nombre              as producto,
       tc.relacion_cuota_ingreso,
       pc.plazo,
       pc.tasa                as tasa_pv,
       pc.comision_desembolso,
       pc.monto_al_cliente,
       pc.monto_pagare,
       pc.nivel_endeudamiento,
       pf.multiplicador,
       pc.seguro,
       r.minimo               as ingreso_minimo,
       r.maximo               as ingreso_maximo,
       pc.score_min,
       pc.score_max
from public.producto_credito pc
join public.perfil pf          on pf.id = pc.perfil_id
join public.tipo_cotizacion tc on tc.codigo = pf.tipo_cotizacion
join public.tipo_flujo f       on f.id = pf.tipo_flujo_id
left join public.tipo_ingreso i on i.id = pf.tipo_ingreso_id
join public.rango_ingreso r    on r.id = pc.rango_ingreso_id;

-- ---------------------------------------------------------------------------
-- RLS: igual que public.producto (activado, sin políticas)
-- ---------------------------------------------------------------------------
alter table public.tipo_cotizacion  enable row level security;
alter table public.tipo_flujo       enable row level security;
alter table public.tipo_ingreso     enable row level security;
alter table public.rango_ingreso    enable row level security;
alter table public.perfil           enable row level security;
alter table public.producto_credito enable row level security;

commit;
