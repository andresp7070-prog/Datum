"use client";

import { useEffect, useRef, useState } from "react";

// Recrea, dentro de la landing, la presentación comercial interactiva
// (presentacion-comercial/index.html) — mismos 7 módulos, mismos datos de
// ejemplo (hamburguesería), mismos pasos. Ahí es clic-a-clic para una
// reunión en vivo; acá avanza sola de corrido (respetando
// prefers-reduced-motion) y un clic en un módulo salta directo a él.

const MS_POR_CUADRO = 2600;

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
  hints: string[];
  highlights: string[];
};

const MODULOS: Modulo[] = [
  {
    id: "Ventas",
    nombre: "Ventas",
    icono: "🧾",
    url: "app.datum.co/ventas",
    totalCuadros: 5,
    hints: [
      "Agregando una venta...",
      "Completando cliente y producto...",
      "Guardando la venta...",
      "Actualizando el historial...",
      "Un momento...",
    ],
    highlights: ["Una sola pantalla", "El cliente se busca solo", "Un clic, todo queda registrado"],
  },
  {
    id: "Inventario",
    nombre: "Inventario",
    icono: "📦",
    url: "app.datum.co/inventario",
    totalCuadros: 4,
    hints: [
      "Agregando los insumos...",
      "Creando la receta...",
      "Calculando los ingredientes...",
      "Un momento...",
    ],
    highlights: ["Alta manual o masiva", "Recetas con cálculo automático", "Nunca se calcula a mano"],
  },
  {
    id: "CRM",
    nombre: "CRM",
    icono: "🤝",
    url: "app.datum.co/crm",
    totalCuadros: 5,
    hints: [
      "Abriendo la ficha del cliente...",
      "Cargando el perfil de compra...",
      "Calificando al cliente...",
      "Registrando una interacción...",
      "Un momento...",
    ],
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
    hints: [
      "Calculando la utilidad del mes...",
      "Cargando las deudas pendientes...",
      "Cargando el detalle de gastos...",
      "Abonando a la deuda...",
      "Un momento...",
    ],
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
    hints: [
      "Cargando las ventas por día...",
      "Cargando el gasto por categoría...",
      "Generando el resumen del día...",
      "Un momento...",
    ],
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
    hints: [
      "Agregando el primer empleado...",
      "Generando el período de nómina...",
      "Marcando el período como pagado...",
      "Un momento...",
    ],
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
    hints: [
      "Cargando la promoción de julio...",
      "Abriendo el detalle...",
      "Cargando su desempeño...",
      "Un momento...",
    ],
    highlights: [
      "El 2x1 se descuenta solo, sin cálculos manuales",
      "Compara la campaña contra el resto del período",
      "Un clic y ves todo su desempeño",
    ],
  },
];

// --- Datos de ejemplo (hamburguesería) — mismos que la presentación comercial ---

const CLIENTE = { nombre: "Camila Ruiz", telefono: "3001234567", correo: "camila.ruiz@gmail.com" };
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

