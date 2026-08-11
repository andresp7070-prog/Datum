-- ============================================================
-- Esquema inicial — plataforma de diagnóstico + módulos SaaS
-- Para pegar en el SQL Editor de Supabase (Fase 1 de la hoja de ruta)
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ------------------------------------------------------------
-- 1. PLANES — catálogo fijo, no pertenece a ninguna empresa
-- ------------------------------------------------------------
create table planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                       -- 'Basico' | 'Pro' | 'Full'
  precio_implementacion numeric(12,2) not null,
  precio_mensual numeric(12,2) not null,
  modulos_incluidos text[] not null,          -- ej. {'ventas','crm'}
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. EMPRESAS — cada empresa cliente es un tenant
-- ------------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Lista fija para que quede consistente y se pueda agrupar/filtrar bien
  -- (antes era texto libre). 'otro' es el escape para un negocio que no
  -- encaja en ninguna — nunca debe bloquear un onboarding.
  tipo_negocio text
    check (tipo_negocio is null or tipo_negocio in (
      'aseo','ropa','restaurante','cafeteria','belleza','ferreteria','taller','tienda','papeleria','otro'
    )),
  plan_id uuid references planes(id),
  modulos_activos text[] default '{}',        -- ajuste manual sobre el plan
  pagina_entrada text not null default 'ventas'
    check (pagina_entrada in ('ventas','crm','inventario','pyg','insights')),  -- en qué módulo aterriza al iniciar sesión; lo decide el diagnóstico, no el cliente
  -- 'ventas': el CRM se comporta como siempre — embudo fijo de 4 etapas, sin
  -- pantalla de configuración, contactos que nacen casi todos ya cerrados
  -- porque vienen de una venta (ej. Aseo Total, Café Mensajero). 'leads':
  -- habilita "Configurar etapas" y las reglas de inactividad, para un
  -- negocio que vive de cotizar/negociar antes de vender. Se activa a mano,
  -- igual que modulos_activos y pagina_entrada — nunca lo decide el cliente.
  crm_modo text not null default 'ventas' check (crm_modo in ('ventas','leads')),
  -- Desarrollo a la medida de un solo cliente (Manantial, tienda de ropa):
  -- habilita el check "Es un apartado" en Agregar venta y la pantalla
  -- "Apartados". Se activa a mano, nunca lo decide el cliente — el mismo
  -- criterio que crm_modo, pero esto ni siquiera es un módulo de precios,
  -- es una función hecha a la medida (ver la sección de Planes y precios).
  permite_apartados boolean not null default false,
  -- Horario real del negocio, para que Panel de control no muestre datos que
  -- no le aplican: horas fuera de atención en "Ventas por hora del día", o
  -- la comparación de festivos si nunca abre esos días. Sin configurar
  -- (el valor por defecto de cada una), el comportamiento es el de
  -- siempre — se activa a mano, empresa por empresa, igual que crm_modo.
  hora_apertura time,
  hora_cierre time,
  atiende_festivos boolean not null default true,
  -- Cómo paga nómina esta empresa — solo aplica si tiene el módulo 'nomina'
  -- activo en modulos_activos; esto define el cómo, no el si.
  nomina_frecuencia_pago text not null default 'mensual' check (nomina_frecuencia_pago in ('mensual','quincenal')),
  -- Nómina fase 2 (aportes patronales): clase de riesgo ARL única para toda
  -- la empresa (I es la más baja/barata — la mayoría de pymes de oficina,
  -- tiendas, aseo caen ahí). exonerado_ley_1607: casi toda pyme colombiana
  -- (menos de 10 salarios mínimos por empleado) está exonerada de pagar
  -- salud patronal, ICBF y SENA — por eso el default es true. Se ajustan a
  -- mano por empresa, mismo criterio que crm_modo.
  arl_clase_riesgo integer not null default 1 check (arl_clase_riesgo between 1 and 5),
  exonerado_ley_1607 boolean not null default true,
  fecha_diagnostico date,
  -- Catálogo fijo de métodos de pago (igual para toda la plataforma); cada
  -- empresa activa cuáles acepta. Editable por ahora en la tabla de Supabase.
  metodos_pago_disponibles text[] not null default '{efectivo,tarjeta,transferencia}'
    check (metodos_pago_disponibles <@ array['efectivo','tarjeta','transferencia','nequi','daviplata','otro']::text[]),
  logo_path text,  -- ruta dentro del bucket 'empresas-logos' de Supabase Storage; opcional
  -- Cuánto paga esta empresa al mes por la suscripción — se llena a mano por
  -- ahora (los precios de los planes no están en firme, y no hay pasarela de
  -- pago conectada todavía). El día que haya cobro automático, esto se
  -- reemplaza por la suma de los cobros reales, no por este campo.
  monto_mensual numeric(12,2),
  -- Contador interno para numerar las ventas de esta empresa (Venta #1, #2,
  -- #3...) — lo actualiza sola asignar_numero_venta(), nunca se edita a mano.
  siguiente_numero_venta integer not null default 1,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. PUNTOS DE VENTA — para empresas con más de un punto físico (varias
-- sedes, un carrito móvil, un stand de eventos). La mayoría de las empresas
-- nunca usan esta tabla: es opcional, no un paso obligatorio del onboarding.
-- El CRM (crm_contactos) queda a nivel de EMPRESA, no de punto — así un
-- cliente que compra en un punto y luego en otro sigue siendo la misma
-- persona con un solo historial. Ventas e inventario sí quedan por punto,
-- porque cada uno vende y tiene stock por separado.
-- ------------------------------------------------------------
create table puntos_venta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz default now(),
  unique (empresa_id, nombre)
);

-- ------------------------------------------------------------
-- Actualizaciones de la plataforma — anuncios cortos que se muestran una
-- sola vez, la siguiente vez que la persona inicia sesión (ver
-- perfiles.ultima_actualizacion_vista_id más abajo). No hay pantalla propia
-- para crearlas todavía: se agregan a mano desde la tabla de Supabase,
-- igual que festivos. Solo la más reciente se le muestra a cada quien.
-- ------------------------------------------------------------
create table actualizaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contenido text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. PERFILES — une el login de Supabase (auth.users) con una empresa y un rol
-- ------------------------------------------------------------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references empresas(id),
  -- 'admin' es un rol de plataforma reservado para futuro personal de
  -- soporte (sin acceso al reporte global). 'super_admin' es exclusivamente
  -- la cuenta dueña de la plataforma — ver requerirAdmin() en el código,
  -- que además verifica el id exacto del usuario, no solo este rol.
  rol text not null default 'cliente' check (rol in ('cliente','admin','super_admin')),
  -- Rol DENTRO de la empresa (solo aplica cuando rol = 'cliente'; varias
  -- personas de la misma empresa pueden tener perfiles distintos, cada una
  -- con su propio login). 'administrador' ve todo lo que la empresa tiene
  -- activo; 'vendedor' solo ve el módulo de Ventas, sin importar qué otros
  -- módulos tenga la empresa.
  rol_empresa text not null default 'administrador' check (rol_empresa in ('administrador','vendedor')),
  -- Solo aplica si la empresa usa puntos_venta. null = ve toda la empresa
  -- (cuenta general / administrador); con un punto asignado, ve solo ese
  -- punto (ej. el barista de un punto específico).
  punto_venta_id uuid references puntos_venta(id),
  nombre text,
  debe_cambiar_password boolean not null default true,  -- true al crear la cuenta; se apaga solo cuando cambia su contraseña por primera vez
  -- Cuál fue la última actualización (de la tabla actualizaciones) que esta
  -- persona ya cerró en el pop-up. null = todavía no ha visto ninguna.
  ultima_actualizacion_vista_id uuid references actualizaciones(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. DIAGNOSTICOS
-- ------------------------------------------------------------
create table diagnosticos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  respuestas jsonb not null,                  -- el cuestionario completo
  modulos_recomendados text[],
  fecha date default current_date
);

-- ------------------------------------------------------------
-- 5. SUSCRIPCIONES — estado del cobro recurrente de cada empresa cliente.
-- Nunca guarda datos de tarjeta (eso vive siempre en la pasarela de pago
-- elegida) — solo el estado y las fechas que deciden cuándo cobrar.
-- 'atributos' guarda lo específico de la pasarela (token, id de la
-- transacción externa) para no tener que tocar esta tabla otra vez el día
-- que se elija entre Wompi, Bold, u otra.
-- ------------------------------------------------------------
create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  estado text not null default 'prueba'
    check (estado in ('prueba','activa','vencida','cancelada')),
  fecha_inicio_prueba timestamptz not null default now(),
  fecha_fin_prueba timestamptz not null default (now() + interval '30 days'),
  fecha_proximo_cobro timestamptz,
  -- Precio congelado de esta empresa al momento de suscribirse — mismo
  -- criterio que ventas_items.precio_unitario: si el plan sube de precio
  -- después, esta empresa no cambia hasta que se renegocie.
  monto_mensual numeric(12,2) not null,
  proveedor_pago text check (proveedor_pago is null or proveedor_pago in ('wompi','bold')),
  atributos jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. VENTAS
-- ------------------------------------------------------------
create table ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null para el resto (la
  -- inmensa mayoría de las empresas).
  punto_venta_id uuid references puntos_venta(id),
  fecha timestamptz not null default now(),  -- fecha Y hora; siempre sugiere el momento actual, pero es editable
  monto numeric(12,2) not null,
  cliente_nombre text,
  producto text,
  metodo_pago text
    check (metodo_pago is null or metodo_pago in ('efectivo','tarjeta','transferencia','nequi','daviplata','otro')),
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: canal de venta, tipo de servicio, etc.
  -- Número simple y consecutivo por empresa (Venta #1, #2...) para
  -- referirse a una venta sin usar el id técnico — útil en recibos,
  -- correos, devoluciones, y cuando haya facturación electrónica. Lo
  -- asigna solo el trigger asignar_numero_venta(), nunca se manda a mano.
  numero_venta integer,
  created_at timestamptz default now(),
  unique (empresa_id, numero_venta)
);

-- Le asigna a cada venta nueva el siguiente número consecutivo de su
-- empresa, tomándolo de empresas.siguiente_numero_venta y subiéndolo en la
-- misma operación — al ser un solo UPDATE sobre una fila, Postgres la
-- bloquea mientras dura, así que dos ventas al mismo tiempo de la misma
-- empresa nunca terminan con el mismo número.
create or replace function asignar_numero_venta()
returns trigger language plpgsql as $$
declare
  v_numero integer;
begin
  update empresas
  set siguiente_numero_venta = siguiente_numero_venta + 1
  where id = new.empresa_id
  returning siguiente_numero_venta - 1 into v_numero;

  new.numero_venta := v_numero;
  return new;
end;
$$;

create trigger trigger_asignar_numero_venta
before insert on ventas
for each row execute function asignar_numero_venta();

-- ------------------------------------------------------------
-- 7. CRM
-- Las etapas del embudo (crm_etapas) son personalizables por empresa: un
-- negocio que vive de ventas directas (ej. Aseo Total) apenas las toca —
-- casi todos sus contactos caen directo en la etapa de cierre porque
-- nacen de una venta. Un negocio que vive de leads y cotizaciones antes de
-- vender (ej. una empresa de servicios) necesita su propio embudo, con las
-- etapas que le hagan sentido a su proceso, y reglas de inactividad que
-- muevan solo a un lead que lleva mucho tiempo sin seguimiento.
-- ------------------------------------------------------------
create table crm_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  orden int not null,
  -- La etapa a la que cae un contacto automáticamente en cuanto se le
  -- registra una venta — exactamente una por empresa (ver el índice único
  -- más abajo). Se marca con marcar_etapa_cierre(), nunca a mano con un
  -- update directo, para garantizar que nunca haya cero o dos etapas de cierre.
  es_cierre boolean not null default false,
  -- Regla de inactividad, opcional: si un contacto lleva más de
  -- "dias_inactividad" sin ninguna interacción registrada mientras está en
  -- esta etapa, se mueve solo a "etapa_destino_inactividad_id". Los dos
  -- campos van juntos — o los dos tienen valor, o ninguno.
  dias_inactividad int,
  etapa_destino_inactividad_id uuid references crm_etapas(id),
  created_at timestamptz default now(),
  unique (empresa_id, nombre),
  unique (empresa_id, orden)
);

-- A lo sumo una etapa de cierre por empresa.
create unique index crm_etapas_una_cierre_por_empresa on crm_etapas (empresa_id) where es_cierre;

-- Toda empresa nueva arranca con las mismas 4 etapas de siempre — desde ahí
-- cada una las agrega, renombra o reordena a su gusto. Así nadie tiene que
-- acordarse de sembrarlas a mano cada vez que se crea una empresa cliente
-- desde el panel de Supabase.
create or replace function crear_etapas_por_defecto()
returns trigger language plpgsql as $$
begin
  insert into crm_etapas (empresa_id, nombre, orden, es_cierre) values
    (new.id, 'Nuevo', 1, false),
    (new.id, 'Contactado', 2, false),
    (new.id, 'Propuesta', 3, false),
    (new.id, 'Cerrado', 4, true);
  return new;
end;
$$;

create trigger trigger_crear_etapas_por_defecto
after insert on empresas
for each row execute function crear_etapas_por_defecto();

create table crm_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  telefono text,
  email text,
  etapa_id uuid references crm_etapas(id),
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: modelo de vehículo, preferencias, alergias, etc.
  created_at timestamptz default now()
);

-- Si se crea un contacto sin indicar en qué etapa arranca (ej. desde
-- "Agregar cliente" a mano), cae en la primera etapa del embudo de esa
-- empresa — no hace falta que cada punto de inserción lo calcule.
create or replace function etapa_inicial_crm(p_empresa_id uuid)
returns uuid language sql stable as $$
  select id from crm_etapas where empresa_id = p_empresa_id order by orden asc limit 1;
$$;

-- La etapa de cierre de una empresa — a dónde cae un contacto en cuanto compra.
create or replace function etapa_cierre_crm(p_empresa_id uuid)
returns uuid language sql stable as $$
  select id from crm_etapas where empresa_id = p_empresa_id and es_cierre limit 1;
$$;

create or replace function fijar_etapa_inicial_crm()
returns trigger language plpgsql as $$
begin
  if new.etapa_id is null then
    new.etapa_id := etapa_inicial_crm(new.empresa_id);
  end if;
  return new;
end;
$$;

create trigger trigger_etapa_inicial_crm
before insert on crm_contactos
for each row execute function fijar_etapa_inicial_crm();

-- Cambia cuál es la etapa de cierre de una empresa, quitándosela a la
-- anterior primero — así nunca queda ninguna, ni dos a la vez (lo que
-- rompería el índice único de arriba).
create or replace function marcar_etapa_cierre(p_etapa_id uuid)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from crm_etapas where id = p_etapa_id;
  if v_empresa_id is null then
    raise exception 'Etapa no encontrada';
  end if;
  update crm_etapas set es_cierre = false where empresa_id = v_empresa_id and es_cierre;
  update crm_etapas set es_cierre = true where id = p_etapa_id;
end;
$$;

-- Mueve una etapa un lugar hacia arriba o hacia abajo en el orden del
-- embudo, intercambiando su "orden" con el de la etapa vecina. Pasa por un
-- valor temporal (-1) porque (empresa_id, orden) es único: si se intentara
-- swapear con dos updates directos, el primero dejaría dos etapas con el
-- mismo orden a mitad de camino y la base de datos lo rechazaría.
create or replace function mover_etapa_crm(p_etapa_id uuid, p_direccion text)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
  v_orden_actual int;
  v_vecino_id uuid;
  v_vecino_orden int;
begin
  select empresa_id, orden into v_empresa_id, v_orden_actual from crm_etapas where id = p_etapa_id;
  if v_empresa_id is null then
    raise exception 'Etapa no encontrada';
  end if;

  if p_direccion = 'arriba' then
    select id, orden into v_vecino_id, v_vecino_orden
    from crm_etapas where empresa_id = v_empresa_id and orden < v_orden_actual
    order by orden desc limit 1;
  else
    select id, orden into v_vecino_id, v_vecino_orden
    from crm_etapas where empresa_id = v_empresa_id and orden > v_orden_actual
    order by orden asc limit 1;
  end if;

  if v_vecino_id is null then
    return; -- ya está en el extremo, no hay nada que mover
  end if;

  update crm_etapas set orden = -1 where id = p_etapa_id;
  update crm_etapas set orden = v_orden_actual where id = v_vecino_id;
  update crm_etapas set orden = v_vecino_orden where id = p_etapa_id;
end;
$$;

create table crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid references crm_contactos(id) not null,
  fecha date default current_date,
  tipo text check (tipo in ('llamada','email','reunion','otro')),
  nota text
);

-- ------------------------------------------------------------
-- Campos personalizados por etapa del CRM (modo 'leads'): cada etapa del
-- embudo puede pedir información distinta — la primera etapa apenas datos
-- básicos, una etapa final ya necesita documentación, país de facturación,
-- etc. Es "atributos" (JSON) para el contacto, pero la LISTA de qué
-- preguntar la define la etapa, no el tipo de negocio — por eso es una
-- tabla propia (la lista de campos es una entidad en sí misma, con su
-- tipo y sus opciones) en vez de solo otro campo de `atributos`.
-- ------------------------------------------------------------
create table crm_etapa_campos (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid references crm_etapas(id) not null,
  nombre text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'fecha', 'si_no', 'seleccion', 'enlace')),
  opciones text[],   -- solo aplica si tipo = 'seleccion'
  requerido boolean not null default false,
  orden int not null default 1,
  created_at timestamptz default now()
);

-- Los valores que cada contacto tiene para esos campos, keyed por el id del
-- campo (no por nombre, para no romperse si el campo se renombra). Aparte
-- de `atributos` (que varía por tipo de negocio) porque este varía por
-- etapa del embudo — son dos cosas distintas que no deben mezclarse.
alter table crm_contactos add column campos_etapa jsonb not null default '{}';

