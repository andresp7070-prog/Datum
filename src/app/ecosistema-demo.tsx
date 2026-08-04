"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Recrea, dentro de la landing, la presentación comercial interactiva
// (presentacion-comercial/index.html) — mismos 7 módulos, mismos datos de
// ejemplo (hamburguesería), mismos pasos.
//
// Para que se sienta como un video de verdad (no diapositivas que ya
// llegan listas), cada cuadro con algo nuevo primero muestra un cursor
// simulado moviéndose hasta el elemento correspondiente, "hace clic"
// (un pulso), y SOLO ENTONCES se revela lo nuevo (texto que se escribe
// solo, cifras que suben, barras que crecen). Ese `revelado` gatea todo
// lo animado: mientras no ha pasado el clic, el cuadro muestra su estado
// "antes de hacer clic" (heredado del cuadro anterior).
//
// El contenido de un módulo YA NO se remonta en cada cuadro (antes se
// forzaba con una key que incluía el cuadro, y eso era lo que se sentía
// como "cortes entre clips"). Ahora solo se remonta al cambiar de módulo
// — dentro de un módulo, los mismos elementos persisten y solo cambia su
// contenido, como pasaría de verdad usando la aplicación.

const MS_POR_CUADRO = 1450;
const MOVER_MS = 320; // tiempo en que el cursor viaja hasta el objetivo
const CLIC_PAUSA_MS = 140; // pausa del "clic" antes de revelar

function formatoCOP(v: number) {
  return "$" + Math.round(v).toLocaleString("es-CO");
}

const NAV_ITEMS = [
  "Resumen",
  "Ventas",
  "CRM",
  "Inventario",
  "Estado P y G",
  "Panel de control",
  "Promociones",
  "Nómina",
];

type Modulo = {
  id: string;
  nombre: string;
  icono: string;
  url: string;
  totalCuadros: number;
  highlights: string[];
};

const MODULOS: Modulo[] = [
  {
    id: "Ventas",
    nombre: "Ventas",
    icono: "🧾",
    url: "app.datum.co/ventas",
    totalCuadros: 5,
    highlights: ["Una sola pantalla", "El cliente se busca solo", "Un clic, todo queda registrado"],
  },
  {
    id: "Inventario",
    nombre: "Inventario",
    icono: "📦",
    url: "app.datum.co/inventario",
    totalCuadros: 4,
    highlights: ["Alta manual o masiva", "Recetas con cálculo automático", "Nunca se calcula a mano"],
  },
  {
    id: "CRM",
    nombre: "CRM",
    icono: "🤝",
    url: "app.datum.co/crm",
    totalCuadros: 5,
    highlights: [
      "Un cliente que compra ya queda aquí, sin crearlo a mano",
      "Perfil de compra calculado solo",
      "El historial nunca se duplica",
    ],
  },
  {
    id: "P y G",
    nombre: "Estado P y G",
    icono: "📊",
    url: "app.datum.co/pyg",
    totalCuadros: 5,
    highlights: [
      "Utilidad real, no solo ingresos menos gastos a ojo",
      "Las deudas no cuentan hasta que se abonan",
      "Un abono mueve los dos números a la vez",
    ],
  },
  {
    id: "Panel de control",
    nombre: "Panel de control",
    icono: "🧠",
    url: "app.datum.co/insights",
    totalCuadros: 4,
    highlights: [
      "Se compara contra tu propio historial, no un número inventado",
      "Resalta solo lo que se sale de lo normal",
      "Resumen en lenguaje natural, automático",
    ],
  },
  {
    id: "Nómina",
    nombre: "Nómina",
    icono: "👥",
    url: "app.datum.co/nomina",
    totalCuadros: 4,
    highlights: [
      "El salario queda congelado en cada período",
      "Aportes patronales y prestaciones se calculan solos",
      "El gasto real solo aparece al marcar pagada",
    ],
  },
  {
    id: "Promociones",
    nombre: "Promociones",
    icono: "🏷️",
    url: "app.datum.co/promociones",
    totalCuadros: 4,
    highlights: [
      "El 2x1 se descuenta solo, sin cálculos manuales",
      "Compara la campaña contra el resto del período",
      "Un clic y ves todo su desempeño",
    ],
  },
];

// A qué elemento se mueve y le "hace clic" el cursor en cada cuadro de
// cada módulo. `null` = ese cuadro no necesita clic (es la consecuencia
// del clic anterior, o una pantalla que solo se está mostrando).
function objetivoCursor(moduloId: string, cuadro: number): string | null {
  const mapa: Record<string, (string | null)[]> = {
    Ventas: ["ventas-agregar", null, "ventas-nombre", "ventas-guardar", null],
    Inventario: ["inventario-agregar", null, "inventario-tab-recetas", "inventario-fila-receta"],
    CRM: ["crm-fila-cliente", null, null, "crm-estrella-5", "crm-agregar-interaccion"],
    "P y G": [null, null, null, null, "pyg-abonar"],
    "Panel de control": [null, null, null, null],
    Nómina: ["nomina-agregar", null, "nomina-tab-periodos", "nomina-marcar-pagada"],
    Promociones: ["promo-agregar", "promo-fila", null, null],
  };
  return mapa[moduloId]?.[cuadro] ?? null;
}