function ChartBars({ items, activoLabel }: { items: { label: string; valor: number; activo?: boolean }[]; activoLabel?: string }) {
  const max = Math.max(...items.map((i) => i.valor));
  return (
    <div className="demo-chart-bars">
      {items.map((it) => (
        <div key={it.label} className="demo-chart-col">
          <span className="demo-chart-val">${Math.round(it.valor / 1000)}k</span>
          <span
            className={`demo-chart-bar${it.activo ? " es-activo" : ""}`}
            style={{ height: `${Math.round((it.valor / max) * 100)}%` }}
          />
          <span className="demo-chart-label">{it.label}</span>
        </div>
      ))}
      {activoLabel && <span className="sr-only">{activoLabel}</span>}
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

function contenidoVentas(cuadro: number) {
  if (cuadro <= 0) {
    return (
      <div>
        <div className="demo-tabs">
          <span className="demo-tab activo">Historial</span>
          <span className="demo-tab">Proyecciones</span>
          <span className="demo-tab">Importar</span>
        </div>
        <div className="demo-content-head"><h4>Ventas</h4><span className="demo-btn-app">Agregar venta</span></div>
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
          <div className="demo-stat-card"><span className="etq">Ventas de hoy</span><span className="val">1</span></div>
          <div className="demo-stat-card"><span className="etq">Vendido hoy</span><span className="val">{formatoCOP(TOTAL_VENTA)}</span></div>
        </div>
        <div className="demo-fila-venta demo-entra">
          <div>
            <div className="nombre">{CLIENTE.nombre}</div>
            <div className="fecha">Hoy</div>
            <div className="productos">{VENTA.producto} ×{VENTA.cantidad}</div>
          </div>
          <div className="derecha">
            <div className="monto">{formatoCOP(TOTAL_VENTA)}</div>
            <div className="metodo">{VENTA.metodo}</div>
          </div>
        </div>
      </div>
    );
  }
  const lleno = cuadro >= 2;
  return (
    <div>
      <div className="demo-content-head"><h4>Agregar venta</h4></div>
      {cuadro === 3 && (
        <div className="demo-success-banner"><span>Venta agregada correctamente.</span><span>Deshacer (60s)</span></div>
      )}
      <div className="demo-form-row">
        <div className="demo-field"><label>Fecha</label><div className="valor">Hoy</div></div>
        <div className="demo-field"><label>Hora</label><div className="valor">Ahora</div></div>
      </div>
      <div className="demo-section">
        <h5>Cliente</h5>
        <div className="demo-field-grid">
          <div className="demo-field"><label>Nombre *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? CLIENTE.nombre : "—"}</div></div>
          <div className="demo-field"><label>Teléfono *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? CLIENTE.telefono : "—"}</div></div>
          <div className="demo-field"><label>Correo *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? CLIENTE.correo : "—"}</div></div>
        </div>
        {lleno && <p className="demo-hint-verde">Cliente nuevo — se registrará automáticamente.</p>}
      </div>
      <div className="demo-section">
        <h5>Productos</h5>
        <div className="demo-field-grid three">
          <div className="demo-field"><label>Producto *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? VENTA.producto : "—"}</div></div>
          <div className="demo-field"><label>Cantidad *</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? `${VENTA.cantidad} unidad(es)` : "—"}</div></div>
          <div className="demo-field"><label>Precio unitario</label><div className={`valor${lleno ? "" : " vacio"}`}>{lleno ? formatoCOP(VENTA.precio) : "—"}</div></div>
        </div>
        <div className="demo-total-row">
          <div className="demo-field"><label>Método de pago *</label><div className="valor">Efectivo</div></div>
          <span className="demo-total-val">Total: {lleno ? formatoCOP(TOTAL_VENTA) : "$0"}</span>
        </div>
      </div>
      {lleno && cuadro !== 3 && <span className="demo-btn-app">Guardar venta</span>}
    </div>
  );
}