-- Campos generales del CRM: a diferencia de crm_etapa_campos (que solo
-- aplica desde cierta etapa en adelante), estos siempre se piden para
-- cualquier contacto, sin importar en qué etapa esté — ej. "horario de
-- atención", "interesado en qué tipo de servicio". Tabla propia por el
-- mismo motivo que crm_etapa_campos (la lista de campos es una entidad en
-- sí misma), pero a nivel de empresa en vez de etapa. Los valores se
-- guardan en el mismo campos_etapa de arriba — las claves son ids de
-- campo, así que no chocan entre las dos tablas.
create table crm_campos_generales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'fecha', 'si_no', 'seleccion', 'enlace')),
  opciones text[],
  requerido boolean not null default false,
  orden int not null default 1,
  created_at timestamptz default now()
);

-- Aplica las reglas de inactividad de una empresa: por cada etapa que tenga
-- una configurada, mueve a "etapa_destino_inactividad_id" a cualquier
-- contacto que lleve más de "dias_inactividad" sin ninguna interacción
-- registrada (o, si nunca ha tenido ninguna, desde que se creó el contacto).
-- No corre como un proceso aparte en segundo plano (no hay servidor propio
-- para eso) — la aplicación la llama cada vez que alguien abre el CRM, así
-- que el movimiento ocurre la próxima vez que alguien entra a esa pantalla,
-- no exactamente al minuto del vencimiento.
create or replace function aplicar_reglas_inactividad_crm(p_empresa_id uuid)
returns void
language plpgsql
as $$
declare
  v_etapa record;
begin
  for v_etapa in
    select id, dias_inactividad, etapa_destino_inactividad_id
    from crm_etapas
    where empresa_id = p_empresa_id
      and dias_inactividad is not null
      and etapa_destino_inactividad_id is not null
  loop
    update crm_contactos c
    set etapa_id = v_etapa.etapa_destino_inactividad_id
    where c.empresa_id = p_empresa_id
      and c.etapa_id = v_etapa.id
      and coalesce(
        (select max(i.fecha) from crm_interacciones i where i.contacto_id = c.id),
        c.created_at::date
      ) <= current_date - v_etapa.dias_inactividad;
  end loop;
end;
$$;

-- Una venta puede quedar asociada a un contacto del CRM (opcional)
alter table ventas add column contacto_id uuid references crm_contactos(id);

-- Calificación manual del cliente, de 0 a 5 estrellas — se ve en el
-- directorio de CRM y en su ficha. Nula mientras nadie la haya puesto.
alter table crm_contactos add column calificacion smallint check (calificacion between 0 and 5);

-- ------------------------------------------------------------
-- CRM de Datum — los leads propios de Andrés (empresas a las que le está
-- vendiendo Datum), separado por completo del CRM que usan sus empresas
-- cliente para SUS propios clientes. Mismo patrón de embudo con etapas
-- personalizables y reglas de inactividad opcionales que ya usa el CRM en
-- modo 'leads', pero sin empresa_id — no es multi-tenant, es un solo
-- embudo para el negocio de Datum. Solo la cuenta de administrador puede
-- verlo o tocarlo (ver políticas RLS más abajo).
-- ------------------------------------------------------------
create table datum_crm_etapas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null,
  es_cierre boolean not null default false,
  dias_inactividad int,
  etapa_destino_inactividad_id uuid references datum_crm_etapas(id),
  created_at timestamptz default now(),
  unique (nombre),
  unique (orden)
);

create unique index datum_crm_etapas_una_cierre on datum_crm_etapas (es_cierre) where es_cierre;

insert into datum_crm_etapas (nombre, orden, es_cierre) values
  ('Nuevo', 1, false),
  ('Contactado', 2, false),
  ('Propuesta', 3, false),
  ('Cerrado', 4, true);

create table datum_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,          -- persona de contacto
  empresa text,                  -- empresa prospecto que representa
  telefono text,
  email text,
  etapa_id uuid references datum_crm_etapas(id),
  calificacion smallint check (calificacion between 0 and 5),
  notas text,
  created_at timestamptz default now()
);

create or replace function datum_etapa_inicial_crm()
returns uuid language sql stable as $$
  select id from datum_crm_etapas order by orden asc limit 1;
$$;

create or replace function fijar_etapa_inicial_datum_lead()
returns trigger language plpgsql as $$
begin
  if new.etapa_id is null then
    new.etapa_id := datum_etapa_inicial_crm();
  end if;
  return new;
end;
$$;

create trigger trigger_etapa_inicial_datum_lead
before insert on datum_leads
for each row execute function fijar_etapa_inicial_datum_lead();

-- Cambia cuál es la etapa de cierre, quitándosela a la anterior primero —
-- así nunca queda ninguna, ni dos a la vez (rompería el índice único de arriba).
create or replace function marcar_etapa_cierre_datum(p_etapa_id uuid)
returns void language plpgsql as $$
begin
  update datum_crm_etapas set es_cierre = false where es_cierre;
  update datum_crm_etapas set es_cierre = true where id = p_etapa_id;
end;
$$;

-- Mueve una etapa un lugar hacia arriba o hacia abajo, igual criterio que
-- mover_etapa_crm(): pasa por un valor temporal (-1) porque "orden" es único.
create or replace function mover_etapa_datum(p_etapa_id uuid, p_direccion text)
returns void language plpgsql as $$
declare
  v_orden_actual int;
  v_vecino_id uuid;
  v_vecino_orden int;
begin
  select orden into v_orden_actual from datum_crm_etapas where id = p_etapa_id;
  if v_orden_actual is null then
    raise exception 'Etapa no encontrada';
  end if;

  if p_direccion = 'arriba' then
    select id, orden into v_vecino_id, v_vecino_orden
    from datum_crm_etapas where orden < v_orden_actual
    order by orden desc limit 1;
  else
    select id, orden into v_vecino_id, v_vecino_orden
    from datum_crm_etapas where orden > v_orden_actual
    order by orden asc limit 1;
  end if;

  if v_vecino_id is null then
    return;
  end if;

  update datum_crm_etapas set orden = -1 where id = p_etapa_id;
  update datum_crm_etapas set orden = v_orden_actual where id = v_vecino_id;
  update datum_crm_etapas set orden = v_vecino_orden where id = p_etapa_id;
end;
$$;

create table datum_crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references datum_leads(id) not null,
  fecha date default current_date,
  tipo text check (tipo in ('llamada','email','reunion','otro')),
  nota text
);

-- Mismo patrón que crm_etapa_campos: cada etapa del embudo de leads de
-- Datum puede pedir información distinta a medida que un lead avanza.
create table datum_crm_etapa_campos (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid references datum_crm_etapas(id) not null,
  nombre text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'fecha', 'si_no', 'seleccion', 'enlace')),
  opciones text[],
  requerido boolean not null default false,
  orden int not null default 1,
  created_at timestamptz default now()
);

alter table datum_leads add column campos_etapa jsonb not null default '{}';

-- Campos generales del CRM de leads de Datum: mismo criterio que
-- crm_campos_generales, pero sin empresa_id — un solo embudo para Datum.
create table datum_crm_campos_generales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'fecha', 'si_no', 'seleccion', 'enlace')),
  opciones text[],
  requerido boolean not null default false,
  orden int not null default 1,
  created_at timestamptz default now()
);

-- El monto real de la venta que ese lead generó — se pide al mover el
-- lead a la etapa marcada como "de cierre" (cualquiera sea su nombre), y
-- alimenta vista_calificacion_leads_datum más abajo. Null mientras el
-- lead no haya cerrado todavía.
alter table datum_leads add column valor_venta numeric(12,2);

-- Mismo criterio que aplicar_reglas_inactividad_crm(): se llama cada vez
-- que alguien abre la pantalla de leads, no corre en segundo plano.
create or replace function aplicar_reglas_inactividad_crm_datum()
returns void language plpgsql as $$
declare
  v_etapa record;
begin
  for v_etapa in
    select id, dias_inactividad, etapa_destino_inactividad_id
    from datum_crm_etapas
    where dias_inactividad is not null and etapa_destino_inactividad_id is not null
  loop
    update datum_leads l
    set etapa_id = v_etapa.etapa_destino_inactividad_id
    where l.etapa_id = v_etapa.id
      and coalesce(
        (select max(i.fecha) from datum_crm_interacciones i where i.lead_id = l.id),
        l.created_at::date
      ) <= current_date - v_etapa.dias_inactividad;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Vista: Calificación automática de leads de Datum por venta generada
-- Mismo principio que vista_calificacion_clientes, pero comparando el
-- valor de venta de cada lead cerrado contra el promedio de los demás
-- leads YA CERRADOS (valor_venta no nulo) — un lead sin cerrar todavía
-- no aparece acá, porque no hay nada que comparar.
-- ------------------------------------------------------------
create or replace view vista_calificacion_leads_datum as
with base as (
  select id as lead_id, valor_venta
  from datum_leads
  where valor_venta is not null
),
promedio as (
  select avg(valor_venta) as promedio_valor from base
),
porcentajes as (
  select
    b.lead_id,
    case when p.promedio_valor > 0
      then 100.0 * (b.valor_venta - p.promedio_valor) / p.promedio_valor
      else 0
    end as pct_valor
  from base b
  cross join promedio p
)
select
  lead_id,
  round(pct_valor, 1) as pct_valor,
  case
    when pct_valor >= 90 then 5
    when pct_valor >= 70 then 4
    when pct_valor >= 50 then 3
    when pct_valor >= 30 then 2
    when pct_valor >= 10 then 1
    else 0
  end as calificacion_automatica
from porcentajes;

-- ------------------------------------------------------------
-- 8. INVENTARIO
-- ------------------------------------------------------------
-- Proveedores: a quién le compra cada producto la empresa, y en qué condición
-- le paga (de contado o a cuotas fijas). Es una entidad propia (no un campo en
-- atributos) porque tiene su propia identidad y su propia forma de pago, no un
-- dato adicional sobre un producto que ya existe.
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  telefono text,
  frecuencia_pago text not null default 'contado'
    check (frecuencia_pago in ('contado', 'diario', 'semanal', 'mensual', 'personalizado')),
  -- Solo aplica cuando frecuencia_pago = 'semanal': qué día de la semana cae el pago
  -- (ej. compras un viernes, pero el pago cae cada lunes).
  dia_semana_pago text
    check (dia_semana_pago is null or dia_semana_pago in
      ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')),
  -- Solo aplica cuando frecuencia_pago = 'personalizado': cada cuántos días se paga.
  dias_personalizado int,
  created_at timestamptz default now()
);

create table inventario_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null para el resto. Cada
  -- punto tiene su propio stock — el mismo producto en dos puntos son dos
  -- filas distintas, no una compartida.
  punto_venta_id uuid references puntos_venta(id),
  nombre text not null,
  sku text,
  categoria text,
  tipo text not null default 'producto' check (tipo in ('producto','servicio')),  -- 'servicio' no descuenta inventario (ej. mano de obra)
  unidad text not null default 'unidad',  -- 'unidad', 'galon', 'litro', 'ml', 'kg', 'caja', etc. — solo para mostrar, no hace conversiones sola
  cantidad numeric(12,2) default 0,
  costo numeric(12,2),
  precio_venta numeric(12,2),
  foto_path text,  -- ruta dentro del bucket 'inventario-fotos' de Supabase Storage; opcional
  proveedor_id uuid references proveedores(id),  -- a quién se le compra este producto; opcional
  es_insumo boolean not null default false,  -- material de receta puro: no se vende individualmente, no tiene precio_venta
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: fecha de vencimiento, modelo compatible, etc.
  created_at timestamptz default now(),
  unique (empresa_id, sku)
);

create table inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventario_items(id) not null,
  tipo text not null check (tipo in ('entrada','salida')),
  motivo text check (motivo in ('compra','ajuste','devolucion','trasvase','dotacion')),  -- 'compra' genera un gasto automático (solo entradas); 'dotacion' también genera un gasto automático (solo salidas)
  cantidad numeric(12,2) not null,
  fecha date default current_date,
  nota text
);

-- Lotes de inventario: cada entrada de stock (compra, producción de un
-- compuesto, carga inicial) guarda su propio costo y fecha por separado —
-- así se puede consumir primero lo más antiguo (FIFO) y el costo que se
-- congela en cada venta refleja lo que de verdad costó esa unidad, no el
-- último precio de compra, aunque el costo haya cambiado entre compras.
create table inventario_lotes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventario_items(id) not null,
  cantidad_disponible numeric(12,2) not null,
  costo_unitario numeric(12,2) not null,
  fecha timestamptz not null default now()
);

-- Consume p_cantidad unidades de los lotes de un producto, del más antiguo al
-- más nuevo (FIFO), y devuelve el costo unitario promedio ponderado de lo
-- consumido. Si no hay suficiente en lotes (nunca se cargó uno, o quedó
-- desfasado), el resto se completa al costo actual del producto, para no
-- dejar la operación a medias.
create or replace function consumir_lotes_fifo(p_item_id uuid, p_cantidad numeric)
returns numeric
language plpgsql
as $$
declare
  v_lote record;
  v_restante numeric := p_cantidad;
  v_tomado numeric;
  v_costo_total numeric := 0;
  v_costo_actual numeric;
begin
  for v_lote in
    select id, cantidad_disponible, costo_unitario
    from inventario_lotes
    where item_id = p_item_id and cantidad_disponible > 0
    order by fecha asc
    for update
  loop
    exit when v_restante <= 0;
    v_tomado := least(v_restante, v_lote.cantidad_disponible);
    update inventario_lotes
    set cantidad_disponible = cantidad_disponible - v_tomado
    where id = v_lote.id;
    v_costo_total := v_costo_total + (v_tomado * v_lote.costo_unitario);
    v_restante := v_restante - v_tomado;
  end loop;

  if v_restante > 0 then
    select costo into v_costo_actual from inventario_items where id = p_item_id;
    v_costo_total := v_costo_total + (v_restante * coalesce(v_costo_actual, 0));
  end if;

  if p_cantidad = 0 then
    return coalesce((select costo from inventario_items where id = p_item_id), 0);
  end if;

  return v_costo_total / p_cantidad;
end;
$$;

-- Detalle de cada venta: qué producto del inventario se vendió y cuánto.
-- item_id queda vacío si el negocio no maneja inventario físico (ej. un servicio de peluquería).
create table ventas_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references ventas(id) not null,
  item_id uuid references inventario_items(id),
  -- Nombre libre de lo vendido, para una empresa sin el módulo de Inventario
  -- activo (no tiene catálogo): item_id queda null y esto guarda qué se
  -- vendió, escrito a mano. Si item_id sí está, el nombre sale del catálogo
  -- y esto queda null — nunca se necesitan los dos a la vez.
  nombre_libre text,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2),   -- costo del ítem congelado al momento de la venta, para que la utilidad histórica no cambie si el costo sube después
  promocion_id uuid,              -- referencia a promociones, se enlaza más abajo
  descuento_aplicado numeric(12,2) default 0
);

-- Esto es la conexion automatica ventas -> inventario:
-- cada vez que se registra un item vendido, se congela su costo actual (para reportes de
-- utilidad futuros) y, si es un producto físico, se genera el movimiento de salida y se
-- resta la cantidad disponible. Nadie tiene que ajustar el inventario a mano.
-- Un producto compuesto (con receta en inventario_receta) también tiene su propia cantidad
-- en stock, igual que cualquier otro: sus insumos no se descuentan aquí al venderlo, sino
-- antes, cuando se ajusta hacia arriba su cantidad para reflejar un lote ya producido
-- (ver ajustar_inventario más abajo) — vender un producto compuesto solo descuenta su
-- propio stock, exactamente como un producto sin receta.
create or replace function descontar_inventario()
returns trigger language plpgsql as $$
declare
  v_tipo text;
  v_costo numeric(12,2);
  v_stock numeric(12,2);
  v_nombre text;
  v_es_insumo boolean;
begin
  -- Una venta histórica importada (importar_ventas_historicas) no debe volver
  -- a descontar inventario ni recalcular el costo — eso ya pasó de verdad con
  -- el sistema anterior del cliente, y el costo ya viene puesto a mano.
  -- Un apartado reclamado (reclamar_apartado) tampoco: la prenda ya se
  -- descontó cuando se apartó, no cuando se terminó de pagar.
  if current_setting('app.importando_historico', true) = 'true'
     or current_setting('app.apartado_ya_descontado', true) = 'true' then
    return new;
  end if;

  if new.item_id is not null then
    select tipo, costo, cantidad, nombre, es_insumo
    into v_tipo, v_costo, v_stock, v_nombre, v_es_insumo
    from inventario_items where id = new.item_id;

    if v_es_insumo then
      raise exception '"%" es material de receta y no se vende individualmente.', v_nombre;
    end if;

    if v_tipo = 'producto' then
      -- No se puede vender más de lo que hay — obliga a mantener el inventario
      -- al día en vez de dejar que la cantidad quede en negativo.
      if v_stock < new.cantidad then
        raise exception 'No hay suficiente stock de "%": quedan % y se intentó vender %. Agrega inventario antes de vender.',
          v_nombre, v_stock, new.cantidad;
      end if;

      -- El costo congelado en la venta sale de los lotes consumidos (FIFO),
      -- no del costo actual del producto — así el margen de esa venta no se
      -- distorsiona si el costo cambió después de comprar lo que se vendió.
      new.costo_unitario := consumir_lotes_fifo(new.item_id, new.cantidad);

      insert into inventario_movimientos (item_id, tipo, cantidad, nota)
      values (new.item_id, 'salida', new.cantidad, 'Descuento automático por venta');

      update inventario_items
      set cantidad = cantidad - new.cantidad
      where id = new.item_id;
    else
      new.costo_unitario := v_costo;
    end if;
  end if;
  return new;
end;
$$;

create trigger trigger_descontar_inventario
before insert on ventas_items
for each row execute function descontar_inventario();

-- Receta: qué insumos (y cuánto de cada uno) necesita un producto para
-- producirse — ej. "Jabón envasado 500ml" necesita 0.5 litros de "Jabón a
-- granel" + 1 unidad de "Envase vacío 500ml". Cada insumo es un producto
-- independiente del inventario con su propia unidad (gramos, mililitros,
-- metros, unidad, etc.); no hay conversión entre unidades — cada fila se
-- descuenta en la unidad propia de ese insumo. Se configura una sola vez,
-- no cada vez que se produce.
create table inventario_receta (
  id uuid primary key default gen_random_uuid(),
  item_resultante_id uuid references inventario_items(id) not null,
  item_insumo_id uuid references inventario_items(id) not null,
  cantidad_insumo numeric(12,4) not null,  -- cuánto se consume del insumo por CADA unidad producida del resultado
  created_at timestamptz default now(),
  unique (item_resultante_id, item_insumo_id)
);