// Ayuda a expresar "ya pasamos de este punto, o justo ahora se reveló" —
// para transiciones que un clic dispara dentro de su propio cuadro
// (cambiar de pestaña, abrir un detalle) en vez de solo mostrar algo nuevo.
function pasado(cuadro: number, n: number, revelado: boolean) {
  return cuadro > n || (cuadro === n && revelado);
}

// --- Datos de ejemplo (hamburguesería) — mismos que la presentación comercial ---

const CLIENTE = { nombre: "Camila Ruiz", telefono: "+57 0000000000", correo: "datum@datum.com" };
const VENTA = { producto: "Hamburguesa Clásica 🍔", cantidad: 2, precio: 12000, metodo: "Efectivo" };
const TOTAL_VENTA = VENTA.cantidad * VENTA.precio;

const PRODUCTOS = [
  { id: "pan", nombre: "Pan de hamburguesa", categoria: "Panadería", emoji: "🍞", cantidad: 40, unidad: "unidad", costo: 800, precio: 1500 },
  { id: "carne", nombre: "Carne de res", categoria: "Cárnicos", emoji: "🥩", cantidad: 30, unidad: "unidad", costo: 2500, precio: 4500 },
  { id: "queso", nombre: "Queso cheddar", categoria: "Lácteos", emoji: "🧀", cantidad: 50, unidad: "unidad", costo: 600, precio: 1200 },
  { id: "lechuga", nombre: "Lechuga", categoria: "Verduras", emoji: "🥬", cantidad: 15, unidad: "unidad", costo: 200, precio: 400 },
  { id: "tomate", nombre: "Tomate", categoria: "Verduras", emoji: "🍅", cantidad: 20, unidad: "unidad", costo: 250, precio: 450 },
];
const RECETA_NECESITA: Record<string, number> = { pan: 1, carne: 1, queso: 1, lechuga: 2, tomate: 1 };
const PRODUCIBLES = Math.min(
  ...Object.entries(RECETA_NECESITA).map(([id, n]) => Math.floor(PRODUCTOS.find((p) => p.id === id)!.cantidad / n)),
);

const PERFIL = { inversion: 24000, ticket: 24000, totalCompras: 1, productoMasComprado: "Hamburguesa Clásica (2 unidades)" };
const COMPRA = { itemsDistintos: 1, unidadesTotales: 2, monto: 24000 };
const INTERACCION = { tipo: "Llamada", nota: "Le encantó la hamburguesa — dijo que vuelve la próxima semana." };

const INGRESOS = 8400000;
const COSTO_VENTAS = 3200000;
const GASTOS = [
  { cat: "Arriendo", monto: 1200000, tipo: "Recurrente · mensual" },
  { cat: "Servicios públicos", monto: 400000, tipo: "Recurrente · mensual" },
  { cat: "Publicidad", monto: 500000, tipo: "Costo puntual" },
];
const DEUDA = { desc: "Préstamo equipo de cocina", total: 2000000, pagadoInicial: 500000 };
const ABONO = 500000;

const DIAS = [
  { d: "Lun", v: 380000 }, { d: "Mar", v: 410000 }, { d: "Mié", v: 395000 },
  { d: "Jue", v: 430000 }, { d: "Vie", v: 620000 }, { d: "Sáb", v: 980000, activo: true },
  { d: "Dom", v: 540000 },
];
const GASTOS_CAT = [
  { c: "Arriendo", v: 1200000 }, { c: "Servicios", v: 400000 }, { c: "Publicidad", v: 500000 },
];

const EMPLEADO = { nombre: "Carlos Gómez", cargo: "Cocinero", salario: 1500000 };
const PERIODO_NOMINA = { rango: "1 jul 2026 — 31 jul 2026", pago: "31 jul 2026" };
const DETALLE_NOMINA = {
  auxilio: 200000, deduccionSalud: 60000, deduccionPension: 60000,
  aportes: 248000, prestaciones: 284600,
};
const NOMINA_DEVENGADO = EMPLEADO.salario + DETALLE_NOMINA.auxilio;
const NOMINA_DEDUCIDO = DETALLE_NOMINA.deduccionSalud + DETALLE_NOMINA.deduccionPension;
const NOMINA_NETO = NOMINA_DEVENGADO - NOMINA_DEDUCIDO;

const PROMO = { nombre: "Martes de 2x1 — Hamburguesa Clásica", tipo: "2x1", codigo: "MARTES2X1" };
const DESEMPENO_PROMO = {
  ventas: 18, ingresos: 396000, ticketPromedio: 22000,
  unidades: 18, descuentoTotal: 216000, ventasTotalesPeriodo: 8400000,
};

// --- Primitivas de animación: lo que hace que se sienta "video", no diapositivas ---

// Revela el texto letra por letra, como si alguien lo estuviera escribiendo.
// El paso se ajusta según el largo del texto para que TODO texto —corto o
// largo— termine de escribirse dentro de un tiempo total parecido, y así
// quepa cómodo en el tiempo que le queda al cuadro después del clic.
function Typewriter({ texto }: { texto: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!texto) return;
    const DURACION_OBJETIVO = 480;
    const pasoMs = Math.max(11, Math.min(38, DURACION_OBJETIVO / texto.length));
    const id = setInterval(() => {
      setN((actual) => {
        if (actual >= texto.length) {
          clearInterval(id);
          return actual;
        }
        return actual + 1;
      });
    }, pasoMs);
    return () => clearInterval(id);
  }, [texto]);
  return <>{texto.slice(0, n)}</>;
}