function contenidoInventario(cuadro: number) {
  const enRecetas = cuadro >= 2;
  return (
    <div>
      <div className="demo-tabs">
        <span className={`demo-tab${enRecetas ? "" : " activo"}`}>Productos</span>
        <span className={`demo-tab${enRecetas ? " activo" : ""}`}>Recetas</span>
        <span className="demo-tab">Proveedores</span>
      </div>
      {!enRecetas ? (
        <>
          <div className="demo-content-head"><h4>Inventario</h4><span className="demo-btn-app">Agregar producto</span></div>
          {cuadro < 1 ? (
            <div className="demo-empty">Aún no tienes productos. Agrega el primero arriba.</div>
          ) : (
            <div className="demo-lista">
              {PRODUCTOS.map((p) => (
                <div key={p.id} className="demo-fila-app">
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
          <div className={`demo-fila-receta${cuadro >= 3 ? " abierta" : ""}`}>
            <div className="head">
              <span className="thumb">🍔</span>
              <span className="nombre">Hamburguesa Clásica</span>
              <div className="derecha"><div className="num">{PRODUCIBLES} unidades posibles</div><div className="sub">con el stock actual</div></div>
              <span className="chevron">▾</span>
            </div>
            {cuadro >= 3 && (
              <div className="detalle">
                {Object.entries(RECETA_NECESITA).map(([id, n]) => {
                  const p = PRODUCTOS.find((x) => x.id === id)!;
                  return (
                    <div key={id} className="insumo-fila">
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

function contenidoCrm(cuadro: number) {
  if (cuadro < 1) {
    return (
      <div>
        <div className="demo-content-head"><h4>CRM</h4><span className="demo-btn-app">Agregar cliente</span></div>
        <div className="demo-fila-app simple">
          <div><div className="nombre">{CLIENTE.nombre}</div><div className="categoria">{CLIENTE.telefono}</div></div>
          <span className="demo-badge-etapa">Cerrado</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <span className="demo-btn-volver">← Directorio</span>
      <div className="demo-ficha-cabecera">
        <div>
          <h4>{CLIENTE.nombre}</h4>
          <p className="sub">{CLIENTE.telefono} · {CLIENTE.correo}</p>
          <div className="demo-estrellas">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={cuadro >= 3 && n <= 5 ? "llena" : ""}>★</span>
            ))}
          </div>
        </div>
        <span className="demo-badge-etapa">Cerrado</span>
      </div>
      {cuadro >= 2 && (
        <div className="demo-section">
          <h5>Perfil de compra</h5>
          <div className="demo-perfil-grid">
            <div><span className="etq">Inversión total</span><span className="val">{formatoCOP(PERFIL.inversion)}</span></div>
            <div><span className="etq">Ticket medio</span><span className="val">{formatoCOP(PERFIL.ticket)}</span></div>
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
        {cuadro >= 4 ? (
          <div className="demo-fila-interaccion demo-entra">
            <div className="meta">Hoy · {INTERACCION.tipo}</div>
            <div className="nota">{INTERACCION.nota}</div>
          </div>
        ) : (
          <p className="demo-faint">Sin interacciones registradas todavía.</p>
        )}
      </div>
    </div>
  );
}

function contenidoPyg(cuadro: number) {
  const conCifras = cuadro >= 1;
  const abonado = cuadro >= 4;
  const bruta = INGRESOS - COSTO_VENTAS;
  const gastosBase = GASTOS.reduce((s, g) => s + g.monto, 0);
  const gastosTotal = gastosBase + (abonado ? ABONO : 0);
  const neta = bruta - gastosTotal;
  const pagado = DEUDA.pagadoInicial + (abonado ? ABONO : 0);
  const pendiente = DEUDA.total - pagado;

  return (
    <div>
      <div className="demo-content-head"><h4>Estado de pérdidas y ganancias</h4></div>
      <p className="demo-rango">Mostrando del 1 jul 2026 al 31 jul 2026</p>
      <div className="demo-pyg-grid">
        <div className="demo-section">
          <h5>Utilidad</h5>
          <div className="demo-pyg-linea"><span>Ingresos por ventas</span><span>{conCifras ? formatoCOP(INGRESOS) : "$0"}</span></div>
          <div className="demo-pyg-linea"><span>Costo de ventas</span><span>− {conCifras ? formatoCOP(COSTO_VENTAS) : "$0"}</span></div>
          <div className="demo-pyg-linea sub"><span>Utilidad bruta</span><span>{conCifras ? formatoCOP(bruta) : "$0"}</span></div>
          <div className="demo-pyg-linea"><span>Gastos operacionales</span><span>− {conCifras ? formatoCOP(gastosTotal) : "$0"}</span></div>
          <div className="demo-pyg-linea neta"><span>Utilidad neta</span><span className={conCifras && neta >= 0 ? "positivo" : ""}>{conCifras ? formatoCOP(neta) : "$0"}</span></div>
        </div>
        <div className="demo-section">
          <h5>Deudas pendientes</h5>
          <div className="demo-deuda-total">{cuadro >= 2 ? formatoCOP(pendiente) : "$0"}</div>
          <p className="demo-faint">No hace parte de la utilidad — es dinero que debes, se muestra aparte.</p>
          {cuadro >= 2 && (
            <div className="demo-fila-deuda"><span>{DEUDA.desc}</span><span className="monto">{formatoCOP(pendiente)}</span></div>
          )}
        </div>
      </div>
      <div className="demo-section">
        <h5>Gastos operacionales</h5>
        {cuadro >= 3 ? (
          [...GASTOS, ...(abonado ? [{ cat: "Pago de deuda", monto: ABONO, tipo: "Costo puntual", meta: "Abono — " + DEUDA.desc }] : [])].map((g, i) => (
            <div key={i} className={`demo-fila-gasto${"meta" in g ? " demo-entra" : ""}`}>
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
  return (
    <div>
      <div className="demo-tabs">
        <span className="demo-tab activo">Gráficas</span>
        <span className="demo-tab demo-tab-disabled">Insights <span className="mini">Próximamente</span></span>
      </div>
      {cuadro >= 3 && (
        <div className="demo-resumen-ia">
          <div className="titulo">Resumen del día</div>
          El sábado vendiste 2,5 veces más que un día normal — tu día más fuerte de la semana, muy por encima del resto. El gasto operacional sigue concentrado en el arriendo, sin sorpresas este mes.
        </div>
      )}
      {cuadro >= 1 && (
        <div className="demo-section">
          <h5>Ventas por día de la semana</h5>
          <ChartBars items={DIAS.map((d) => ({ label: d.d, valor: d.v, activo: d.activo }))} />
        </div>
      )}
      {cuadro >= 2 && (
        <div className="demo-section">
          <h5>Gasto por categoría</h5>
          <ChartBars items={GASTOS_CAT.map((g) => ({ label: g.c, valor: g.v }))} />
        </div>
      )}
    </div>
  );
}

function contenidoNomina(cuadro: number) {
  const enPeriodos = cuadro >= 2;
  const pagado = cuadro >= 3;
  return (
    <div>
      <div className="demo-tabs">
        <span className={`demo-tab${enPeriodos ? "" : " activo"}`}>Empleados</span>
        <span className={`demo-tab${enPeriodos ? " activo" : ""}`}>Períodos</span>
      </div>
      {!enPeriodos ? (
        <>
          <div className="demo-content-head"><h4>Empleados</h4><span className="demo-btn-app">Agregar empleado</span></div>
          {cuadro < 1 ? (
            <div className="demo-empty">Todavía no tienes empleados. Agrega el primero arriba.</div>
          ) : (
            <div className="demo-fila-app simple demo-entra">
              <div><div className="nombre">{EMPLEADO.nombre}</div><div className="categoria">{EMPLEADO.cargo}</div></div>
              <span className="derecha">{formatoCOP(EMPLEADO.salario)}/mes</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="demo-content-head"><h4>Períodos de nómina</h4><span className="demo-btn-app">Generar nómina</span></div>
          <div className="demo-fila-app simple demo-entra">
            <div><div className="nombre">{PERIODO_NOMINA.rango}</div><div className="categoria">Pago: {PERIODO_NOMINA.pago}</div></div>
            <span className={`demo-badge-etapa${pagado ? " pagada" : ""}`}>{pagado ? "Pagada" : "Borrador"}</span>
          </div>
          <table className="demo-tabla-nomina">
            <thead><tr><th>Empleado</th><th>Devengado</th><th>Deducido</th><th>Neto</th></tr></thead>
            <tbody>
              <tr>
                <td><b>{EMPLEADO.nombre}</b><br /><span className="faint">{EMPLEADO.cargo}</span></td>
                <td>{formatoCOP(NOMINA_DEVENGADO)}</td>
                <td>{formatoCOP(NOMINA_DEDUCIDO)}</td>
                <td><b>{formatoCOP(NOMINA_NETO)}</b></td>
              </tr>
            </tbody>
          </table>
          <div className="demo-nomina-totales">
            <div><span className="etq">Neto a empleados</span><span className="val">{formatoCOP(NOMINA_NETO)}</span></div>
            <div><span className="etq">Aportes patronales</span><span className="val">{formatoCOP(DETALLE_NOMINA.aportes)}</span></div>
            <div><span className="etq">Prestaciones provisionadas</span><span className="val">{formatoCOP(DETALLE_NOMINA.prestaciones)}</span></div>
            <div><span className="etq">Costo total del período</span><span className="val">{formatoCOP(NOMINA_NETO + DETALLE_NOMINA.aportes + DETALLE_NOMINA.prestaciones)}</span></div>
          </div>
          {pagado ? (
            <p className="demo-nota-verde">Esto ya generó los gastos de nómina, aportes patronales y prestaciones automáticamente en el Estado de P y G.</p>
          ) : (
            <span className="demo-btn-app">Marcar como pagada</span>
          )}
        </>
      )}
    </div>
  );
}

function contenidoPromociones(cuadro: number) {
  if (cuadro < 2) {
    return (
      <div>
        <div className="demo-content-head"><h4>Promociones</h4><span className="demo-btn-app">Agregar promoción</span></div>
        {cuadro < 1 ? (
          <div className="demo-empty">Todavía no tienes promociones registradas.</div>
        ) : (
          <div className="demo-fila-app simple demo-entra">
            <div><div className="nombre">{PROMO.nombre}</div><div className="categoria">{PROMO.tipo} · {PROMO.codigo} · 1 jul a 31 jul 2026</div></div>
            <span className="demo-estado-promo">Activa ahora</span>
          </div>
        )}
      </div>
    );
  }
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
        {cuadro < 3 ? (
          <p className="demo-faint">Todavía no se ha usado esta promoción en ninguna venta.</p>
        ) : (
          <div className="demo-perfil-grid">
            <div><span className="etq">Ventas con este descuento</span><span className="val">{DESEMPENO_PROMO.ventas}</span></div>
            <div><span className="etq">Ingresos de esas ventas</span><span className="val">{formatoCOP(DESEMPENO_PROMO.ingresos)}</span></div>
            <div><span className="etq">Ticket promedio</span><span className="val">{formatoCOP(DESEMPENO_PROMO.ticketPromedio)}</span></div>
            <div><span className="etq">Unidades con descuento</span><span className="val">{DESEMPENO_PROMO.unidades}</span></div>
            <div><span className="etq">Dinero regalado/descontado</span><span className="val">{formatoCOP(DESEMPENO_PROMO.descuentoTotal)}</span></div>
            <div><span className="etq">Ventas totales del período</span><span className="val">{formatoCOP(DESEMPENO_PROMO.ventasTotalesPeriodo)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Contenido({ moduloId, cuadro }: { moduloId: string; cuadro: number }) {
  switch (moduloId) {
    case "Ventas": return contenidoVentas(cuadro);
    case "Inventario": return contenidoInventario(cuadro);
    case "CRM": return contenidoCrm(cuadro);
    case "P y G": return contenidoPyg(cuadro);
    case "Panel de control": return contenidoPanel(cuadro);
    case "Nómina": return contenidoNomina(cuadro);
    case "Promociones": return contenidoPromociones(cuadro);
    default: return null;
  }
}

export function EcosistemaDemo() {
  const [indiceModulo, setIndiceModulo] = useState(0);
  const [cuadro, setCuadro] = useState(0);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (reduceMotionRef.current) return;
    const intervalo = setInterval(() => {
      setCuadro((cActual) => {
        const modulo = MODULOS[indiceModulo];
        if (cActual < modulo.totalCuadros - 1) return cActual + 1;
        setIndiceModulo((iActual) => (iActual + 1) % MODULOS.length);
        return 0;
      });
    }, MS_POR_CUADRO);
    return () => clearInterval(intervalo);
  }, [indiceModulo]);

  function saltarAModulo(i: number) {
    setIndiceModulo(i);
    setCuadro(0);
  }

  const modulo = MODULOS[indiceModulo];

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
        <div className="app-body">
          <AppSidebar activo={modulo.id === "P y G" ? "Estado P y G" : modulo.id} />
          <div className="app-content" key={`${modulo.id}-${cuadro}`}>
            <Contenido moduloId={modulo.id} cuadro={cuadro} />
          </div>
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