-- Reabastecer un producto que ya existe: suma cantidad al stock actual
-- (nunca lo reemplaza) y actualiza costo, precio de venta y categoría a
-- los valores más recientes. Se usa desde "Agregar producto" cuando la
-- persona busca el nombre y encuentra que ya existe, en vez de crear un
-- duplicado. Es una sola operación atómica para evitar perder cantidad
-- si dos personas reabastecen el mismo producto casi al mismo tiempo.
create or replace function reabastecer_producto(
  p_item_id uuid,
  p_cantidad_agregada numeric,
  p_costo numeric,
  p_precio_venta numeric,
  p_categoria text,
  p_proveedor_id uuid default null
)
returns void
language plpgsql
as $$
begin
  update inventario_items
  set cantidad = cantidad + p_cantidad_agregada,
      costo = p_costo,
      precio_venta = p_precio_venta,
      categoria = p_categoria,
      proveedor_id = p_proveedor_id
  where id = p_item_id;

  -- Cada compra es su propio lote, con su propio costo — por si el próximo
  -- mes cambia el precio, para poder venderlos en el orden en que entraron.
  if p_cantidad_agregada > 0 then
    insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
    values (p_item_id, p_cantidad_agregada, p_costo);
  end if;
end;
$$;

-- Corrige la cantidad en stock a lo que de verdad hay — pérdida, daño, o un
-- conteo físico que no coincide con el sistema. A diferencia de reabastecer
-- (que siempre suma), esto fija el número exacto y deja un movimiento en
-- inventario_movimientos con motivo 'ajuste' como registro de por qué cambió.
create or replace function ajustar_inventario(
  p_item_id uuid,
  p_cantidad_real numeric,
  p_nota text default null
)
returns void
language plpgsql
as $$
declare
  v_cantidad_actual numeric(12,2);
  v_costo_actual numeric(12,2);
  v_diferencia numeric(12,2);
  v_receta record;
  v_costo_producido numeric(12,2);
  v_costo_insumo numeric(12,2);
begin
  select cantidad, costo into v_cantidad_actual, v_costo_actual
  from inventario_items where id = p_item_id;
  if v_cantidad_actual is null then
    raise exception 'Producto no encontrado';
  end if;

  v_diferencia := p_cantidad_real - v_cantidad_actual;
  if v_diferencia = 0 then
    return;
  end if;

  insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
  values (
    p_item_id,
    case when v_diferencia > 0 then 'entrada' else 'salida' end,
    'ajuste',
    abs(v_diferencia),
    p_nota
  );

  update inventario_items set cantidad = p_cantidad_real where id = p_item_id;

  if v_diferencia > 0 then
    if exists (select 1 from inventario_receta where item_resultante_id = p_item_id) then
      -- Tiene receta: estas unidades de más se acaban de producir de verdad —
      -- se descuentan los insumos usados (de sus propios lotes, FIFO) y el
      -- costo del lote nuevo es lo que de verdad costaron esos insumos, no un
      -- número puesto a mano. Un ajuste hacia abajo no toca los insumos: esas
      -- unidades ya estaban producidas, solo se perdieron o se dañaron.
      v_costo_producido := 0;
      for v_receta in
        select item_insumo_id, cantidad_insumo
        from inventario_receta
        where item_resultante_id = p_item_id
      loop
        v_costo_insumo := consumir_lotes_fifo(v_receta.item_insumo_id, v_receta.cantidad_insumo * v_diferencia);
        v_costo_producido := v_costo_producido + (v_costo_insumo * v_receta.cantidad_insumo);

        insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
        values (
          v_receta.item_insumo_id, 'salida', 'trasvase',
          v_receta.cantidad_insumo * v_diferencia,
          'Consumido al producir ' || v_diferencia || ' unidad(es) de un producto compuesto'
        );

        update inventario_items
        set cantidad = cantidad - (v_receta.cantidad_insumo * v_diferencia)
        where id = v_receta.item_insumo_id;
      end loop;

      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (p_item_id, v_diferencia, v_costo_producido);

      update inventario_items set costo = v_costo_producido where id = p_item_id;
    else
      -- Sin receta: se encontró más stock del que el sistema pensaba. Se
      -- registra como lote nuevo al costo actual del producto, que es el
      -- único dato de costo disponible para esas unidades.
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (p_item_id, v_diferencia, coalesce(v_costo_actual, 0));
    end if;
  else
    -- Ajuste hacia abajo (pérdida, daño, conteo): se descuenta de los lotes
    -- existentes empezando por el más antiguo, para no perder la trazabilidad.
    perform consumir_lotes_fifo(p_item_id, abs(v_diferencia));
  end if;
end;
$$;

-- Dotación: productos que se le entregan a un empleado (esponjas, uniformes,
-- etc.), no a un cliente. No es una venta (no genera ingreso), pero sí es un
-- costo real del negocio, así que además de descontar el inventario (por
-- FIFO, igual que una venta) genera su propio gasto automático en
-- finanzas_movimientos — a diferencia de un 'ajuste' por pérdida o daño, que
-- no debe tocar el P y G.
create or replace function registrar_dotacion(
  p_item_id uuid,
  p_cantidad numeric,
  p_nota text default null
)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
  v_nombre text;
  v_stock numeric(12,2);
  v_costo_consumido numeric(12,2);
begin
  select empresa_id, nombre, cantidad into v_empresa_id, v_nombre, v_stock
  from inventario_items where id = p_item_id;

  if v_empresa_id is null then
    raise exception 'Producto no encontrado';
  end if;
  if p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if v_stock < p_cantidad then
    raise exception 'No hay suficiente stock de "%": quedan % y se intentó entregar %.',
      v_nombre, v_stock, p_cantidad;
  end if;

  v_costo_consumido := consumir_lotes_fifo(p_item_id, p_cantidad);

  insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
  values (p_item_id, 'salida', 'dotacion', p_cantidad, p_nota);

  update inventario_items set cantidad = cantidad - p_cantidad where id = p_item_id;

  insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, nota)
  values (
    v_empresa_id, 'gasto', 'dotación a empleados',
    p_cantidad * coalesce(v_costo_consumido, 0),
    coalesce(p_nota, 'Dotación de "' || v_nombre || '" a empleado')
  );
end;
$$;

-- Carga masiva de inventario inicial: para una empresa que llega con su propio
-- catálogo (de otra herramienta o de una hoja de Excel a mano). Por cada fila
-- del CSV, si el producto ya existe (mismo nombre en la empresa) le suma la
-- cantidad y actualiza costo/precio/categoría — igual que reabastecer_producto();
-- si no existe, lo crea. Es una foto de "cuánto hay hoy", no un historial de
-- movimientos. Devuelve cuántos productos nuevos creó.
create or replace function cargar_inventario_inicial(
  p_empresa_id uuid,
  p_items jsonb,  -- [{"nombre":"...","categoria":"...","unidad":"unidad","cantidad":10,"costo":1000,"precio_venta":2000,"es_insumo":false}, ...]
  p_reemplazar boolean default false,  -- true: el archivo reemplaza la cantidad de cada producto (carga inicial o recuento completo); false: suma a lo que ya hay (reabastecimiento)
  p_punto_venta_id uuid default null   -- solo si la empresa usa puntos_venta; null para el resto
)
returns int
language plpgsql
as $$
declare
  v_item jsonb;
  v_existente_id uuid;
  v_item_id uuid;
  v_cantidad numeric;
  v_costo numeric;
  v_es_insumo boolean;
  v_precio_venta numeric;
  v_creados int := 0;
  v_items_reseteados uuid[] := '{}';
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_costo := (v_item->>'costo')::numeric;
    v_es_insumo := coalesce((v_item->>'es_insumo')::boolean, false);
    -- un insumo puro no se vende individualmente, así que nunca tiene precio de venta
    v_precio_venta := case when v_es_insumo then null else (v_item->>'precio_venta')::numeric end;

    -- El mismo nombre puede existir en puntos distintos como filas separadas
    -- (cada una con su propio stock) — "is not distinct from" trata null
    -- como igual a null, para no romper a las empresas sin puntos de venta.
    select id into v_existente_id
    from inventario_items
    where empresa_id = p_empresa_id
      and punto_venta_id is not distinct from p_punto_venta_id
      and lower(unaccent(nombre)) = lower(unaccent(v_item->>'nombre'))
    limit 1;

    if v_existente_id is not null then
      if p_reemplazar and not (v_existente_id = any(v_items_reseteados)) then
        -- primera fila de este producto en una carga que reemplaza: se
        -- descarta el stock y los lotes anteriores, empieza de cero con lo
        -- que diga el archivo
        delete from inventario_lotes where item_id = v_existente_id;
        update inventario_items
        set cantidad = v_cantidad,
            costo = coalesce(v_costo, costo),
            precio_venta = case when v_es_insumo then null else coalesce(v_precio_venta, precio_venta) end,
            categoria = coalesce(nullif(v_item->>'categoria', ''), categoria),
            es_insumo = v_es_insumo
        where id = v_existente_id;
        v_items_reseteados := v_items_reseteados || v_existente_id;
      else
        -- reabastecimiento normal, o segunda fila del mismo producto en una
        -- carga que reemplaza (mismo nombre, distinto costo = otro lote)
        update inventario_items
        set cantidad = cantidad + v_cantidad,
            costo = coalesce(v_costo, costo),
            precio_venta = case when v_es_insumo then null else coalesce(v_precio_venta, precio_venta) end,
            categoria = coalesce(nullif(v_item->>'categoria', ''), categoria),
            es_insumo = v_es_insumo
        where id = v_existente_id;
      end if;
      v_item_id := v_existente_id;
    else
      insert into inventario_items (empresa_id, punto_venta_id, nombre, categoria, unidad, cantidad, costo, precio_venta, es_insumo)
      values (
        p_empresa_id,
        p_punto_venta_id,
        v_item->>'nombre',
        nullif(v_item->>'categoria', ''),
        coalesce(nullif(v_item->>'unidad', ''), 'unidad'),
        v_cantidad,
        v_costo,
        v_precio_venta,
        v_es_insumo
      )
      returning id into v_item_id;
      v_creados := v_creados + 1;
      v_items_reseteados := v_items_reseteados || v_item_id;
    end if;

    if v_cantidad > 0 then
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item_id, v_cantidad, coalesce(v_costo, 0));
    end if;
  end loop;

  return v_creados;
end;
$$;

-- ------------------------------------------------------------
-- 8.5. APARTADOS — desarrollo a la medida de Manantial (empresas.permite_apartados)
-- Venta parcial: el cliente paga un abono, la prenda se separa del
-- inventario disponible de inmediato, y tiene 30 días para completar el
-- pago. Si completa, se convierte en una venta real. Si no, lo abonado
-- queda como ingreso y la prenda vuelve a estar disponible. Las cifras de
-- venta solo cuentan la plata que de verdad entró en cada momento (mismo
-- criterio de caja que ya usan los pasivos) — nunca el precio completo por
-- adelantado, así vista_estado_resultados no necesita ningún cambio: un
-- apartado no le genera ninguna fila a "ventas" hasta que se resuelve.
-- ------------------------------------------------------------
create table apartados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  punto_venta_id uuid references puntos_venta(id),
  contacto_id uuid references crm_contactos(id),
  cliente_nombre text,
  cliente_telefono text,
  cliente_email text,
  monto_total numeric(12,2) not null,
  monto_abonado numeric(12,2) not null default 0,
  fecha date not null default current_date,
  fecha_limite date not null,
  estado text not null default 'activo' check (estado in ('activo','reclamado','vencido')),
  -- Se llena cuando se resuelve (reclamado o vencido) — enlaza a la venta
  -- real que sí cuenta en el P y G. Null mientras sigue activo.
  venta_id uuid references ventas(id),
  created_at timestamptz default now()
);

-- item_id es opcional: si la empresa tiene catálogo (Inventario activo), la
-- prenda se separa de ahí (FIFO) igual que una venta normal. Si no (ej.
-- Manantial, que no tiene el módulo de Inventario), queda null y se usa
-- nombre_libre + costo_unitario escrito a mano — el mismo patrón dual que ya
-- usa ventas_items, y sin catálogo no hay nada que descontar ni devolver.
create table apartados_items (
  id uuid primary key default gen_random_uuid(),
  apartado_id uuid references apartados(id) not null,
  item_id uuid references inventario_items(id),
  nombre_libre text,
  cantidad numeric(12,2) not null,
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2)  -- congelado vía FIFO si hay item_id; escrito a mano si no
);

create table apartados_abonos (
  id uuid primary key default gen_random_uuid(),
  apartado_id uuid references apartados(id) not null,
  monto numeric(12,2) not null,
  fecha date not null default current_date,
  created_at timestamptz default now()
);