// Sube en vivo desde 0 hasta el valor final — para que una cifra se sienta
// calculada en el momento, no ya lista de antemano.
function Contador({ valor, formato }: { valor: number; formato?: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!valor) return;
    const inicio = performance.now();
    const duracion = 550;
    let raf = 0;
    function tick(t: number) {
      const p = Math.max(0, Math.min(1, (t - inicio) / duracion));
      const suavizado = 1 - Math.pow(1 - p, 3);
      setN(Math.round(valor * suavizado));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{formato ? formato(n) : n}</>;
}

function ChartBars({
  items,
  animar,
}: {
  items: { label: string; valor: number; activo?: boolean }[];
  animar: boolean;
}) {
  const [listo, setListo] = useState(!animar);
  useEffect(() => {
    if (!animar) return;
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, [animar]);
  const max = Math.max(...items.map((i) => i.valor));
  return (
    <div className="demo-chart-bars">
      {items.map((it, i) => (
        <div key={it.label} className="demo-chart-col">
          <span className="demo-chart-val">${Math.round(it.valor / 1000)}k</span>
          <span
            className={`demo-chart-bar${it.activo ? " es-activo" : ""}`}
            style={{
              height: listo ? `${Math.round((it.valor / max) * 100)}%` : "0%",
              transition: animar ? `height 0.5s cubic-bezier(.2,.8,.2,1) ${i * 45}ms` : "none",
            }}
          />
          <span className="demo-chart-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function AppSidebar({ activo }: { activo: string }) {
  return (
    <aside className="demo-sidebar">
      <div>
        <div className="demo-sidebar-brand">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M 24 42 A 18 18 0 1 1 36.321 37.122" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
          </svg>
          <span>Datum</span>
        </div>
        <nav className="demo-nav-list">
          {NAV_ITEMS.map((item) => (
            <span key={item} className={`demo-nav-item${item === activo ? " activo" : ""}`}>
              {item}
            </span>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function contenidoVentas(cuadro: number, revelado: boolean) {
  if (cuadro <= 0) {
    return (
      <div>
        <div className="demo-tabs">
          <span className="demo-tab activo">Historial</span>
          <span className="demo-tab">Proyecciones</span>
          <span className="demo-tab">Importar</span>
        </div>
        <div className="demo-content-head"><h4>Ventas</h4><span className="demo-btn-app" data-cursor="ventas-agregar">Agregar venta</span></div>
        <div className="demo-stat-cards">
          <div className="demo-stat-card"><span className="etq">Ventas de hoy</span><span className="val">0</span></div>
          <div className="demo-stat-card"><span className="etq">Vendido hoy</span><span className="val">$0</span></div>
        </div>
        <div className="demo-empty">Todavía no hay ventas registradas.</div>
      </div>
    );
  }
  if (cuadro >= 4) {
    return (
      <div>
        <div className="demo-tabs">
          <span className="demo-tab activo">Historial</span>
          <span className="demo-tab">Proyecciones</span>
          <span className="demo-tab">Importar</span>
        </div>
        <div className="demo-content-head"><h4>Ventas</h4><span className="demo-btn-app">Agregar venta</span></div>
        <div className="demo-stat-cards">
          <div className="demo-stat-card"><span className="etq">Ventas de hoy</span><span className="val"><Contador valor={1} /></span></div>
          <div className="demo-stat-card"><span className="etq">Vendido hoy</span><span className="val"><Contador valor={TOTAL_VENTA} formato={formatoCOP} /></span></div>
        </div>
        <div className="demo-fila-venta demo-entra">
          <div>
            <div className="nombre">{CLIENTE.nombre}</div>
            <div className="fecha">Hoy</div>
            <div className="productos">{VENTA.producto} ×{VENTA.cantidad}</div>
          </div>
          <div className="derecha">
            <div className="monto"><Contador valor={TOTAL_VENTA} formato={formatoCOP} /></div>
            <div className="metodo">{VENTA.metodo}</div>
          </div>
        </div>
      </div>
    );
  }
  // Cuadro 2: clic en "Nombre" llena el formulario. Cuadro 3: el formulario
  // sigue lleno hasta que el clic en "Guardar" se completa — ahí se limpia
  // y aparece el aviso de éxito, todo dentro del mismo cuadro 3.
  const lleno = pasado(cuadro, 2, revelado) && !pasado(cuadro, 3, revelado);
  const llenandoAhora = cuadro === 2 && revelado;
  const guardando = pasado(cuadro, 3, revelado);
  return (
    <div>
      <div className="demo-content-head"><h4>Agregar venta</h4></div>
      {guardando && (
        <div className="demo-success-banner demo-entra"><span>Venta agregada correctamente.</span><span>Deshacer (60s)</span></div>
      )}
      <div className="demo-form-row">
        <div className="demo-field"><label>Fecha</label><div className="valor">Hoy</div></div>
        <div className="demo-field"><label>Hora</label><div className="valor">Ahora</div></div>
      </div>
      <div className="demo-section">
        <h5>Cliente</h5>
        <div className="demo-field-grid">
          <div className="demo-field"><label>Nombre *</label><div className={`valor${lleno ? "" : " vacio"}`} data-cursor="ventas-nombre">{lleno ? (llenandoAhora ? <Typewriter texto={CLIENTE.nombre} /> : CLIENTE.nombre) : "—"}</div></div>
          <div className="demo-field"><label>Teléfono *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? (llenandoAhora ? <Typewriter texto={CLIENTE.telefono} /> : CLIENTE.telefono) : "—"}</div></div>
          <div className="demo-field"><label>Correo *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? (llenandoAhora ? <Typewriter texto={CLIENTE.correo} /> : CLIENTE.correo) : "—"}</div></div>
        </div>
        {lleno && <p className="demo-hint-verde demo-entra">Cliente nuevo — se registrará automáticamente.</p>}
      </div>
      <div className="demo-section">
        <h5>Productos</h5>
        <div className="demo-field-grid three">
          <div className="demo-field"><label>Producto *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? (llenandoAhora ? <Typewriter texto={VENTA.producto} /> : VENTA.producto) : "—"}</div></div>
          <div className="demo-field"><label>Cantidad *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? `${VENTA.cantidad} unidad(es)` : "—"}</div></div>
          <div className="demo-field"><label>Precio unitario</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? formatoCOP(VENTA.precio) : "—"}</div></div>
        </div>
        <div className="demo-total-row">
          <div className="demo-field"><label>Método de pago *</label><div className="valor">Efectivo</div></div>
          <span className="demo-total-val">Total: {lleno ? (llenandoAhora ? <Contador valor={TOTAL_VENTA} formato={formatoCOP} /> : formatoCOP(TOTAL_VENTA)) : "$0"}</span>
        </div>
      </div>
      {lleno && <span className="demo-btn-app demo-entra" data-cursor="ventas-guardar">Guardar venta</span>}
    </div>
  );
}

function contenidoInventario(cuadro: number, revelado: boolean) {
  const enRecetas = pasado(cuadro, 2, revelado);
  const abierta = cuadro === 3 && revelado;
  const abriendoAhora = cuadro === 2 && revelado;
  return (
    <div>
      <div className="demo-tabs">
        <span className={`demo-tab${enRecetas ? "" : " activo"}`}>Productos</span>
        <span className={`demo-tab${enRecetas ? " activo" : ""}`} data-cursor="inventario-tab-recetas">Recetas</span>
        <span className="demo-tab">Proveedores</span>
      </div>
      {!enRecetas ? (
        <>
          <div className="demo-content-head"><h4>Inventario</h4><span className="demo-btn-app" data-cursor="inventario-agregar">Agregar producto</span></div>
          {cuadro < 1 ? (
            <div className="demo-empty">Aún no tienes productos. Agrega el primero arriba.</div>
          ) : (
            <div className="demo-lista">
              {PRODUCTOS.map((p, i) => (
                <div key={p.id} className="demo-fila-app demo-entra" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="izq"><span className="thumb">{p.emoji}</span><div><div className="nombre">{p.nombre}</div><div className="categoria">{p.categoria}</div></div></div>
                  <div className="datos">
                    <div><span className="etq">Cantidad</span><span className="val">{p.cantidad} {p.unidad}</span></div>
                    <div><span className="etq">Costo</span><span className="val">{formatoCOP(p.costo)}</span></div>
                    <div><span className="etq">Precio</span><span className="val">{formatoCOP(p.precio)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="demo-content-head"><h4>Recetas</h4></div>
          <div className={`demo-fila-receta${abierta ? " abierta" : ""}`} data-cursor="inventario-fila-receta">
            <div className="head">
              <span className="thumb">🍔</span>
              <span className="nombre">Hamburguesa Clásica</span>
              <div className="derecha">
                <div className="num">{abriendoAhora ? <Contador valor={PRODUCIBLES} formato={(n) => `${n} unidades posibles`} /> : `${PRODUCIBLES} unidades posibles`}</div>
                <div className="sub">con el stock actual</div>
              </div>
              <span className="chevron">▾</span>
            </div>
            {abierta && (
              <div className="detalle">
                {Object.entries(RECETA_NECESITA).map(([id, n], i) => {
                  const p = PRODUCTOS.find((x) => x.id === id)!;
                  return (
                    <div key={id} className="insumo-fila demo-entra" style={{ animationDelay: `${i * 55}ms` }}>
                      <span>{p.emoji} {p.nombre}</span>
                      <span className="der">{p.cantidad} {p.unidad} en stock · usa {n} por unidad</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function contenidoCrm(cuadro: number, revelado: boolean) {
  if (cuadro < 1) {
    return (
      <div>
        <div className="demo-content-head"><h4>CRM</h4><span className="demo-btn-app">Agregar cliente</span></div>
        <div className="demo-fila-app simple" data-cursor="crm-fila-cliente">
          <div><div className="nombre">{CLIENTE.nombre}</div><div className="categoria">{CLIENTE.telefono}</div></div>
          <span className="demo-badge-etapa">Cerrado</span>
        </div>
      </div>
    );
  }
  const calificado = pasado(cuadro, 3, revelado);
  const calificandoAhora = cuadro === 3 && revelado;
  const interaccionAgregada = pasado(cuadro, 4, revelado);
  const interaccionAhora = cuadro === 4 && revelado;
  return (
    <div>
      <span className="demo-btn-volver">← Directorio</span>
      <div className="demo-ficha-cabecera">
        <div>
          <h4>{CLIENTE.nombre}</h4>
          <p className="sub">{CLIENTE.telefono} · {CLIENTE.correo}</p>
          <div className="demo-estrellas" data-cursor="crm-estrella-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`${calificado ? "llena" : ""}${calificandoAhora ? " demo-star-in" : ""}`}
                style={calificandoAhora ? { animationDelay: `${(n - 1) * 80}ms` } : undefined}
              >
                ★
              </span>
            ))}
          </div>
        </div>
        <span className="demo-badge-etapa">Cerrado</span>
      </div>
      {cuadro >= 2 && (
        <div className={`demo-section${cuadro === 2 ? " demo-entra" : ""}`}>
          <h5>Perfil de compra</h5>
          <div className="demo-perfil-grid">
            <div><span className="etq">Inversión total</span><span className="val">{cuadro === 2 ? <Contador valor={PERFIL.inversion} formato={formatoCOP} /> : formatoCOP(PERFIL.inversion)}</span></div>
            <div><span className="etq">Ticket medio</span><span className="val">{cuadro === 2 ? <Contador valor={PERFIL.ticket} formato={formatoCOP} /> : formatoCOP(PERFIL.ticket)}</span></div>
            <div><span className="etq">Total de compras</span><span className="val">{PERFIL.totalCompras}</span></div>
            <div><span className="etq">Producto más comprado</span><span className="val">{PERFIL.productoMasComprado}</span></div>
          </div>
        </div>
      )}
      <div className="demo-section">
        <h5>Historial de compras</h5>
        <div className="demo-fila-compra">
          <span className="fecha">Hoy</span>
          <span className="resumen">{COMPRA.itemsDistintos} ítem(s), {COMPRA.unidadesTotales} unidad(es)</span>
          <span className="monto">{formatoCOP(COMPRA.monto)}</span>
        </div>
      </div>
      <div className="demo-section">
        <h5>Interacciones</h5>
        {interaccionAgregada ? (
          <div className="demo-fila-interaccion demo-entra">
            <div className="meta">Hoy · {INTERACCION.tipo}</div>
            <div className="nota">{interaccionAhora ? <Typewriter texto={INTERACCION.nota} /> : INTERACCION.nota}</div>
          </div>
        ) : (
          <p className="demo-faint">
            Sin interacciones registradas todavía.{" "}
            {cuadro === 4 && <span className="demo-link-mini" data-cursor="crm-agregar-interaccion">+ Registrar interacción</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function contenidoPyg(cuadro: number, revelado: boolean) {
  const conCifras = cuadro >= 1;
  const abonado = cuadro === 4 && revelado;
  const bruta = INGRESOS - COSTO_VENTAS;
  const gastosBase = GASTOS.reduce((s, g) => s + g.monto, 0);
  const gastosTotal = gastosBase + (abonado ? ABONO : 0);
  const neta = bruta - gastosTotal;
  const pagado = DEUDA.pagadoInicial + (abonado ? ABONO : 0);
  const pendiente = DEUDA.total - pagado;

  // Solo se anima la cifra el cuadro en que aparece o cambia de verdad —
  // el resto del tiempo se pinta estática para no "recontar" lo mismo.
  const primerCalculo = cuadro === 1;
  const cambiaPorAbono = cuadro === 4 && revelado;

  return (
    <div>
      <div className="demo-content-head"><h4>Estado de pérdidas y ganancias</h4></div>
      <p className="demo-rango">Mostrando del 1 jul 2026 al 31 jul 2026</p>
      <div className="demo-pyg-grid">
        <div className="demo-section">
          <h5>Utilidad</h5>
          <div className="demo-pyg-linea"><span>Ingresos por ventas</span><span>{conCifras ? (primerCalculo ? <Contador valor={INGRESOS} formato={formatoCOP} /> : formatoCOP(INGRESOS)) : "$0"}</span></div>
          <div className="demo-pyg-linea"><span>Costo de ventas</span><span>− {conCifras ? (primerCalculo ? <Contador valor={COSTO_VENTAS} formato={formatoCOP} /> : formatoCOP(COSTO_VENTAS)) : "$0"}</span></div>
          <div className="demo-pyg-linea sub"><span>Utilidad bruta</span><span>{conCifras ? (primerCalculo ? <Contador valor={bruta} formato={formatoCOP} /> : formatoCOP(bruta)) : "$0"}</span></div>
          <div className="demo-pyg-linea"><span>Gastos operacionales</span><span>− {conCifras ? ((primerCalculo || cambiaPorAbono) ? <Contador valor={gastosTotal} formato={formatoCOP} /> : formatoCOP(gastosTotal)) : "$0"}</span></div>
          <div className="demo-pyg-linea neta"><span>Utilidad neta</span><span className={conCifras && neta >= 0 ? "positivo" : ""}>{conCifras ? ((primerCalculo || cambiaPorAbono) ? <Contador valor={neta} formato={formatoCOP} /> : formatoCOP(neta)) : "$0"}</span></div>
        </div>
        <div className="demo-section">
          <h5>Deudas pendientes</h5>
          <div className="demo-deuda-total">{cuadro >= 2 ? ((cuadro === 2 || cambiaPorAbono) ? <Contador valor={pendiente} formato={formatoCOP} /> : formatoCOP(pendiente)) : "$0"}</div>
          <p className="demo-faint">No hace parte de la utilidad — es dinero que debes, se muestra aparte.</p>
          {cuadro >= 2 && (
            <>
              <div className="demo-fila-deuda"><span>{DEUDA.desc}</span><span className="monto">{formatoCOP(pendiente)}</span></div>
              {!abonado && <span className="demo-link-mini" data-cursor="pyg-abonar">+ Registrar abono</span>}
            </>
          )}
        </div>
      </div>
      <div className="demo-section">
        <h5>Gastos operacionales</h5>
        {cuadro >= 3 ? (
          [...GASTOS, ...(abonado ? [{ cat: "Pago de deuda", monto: ABONO, tipo: "Costo puntual", meta: "Abono — " + DEUDA.desc }] : [])].map((g, i) => (
            <div
              key={i}
              className={`demo-fila-gasto${(cuadro === 3 || "meta" in g) ? " demo-entra" : ""}`}
              style={cuadro === 3 ? { animationDelay: `${i * 70}ms` } : undefined}
            >
              <div><div className="cat">{g.cat}</div>{"meta" in g && <div className="meta">{(g as { meta: string }).meta}</div>}</div>
              <div className="der"><div className="monto">{formatoCOP(g.monto)}</div><div className="tipo">{g.tipo}</div></div>
            </div>
          ))
        ) : (
          <p className="demo-faint">No hay gastos registrados en este período.</p>
        )}
      </div>
    </div>
  );
}

function contenidoPanel(cuadro: number) {
  const resumenTexto =
    "El sábado vendiste 2,5× más que un día normal — tu día más fuerte de la semana.";
  return (
    <div>
      <div className="demo-tabs">
        <span className="demo-tab activo">Gráficas</span>
        <span className="demo-tab demo-tab-disabled">Insights <span className="mini">Próximamente</span></span>
      </div>
      {cuadro >= 3 && (
        <div className={`demo-resumen-ia${cuadro === 3 ? " demo-entra" : ""}`}>
          <div className="titulo">Resumen del día</div>
          {cuadro === 3 ? <Typewriter texto={resumenTexto} /> : resumenTexto}
        </div>
      )}
      {cuadro >= 1 && (
        <div className="demo-section">
          <h5>Ventas por día de la semana</h5>
          <ChartBars items={DIAS.map((d) => ({ label: d.d, valor: d.v, activo: d.activo }))} animar={cuadro === 1} />
        </div>
      )}
      {cuadro >= 2 && (
        <div className="demo-section">
          <h5>Gasto por categoría</h5>
          <ChartBars items={GASTOS_CAT.map((g) => ({ label: g.c, valor: g.v }))} animar={cuadro === 2} />
        </div>
      )}
    </div>
  );
}

function contenidoNomina(cuadro: number, revelado: boolean) {
  const enPeriodos = pasado(cuadro, 2, revelado);
  const pagado = pasado(cuadro, 3, revelado);
  const generandoAhora = cuadro === 2 && revelado;
  return (
    <div>
      <div className="demo-tabs">
        <span className={`demo-tab${enPeriodos ? "" : " activo"}`}>Empleados</span>
        <span className={`demo-tab${enPeriodos ? " activo" : ""}`} data-cursor="nomina-tab-periodos">Períodos</span>
      </div>
      {!enPeriodos ? (
        <>
          <div className="demo-content-head"><h4>Empleados</h4><span className="demo-btn-app" data-cursor="nomina-agregar">Agregar empleado</span></div>
          {cuadro < 1 ? (
            <div className="demo-empty">Todavía no tienes empleados. Agrega el primero arriba.</div>
          ) : (
            <div className="demo-fila-app simple demo-entra">
              <div><div className="nombre">{EMPLEADO.nombre}</div><div className="categoria">{EMPLEADO.cargo}</div></div>
              <span className="derecha">{cuadro === 1 ? <Contador valor={EMPLEADO.salario} formato={(n) => `${formatoCOP(n)}/mes`} /> : `${formatoCOP(EMPLEADO.salario)}/mes`}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="demo-content-head"><h4>Períodos de nómina</h4><span className="demo-btn-app">Generar nómina</span></div>
          <div className="demo-fila-app simple">
            <div><div className="nombre">{PERIODO_NOMINA.rango}</div><div className="categoria">Pago: {PERIODO_NOMINA.pago}</div></div>
            <span className={`demo-badge-etapa${pagado ? " pagada" : ""}`}>{pagado ? "Pagada" : "Borrador"}</span>
          </div>
          <table className="demo-tabla-nomina">
            <thead><tr><th>Empleado</th><th>Devengado</th><th>Deducido</th><th>Neto</th></tr></thead>
            <tbody>
              <tr>
                <td><b>{EMPLEADO.nombre}</b><br /><span className="faint">{EMPLEADO.cargo}</span></td>
                <td>{generandoAhora ? <Contador valor={NOMINA_DEVENGADO} formato={formatoCOP} /> : formatoCOP(NOMINA_DEVENGADO)}</td>
                <td>{generandoAhora ? <Contador valor={NOMINA_DEDUCIDO} formato={formatoCOP} /> : formatoCOP(NOMINA_DEDUCIDO)}</td>
                <td><b>{generandoAhora ? <Contador valor={NOMINA_NETO} formato={formatoCOP} /> : formatoCOP(NOMINA_NETO)}</b></td>
              </tr>
            </tbody>
          </table>
          <div className="demo-nomina-totales">
            <div><span className="etq">Neto a empleados</span><span className="val">{formatoCOP(NOMINA_NETO)}</span></div>
            <div><span className="etq">Aportes patronales</span><span className="val">{generandoAhora ? <Contador valor={DETALLE_NOMINA.aportes} formato={formatoCOP} /> : formatoCOP(DETALLE_NOMINA.aportes)}</span></div>
            <div><span className="etq">Prestaciones provisionadas</span><span className="val">{generandoAhora ? <Contador valor={DETALLE_NOMINA.prestaciones} formato={formatoCOP} /> : formatoCOP(DETALLE_NOMINA.prestaciones)}</span></div>
            <div><span className="etq">Costo total del período</span><span className="val">{formatoCOP(NOMINA_NETO + DETALLE_NOMINA.aportes + DETALLE_NOMINA.prestaciones)}</span></div>
          </div>
          {pagado ? (
            <p className="demo-nota-verde demo-entra">Esto ya generó los gastos de nómina, aportes patronales y prestaciones automáticamente en el Estado de P y G.</p>
          ) : (
            <span className="demo-btn-app" data-cursor="nomina-marcar-pagada">Marcar como pagada</span>
          )}
        </>
      )}
    </div>
  );
}

function contenidoPromociones(cuadro: number, revelado: boolean) {
  const enDetalle = pasado(cuadro, 1, revelado);
  if (!enDetalle) {
    return (
      <div>
        <div className="demo-content-head"><h4>Promociones</h4><span className="demo-btn-app" data-cursor="promo-agregar">Agregar promoción</span></div>
        {cuadro < 1 ? (
          <div className="demo-empty">Todavía no tienes promociones registradas.</div>
        ) : (
          <div className="demo-fila-app simple demo-entra" data-cursor="promo-fila">
            <div><div className="nombre">{PROMO.nombre}</div><div className="categoria">{PROMO.tipo} · {PROMO.codigo} · 1 jul a 31 jul 2026</div></div>
            <span className="demo-estado-promo">Activa ahora</span>
          </div>
        )}
      </div>
    );
  }
  const desempenoVisible = pasado(cuadro, 3, revelado);
  return (
    <div>
      <span className="demo-btn-volver">← Volver a promociones</span>
      <div className="demo-ficha-cabecera">
        <div><h4>{PROMO.nombre}</h4><p className="sub">{PROMO.tipo} · {PROMO.codigo}</p></div>
        <span className="demo-estado-promo">Activa ahora</span>
      </div>
      <div className="demo-perfil-grid">
        <div><span className="etq">Período</span><span className="val">1 jul 2026 a 31 jul 2026</span></div>
        <div><span className="etq">Aplica a</span><span className="val">Hamburguesa Clásica</span></div>
      </div>
      <div className="demo-section">
        <h5>Desempeño</h5>
        {!desempenoVisible ? (
          <p className="demo-faint">Todavía no se ha usado esta promoción en ninguna venta.</p>
        ) : (
          <div className="demo-perfil-grid demo-entra">
            <div><span className="etq">Ventas con este descuento</span><span className="val"><Contador valor={DESEMPENO_PROMO.ventas} /></span></div>
            <div><span className="etq">Ingresos de esas ventas</span><span className="val"><Contador valor={DESEMPENO_PROMO.ingresos} formato={formatoCOP} /></span></div>
            <div><span className="etq">Ticket promedio</span><span className="val"><Contador valor={DESEMPENO_PROMO.ticketPromedio} formato={formatoCOP} /></span></div>
            <div><span className="etq">Unidades con descuento</span><span className="val"><Contador valor={DESEMPENO_PROMO.unidades} /></span></div>
            <div><span className="etq">Dinero regalado/descontado</span><span className="val"><Contador valor={DESEMPENO_PROMO.descuentoTotal} formato={formatoCOP} /></span></div>
            <div><span className="etq">Ventas totales del período</span><span className="val"><Contador valor={DESEMPENO_PROMO.ventasTotalesPeriodo} formato={formatoCOP} /></span></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Contenido({ moduloId, cuadro, revelado }: { moduloId: string; cuadro: number; revelado: boolean }) {
  switch (moduloId) {
    case "Ventas": return contenidoVentas(cuadro, revelado);
    case "Inventario": return contenidoInventario(cuadro, revelado);
    case "CRM": return contenidoCrm(cuadro, revelado);
    case "P y G": return contenidoPyg(cuadro, revelado);
    case "Panel de control": return contenidoPanel(cuadro);
    case "Nómina": return contenidoNomina(cuadro, revelado);
    case "Promociones": return contenidoPromociones(cuadro, revelado);
    default: return null;
  }
}

type EstadoDemo = { indiceModulo: number; cuadro: number; revelado: boolean };
type CursorState = { x: number; y: number; visible: boolean; clic: boolean };

export function EcosistemaDemo() {
  // Un solo estado para módulo + cuadro + revelado: así el avance
  // automático (y el reinicio de "revelado" que trae cada cuadro nuevo)
  // es una sola actualización atómica.
  const [estado, setEstado] = useState<EstadoDemo>({ indiceModulo: 0, cuadro: 0, revelado: false });
  const { indiceModulo, cuadro } = estado;
  const reduceMotionRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, visible: false, clic: false });

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (reduceMotionRef.current) return;
    const intervalo = setInterval(() => {
      setEstado(({ indiceModulo: iActual, cuadro: cActual }) => {
        const modulo = MODULOS[iActual];
        if (cActual < modulo.totalCuadros - 1) {
          return { indiceModulo: iActual, cuadro: cActual + 1, revelado: false };
        }
        // El módulo se repite solo por ahora — pasar al siguiente módulo
        // automáticamente se ajusta más adelante.
        return { indiceModulo: iActual, cuadro: 0, revelado: false };
      });
    }, MS_POR_CUADRO);
    return () => clearInterval(intervalo);
  }, []);

  const modulo = MODULOS[indiceModulo];
  const objetivoActual = objetivoCursor(modulo.id, cuadro);
  // Si este cuadro no tiene nada que "clickear", ya está revelado de
  // entrada; si sí lo tiene, depende de que el clic simulado haya
  // terminado (estado.revelado, que solo un setTimeout pone en true).
  const revelado = estado.revelado || !objetivoActual;

  // Mueve el cursor simulado hasta el objetivo de este cuadro, "hace
  // clic" (un pulso), y solo entonces libera lo nuevo de este cuadro.
  useLayoutEffect(() => {
    if (reduceMotionRef.current || !objetivoActual) return;
    const contenedor = bodyRef.current;
    const el = contenedor?.querySelector(`[data-cursor="${objetivoActual}"]`);
    if (!contenedor || !el) {
      const id = setTimeout(() => setEstado((e) => ({ ...e, revelado: true })), 0);
      return () => clearTimeout(id);
    }
    const cBox = contenedor.getBoundingClientRect();
    const eBox = el.getBoundingClientRect();
    const x = eBox.left - cBox.left + eBox.width / 2;
    const y = eBox.top - cBox.top + eBox.height / 2;
    const idMover = setTimeout(() => setCursor({ x, y, visible: true, clic: false }), 0);
    const idClic = setTimeout(() => setCursor((c) => ({ ...c, clic: true })), MOVER_MS);
    const idRevela = setTimeout(() => {
      setCursor((c) => ({ ...c, clic: false }));
      setEstado((e) => ({ ...e, revelado: true }));
    }, MOVER_MS + CLIC_PAUSA_MS);
    return () => {
      clearTimeout(idMover);
      clearTimeout(idClic);
      clearTimeout(idRevela);
    };
  }, [indiceModulo, cuadro, objetivoActual]);

  function saltarAModulo(i: number) {
    setEstado({ indiceModulo: i, cuadro: 0, revelado: false });
  }

  return (
    <div className="demo-wrap">
      <div className="demo-tabs-modulos" role="tablist" aria-label="Módulos de Datum">
        {MODULOS.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={i === indiceModulo}
            className={`demo-tab-modulo${i === indiceModulo ? " activo" : ""}`}
            onClick={() => saltarAModulo(i)}
          >
            <span className="icono">{m.icono}</span>
            {m.nombre}
          </button>
        ))}
      </div>

      <div className="app-frame">
        <div className="app-chrome">
          <span className="app-dot" /><span className="app-dot" /><span className="app-dot" />
          <span className="app-url">{modulo.url}</span>
          <span className="app-progreso">
            {Array.from({ length: modulo.totalCuadros }).map((_, i) => (
              <span key={i} className={i === cuadro ? "activo" : ""} />
            ))}
          </span>
        </div>
        <div className="app-body" ref={bodyRef}>
          <AppSidebar activo={modulo.id === "P y G" ? "Estado P y G" : modulo.id} />
          <div className="app-content" key={modulo.id}>
            <Contenido moduloId={modulo.id} cuadro={cuadro} revelado={revelado} />
          </div>
          {cursor.visible && (
            <div
              className={`demo-cursor${cursor.clic ? " clic" : ""}`}
              style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 3 L5 19 L9.5 15 L12.2 21 L14.8 19.8 L12.1 13.8 L18 13.5 Z" fill="#1a1b33" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              <span className="demo-cursor-anillo" />
            </div>
          )}
        </div>
      </div>

      <p className="demo-highlights">
        {modulo.highlights.map((h, i) => (
          <span key={i}>{i > 0 && " · "}✓ {h}</span>
        ))}
      </p>
    </div>
  );
}