-- Convierte un apartado ya pagado por completo en una venta real. Las
-- prendas con item_id ya se descontaron del inventario cuando se
-- apartaron, así que se usa la bandera app.apartado_ya_descontado para que
-- el trigger de descuento automático (pensado para una venta normal) no
-- las reste otra vez. Las líneas con nombre_libre (sin catálogo) nunca
-- tocan inventario, ni al apartar ni al reclamar — igual que una venta
-- normal sin catálogo.
create or replace function reclamar_apartado(p_apartado_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_apartado record;
  v_venta_id uuid;
  v_item record;
begin
  select * into v_apartado from apartados where id = p_apartado_id;
  if v_apartado.id is null then
    raise exception 'Apartado no encontrado';
  end if;

  insert into ventas (empresa_id, punto_venta_id, monto, contacto_id, cliente_nombre, atributos, fecha)
  values (
    v_apartado.empresa_id, v_apartado.punto_venta_id, v_apartado.monto_total,
    v_apartado.contacto_id, v_apartado.cliente_nombre,
    jsonb_build_object('origen', 'apartado', 'apartado_id', v_apartado.id), now()
  )
  returning id into v_venta_id;

  perform set_config('app.apartado_ya_descontado', 'true', true);

  for v_item in
    select item_id, nombre_libre, cantidad, precio_unitario, costo_unitario
    from apartados_items where apartado_id = p_apartado_id
  loop
    insert into ventas_items (venta_id, item_id, nombre_libre, cantidad, precio_unitario, costo_unitario)
    values (v_venta_id, v_item.item_id, v_item.nombre_libre, v_item.cantidad, v_item.precio_unitario, v_item.costo_unitario);
  end loop;

  perform set_config('app.apartado_ya_descontado', 'false', true);

  update apartados set estado = 'reclamado', venta_id = v_venta_id where id = p_apartado_id;

  -- Ya hay una venta real de por medio — el contacto pasa a la etapa de
  -- cierre, exactamente igual que con cualquier otra venta.
  if v_apartado.contacto_id is not null then
    update crm_contactos set etapa_id = etapa_cierre_crm(v_apartado.empresa_id) where id = v_apartado.contacto_id;
  end if;

  return v_venta_id;
end;
$$;

-- Registra un abono sobre un apartado activo. Si con este abono se
-- completa el precio total, el apartado se resuelve solo — no hace falta
-- un botón aparte para "entregar" la prenda.
create or replace function agregar_abono_apartado(
  p_apartado_id uuid,
  p_monto numeric,
  p_fecha date default current_date
)
returns void
language plpgsql
as $$
declare
  v_estado text;
  v_monto_total numeric;
  v_monto_abonado numeric;
begin
  select estado, monto_total into v_estado, v_monto_total from apartados where id = p_apartado_id;

  if v_estado is null then
    raise exception 'Apartado no encontrado';
  end if;
  if v_estado <> 'activo' then
    raise exception 'Este apartado ya no está activo — no se le pueden agregar más abonos.';
  end if;
  if p_monto <= 0 then
    raise exception 'El abono debe ser mayor a cero.';
  end if;

  insert into apartados_abonos (apartado_id, monto, fecha) values (p_apartado_id, p_monto, p_fecha);

  update apartados set monto_abonado = monto_abonado + p_monto where id = p_apartado_id;

  select monto_abonado into v_monto_abonado from apartados where id = p_apartado_id;

  if v_monto_abonado >= v_monto_total then
    perform reclamar_apartado(p_apartado_id);
  end if;
end;
$$;

-- Crea un apartado nuevo y arranca el plazo de 30 días. Cada línea puede
-- venir con item_id (empresa con catálogo: la prenda se separa del
-- inventario disponible de inmediato, FIFO, igual que una venta) o con
-- nombre_libre + costo escrito a mano (empresa sin catálogo, ej. Manantial —
-- no hay nada que descontar ni devolver, exactamente igual que una venta
-- normal sin Inventario). El contacto del CRM se busca o se crea igual que
-- en registrar_venta(), pero sin moverlo a la etapa de cierre todavía — eso
-- solo pasa cuando el apartado se resuelve de verdad (reclamado o vencido).
create or replace function registrar_apartado(
  p_empresa_id uuid,
  p_contacto_id uuid,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text,
  p_items jsonb,  -- [{"item_id":"...","nombre_libre":null,"cantidad":1,"precio_unitario":80000,"costo_unitario":null}, ...]
                   -- o, sin catálogo: [{"item_id":null,"nombre_libre":"Vestido azul","cantidad":1,"precio_unitario":80000,"costo_unitario":40000}, ...]
  p_monto_inicial numeric,
  p_punto_venta_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_contacto_id uuid;
  v_apartado_id uuid;
  v_monto_total numeric(12,2);
  v_item jsonb;
  v_item_id uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_costo numeric;
  v_stock numeric;
  v_nombre text;
  v_es_insumo boolean;
  v_tipo text;
begin
  if p_contacto_id is not null then
    v_contacto_id := p_contacto_id;
    update crm_contactos
    set nombre = coalesce(p_cliente_nombre, nombre), email = coalesce(p_cliente_email, email)
    where id = v_contacto_id;
  elsif coalesce(p_cliente_nombre, '') <> '' then
    select id into v_contacto_id
    from crm_contactos where empresa_id = p_empresa_id and telefono = p_cliente_telefono
    limit 1;

    if v_contacto_id is null then
      insert into crm_contactos (empresa_id, nombre, telefono, email)
      values (p_empresa_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email)
      returning id into v_contacto_id;
    else
      update crm_contactos
      set nombre = coalesce(p_cliente_nombre, nombre), email = coalesce(p_cliente_email, email)
      where id = v_contacto_id;
    end if;
  else
    v_contacto_id := null;
  end if;

  select sum((item->>'cantidad')::numeric * (item->>'precio_unitario')::numeric)
  into v_monto_total
  from jsonb_array_elements(p_items) as item;

  insert into apartados (empresa_id, punto_venta_id, contacto_id, cliente_nombre, cliente_telefono, cliente_email, monto_total, fecha, fecha_limite)
  values (p_empresa_id, p_punto_venta_id, v_contacto_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email, v_monto_total, current_date, current_date + interval '30 days')
  returning id into v_apartado_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := nullif(v_item->>'item_id', '')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario')::numeric;

    if v_item_id is not null then
      -- Empresa con catálogo: se separa del inventario disponible, FIFO,
      -- igual que una venta.
      select tipo, cantidad, nombre, es_insumo into v_tipo, v_stock, v_nombre, v_es_insumo
      from inventario_items where id = v_item_id;

      if v_es_insumo then
        raise exception '"%" es material de receta y no se vende individualmente.', v_nombre;
      end if;
      if v_stock < v_cantidad then
        raise exception 'No hay suficiente stock de "%": quedan % y se intentó apartar %.', v_nombre, v_stock, v_cantidad;
      end if;

      v_costo := consumir_lotes_fifo(v_item_id, v_cantidad);

      insert into inventario_movimientos (item_id, tipo, cantidad, nota)
      values (v_item_id, 'salida', v_cantidad, 'Apartado — separado del inventario disponible');

      update inventario_items set cantidad = cantidad - v_cantidad where id = v_item_id;

      insert into apartados_items (apartado_id, item_id, cantidad, precio_unitario, costo_unitario)
      values (v_apartado_id, v_item_id, v_cantidad, v_precio, v_costo);
    else
      -- Sin catálogo: nombre y costo escritos a mano, nada que descontar.
      insert into apartados_items (apartado_id, nombre_libre, cantidad, precio_unitario, costo_unitario)
      values (v_apartado_id, nullif(v_item->>'nombre_libre', ''), v_cantidad, v_precio, nullif(v_item->>'costo_unitario', '')::numeric);
    end if;
  end loop;

  if p_monto_inicial > 0 then
    perform agregar_abono_apartado(v_apartado_id, p_monto_inicial, current_date);
  end if;

  return v_apartado_id;
end;
$$;

-- Revisa los apartados vencidos de una empresa (más de 30 días sin
-- completar el pago) y los resuelve: lo abonado hasta ese momento queda
-- como ingreso (el cliente lo pierde), y la prenda vuelve a estar
-- disponible en el inventario. No corre sola en segundo plano (no hay
-- servidor propio para eso) — se llama cada vez que alguien abre la
-- pantalla de Apartados, así que el cierre ocurre en la próxima visita a
-- esa pantalla, no exactamente al minuto del vencimiento.
create or replace function aplicar_vencimiento_apartados(p_empresa_id uuid)
returns void
language plpgsql
as $$
declare
  v_apartado record;
  v_venta_id uuid;
  v_item record;
begin
  for v_apartado in
    select * from apartados
    where empresa_id = p_empresa_id and estado = 'activo' and fecha_limite < current_date
  loop
    if v_apartado.monto_abonado > 0 then
      insert into ventas (empresa_id, punto_venta_id, monto, contacto_id, cliente_nombre, fecha, atributos)
      values (
        v_apartado.empresa_id, v_apartado.punto_venta_id, v_apartado.monto_abonado,
        v_apartado.contacto_id, v_apartado.cliente_nombre, v_apartado.fecha_limite,
        jsonb_build_object('origen', 'apartado_vencido', 'apartado_id', v_apartado.id)
      )
      returning id into v_venta_id;

      insert into ventas_items (venta_id, nombre_libre, cantidad, precio_unitario, costo_unitario)
      values (v_venta_id, 'Apartado vencido — abono no reclamado', 1, v_apartado.monto_abonado, 0);

      if v_apartado.contacto_id is not null then
        update crm_contactos set etapa_id = etapa_cierre_crm(v_apartado.empresa_id) where id = v_apartado.contacto_id;
      end if;
    else
      v_venta_id := null;
    end if;

    -- Solo las líneas con catálogo (item_id) tienen algo que devolver — las
    -- de nombre_libre nunca descontaron nada al apartar.
    for v_item in
      select item_id, cantidad, costo_unitario
      from apartados_items
      where apartado_id = v_apartado.id and item_id is not null
    loop
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item.item_id, v_item.cantidad, coalesce(v_item.costo_unitario, 0));

      insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
      values (v_item.item_id, 'entrada', 'devolucion', v_item.cantidad, 'Apartado vencido — vuelve a estar disponible');

      update inventario_items set cantidad = cantidad + v_item.cantidad where id = v_item.item_id;
    end loop;

    update apartados set estado = 'vencido', venta_id = v_venta_id where id = v_apartado.id;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 9. FINANZAS — alimenta el estado de pérdidas y ganancias
-- ------------------------------------------------------------
create table finanzas_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null para el resto. Así el
  -- arriendo o la nómina de un punto no se mezclan con los de otro, y cada
  -- punto puede tener su propia utilidad neta.
  punto_venta_id uuid references puntos_venta(id),
  tipo text not null check (tipo in ('ingreso','gasto')),
  categoria text,
  monto numeric(12,2) not null,
  fecha date default current_date,
  nota text
);

-- Cuando una entrada de inventario es una compra real (no un ajuste o devolución),
-- se genera el gasto correspondiente solo. Los ajustes no deben inflar tus gastos —
-- por eso esto no es automático para cualquier entrada, solo para motivo = 'compra'.
create or replace function registrar_gasto_compra()
returns trigger language plpgsql as $$
declare
  v_empresa_id uuid;
  v_costo numeric(12,2);
begin
  if new.tipo = 'entrada' and new.motivo = 'compra' then
    select empresa_id, costo into v_empresa_id, v_costo
    from inventario_items where id = new.item_id;

    insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, nota)
    values (v_empresa_id, 'gasto', 'compra de inventario', new.cantidad * coalesce(v_costo, 0),
            'Generado automáticamente por compra de inventario');
  end if;
  return new;
end;
$$;

create trigger trigger_registrar_gasto_compra
after insert on inventario_movimientos
for each row execute function registrar_gasto_compra();

-- ------------------------------------------------------------
-- Vista: Estado de pérdidas y ganancias
-- Estructura contable real: Ingresos - Costo de ventas = Utilidad bruta;
-- + otros ingresos - gastos operacionales = Utilidad neta.
-- Usa el costo congelado en cada venta (no el costo actual). Respeta
-- Row Level Security automáticamente: cada empresa solo ve su propia fila.
-- ------------------------------------------------------------
-- punto_venta_id se incluye en cada CTE y se junta con "is not distinct
-- from" en vez de "=" — así una empresa sin puntos de venta (punto_venta_id
-- siempre null en todas sus filas) sigue calzando null con null, y no se
-- rompe el cálculo de nadie que no use puntos de venta.
create or replace view vista_estado_resultados as
with periodos as (
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes from ventas
  union
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes from finanzas_movimientos
),
ventas_mes as (
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes, sum(monto) as ingresos
  from ventas group by 1, 2, 3
),
costo_ventas_mes as (
  select v.empresa_id, v.punto_venta_id, date_trunc('month', v.fecha) as mes,
    sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as costo_ventas
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  group by 1, 2, 3
),
otros_mes as (
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes,
    sum(case when tipo = 'ingreso' then monto else 0 end) as ingresos_otros,
    sum(case when tipo = 'gasto' then monto else 0 end) as gastos_operacionales
  from finanzas_movimientos group by 1, 2, 3
)
select
  p.empresa_id,
  p.mes,
  coalesce(vm.ingresos, 0) as ingresos_por_ventas,
  coalesce(cv.costo_ventas, 0) as costo_de_ventas,
  coalesce(vm.ingresos, 0) - coalesce(cv.costo_ventas, 0) as utilidad_bruta,
  coalesce(om.ingresos_otros, 0) as otros_ingresos,
  coalesce(om.gastos_operacionales, 0) as gastos_operacionales,
  (coalesce(vm.ingresos, 0) - coalesce(cv.costo_ventas, 0)
   + coalesce(om.ingresos_otros, 0) - coalesce(om.gastos_operacionales, 0)) as utilidad_neta,
  p.punto_venta_id
from periodos p
left join ventas_mes vm on vm.empresa_id = p.empresa_id and vm.mes = p.mes
  and vm.punto_venta_id is not distinct from p.punto_venta_id
left join costo_ventas_mes cv on cv.empresa_id = p.empresa_id and cv.mes = p.mes
  and cv.punto_venta_id is not distinct from p.punto_venta_id
left join otros_mes om on om.empresa_id = p.empresa_id and om.mes = p.mes
  and om.punto_venta_id is not distinct from p.punto_venta_id;

-- ------------------------------------------------------------
-- Pasivos y deudas por pagar
-- Crear la deuda no genera ningún gasto por sí sola — ese dinero
-- todavía no ha salido. El gasto real (criterio de caja) se registra
-- cuando efectivamente se abona o se paga, con la fecha en que
-- ocurrió: cada abono genera su propio movimiento en
-- finanzas_movimientos (enlazado vía pasivo_id más abajo), así sí
-- impacta vista_estado_resultados en el mes correspondiente, sin
-- duplicar — solo se cuenta la porción abonada, nunca la deuda
-- completa de una vez.
-- ------------------------------------------------------------
create table pasivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  descripcion text not null,                    -- 'Préstamo Bancolombia', 'Pago proveedor Aseo Distribuciones'
  tipo text check (tipo in ('prestamo','proveedor','tarjeta_credito','otro')),
  monto_total numeric(12,2) not null,
  monto_pagado numeric(12,2) not null default 0,
  fecha_vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','vencido')),
  -- Cada cuánto se planea pagar (informativo — no genera abonos solo, cada
  -- pago se sigue registrando a mano con registrarAbono()/marcarPagado()).
  frecuencia_pago text check (frecuencia_pago is null or frecuencia_pago in ('diario','mensual','anual','unico')),
  created_at timestamptz default now()
);

-- Enlaza cada abono/pago (registrado como gasto en finanzas_movimientos,
-- categoría 'pago de deuda') con la deuda a la que corresponde. Nulo
-- para cualquier otro gasto o ingreso que no sea un pago de deuda.
alter table finanzas_movimientos add column pasivo_id uuid references pasivos(id);

-- Si un gasto se repite (arriendo, nómina, servicios), queda marcado como
-- referencia — informativo, no genera el siguiente gasto solo: cada uno se
-- sigue registrando a mano cuando ocurre de verdad (criterio de caja).
alter table finanzas_movimientos add column recurrente boolean not null default false;
alter table finanzas_movimientos add column frecuencia text
  check (frecuencia is null or frecuencia in ('diario','mensual','anual'));

-- ------------------------------------------------------------
-- Finanzas de Datum — el propio P y G del negocio Datum, aparte del de
-- cada empresa cliente. Mismo criterio de caja que pasivos/finanzas_movimientos
-- de arriba (crear una deuda no genera gasto; solo el abono real lo hace),
-- pero sin empresa_id: esto no es de ninguna empresa cliente, es del negocio
-- Datum mismo. Solo la cuenta de administrador puede verlas o tocarlas (ver
-- políticas RLS más abajo) — ningún cliente tiene acceso ni las ve nunca.
-- ------------------------------------------------------------
create table datum_pasivos (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  tipo text check (tipo in ('prestamo','proveedor','tarjeta_credito','otro')),
  monto_total numeric(12,2) not null,
  monto_pagado numeric(12,2) not null default 0,
  fecha_vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','vencido')),
  frecuencia_pago text check (frecuencia_pago is null or frecuencia_pago in ('diario','mensual','anual','unico')),
  created_at timestamptz default now()
);

create table datum_movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ingreso','gasto')),
  categoria text,
  monto numeric(12,2) not null,
  fecha date default current_date,
  nota text,
  pasivo_id uuid references datum_pasivos(id),
  recurrente boolean not null default false,
  frecuencia text check (frecuencia is null or frecuencia in ('diario','mensual','anual')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Vista: Utilidad por producto y por categoría
-- Usa el costo congelado en cada venta (no el costo actual), para que
-- la utilidad de ventas pasadas no cambie si el costo del producto sube después.
-- Vive dentro del módulo de Estado de P y G — es su desglose por producto.
-- ------------------------------------------------------------
create or replace view vista_utilidad_por_producto as
select
  i.empresa_id,
  i.id as item_id,
  i.nombre,
  i.categoria,
  i.tipo,
  sum(vi.cantidad) as unidades_vendidas,
  sum(vi.cantidad * vi.precio_unitario) as ingresos,
  sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as costos,
  sum(vi.cantidad * vi.precio_unitario) - sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as utilidad,
  case
    when sum(vi.cantidad * vi.precio_unitario) > 0
    then round(100.0 * (sum(vi.cantidad * vi.precio_unitario) - sum(vi.cantidad * coalesce(vi.costo_unitario, 0)))
                / sum(vi.cantidad * vi.precio_unitario), 1)
    else 0
  end as margen_porcentaje
from ventas_items vi
join inventario_items i on i.id = vi.item_id
group by i.empresa_id, i.id, i.nombre, i.categoria, i.tipo;

create or replace view vista_utilidad_por_categoria as
select
  empresa_id,
  categoria,
  sum(unidades_vendidas) as unidades_vendidas,
  sum(ingresos) as ingresos,
  sum(costos) as costos,
  sum(utilidad) as utilidad,
  case when sum(ingresos) > 0 then round(100.0 * sum(utilidad) / sum(ingresos), 1) else 0 end as margen_porcentaje
from vista_utilidad_por_producto
group by empresa_id, categoria;

-- ------------------------------------------------------------
-- Vista: Resumen por venta — cuántos ítems distintos y cuántas
-- unidades en total llevó cada venta (el "carrito" completo).
-- ------------------------------------------------------------
create or replace view vista_resumen_ventas as
select
  v.id as venta_id,
  v.empresa_id,
  v.fecha,
  v.monto,
  v.contacto_id,
  count(vi.id) as items_distintos,
  coalesce(sum(vi.cantidad), 0) as unidades_totales
from ventas v
left join ventas_items vi on vi.venta_id = v.id
group by v.id, v.empresa_id, v.fecha, v.monto, v.contacto_id;

-- ------------------------------------------------------------
-- Vista: Velocidad de venta reciente por producto — unidades
-- vendidas por día, promediado sobre los últimos 30 días. Alimenta
-- la pestaña "Proyecciones" de Inventario: cantidad disponible ÷
-- esto = días de stock que quedan al ritmo de venta actual.
-- ------------------------------------------------------------
create or replace view vista_velocidad_ventas as
select
  i.empresa_id,
  vi.item_id,
  round(sum(vi.cantidad) / 30.0, 4) as unidades_por_dia
from ventas_items vi
join ventas v on v.id = vi.venta_id
join inventario_items i on i.id = vi.item_id
where v.fecha >= now() - interval '30 days'
group by i.empresa_id, vi.item_id;

-- ------------------------------------------------------------
-- Vista: Historial de compras por producto — última vez que se
-- reabasteció y cada cuántos días en promedio, según cada lote
-- (inventario_lotes) que se le ha agregado. También alimenta la
-- pestaña "Proyecciones" de Inventario. Nota: cuenta cualquier
-- entrada de stock (reabastecer, deshacer una venta, un apartado
-- vencido que vuelve a inventario, un ajuste hacia arriba) — no
-- distingue si fue exactamente una compra, así que en un producto
-- con devoluciones frecuentes el promedio puede verse un poco más
-- seguido de lo real.
-- ------------------------------------------------------------
create or replace view vista_compras_producto as
select
  i.empresa_id,
  l.item_id,
  count(l.id) as total_compras,
  min(l.fecha) as primera_compra,
  max(l.fecha) as ultima_compra,
  case
    when count(l.id) > 1
    then round(extract(epoch from (max(l.fecha) - min(l.fecha))) / 86400.0 / (count(l.id) - 1), 1)
    else null
  end as dias_promedio_entre_compras
from inventario_lotes l
join inventario_items i on i.id = l.item_id
group by i.empresa_id, l.item_id;

-- ------------------------------------------------------------
-- Vista: Resumen por proveedor — última vez que se le compró, el costo
-- promedio pagado, la categoría que más se le compra, y la rentabilidad
-- que dejan sus productos al venderse. Se basa en inventario_lotes (cada
-- reabastecimiento), igual que vista_compras_producto, porque hoy es lo
-- único que guarda el costo y la fecha exactos de cada compra —
-- inventario_movimientos todavía no registra compras.
-- "Costo promedio" es el costo unitario promedio pagado, no el valor total
-- de una compra — un lote no guarda cuánto se compró originalmente una vez
-- se empieza a vender (solo lo que queda disponible).
-- "Categoría más comprada" es la de más reabastecimientos (lotes), no la de
-- mayor cantidad — por la misma razón.
-- ------------------------------------------------------------
create or replace view vista_proveedores as
with lotes_proveedor as (
  select i.proveedor_id, i.empresa_id, i.categoria, l.costo_unitario, l.fecha
  from inventario_lotes l
  join inventario_items i on i.id = l.item_id
  where i.proveedor_id is not null
),
categoria_conteo as (
  select proveedor_id, categoria, count(*) as veces
  from lotes_proveedor
  group by proveedor_id, categoria
),
categoria_top as (
  select distinct on (proveedor_id) proveedor_id, categoria
  from categoria_conteo
  order by proveedor_id, veces desc
),
rentabilidad as (
  select i.proveedor_id, sum(u.utilidad) as utilidad_generada
  from vista_utilidad_por_producto u
  join inventario_items i on i.id = u.item_id
  where i.proveedor_id is not null
  group by i.proveedor_id
)
select
  p.id as proveedor_id,
  p.empresa_id,
  p.nombre,
  max(lp.fecha) as ultima_compra,
  round(avg(lp.costo_unitario), 2) as costo_promedio,
  ct.categoria as categoria_mas_comprada,
  coalesce(r.utilidad_generada, 0) as rentabilidad
from proveedores p
left join lotes_proveedor lp on lp.proveedor_id = p.id
left join categoria_top ct on ct.proveedor_id = p.id
left join rentabilidad r on r.proveedor_id = p.id
group by p.id, p.empresa_id, p.nombre, ct.categoria, r.utilidad_generada;

-- ------------------------------------------------------------
-- Festivos de Colombia — tabla de referencia, compartida por
-- todas las empresas (no es un dato de ninguna en particular,
-- por eso no lleva empresa_id ni Row Level Security).
-- Poblada con el calendario oficial 2026. Verificado en fuentes
-- públicas en julio 2026 — el festivo del 13 de julio (Virgen de
-- Chiquinquirá, Ley 2578 de 2026) tiene una demanda en curso ante
-- la Corte Constitucional; si se cae, basta con borrar esa fila.
-- Hay que agregar manualmente las fechas de cada año nuevo.
-- ------------------------------------------------------------
create table festivos (
  fecha date primary key,
  nombre text not null
);

insert into festivos (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-12', 'Día de los Reyes Magos'),
  ('2026-03-23', 'Día de San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Día de la Ascensión'),
  ('2026-06-08', 'Corpus Christi'),
  ('2026-06-15', 'Sagrado Corazón de Jesús'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-13', 'Virgen del Rosario de Chiquinquirá'),
  ('2026-07-20', 'Día de la Independencia'),
  ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'),
  ('2026-10-12', 'Día de la Raza'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad');

-- Vista: ventas por día, marcando día de la semana y si fue festivo.
-- Responde directo "¿vendemos más los festivos?" — se filtra o agrupa por es_festivo.
-- "at time zone 'America/Bogota'" convierte la marca de tiempo (guardada en
-- UTC) a la hora real de Colombia antes de truncarla a un día — si no, una
-- venta después de las 7pm (Colombia) quedaba contada como del día
-- siguiente en UTC, y por eso podía no coincidir con el festivo real ni con
-- el día de la semana correcto.
create or replace view vista_ventas_por_dia as
select
  v.empresa_id,
  (v.fecha at time zone 'America/Bogota')::date as dia,
  case extract(dow from (v.fecha at time zone 'America/Bogota')::date)::int
    when 0 then 'Domingo' when 1 then 'Lunes' when 2 then 'Martes'
    when 3 then 'Miércoles' when 4 then 'Jueves' when 5 then 'Viernes'
    when 6 then 'Sábado'
  end as dia_semana,
  (f.fecha is not null) as es_festivo,
  f.nombre as nombre_festivo,
  count(v.id) as numero_ventas,
  sum(v.monto) as total_vendido
from ventas v
left join festivos f on f.fecha = (v.fecha at time zone 'America/Bogota')::date
group by v.empresa_id, (v.fecha at time zone 'America/Bogota')::date, f.fecha, f.nombre;

-- ------------------------------------------------------------
-- Vista: Perfil de compra de un cliente
-- Para la ficha del contacto cuando el CRM se alimenta de ventas:
-- ticket medio, cada cuántos días compra en promedio, el producto
-- más barato y más caro que se le ha vendido, e inversión total.
-- Un cliente sin compras (un lead puro) simplemente no aparece aquí.
-- ------------------------------------------------------------
create or replace view vista_perfil_cliente as
with agregados as (
  select
    c.id as contacto_id,
    c.empresa_id,
    count(v.id) as total_compras,
    sum(v.monto) as inversion_total,
    round(avg(v.monto), 0) as ticket_medio,
    min(v.fecha) as primera_compra,
    max(v.fecha) as ultima_compra,
    case
      when count(v.id) > 1
      then round(extract(epoch from (max(v.fecha) - min(v.fecha))) / 86400.0 / (count(v.id) - 1), 1)
      else null
    end as dias_promedio_entre_compras
  from crm_contactos c
  join ventas v on v.contacto_id = c.id
  group by c.id, c.empresa_id
),
items_cliente as (
  select
    v.contacto_id,
    vi.precio_unitario,
    i.nombre as producto_nombre,
    row_number() over (partition by v.contacto_id order by vi.precio_unitario asc) as rn_barato,
    row_number() over (partition by v.contacto_id order by vi.precio_unitario desc) as rn_caro
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  join inventario_items i on i.id = vi.item_id
  where v.contacto_id is not null
),
items_frecuentes as (
  select
    contacto_id,
    producto_nombre,
    unidades,
    row_number() over (partition by contacto_id order by unidades desc) as rn_frecuente
  from (
    select v.contacto_id, i.nombre as producto_nombre, sum(vi.cantidad) as unidades
    from ventas v
    join ventas_items vi on vi.venta_id = v.id
    join inventario_items i on i.id = vi.item_id
    where v.contacto_id is not null
    group by v.contacto_id, i.nombre
  ) sub
),
-- Total de unidades compradas (todos los productos, no solo el más
-- comprado) — lo usa vista_calificacion_clientes, aparte de rn_frecuente
-- de arriba que es por producto individual.
unidades_totales as (
  select v.contacto_id, sum(vi.cantidad) as unidades_totales
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  where v.contacto_id is not null
  group by v.contacto_id
)
select
  a.contacto_id,
  a.empresa_id,
  a.total_compras,
  a.inversion_total,
  a.ticket_medio,
  a.primera_compra,
  a.ultima_compra,
  a.dias_promedio_entre_compras,
  barato.producto_nombre as producto_mas_economico,
  barato.precio_unitario as precio_mas_economico,
  caro.producto_nombre as producto_mas_costoso,
  caro.precio_unitario as precio_mas_costoso,
  frecuente.producto_nombre as producto_mas_comprado,
  frecuente.unidades as unidades_producto_mas_comprado,
  coalesce(ut.unidades_totales, 0) as unidades_totales
from agregados a
left join (select * from items_cliente where rn_barato = 1) barato on barato.contacto_id = a.contacto_id
left join (select * from items_cliente where rn_caro = 1) caro on caro.contacto_id = a.contacto_id
left join (select * from items_frecuentes where rn_frecuente = 1) frecuente on frecuente.contacto_id = a.contacto_id
left join unidades_totales ut on ut.contacto_id = a.contacto_id;

-- ------------------------------------------------------------
-- Vista: Calificación automática de clientes por historial de compras
-- Reemplaza la calificación manual de estrellas (crm_contactos.calificacion,
-- que queda en el esquema sin usarse por si algún día se retoma). Cada
-- cliente se compara contra el PROMEDIO de los demás clientes de su misma
-- empresa (nunca contra un número inventado igual para todas las empresas
-- — mismo principio que el motor de anomalías de Panel de control), en un
-- mix de cuánto ha comprado en valor y en cantidad de unidades:
--   >= 90% sobre el promedio → 5 estrellas
--   >= 70% → 4 · >= 50% → 3 · >= 30% → 2 · >= 10% → 1 · si no, 0
-- El "mix" es el promedio simple del % en valor y el % en unidades.
-- ------------------------------------------------------------
create or replace view vista_calificacion_clientes as
with base as (
  select contacto_id, empresa_id, inversion_total, unidades_totales
  from vista_perfil_cliente
),
promedios as (
  select
    empresa_id,
    avg(inversion_total) as promedio_valor,
    avg(unidades_totales) as promedio_unidades
  from base
  group by empresa_id
),
porcentajes as (
  select
    b.contacto_id,
    b.empresa_id,
    case when p.promedio_valor > 0
      then 100.0 * (b.inversion_total - p.promedio_valor) / p.promedio_valor
      else 0
    end as pct_valor,
    case when p.promedio_unidades > 0
      then 100.0 * (b.unidades_totales - p.promedio_unidades) / p.promedio_unidades
      else 0
    end as pct_unidades
  from base b
  join promedios p on p.empresa_id = b.empresa_id
)
select
  contacto_id,
  empresa_id,
  round(pct_valor, 1) as pct_valor,
  round(pct_unidades, 1) as pct_unidades,
  round((pct_valor + pct_unidades) / 2, 1) as pct_mixto,
  case
    when (pct_valor + pct_unidades) / 2 >= 90 then 5
    when (pct_valor + pct_unidades) / 2 >= 70 then 4
    when (pct_valor + pct_unidades) / 2 >= 50 then 3
    when (pct_valor + pct_unidades) / 2 >= 30 then 2
    when (pct_valor + pct_unidades) / 2 >= 10 then 1
    else 0
  end as calificacion_automatica
from porcentajes;

-- ------------------------------------------------------------
-- 10. PROMOCIONES Y DESCUENTOS
-- ------------------------------------------------------------
create table promociones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null = aplica a todos los
  -- puntos (y es el único valor posible para el resto de las empresas).
  punto_venta_id uuid references puntos_venta(id),
  nombre text not null,                             -- ej. 'Cambio de aceite 20% - Julio'
  codigo text,                                       -- código de cupón, opcional
  tipo_promocion text not null
    check (tipo_promocion in ('descuento_porcentaje','descuento_fijo','2x1','lleve_x_gratis','fidelidad')),
  -- 20 (=20%), 10000 (=$10.000), o para 'fidelidad' el número de compras
  -- necesarias antes del regalo (ej. 10); null para 2x1 y lleve_x_gratis
  valor numeric(12,2),
  aplica_a_categoria text,                            -- alternativa: toda una categoría
  -- Para 'lleve_x_gratis': qué producto se regala (distinto del que se compra).
  -- Para 'fidelidad': el producto que se cuenta Y el que se regala son el
  -- mismo (ej. cada 10 cafés, el 11 es gratis) — mismo campo, doble uso.
  item_regalo_id uuid references inventario_items(id),
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean not null default true,
  created_at timestamptz default now()
);

-- Productos específicos a los que aplica una promoción (cuando no aplica a todo el
-- catálogo ni a una categoría entera) — una promoción puede aplicar a varios productos.
create table promocion_items (
  promocion_id uuid references promociones(id) not null,
  item_id uuid references inventario_items(id) not null,
  primary key (promocion_id, item_id)
);

alter table ventas_items add constraint ventas_items_promocion_id_fkey
  foreign key (promocion_id) references promociones(id);

-- Progreso de un cliente en una promoción de fidelidad: cuántas unidades del
-- producto lleva compradas (pagadas) desde su último canje, o desde siempre
-- si nunca ha canjeado. No se guarda en ninguna tabla aparte — se calcula al
-- vuelo desde el historial real de ventas, para que nunca se desincronice.
create or replace function progreso_fidelidad(p_promocion_id uuid, p_contacto_id uuid)
returns integer
language sql stable
as $$
  with ultimo_canje as (
    select max(v.fecha) as fecha
    from ventas_items vi
    join ventas v on v.id = vi.venta_id
    where vi.promocion_id = p_promocion_id
      and v.contacto_id = p_contacto_id
  )
  select coalesce(sum(vi.cantidad), 0)::integer
  from ventas_items vi
  join ventas v on v.id = vi.venta_id
  join promociones p on p.id = p_promocion_id
  where v.contacto_id = p_contacto_id
    and vi.item_id = p.item_regalo_id
    and (vi.promocion_id is null or vi.promocion_id <> p_promocion_id)
    and v.fecha > coalesce((select fecha from ultimo_canje), '-infinity'::timestamptz);
$$;

-- Vista: desempeño completo de cada promoción — ventas que la usaron, ticket promedio
-- de esas ventas, unidades movidas con descuento, cuánto dinero se regaló, y las ventas
-- totales de todo el período de la campaña (para comparar campaña vs. no campaña).
create or replace view vista_efectividad_promociones as
with ventas_con_promo as (
  select distinct v.id as venta_id, v.monto, vi.promocion_id
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  where vi.promocion_id is not null
)
select
  p.id as promocion_id,
  p.empresa_id,
  p.nombre,
  p.tipo_promocion,
  p.codigo,
  p.fecha_inicio,
  p.fecha_fin,
  count(distinct vc.venta_id) as ventas_con_este_descuento,
  coalesce(sum(vc.monto), 0) as ingresos_de_esas_ventas,
  case when count(distinct vc.venta_id) > 0
    then round(coalesce(sum(vc.monto), 0) / count(distinct vc.venta_id), 0)
    else 0
  end as ticket_promedio,
  (select coalesce(sum(vi2.cantidad), 0) from ventas_items vi2 where vi2.promocion_id = p.id) as unidades_con_descuento,
  (select coalesce(sum(vi2.descuento_aplicado), 0) from ventas_items vi2 where vi2.promocion_id = p.id) as descuento_total_otorgado,
  (select coalesce(sum(v2.monto), 0) from ventas v2
     where v2.empresa_id = p.empresa_id and v2.fecha::date between p.fecha_inicio and p.fecha_fin) as ventas_totales_del_periodo
from promociones p
left join ventas_con_promo vc on vc.promocion_id = p.id
group by p.id, p.empresa_id, p.nombre, p.tipo_promocion, p.codigo, p.fecha_inicio, p.fecha_fin;

-- ------------------------------------------------------------
-- 10.5. DEVOLUCIONES Y GARANTÍAS
-- Un solo flujo para los dos casos (el cliente se arrepintió, o el
-- producto vino defectuoso) — el campo 'tipo' distingue cuál es cuál, pero
-- comparten la misma tabla y las mismas dos funciones. Se registra en
-- 'pendiente' y se resuelve después (aceptada/rechazada), mismo patrón de
-- dos pasos que ya usan los apartados.
-- ------------------------------------------------------------
create table devoluciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  venta_id uuid references ventas(id) not null,
  contacto_id uuid references crm_contactos(id),
  tipo text not null check (tipo in ('devolucion','garantia')),
  motivo text,
  fecha timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada')),
  -- Los siguientes tres solo se llenan al aceptar, cada uno según la
  -- resolución elegida.
  resolucion text check (resolucion is null or resolucion in ('reembolso','cambio','cupon')),
  monto_reembolso numeric(12,2),
  item_cambio_id uuid references inventario_items(id),
  cantidad_cambio numeric(12,2),
  created_at timestamptz default now()
);

-- item_id es opcional: si ya no existe en el catálogo, queda null y se usa
-- nombre_libre — mismo patrón dual que ventas_items.
create table devoluciones_items (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid references devoluciones(id) not null,
  item_id uuid references inventario_items(id),
  nombre_libre text,
  cantidad numeric(12,2) not null,
  -- Se decide al momento de recibir el producto devuelto: si vuelve al
  -- inventario disponible, o si queda dañado y aparte, sin volver a la venta.
  estado_producto text not null check (estado_producto in ('buen_estado','danado')),
  created_at timestamptz default now()
);

-- Crédito a favor de un cliente cuando la resolución de una devolución es
-- 'cupon' — se aplica como parte del pago en una venta futura (ese
-- descuento en el formulario de venta todavía no está construido).
create table cupones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  contacto_id uuid references crm_contactos(id) not null,
  devolucion_id uuid references devoluciones(id),
  monto numeric(12,2) not null,
  monto_usado numeric(12,2) not null default 0,
  fecha_vencimiento date,
  estado text not null default 'activo' check (estado in ('activo','usado','vencido','cancelado')),
  created_at timestamptz default now()
);

-- Registra una devolución o garantía en 'pendiente', con sus productos. No
-- mueve nada de inventario ni de dinero todavía — eso solo pasa al
-- resolverla con resolver_devolucion(), igual que un apartado no es una
-- venta real hasta que se reclama.
create or replace function registrar_devolucion(
  p_empresa_id uuid,
  p_venta_id uuid,
  p_contacto_id uuid,
  p_tipo text,   -- 'devolucion' o 'garantia'
  p_motivo text,
  p_items jsonb  -- [{"item_id":"...","nombre_libre":null,"cantidad":1,"estado_producto":"buen_estado"}, ...]
)
returns uuid
language plpgsql
as $$
declare
  v_devolucion_id uuid;
  v_item jsonb;
begin
  if p_tipo not in ('devolucion','garantia') then
    raise exception 'Tipo inválido: debe ser devolucion o garantia.';
  end if;

  insert into devoluciones (empresa_id, venta_id, contacto_id, tipo, motivo)
  values (p_empresa_id, p_venta_id, p_contacto_id, p_tipo, p_motivo)
  returning id into v_devolucion_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into devoluciones_items (devolucion_id, item_id, nombre_libre, cantidad, estado_producto)
    values (
      v_devolucion_id,
      nullif(v_item->>'item_id','')::uuid,
      nullif(v_item->>'nombre_libre',''),
      (v_item->>'cantidad')::numeric,
      v_item->>'estado_producto'
    );
  end loop;

  return v_devolucion_id;
end;
$$;

-- Acepta o rechaza una devolución pendiente. Si se acepta: cada producto
-- en buen estado vuelve al inventario disponible, con el mismo costo que
-- quedó congelado en la venta original (igual criterio que deshacer_venta).
-- Si la resolución es 'cambio', además se descuenta del inventario el
-- producto de reemplazo que se lleva el cliente (misma lógica de salida
-- que una venta normal) — la cantidad la decide quien resuelve la
-- devolución, no siempre es una unidad por una. Si la resolución es
-- 'cupon', crea el crédito a favor del cliente.
create or replace function resolver_devolucion(
  p_devolucion_id uuid,
  p_estado text,                          -- 'aceptada' o 'rechazada'
  p_resolucion text default null,         -- 'reembolso' | 'cambio' | 'cupon', solo si aceptada
  p_monto_reembolso numeric default null,
  p_item_cambio_id uuid default null,
  p_cantidad_cambio numeric default null,
  p_cupon_monto numeric default null,
  p_cupon_vencimiento date default null
)
returns void
language plpgsql
as $$
declare
  v_devolucion record;
  v_item record;
  v_item_cambio record;
begin
  select * into v_devolucion from devoluciones where id = p_devolucion_id;
  if v_devolucion.id is null then
    raise exception 'Devolución no encontrada';
  end if;
  if v_devolucion.estado <> 'pendiente' then
    raise exception 'Esta devolución ya fue resuelta.';
  end if;
  if p_estado not in ('aceptada','rechazada') then
    raise exception 'Estado inválido: debe ser aceptada o rechazada.';
  end if;

  if p_estado = 'aceptada' then
    if p_resolucion is null or p_resolucion not in ('reembolso','cambio','cupon') then
      raise exception 'Elige cómo se resuelve: reembolso, cambio o cupón.';
    end if;

    for v_item in
      select di.item_id, di.cantidad, vi.costo_unitario
      from devoluciones_items di
      left join ventas_items vi on vi.venta_id = v_devolucion.venta_id and vi.item_id = di.item_id
      where di.devolucion_id = p_devolucion_id
        and di.estado_producto = 'buen_estado'
        and di.item_id is not null
    loop
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item.item_id, v_item.cantidad, coalesce(v_item.costo_unitario, 0));

      insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
      values (v_item.item_id, 'entrada', 'devolucion', v_item.cantidad, 'Devolución aceptada');

      update inventario_items set cantidad = cantidad + v_item.cantidad where id = v_item.item_id;
    end loop;

    if p_resolucion = 'cambio' then
      if p_item_cambio_id is null or p_cantidad_cambio is null or p_cantidad_cambio <= 0 then
        raise exception 'Elige el producto de reemplazo y una cantidad mayor a cero.';
      end if;

      select id, cantidad into v_item_cambio from inventario_items where id = p_item_cambio_id;
      if v_item_cambio.id is null then
        raise exception 'El producto de reemplazo no existe.';
      end if;
      if v_item_cambio.cantidad < p_cantidad_cambio then
        raise exception 'No hay suficiente stock del producto de reemplazo: quedan %, se necesitan %.',
          v_item_cambio.cantidad, p_cantidad_cambio;
      end if;

      insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
      values (p_item_cambio_id, 'salida', 'devolucion', p_cantidad_cambio, 'Entregado como cambio');

      update inventario_items set cantidad = cantidad - p_cantidad_cambio where id = p_item_cambio_id;
    end if;

    if p_resolucion = 'cupon' then
      if v_devolucion.contacto_id is null then
        raise exception 'Esta devolución no tiene cliente asociado — no se puede crear un cupón.';
      end if;
      if p_cupon_monto is null or p_cupon_monto <= 0 then
        raise exception 'El monto del cupón debe ser mayor a cero.';
      end if;

      insert into cupones (empresa_id, contacto_id, devolucion_id, monto, fecha_vencimiento)
      values (v_devolucion.empresa_id, v_devolucion.contacto_id, p_devolucion_id, p_cupon_monto, p_cupon_vencimiento);
    end if;
  end if;

  update devoluciones
  set estado = p_estado,
      resolucion = case when p_estado = 'aceptada' then p_resolucion else null end,
      monto_reembolso = case when p_resolucion = 'reembolso' then p_monto_reembolso else null end,
      item_cambio_id = case when p_resolucion = 'cambio' then p_item_cambio_id else null end,
      cantidad_cambio = case when p_resolucion = 'cambio' then p_cantidad_cambio else null end
  where id = p_devolucion_id;
end;
$$;

-- ------------------------------------------------------------
-- 11. NÓMINA — módulo propio (empresas.modulos_activos), fase 1: solo
-- salario fijo mensual/quincenal. Cubre lo que sí afecta el pago de cada
-- período (salario, auxilio de transporte, salud y pensión del empleado) y
-- el desprendible de pago. Los aportes patronales (lo que paga la empresa
-- aparte, no se le descuenta al empleado) y la provisión de prestaciones
-- sociales (cesantías, prima, vacaciones) quedan para una fase 2.
-- ------------------------------------------------------------
create table empleados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  cedula text,
  cargo text,
  salario_base numeric(12,2) not null,
  fecha_ingreso date not null default current_date,
  fecha_retiro date,
  activo boolean not null default true,
  -- Determina qué regla de indemnización aplica en finalizar_contrato_empleado()
  -- si el contrato termina sin justa causa. 'indefinido' es el caso por
  -- defecto y el único con cálculo automático por ahora — 'fijo' y
  -- 'obra_labor' quedan marcados para calcular la indemnización a mano
  -- (dependen del plazo pactado / de la obra, no solo del tiempo servido).
  tipo_contrato text not null default 'indefinido'
    check (tipo_contrato in ('indefinido','fijo','obra_labor')),
  created_at timestamptz default now()
);

-- Salario mínimo y auxilio de transporte de cada año — cambian por decreto
-- cada enero. Sin Row Level Security: es información pública de la ley, no
-- de ninguna empresa en particular (mismo criterio que "festivos"). Hay que
-- agregar la fila del año nuevo a mano — no hay ninguna fórmula que la
-- calcule sola.
create table nomina_parametros_legales (
  anio integer primary key,
  salario_minimo numeric(12,2) not null,
  auxilio_transporte numeric(12,2) not null
);

-- Cada "corrida" de nómina de una empresa (ej. "1-15 de julio 2026").
create table nomina_periodos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  fecha_pago date not null,
  -- 'borrador' no ha movido plata todavía; al marcarlo 'pagado' es cuando de
  -- verdad genera el gasto en finanzas_movimientos (criterio de caja, mismo
  -- principio que los abonos de pasivos).
  estado text not null default 'borrador' check (estado in ('borrador','pagado')),
  created_at timestamptz default now()
);

-- Una fila por empleado dentro de cada período — el desprendible de pago
-- sale directo de aquí. salario_base queda congelado al momento de generar
-- la nómina (igual que ventas_items.precio_unitario): si después cambia el
-- sueldo del empleado, los desprendibles ya generados no se alteran.
create table nomina_detalles (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid references nomina_periodos(id) not null,
  empleado_id uuid references empleados(id) not null,
  salario_base numeric(12,2) not null,
  auxilio_transporte numeric(12,2) not null default 0,
  deduccion_salud numeric(12,2) not null default 0,
  deduccion_pension numeric(12,2) not null default 0,
  total_devengado numeric(12,2) not null,
  total_deducido numeric(12,2) not null,
  neto_pagado numeric(12,2) not null,
  -- Fase 2 — aportes patronales: lo que paga la empresa aparte, nunca se le
  -- descuenta al empleado, no aparece en su desprendible. Se paga junto con
  -- la nómina (mismo criterio de caja: solo se genera el gasto real cuando
  -- el período se marca 'pagado', ver marcar_nomina_pagada()).
  aporte_salud_patronal numeric(12,2) not null default 0,
  aporte_pension_patronal numeric(12,2) not null default 0,
  aporte_arl numeric(12,2) not null default 0,
  aporte_caja_compensacion numeric(12,2) not null default 0,
  aporte_icbf numeric(12,2) not null default 0,
  aporte_sena numeric(12,2) not null default 0,
  total_aportes_patronales numeric(12,2) not null default 0,
  -- Fase 2 — prestaciones sociales: se acumulan cada período (provisión).
  -- Cesantías, intereses y prima generan su gasto real automático al marcar
  -- el período como pagado (ver marcar_nomina_pagada()); el pago real
  -- después (consignar cesantías, pagar la prima) no se vuelve a registrar,
  -- para no duplicar. Vacaciones es la excepción: no genera un gasto propio
  -- — no es plata extra, es el mismo salario en días no trabajados — así
  -- que este campo es puramente informativo, para calcular cuánto valen los
  -- días pendientes el día que se liquide un contrato.
  provision_cesantias numeric(12,2) not null default 0,
  provision_intereses_cesantias numeric(12,2) not null default 0,
  provision_prima numeric(12,2) not null default 0,
  provision_vacaciones numeric(12,2) not null default 0,
  unique (periodo_id, empleado_id)
);

-- Vacaciones tomadas por un empleado: fechas concretas, no solo un número de
-- días. Esto es lo que permite que generar_nomina() sepa, para un período
-- dado, cuántos días de ese período caen en vacaciones y le quite el
-- auxilio de transporte proporcional a esos días (el salario NO cambia — el
-- empleado cobra igual, solo que el auxilio no aplica en días que no va a
-- trabajar). "Finalizar contrato" con la liquidación de los días pendientes
-- en dinero queda para una fase futura.
create table nomina_vacaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid references empleados(id) not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  dias integer not null,
  created_at timestamptz default now()
);

-- Vista: cuántos días de vacaciones lleva causados cada empleado (15 días
-- hábiles por año trabajado, aproximado como 1.25 días por mes — la misma
-- aproximación que usa la mayoría del software de nómina en Colombia para
-- llevar el saldo mes a mes) contra cuántos ya se ha tomado. La resta
-- (causados - tomados) es lo que se muestra como "días pendientes" en la
-- ficha del empleado.
create or replace view vista_vacaciones_empleado as
select
  e.id as empleado_id,
  e.empresa_id,
  floor((coalesce(e.fecha_retiro, current_date) - e.fecha_ingreso) / 30.0 * 1.25) as dias_causados,
  coalesce((select sum(v.dias) from nomina_vacaciones v where v.empleado_id = e.id), 0) as dias_tomados
from empleados e;

-- Genera un período de nómina completo: crea nomina_periodos y una fila en
-- nomina_detalles por cada empleado activo que estuvo vinculado en algún
-- momento del rango (no prorratea por entrada/salida a mitad de período —
-- un empleado que entra o sale a mitad de período de todos modos cuenta el
-- período completo, por ahora; la salida real se maneja aparte con
-- finalizar_contrato_empleado(), que sí prorratea por día exacto).
--
-- Lo que SÍ se prorratea es el período completo según
-- empresas.nomina_frecuencia_pago: 'mensual' paga el salario íntegro (100%),
-- 'quincenal' la mitad (50%) — sin esto, una empresa quincenal que genera
-- dos períodos al mes le pagaría a cada empleado el salario completo dos
-- veces. Los umbrales de elegibilidad (auxilio de transporte hasta 2 SMLV,
-- exoneración hasta 10 SMLV) se evalúan sobre el salario mensual completo
-- del empleado, no sobre la porción de este período — es el nivel salarial
-- real de la persona, no cuánto le toca cobrar esta quincena.
--
-- Deducciones del empleado: salud y pensión son 4% cada una (fijo por ley),
-- sobre lo que de verdad se paga este período.
-- Aportes patronales: pensión 12% y caja de compensación 4% siempre se
-- pagan; ARL según la clase de riesgo de la empresa (tarifas fijas por ley,
-- no cambian por año); salud patronal (8.5%), ICBF (3%) y SENA (2%) solo se
-- pagan si la empresa NO está exonerada por la Ley 1607 o el empleado gana
-- 10 salarios mínimos o más.
-- Prestaciones sociales (provisión, no genera gasto — ver nomina_detalles):
-- cesantías y prima son 8.33% cada una sobre salario + auxilio; vacaciones
-- 4.17% solo sobre el salario (por ley, el auxilio de transporte no cuenta
-- para vacaciones). Los intereses de cesantías (12% anual) se aproximan
-- aquí como 1% de la cesantía de ese mismo período — una simplificación
-- mensual razonable, no el cálculo exacto sobre el saldo acumulado del año
-- que se usaría en una liquidación real.
create or replace function generar_nomina(
  p_empresa_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_fecha_pago date
)
returns uuid
language plpgsql
as $$
declare
  v_periodo_id uuid;
  v_anio integer;
  v_smlv numeric(12,2);
  v_auxilio numeric(12,2);
  v_arl_clase integer;
  v_exonerado boolean;
  v_frecuencia text;
  v_fraccion numeric(3,2);
  v_tasa_arl numeric(7,5);
  v_empleado record;
  v_salario_pago numeric(12,2);
  v_aux numeric(12,2);
  v_salud numeric(12,2);
  v_pension numeric(12,2);
  v_salud_patronal numeric(12,2);
  v_pension_patronal numeric(12,2);
  v_arl numeric(12,2);
  v_caja numeric(12,2);
  v_icbf numeric(12,2);
  v_sena numeric(12,2);
  v_cesantias numeric(12,2);
  v_intereses_cesantias numeric(12,2);
  v_prima numeric(12,2);
  v_vacaciones numeric(12,2);
  v_dias_vacaciones integer;
begin
  v_anio := extract(year from p_fecha_fin);

  select salario_minimo, auxilio_transporte into v_smlv, v_auxilio
  from nomina_parametros_legales where anio = v_anio;

  if v_smlv is null then
    raise exception 'Faltan los parámetros legales (salario mínimo, auxilio de transporte) del año % en nomina_parametros_legales.', v_anio;
  end if;

  select arl_clase_riesgo, exonerado_ley_1607, nomina_frecuencia_pago
  into v_arl_clase, v_exonerado, v_frecuencia
  from empresas where id = p_empresa_id;

  v_tasa_arl := case v_arl_clase
    when 1 then 0.00522
    when 2 then 0.01044
    when 3 then 0.02436
    when 4 then 0.04350
    when 5 then 0.06960
    else 0.00522
  end;

  v_fraccion := case when v_frecuencia = 'quincenal' then 0.5 else 1.0 end;

  insert into nomina_periodos (empresa_id, fecha_inicio, fecha_fin, fecha_pago)
  values (p_empresa_id, p_fecha_inicio, p_fecha_fin, p_fecha_pago)
  returning id into v_periodo_id;

  for v_empleado in
    select id, salario_base
    from empleados
    where empresa_id = p_empresa_id
      and activo
      and fecha_ingreso <= p_fecha_fin
      and (fecha_retiro is null or fecha_retiro >= p_fecha_inicio)
  loop
    v_salario_pago := round(v_empleado.salario_base * v_fraccion);
    v_aux := case when v_empleado.salario_base <= v_smlv * 2 then round(v_auxilio * v_fraccion) else 0 end;

    -- Días de este período que caen en vacaciones registradas del
    -- empleado (nomina_vacaciones) — el salario no cambia, pero el
    -- auxilio de transporte se descuenta proporcional (mes comercial de
    -- 30 días, la convención estándar de nómina en Colombia).
    select coalesce(sum(
      greatest(0, least(v.fecha_fin, p_fecha_fin) - greatest(v.fecha_inicio, p_fecha_inicio) + 1)
    ), 0)
    into v_dias_vacaciones
    from nomina_vacaciones v
    where v.empleado_id = v_empleado.id
      and v.fecha_inicio <= p_fecha_fin
      and v.fecha_fin >= p_fecha_inicio;

    if v_dias_vacaciones > 0 then
      v_aux := greatest(0, v_aux - round((v_auxilio / 30.0) * v_dias_vacaciones));
    end if;

    v_salud := round(v_salario_pago * 0.04);
    v_pension := round(v_salario_pago * 0.04);

    v_pension_patronal := round(v_salario_pago * 0.12);
    v_arl := round(v_salario_pago * v_tasa_arl);
    v_caja := round(v_salario_pago * 0.04);

    if v_exonerado and v_empleado.salario_base < v_smlv * 10 then
      v_salud_patronal := 0;
      v_icbf := 0;
      v_sena := 0;
    else
      v_salud_patronal := round(v_salario_pago * 0.085);
      v_icbf := round(v_salario_pago * 0.03);
      v_sena := round(v_salario_pago * 0.02);
    end if;

    v_cesantias := round((v_salario_pago + v_aux) * 0.0833);
    v_intereses_cesantias := round(v_cesantias * 0.01);
    v_prima := round((v_salario_pago + v_aux) * 0.0833);
    v_vacaciones := round(v_salario_pago * 0.0417);

    insert into nomina_detalles (
      periodo_id, empleado_id, salario_base, auxilio_transporte,
      deduccion_salud, deduccion_pension, total_devengado, total_deducido, neto_pagado,
      aporte_salud_patronal, aporte_pension_patronal, aporte_arl, aporte_caja_compensacion,
      aporte_icbf, aporte_sena, total_aportes_patronales,
      provision_cesantias, provision_intereses_cesantias, provision_prima, provision_vacaciones
    )
    values (
      v_periodo_id, v_empleado.id, v_salario_pago, v_aux,
      v_salud, v_pension,
      v_salario_pago + v_aux,
      v_salud + v_pension,
      v_salario_pago + v_aux - v_salud - v_pension,
      v_salud_patronal, v_pension_patronal, v_arl, v_caja, v_icbf, v_sena,
      v_salud_patronal + v_pension_patronal + v_arl + v_caja + v_icbf + v_sena,
      v_cesantias, v_intereses_cesantias, v_prima, v_vacaciones
    );
  end loop;

  return v_periodo_id;
end;
$$;

-- Marca un período como pagado y ahí sí genera el gasto real en
-- finanzas_movimientos (criterio de caja: el gasto se registra cuando la
-- plata de verdad sale, no cuando se arma el borrador).
create or replace function marcar_nomina_pagada(p_periodo_id uuid)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
  v_fecha_pago date;
  v_estado text;
  v_total_neto numeric(12,2);
  v_total_aportes numeric(12,2);
  v_total_prestaciones numeric(12,2);
begin
  select empresa_id, fecha_pago, estado into v_empresa_id, v_fecha_pago, v_estado
  from nomina_periodos where id = p_periodo_id;

  if v_empresa_id is null then
    raise exception 'Período de nómina no encontrado';
  end if;
  if v_estado = 'pagado' then
    raise exception 'Este período ya está marcado como pagado';
  end if;

  -- Vacaciones queda afuera de esta suma a propósito: no es plata extra
  -- (el empleado cobra el mismo salario de siempre, solo que en días que no
  -- trabaja), y ese salario ya se cuenta completo en el gasto de 'nómina'
  -- de cada mes — sumarlo aparte contaría el mismo dinero dos veces.
  -- Cesantías, sus intereses y la prima sí son plata extra real.
  select
    coalesce(sum(neto_pagado), 0),
    coalesce(sum(total_aportes_patronales), 0),
    coalesce(sum(provision_cesantias + provision_intereses_cesantias + provision_prima), 0)
  into v_total_neto, v_total_aportes, v_total_prestaciones
  from nomina_detalles where periodo_id = p_periodo_id;

  insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
  values (v_empresa_id, 'gasto', 'nómina', v_total_neto, v_fecha_pago, 'Nómina generada automáticamente');

  -- Aportes patronales: gasto real y aparte (nunca se le descuenta al
  -- empleado) — se paga en el mismo momento que la nómina, así que sigue el
  -- mismo criterio de caja.
  if v_total_aportes > 0 then
    insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
    values (v_empresa_id, 'gasto', 'aportes patronales', v_total_aportes, v_fecha_pago, 'Aportes patronales generados automáticamente');
  end if;

  -- Cesantías, intereses y prima: a diferencia de nómina y aportes
  -- patronales, acá SÍ se reconoce el gasto por causación (lo que se
  -- acumula ese período), no cuando de verdad se paga la prima o se
  -- consignan las cesantías — para que el P y G refleje el costo real de
  -- tener a cada empleado sin que haya que registrar nada a mano después.
  -- Por eso, cuando llegue el momento real de pagarlas, ESE pago no se
  -- debe registrar de nuevo en "Gastos e ingresos" — ya quedó contado
  -- aquí, mes a mes, y contarlo dos veces inflaría el gasto. Vacaciones sí
  -- se sigue registrando a mano cuando el empleado las toma (ver arriba).
  if v_total_prestaciones > 0 then
    insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
    values (v_empresa_id, 'gasto', 'prestaciones sociales', v_total_prestaciones, v_fecha_pago, 'Provisión de prestaciones sociales generada automáticamente');
  end if;

  update nomina_periodos set estado = 'pagado' where id = p_periodo_id;
end;
$$;

-- Liquidación de contrato — salario de días trabajados no pagados aún,
-- cesantías/intereses/prima proporcionales a esos días, vacaciones
-- pendientes pagadas en dinero, y (solo si aplica) indemnización por
-- despido sin justa causa.
--
-- p_motivo decide si hay indemnización: 'renuncia' y
-- 'despido_justa_causa' nunca la generan (por ley); solo
-- 'despido_sin_justa_causa' la calcula, y SOLO para contrato indefinido
-- (empleados.tipo_contrato) — para 'fijo' u 'obra_labor' la regla depende
-- del plazo pactado o de la obra, no solo del tiempo servido, así que se
-- deja marcada para calcular a mano en vez de arriesgar un número mal
-- calculado (indemnizacion_requiere_calculo_manual = true).
--
-- Indemnización para término indefinido (art. 64 CST, Ley 789 de 2002):
-- salario < 10 SMLMV → 30 días si llevaba 1 año o menos, + 20 días por
-- cada año adicional (proporcional la fracción); salario >= 10 SMLMV →
-- 20 días el primer año, + 15 días por cada año adicional. Se calcula
-- sobre el salario base (sin auxilio de transporte), el criterio estándar
-- porque el auxilio no es factor salarial.
--
-- A diferencia de generar_nomina() (que siempre paga el salario mensual
-- completo, sin importar cuántos días tenga el período), acá SÍ se
-- prorratea por día exacto — es la única situación donde es obligatorio,
-- porque nadie se retira justo el último día de un período ya generado.
--
-- p_simular = true: calcula y devuelve el desglose, SIN escribir nada — es
-- lo que usa la pantalla para mostrar "cuánto se debe pagar y por qué"
-- antes de confirmar. p_simular = false: además de devolver el mismo
-- desglose, sí registra todo (nuevo período de nómina con lo pendiente, sus
-- gastos reales, el pago de vacaciones, la indemnización si aplica, y
-- marca al empleado como retirado).
create or replace function finalizar_contrato_empleado(
  p_empleado_id uuid,
  p_fecha_retiro date,
  p_motivo text,
  p_simular boolean default false
)
returns table (
  fecha_desde date,
  dias_periodo integer,
  salario_proporcional numeric,
  auxilio_proporcional numeric,
  deducciones_empleado numeric,
  neto_periodo numeric,
  aportes_patronales numeric,
  cesantias_intereses_prima numeric,
  dias_vacaciones_pendientes numeric,
  monto_vacaciones_pendientes numeric,
  dias_indemnizacion numeric,
  monto_indemnizacion numeric,
  indemnizacion_requiere_calculo_manual boolean,
  total_a_pagar_empleado numeric
)
language plpgsql
as $$
declare
  v_empresa_id uuid;
  v_salario_base numeric(12,2);
  v_fecha_ingreso date;
  v_activo boolean;
  v_tipo_contrato text;
  v_ultimo_fin date;
  v_fecha_desde date;
  v_dias integer;
  v_anio integer;
  v_smlv numeric(12,2);
  v_auxilio_mensual numeric(12,2);
  v_arl_clase integer;
  v_exonerado boolean;
  v_tasa_arl numeric(7,5);
  v_aux numeric(12,2) := 0;
  v_salario_prop numeric(12,2) := 0;
  v_salud numeric(12,2) := 0;
  v_pension numeric(12,2) := 0;
  v_salud_patronal numeric(12,2) := 0;
  v_pension_patronal numeric(12,2) := 0;
  v_arl numeric(12,2) := 0;
  v_caja numeric(12,2) := 0;
  v_icbf numeric(12,2) := 0;
  v_sena numeric(12,2) := 0;
  v_total_aportes numeric(12,2) := 0;
  v_cesantias numeric(12,2) := 0;
  v_intereses numeric(12,2) := 0;
  v_prima numeric(12,2) := 0;
  v_periodo_id uuid;
  v_dias_causados numeric;
  v_dias_tomados numeric;
  v_dias_pendientes numeric;
  v_monto_vacaciones numeric(12,2);
  v_tenure_dias integer;
  v_dias_extra integer;
  v_anios_extra_completos integer;
  v_dias_fraccion integer;
  v_base_dias numeric;
  v_tasa_extra_dias numeric;
  v_dias_indemnizacion numeric(10,4) := 0;
  v_monto_indemnizacion numeric(12,2) := 0;
  v_requiere_manual boolean := false;
begin
  if p_motivo not in ('renuncia', 'despido_justa_causa', 'despido_sin_justa_causa') then
    raise exception 'Motivo de salida inválido: %', p_motivo;
  end if;

  select empresa_id, salario_base, fecha_ingreso, activo, tipo_contrato
  into v_empresa_id, v_salario_base, v_fecha_ingreso, v_activo, v_tipo_contrato
  from empleados where id = p_empleado_id;

  if v_empresa_id is null then
    raise exception 'Empleado no encontrado';
  end if;
  if not v_activo then
    raise exception 'Este empleado ya está retirado';
  end if;

  v_anio := extract(year from p_fecha_retiro);
  select salario_minimo, auxilio_transporte into v_smlv, v_auxilio_mensual
  from nomina_parametros_legales where anio = v_anio;
  if v_smlv is null then
    raise exception 'Faltan los parámetros legales (salario mínimo, auxilio de transporte) del año % en nomina_parametros_legales.', v_anio;
  end if;

  select arl_clase_riesgo, exonerado_ley_1607 into v_arl_clase, v_exonerado
  from empresas where id = v_empresa_id;
  v_tasa_arl := case v_arl_clase
    when 1 then 0.00522
    when 2 then 0.01044
    when 3 then 0.02436
    when 4 then 0.04350
    when 5 then 0.06960
    else 0.00522
  end;

  select max(np.fecha_fin) into v_ultimo_fin
  from nomina_periodos np
  join nomina_detalles nd on nd.periodo_id = np.id
  where nd.empleado_id = p_empleado_id;

  v_fecha_desde := coalesce(v_ultimo_fin + 1, v_fecha_ingreso);
  v_dias := greatest(0, p_fecha_retiro - v_fecha_desde + 1);

  if v_dias > 0 then
    v_salario_prop := round((v_salario_base / 30.0) * v_dias);
    v_aux := case when v_salario_base <= v_smlv * 2
      then round((v_auxilio_mensual / 30.0) * v_dias)
      else 0
    end;
    v_salud := round(v_salario_prop * 0.04);
    v_pension := round(v_salario_prop * 0.04);
    v_pension_patronal := round(v_salario_prop * 0.12);
    v_arl := round(v_salario_prop * v_tasa_arl);
    v_caja := round(v_salario_prop * 0.04);

    if v_exonerado and v_salario_base < v_smlv * 10 then
      v_salud_patronal := 0;
      v_icbf := 0;
      v_sena := 0;
    else
      v_salud_patronal := round(v_salario_prop * 0.085);
      v_icbf := round(v_salario_prop * 0.03);
      v_sena := round(v_salario_prop * 0.02);
    end if;

    v_total_aportes := v_salud_patronal + v_pension_patronal + v_arl + v_caja + v_icbf + v_sena;
    v_cesantias := round((v_salario_prop + v_aux) * 0.0833);
    v_intereses := round(v_cesantias * 0.01);
    v_prima := round((v_salario_prop + v_aux) * 0.0833);
  end if;

  select vve.dias_causados, vve.dias_tomados into v_dias_causados, v_dias_tomados
  from vista_vacaciones_empleado vve where vve.empleado_id = p_empleado_id;

  v_dias_pendientes := greatest(0, coalesce(v_dias_causados, 0) - coalesce(v_dias_tomados, 0));
  v_monto_vacaciones := round(v_dias_pendientes * (v_salario_base / 30.0));

  if p_motivo = 'despido_sin_justa_causa' then
    if v_tipo_contrato <> 'indefinido' then
      v_requiere_manual := true;
    else
      v_tenure_dias := p_fecha_retiro - v_fecha_ingreso;
      v_base_dias := case when v_salario_base < v_smlv * 10 then 30 else 20 end;
      v_tasa_extra_dias := case when v_salario_base < v_smlv * 10 then 20 else 15 end;

      if v_tenure_dias <= 360 then
        v_dias_indemnizacion := v_base_dias;
      else
        v_dias_extra := v_tenure_dias - 360;
        v_anios_extra_completos := floor(v_dias_extra / 360.0);
        v_dias_fraccion := v_dias_extra - (v_anios_extra_completos * 360);
        v_dias_indemnizacion := v_base_dias
          + v_tasa_extra_dias * v_anios_extra_completos
          + v_tasa_extra_dias * (v_dias_fraccion / 360.0);
      end if;

      v_monto_indemnizacion := round((v_salario_base / 30.0) * v_dias_indemnizacion);
    end if;
  end if;

  if not p_simular then
    if v_dias > 0 then
      insert into nomina_periodos (empresa_id, fecha_inicio, fecha_fin, fecha_pago, estado)
      values (v_empresa_id, v_fecha_desde, p_fecha_retiro, p_fecha_retiro, 'pagado')
      returning id into v_periodo_id;

      insert into nomina_detalles (
        periodo_id, empleado_id, salario_base, auxilio_transporte,
        deduccion_salud, deduccion_pension, total_devengado, total_deducido, neto_pagado,
        aporte_salud_patronal, aporte_pension_patronal, aporte_arl, aporte_caja_compensacion,
        aporte_icbf, aporte_sena, total_aportes_patronales,
        provision_cesantias, provision_intereses_cesantias, provision_prima, provision_vacaciones
      )
      values (
        v_periodo_id, p_empleado_id, v_salario_prop, v_aux,
        v_salud, v_pension, v_salario_prop + v_aux, v_salud + v_pension,
        v_salario_prop + v_aux - v_salud - v_pension,
        v_salud_patronal, v_pension_patronal, v_arl, v_caja, v_icbf, v_sena, v_total_aportes,
        v_cesantias, v_intereses, v_prima, 0
      );

      insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
      values (
        v_empresa_id, 'gasto', 'nómina', v_salario_prop + v_aux - v_salud - v_pension, p_fecha_retiro,
        'Liquidación: salario de los últimos ' || v_dias || ' días trabajados'
      );

      if v_total_aportes > 0 then
        insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
        values (v_empresa_id, 'gasto', 'aportes patronales', v_total_aportes, p_fecha_retiro, 'Aportes patronales de la liquidación');
      end if;

      if v_cesantias + v_intereses + v_prima > 0 then
        insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
        values (
          v_empresa_id, 'gasto', 'prestaciones sociales', v_cesantias + v_intereses + v_prima, p_fecha_retiro,
          'Cesantías, intereses y prima proporcionales de la liquidación'
        );
      end if;
    end if;

    if v_monto_vacaciones > 0 then
      insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
      values (
        v_empresa_id, 'gasto', 'liquidación', v_monto_vacaciones, p_fecha_retiro,
        'Pago de ' || v_dias_pendientes || ' días de vacaciones pendientes'
      );
    end if;

    if v_monto_indemnizacion > 0 then
      insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, fecha, nota)
      values (
        v_empresa_id, 'gasto', 'liquidación', v_monto_indemnizacion, p_fecha_retiro,
        'Indemnización por despido sin justa causa (' || round(v_dias_indemnizacion, 1) || ' días)'
      );
    end if;

    update empleados set activo = false, fecha_retiro = p_fecha_retiro where id = p_empleado_id;
  end if;

  return query select
    v_fecha_desde, v_dias, v_salario_prop, v_aux, (v_salud + v_pension),
    (v_salario_prop + v_aux - v_salud - v_pension), v_total_aportes,
    (v_cesantias + v_intereses + v_prima), v_dias_pendientes, v_monto_vacaciones,
    v_dias_indemnizacion, v_monto_indemnizacion, v_requiere_manual,
    (v_salario_prop + v_aux - v_salud - v_pension + v_cesantias + v_intereses + v_prima
      + v_monto_vacaciones + v_monto_indemnizacion);
end;
$$;

-- Insights — resumen ejecutivo en lenguaje natural, generado por Claude
-- (capa opcional encima del motor de anomalías, que sigue siendo 100%
-- Postgres/TypeScript propio). No reemplaza las gráficas: lee las mismas
-- anomalías que el motor ya detectó y las redacta priorizadas en un párrafo
-- corto. Se genera como máximo una vez al día por empresa — la aplicación
-- revisa si ya existe una fila de hoy antes de llamar la API, para
-- mantener el costo mínimo (mismo patrón de "corre cuando alguien abre la
-- pantalla" que ya usan las reglas de inactividad del CRM y el vencimiento
-- de apartados, solo que aquí el límite es una vez al día en vez de cada
-- vez, porque esta sí tiene un costo real por llamada).
create table insights_resumen_ia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  contenido text not null,
  generado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- Integración con Google Calendar (CRM modo 'leads', tanto en empresas
-- cliente como en el CRM propio de Datum): cada usuario conecta su propia
-- cuenta de Google, no hay una cuenta compartida para toda la plataforma.
-- Solo se guarda el refresh_token — el access_token nunca se guarda, se
-- pide de nuevo con el refresh_token cada vez que hace falta, así este
-- código no tiene que preocuparse por manejar su expiración.
-- ------------------------------------------------------------
create table integraciones_google (
  perfil_id uuid primary key references perfiles(id) on delete cascade,
  refresh_token text not null,
  correo_google text,
  created_at timestamptz default now()
);

-- Un seguimiento agendado desde la ficha de un cliente, enlazado al evento
-- real creado en el Google Calendar de quien lo agendó.
create table crm_eventos_calendar (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid references crm_contactos(id) not null,
  perfil_id uuid references perfiles(id) not null,
  google_event_id text not null,
  link text,   -- htmlLink que devuelve Google, para abrir el evento sin otra llamada a su API
  meet_link text,   -- hangoutLink que devuelve Google al pedir conferenceData
  titulo text not null,
  fecha timestamptz not null,
  nota text,
  created_at timestamptz default now()
);

-- Mismo patrón, para el CRM propio de leads de Datum.
create table datum_crm_eventos_calendar (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references datum_leads(id) not null,
  perfil_id uuid references perfiles(id) not null,
  google_event_id text not null,
  link text,
  meet_link text,
  titulo text not null,
  fecha timestamptz not null,
  nota text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — el corazón del multi-tenant
-- Cada empresa ve solo sus propias filas; el admin las ve todas.
-- ============================================================

alter table empresas enable row level security;
alter table puntos_venta enable row level security;
alter table perfiles enable row level security;
alter table actualizaciones enable row level security;
alter table diagnosticos enable row level security;
alter table suscripciones enable row level security;
alter table ventas enable row level security;
alter table ventas_items enable row level security;
alter table crm_etapas enable row level security;
alter table crm_etapa_campos enable row level security;
alter table crm_campos_generales enable row level security;
alter table crm_contactos enable row level security;
alter table crm_interacciones enable row level security;
alter table inventario_items enable row level security;
alter table inventario_movimientos enable row level security;
alter table inventario_lotes enable row level security;
alter table inventario_receta enable row level security;
alter table proveedores enable row level security;
alter table finanzas_movimientos enable row level security;
alter table pasivos enable row level security;
alter table promociones enable row level security;
alter table promocion_items enable row level security;
alter table devoluciones enable row level security;
alter table devoluciones_items enable row level security;
alter table cupones enable row level security;
alter table apartados enable row level security;
alter table apartados_items enable row level security;
alter table apartados_abonos enable row level security;
alter table empleados enable row level security;
alter table nomina_periodos enable row level security;
alter table nomina_detalles enable row level security;
alter table nomina_vacaciones enable row level security;
alter table insights_resumen_ia enable row level security;
alter table integraciones_google enable row level security;
alter table crm_eventos_calendar enable row level security;
alter table datum_pasivos enable row level security;
alter table datum_movimientos enable row level security;
alter table datum_crm_etapas enable row level security;
alter table datum_crm_etapa_campos enable row level security;
alter table datum_crm_campos_generales enable row level security;
alter table datum_leads enable row level security;
alter table datum_crm_interacciones enable row level security;
alter table datum_crm_eventos_calendar enable row level security;

-- Funciones auxiliares, para no repetir la misma subconsulta en cada política.
-- security definer es necesario aquí: la política de "perfiles" usa es_admin(),
-- que a su vez consulta "perfiles" — sin security definer, Postgres tendría que
-- re-evaluar esa misma política para resolver la función, entrando en un ciclo
-- que termina en error ("infinite recursion detected in policy for relation").
create or replace function mi_empresa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from perfiles where id = auth.uid();
$$;

create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select rol = 'admin' from perfiles where id = auth.uid();
$$;

-- A qué punto de venta está limitado el usuario actual. null = ve toda la
-- empresa (caso normal: cuenta general, o cualquier empresa que no usa
-- puntos_venta). Con un valor, solo ve ese punto.
create or replace function mi_punto_venta_id()
returns uuid language sql stable security definer set search_path = public as $$
  select punto_venta_id from perfiles where id = auth.uid();
$$;

-- Políticas: mismo patrón repetido en cada tabla con empresa_id
create policy "ver mi propia empresa" on empresas
  for select using (id = mi_empresa_id() or es_admin());

create policy "ver mis puntos de venta" on puntos_venta
  for all using (empresa_id = mi_empresa_id() or es_admin());

-- Solo permite actualizar (nunca crear ni borrar) la propia fila de empresa.
-- En la práctica, el único código de la aplicación que escribe aquí es
-- subirLogoEmpresa(), que solo toca logo_path — el resto de campos
-- (plan, módulos activos, etc.) siguen siendo de administración manual.
create policy "actualizar mi propia empresa" on empresas
  for update using (id = mi_empresa_id() or es_admin())
  with check (id = mi_empresa_id() or es_admin());

create policy "ver mi propio perfil" on perfiles
  for select using (id = auth.uid() or es_admin());

create policy "actualizar mi propio perfil" on perfiles
  for update using (id = auth.uid() or es_admin())
  with check (id = auth.uid() or es_admin());

-- Personal, no de empresa: cada quien conecta y ve solo su propia cuenta de
-- Google, nadie más (ni siquiera el admin) necesita leer este token.
create policy "ver mi propia integracion de google" on integraciones_google
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- No es un dato de ninguna empresa en particular (como festivos) — cualquier
-- persona con sesión puede leerlas, para que el pop-up funcione.
create policy "ver actualizaciones con sesión activa" on actualizaciones
  for select using (auth.uid() is not null);

create policy "ver mis diagnosticos" on diagnosticos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis suscripciones" on suscripciones
  for all using (empresa_id = mi_empresa_id() or es_admin());

-- Con puntos_venta: si mi perfil está limitado a un punto (mi_punto_venta_id()
-- no es null), solo veo las filas de ese punto. Si no está limitado (caso de
-- casi todas las empresas), veo toda la empresa igual que siempre.
create policy "ver mis ventas" on ventas
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver mis etapas de crm" on crm_etapas
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mi crm" on crm_contactos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mi inventario" on inventario_items
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver mis proveedores" on proveedores
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis finanzas" on finanzas_movimientos
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver mis pasivos" on pasivos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis promociones" on promociones
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis apartados" on apartados
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver items de mis apartados" on apartados_items
  for all using (
    apartado_id in (select id from apartados where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver abonos de mis apartados" on apartados_abonos
  for all using (
    apartado_id in (select id from apartados where empresa_id = mi_empresa_id())
    or es_admin()
  );

-- Tablas sin empresa_id directo: se filtran a través de su tabla padre
create policy "ver interacciones de mi crm" on crm_interacciones
  for all using (
    contacto_id in (select id from crm_contactos where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver campos de mis etapas de crm" on crm_etapa_campos
  for all using (
    etapa_id in (select id from crm_etapas where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver eventos de calendar de mi crm" on crm_eventos_calendar
  for all using (
    contacto_id in (select id from crm_contactos where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver mis campos generales de crm" on crm_campos_generales
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver movimientos de mi inventario" on inventario_movimientos
  for all using (
    item_id in (select id from inventario_items where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver lotes de mi inventario" on inventario_lotes
  for all using (
    item_id in (select id from inventario_items where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver receta de mi inventario" on inventario_receta
  for all using (
    item_resultante_id in (select id from inventario_items where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver items de mis ventas" on ventas_items
  for all using (
    venta_id in (select id from ventas where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver productos de mis promociones" on promocion_items
  for all using (
    promocion_id in (select id from promociones where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver mis devoluciones" on devoluciones
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver items de mis devoluciones" on devoluciones_items
  for all using (
    devolucion_id in (select id from devoluciones where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver mis cupones" on cupones
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis empleados" on empleados
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis periodos de nomina" on nomina_periodos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver detalles de mi nomina" on nomina_detalles
  for all using (
    periodo_id in (select id from nomina_periodos where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver vacaciones de mis empleados" on nomina_vacaciones
  for all using (
    empleado_id in (select id from empleados where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver resumen de insights de mi empresa" on insights_resumen_ia
  for all using (empresa_id = mi_empresa_id() or es_admin());

-- Sin empresa_id: no hay "mi_empresa_id() = ..." posible acá. Solo la cuenta
-- de administrador puede ver o tocar las finanzas propias de Datum.
create policy "solo admin ve pasivos de datum" on datum_pasivos
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve movimientos de datum" on datum_movimientos
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve etapas de leads de datum" on datum_crm_etapas
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve campos de etapas de leads de datum" on datum_crm_etapa_campos
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve campos generales de leads de datum" on datum_crm_campos_generales
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve leads de datum" on datum_leads
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve interacciones de leads de datum" on datum_crm_interacciones
  for all using (es_admin()) with check (es_admin());

create policy "solo admin ve eventos de calendar de leads de datum" on datum_crm_eventos_calendar
  for all using (es_admin()) with check (es_admin());

-- ============================================================
-- STORAGE — fotos de productos
-- Bucket privado: cada empresa solo puede ver y subir fotos dentro de su
-- propia carpeta ('{empresa_id}/{item_id}/archivo'). Límite de 5MB por foto,
-- solo formatos de imagen comunes.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario-fotos', 'inventario-fotos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "ver fotos de mi empresa" on storage.objects
  for select using (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "subir fotos de mi empresa" on storage.objects
  for insert with check (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "actualizar fotos de mi empresa" on storage.objects
  for update using (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "borrar fotos de mi empresa" on storage.objects
  for delete using (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

-- Bucket separado para el logo de cada empresa — mismo patrón de RLS que
-- las fotos de producto, pero con límite más pequeño (2MB) y permitiendo SVG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('empresas-logos', 'empresas-logos', false, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "ver logo de mi empresa" on storage.objects
  for select using (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "subir logo de mi empresa" on storage.objects
  for insert with check (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "actualizar logo de mi empresa" on storage.objects
  for update using (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "borrar logo de mi empresa" on storage.objects
  for delete using (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

-- ============================================================
-- FUNCIONES DE NEGOCIO
-- El punto de entrada que usa la aplicación — nunca se arma
-- una venta con llamadas separadas al CRM, a ventas y a inventario.
-- ============================================================

-- Buscador de clientes: escribe cualquier parte del nombre, teléfono o placa
-- y devuelve las coincidencias dentro de la empresa. Si no aparece nada,
-- es un cliente nuevo; si aparece, es recurrente. unaccent() ignora tildes,
-- para que "jose" encuentre a "José" y viceversa.
create or replace function buscar_clientes(p_empresa_id uuid, p_query text)
returns setof crm_contactos
language sql stable
as $$
  select *
  from crm_contactos
  where empresa_id = p_empresa_id
    and (
      unaccent(nombre) ilike unaccent('%' || p_query || '%')
      or telefono ilike '%' || p_query || '%'
      or unaccent(atributos->>'placa') ilike unaccent('%' || p_query || '%')
    )
  order by nombre
  limit 20;
$$;

-- Registra una venta completa de una sola vez:
-- si ya se confirmó un cliente encontrado con buscar_clientes(), se usa directo;
-- si no, lo busca por teléfono o lo crea. Luego crea la venta y cada item
-- (lo que dispara el descuento de inventario automático solo para productos).
-- Si algo falla a mitad de camino, no queda nada guardado a medias.
create or replace function registrar_venta(
  p_empresa_id uuid,
  p_contacto_id uuid,           -- confirmado en el buscador; null si es cliente nuevo o no se buscó
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text,
  p_atributos_cliente jsonb,    -- ej. {"placa": "ABC123", "modelo": "Dominar 250"}
  p_atributos_venta jsonb,      -- ej. {"km": 15000}
  p_items jsonb,                 -- ej. [{"item_id":"...","cantidad":1,"precio_unitario":20000,"promocion_id":null,"descuento_aplicado":0}, ...]
                                  -- o, sin catálogo (empresa sin Inventario): [{"nombre_libre":"Camisa talla M","cantidad":1,"precio_unitario":45000,"costo_unitario":20000}, ...]
  p_fecha timestamptz default null,  -- si la persona cambió la fecha/hora sugerida; null = usar el momento actual
  p_metodo_pago text default null,   -- uno de los valores en empresas.metodos_pago_disponibles
  p_punto_venta_id uuid default null -- solo si la empresa usa puntos_venta; null para el resto
)
returns uuid
language plpgsql
as $$
declare
  v_contacto_id uuid;
  v_venta_id uuid;
  v_monto_total numeric(12,2);
  v_item jsonb;
begin
  -- 1. Cliente: si ya se confirmó uno en el buscador, se usa directo. Si no
  --    se dio ningún nombre (negocio sin CRM activo, venta anónima), se
  --    omite por completo — no se crea ni se busca ningún contacto.
  if p_contacto_id is not null then
    v_contacto_id := p_contacto_id;
    update crm_contactos
    set atributos = atributos || p_atributos_cliente,
        nombre = coalesce(p_cliente_nombre, nombre),
        email = coalesce(p_cliente_email, email),
        etapa_id = etapa_cierre_crm(p_empresa_id)
    where id = v_contacto_id;
  elsif coalesce(p_cliente_nombre, '') <> '' then
    select id into v_contacto_id
    from crm_contactos
    where empresa_id = p_empresa_id and telefono = p_cliente_telefono
    limit 1;

    if v_contacto_id is null then
      insert into crm_contactos (empresa_id, nombre, telefono, email, atributos, etapa_id)
      values (p_empresa_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email, p_atributos_cliente, etapa_cierre_crm(p_empresa_id))
      returning id into v_contacto_id;
    else
      update crm_contactos
      set atributos = atributos || p_atributos_cliente,
          nombre = coalesce(p_cliente_nombre, nombre),
          email = coalesce(p_cliente_email, email),
          etapa_id = etapa_cierre_crm(p_empresa_id)
      where id = v_contacto_id;
    end if;
  else
    v_contacto_id := null;
  end if;

  -- 2. Calcular el monto total a partir de los items (ya con el descuento aplicado)
  select sum((item->>'cantidad')::numeric * (item->>'precio_unitario')::numeric)
  into v_monto_total
  from jsonb_array_elements(p_items) as item;

  -- 3. Crear la venta
  insert into ventas (empresa_id, punto_venta_id, monto, contacto_id, cliente_nombre, atributos, fecha, metodo_pago)
  values (p_empresa_id, p_punto_venta_id, v_monto_total, v_contacto_id, p_cliente_nombre, p_atributos_venta, coalesce(p_fecha, now()), p_metodo_pago)
  returning id into v_venta_id;

  -- 4. Agregar cada producto o servicio vendido, con su promoción si aplica
  --    (esto dispara el descuento de inventario, solo para productos con
  --    item_id — una empresa sin Inventario no manda item_id, solo
  --    nombre_libre y su propio costo_unitario, y no pasa por ese trigger)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into ventas_items (venta_id, item_id, nombre_libre, cantidad, precio_unitario, costo_unitario, promocion_id, descuento_aplicado)
    values (
      v_venta_id,
      nullif(v_item->>'item_id','')::uuid,
      nullif(v_item->>'nombre_libre',''),
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      nullif(v_item->>'costo_unitario','')::numeric,
      nullif(v_item->>'promocion_id','')::uuid,
      coalesce((v_item->>'descuento_aplicado')::numeric, 0)
    );
  end loop;

  return v_venta_id;
end;
$$;

-- Deshacer una venta recién registrada, para corregir un error sin dejar el
-- inventario mal calculado. Solo funciona en los 2 minutos siguientes a
-- haberla creado (la app solo ofrece el botón durante 60 segundos; este
-- margen extra es por si hay algo de latencia). En vez de intentar
-- reconstruir el lote exacto que consumió el FIFO (frágil si hubo otra
-- venta del mismo producto en el medio), crea un lote nuevo de entrada al
-- costo que quedó congelado en la venta — la cantidad y el costo quedan
-- exactamente igual que antes de vender, aunque no sea "el mismo" lote.
-- No revierte nada del CRM (si creó o actualizó un contacto, se queda así).
create or replace function deshacer_venta(p_venta_id uuid)
returns void
language plpgsql
as $$
declare
  v_creada_en timestamptz;
  v_item record;
begin
  select created_at into v_creada_en from ventas where id = p_venta_id;
  if v_creada_en is null then
    raise exception 'Venta no encontrada';
  end if;
  if now() - v_creada_en > interval '2 minutes' then
    raise exception 'Ya pasó el tiempo para deshacer esta venta';
  end if;

  for v_item in
    select vi.item_id, vi.cantidad, vi.costo_unitario, ii.tipo
    from ventas_items vi
    join inventario_items ii on ii.id = vi.item_id
    where vi.venta_id = p_venta_id and vi.item_id is not null
  loop
    if v_item.tipo = 'producto' then
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item.item_id, v_item.cantidad, coalesce(v_item.costo_unitario, 0));

      insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
      values (v_item.item_id, 'entrada', 'devolucion', v_item.cantidad, 'Venta deshecha');

      update inventario_items
      set cantidad = cantidad + v_item.cantidad
      where id = v_item.item_id;
    end if;
  end loop;

  delete from ventas_items where venta_id = p_venta_id;
  delete from ventas where id = p_venta_id;
end;
$$;

-- Carga masiva de ventas históricas: para una empresa que migra desde otra
-- herramienta (o una hoja de Excel) y quiere conservar su historial de
-- ventas. Por defecto (p_descontar_inventario = false) estas ventas NUNCA
-- descuentan inventario ni recalculan costo por FIFO — para migrar ventas
-- que ya pasaron de verdad en el sistema anterior del cliente, donde volver
-- a descontarlas duplicaría el efecto. Si p_descontar_inventario = true, se
-- comportan como ventas reales (registrar_venta()): sí descuentan stock por
-- FIFO y bloquean la fila si no hay suficiente — útil para cargar ventas
-- recientes en lote (ej. de un turno de noche) que sí deben afectar el
-- inventario actual. Como toda la carga corre en una sola transacción, si
-- una fila falla por falta de stock en ese modo, NINGUNA fila se importa.
-- Cada fila es una venta de un solo producto (una fila del CSV = una línea
-- vendida); si el producto no existe en el catálogo, la venta igual se
-- guarda, solo queda sin ligar a inventario. Devuelve cuántas se importaron.
create or replace function importar_ventas_historicas(
  p_empresa_id uuid,
  p_ventas jsonb,  -- [{"fecha":"2026-03-01","cliente_nombre":"...","cliente_telefono":"...","cliente_email":"...","producto":"...","cantidad":1,"precio_unitario":1000,"costo_unitario":700,"metodo_pago":"efectivo"}, ...]
  p_descontar_inventario boolean default false
)
returns int
language plpgsql
as $$
declare
  v_fila jsonb;
  v_item_id uuid;
  v_contacto_id uuid;
  v_venta_id uuid;
  v_importadas int := 0;
  v_cantidad numeric;
  v_precio numeric;
  v_costo numeric;
begin
  perform set_config('app.importando_historico', (not p_descontar_inventario)::text, true);

  for v_fila in select * from jsonb_array_elements(p_ventas)
  loop
    v_item_id := null;
    if coalesce(v_fila->>'producto', '') <> '' then
      select id into v_item_id
      from inventario_items
      where empresa_id = p_empresa_id
        and lower(unaccent(nombre)) = lower(unaccent(v_fila->>'producto'))
      limit 1;
    end if;

    v_contacto_id := null;
    if coalesce(v_fila->>'cliente_telefono', '') <> '' then
      select id into v_contacto_id
      from crm_contactos
      where empresa_id = p_empresa_id and telefono = (v_fila->>'cliente_telefono')
      limit 1;

      if v_contacto_id is null then
        insert into crm_contactos (empresa_id, nombre, telefono, email, etapa_id)
        values (
          p_empresa_id,
          coalesce(nullif(v_fila->>'cliente_nombre', ''), 'Cliente sin nombre'),
          v_fila->>'cliente_telefono',
          nullif(v_fila->>'cliente_email', ''),
          etapa_cierre_crm(p_empresa_id)
        )
        returning id into v_contacto_id;
      else
        update crm_contactos set etapa_id = etapa_cierre_crm(p_empresa_id) where id = v_contacto_id;
      end if;
    end if;

    v_cantidad := (v_fila->>'cantidad')::numeric;
    v_precio := (v_fila->>'precio_unitario')::numeric;
    v_costo := nullif(v_fila->>'costo_unitario', '')::numeric;
    if v_costo is null and v_item_id is not null then
      select costo into v_costo from inventario_items where id = v_item_id;
    end if;

    insert into ventas (empresa_id, fecha, monto, contacto_id, cliente_nombre, metodo_pago)
    values (
      p_empresa_id,
      (v_fila->>'fecha')::timestamptz,
      v_cantidad * v_precio,
      v_contacto_id,
      nullif(v_fila->>'cliente_nombre', ''),
      nullif(v_fila->>'metodo_pago', '')
    )
    returning id into v_venta_id;

    insert into ventas_items (venta_id, item_id, nombre_libre, cantidad, precio_unitario, costo_unitario)
    values (
      v_venta_id,
      v_item_id,
      case when v_item_id is null then nullif(v_fila->>'producto', '') end,
      v_cantidad,
      v_precio,
      v_costo
    );

    v_importadas := v_importadas + 1;
  end loop;

  return v_importadas;
end;
$$;

-- Tamaño total de la base de datos, en bytes — para el panel de
-- administrador (sección "Uso de la plataforma"). No expone nada de ninguna
-- empresa en particular, solo un número agregado de toda la base.
create or replace function tamano_base_datos()
returns bigint
language sql
stable
as $$
  select pg_database_size(current_database());
$$;
