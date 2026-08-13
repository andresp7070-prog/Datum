import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerContextoPunto } from "@/lib/puntos";
import { PygTabs } from "./pyg-tabs";
import { SelectorRangoPyg } from "./selector-rango";
import { PagoRapidoDeuda } from "./pago-rapido-deuda";

type FilaResultados = {
  ingresos_por_ventas: number;
  costo_de_ventas: number;
  utilidad_bruta: number;
  otros_ingresos: number;
  gastos_operacionales: number;
  utilidad_neta: number;
};

type Pasivo = {
  id: string;
  descripcion: string;
  tipo: string | null;
  monto_total: number;
  monto_pagado: number;
  fecha_vencimiento: string | null;
  estado: string;
};

type MovimientoGasto = {
  id: string;
  categoria: string | null;
  monto: number;
  fecha: string;
  nota: string | null;
  recurrente: boolean;
  frecuencia: string | null;
};

function formatoMoneda(valor: number | null | undefined) {
  return (valor ?? 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function primerDiaMesActualIso() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function ultimoDiaMesActualIso() {
  const hoy = new Date();
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
}

function sumarUnDiaIso(fechaIso: string) {
  const d = new Date(`${fechaIso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatoFechaCorta(fechaIso: string) {
  return new Date(`${fechaIso}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PygPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde: desdeParam, hasta: hastaParam } = await searchParams;
  const desde = desdeParam || primerDiaMesActualIso();
  const hasta = hastaParam || ultimoDiaMesActualIso();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { puntoSeleccionado, puntosVenta } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    perfil.punto_venta_id,
  );
  const empresaUsaPuntos = puntosVenta.length > 0;

  // El estado de resultados se calcula directo de las tablas crudas para el
  // rango de fechas exacto elegido (con día, no solo mes) — la vista
  // vista_estado_resultados solo agrupa por mes completo, así que no sirve
  // para un rango arbitrario.
  let itemsQuery = supabase
    .from("ventas_items")
    .select("cantidad, precio_unitario, costo_unitario, ventas!inner ( fecha, empresa_id, punto_venta_id )")
    .eq("ventas.empresa_id", perfil.empresa_id)
    .gte("ventas.fecha", `${desde}T00:00:00`)
    .lt("ventas.fecha", `${sumarUnDiaIso(hasta)}T00:00:00`);

  if (puntoSeleccionado) itemsQuery = itemsQuery.eq("ventas.punto_venta_id", puntoSeleccionado);

  let finanzasQuery = supabase
    .from("finanzas_movimientos")
    .select("id, tipo, categoria, monto, fecha, nota, recurrente, frecuencia")
    .eq("empresa_id", perfil.empresa_id)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (puntoSeleccionado) finanzasQuery = finanzasQuery.eq("punto_venta_id", puntoSeleccionado);

  // pasivosData no depende del rango de fechas ni del punto — sale con las
  // otras dos.
  const [{ data: itemsData }, { data: finanzasData }, { data: pasivosData }] = await Promise.all([
    itemsQuery,
    finanzasQuery,
    supabase
      .from("pasivos")
      .select("id, descripcion, tipo, monto_total, monto_pagado, fecha_vencimiento, estado")
      .eq("empresa_id", perfil.empresa_id)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
  ]);

  let ingresos_por_ventas = 0;
  let costo_de_ventas = 0;
  for (const item of itemsData ?? []) {
    ingresos_por_ventas += Number(item.cantidad) * Number(item.precio_unitario);
    costo_de_ventas += Number(item.cantidad) * Number(item.costo_unitario ?? 0);
  }

  let otros_ingresos = 0;
  let gastos_operacionales = 0;
  const gastos: MovimientoGasto[] = [];
  for (const mov of finanzasData ?? []) {
    if (mov.tipo === "ingreso") {
      otros_ingresos += Number(mov.monto);
    } else {
      gastos_operacionales += Number(mov.monto);
      gastos.push({
        id: mov.id,
        categoria: mov.categoria,
        monto: Number(mov.monto),
        fecha: mov.fecha,
        nota: mov.nota,
        recurrente: mov.recurrente,
        frecuencia: mov.frecuencia,
      });
    }
  }
  gastos.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const utilidad_bruta = ingresos_por_ventas - costo_de_ventas;
  const fila: FilaResultados = {
    ingresos_por_ventas,
    costo_de_ventas,
    utilidad_bruta,
    otros_ingresos,
    gastos_operacionales,
    utilidad_neta: utilidad_bruta + otros_ingresos - gastos_operacionales,
  };

  const pasivos = (pasivosData ?? []) as Pasivo[];
  const totalPendiente = pasivos
    .filter((p) => p.estado !== "pagado")
    .reduce((suma, p) => suma + (p.monto_total - p.monto_pagado), 0);

  return (
    <div className="space-y-6">
      <PygTabs />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Estado de pérdidas y ganancias</h1>
        <div className="flex gap-2">
          <Link
            href="/pyg/movimientos"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Gastos e ingresos
          </Link>
          <Link
            href="/pyg/pasivos"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Deudas
          </Link>
        </div>
      </div>

      <div>
        <SelectorRangoPyg desde={desde} hasta={hasta} />
        <p className="mt-2 text-xs text-gray-400">
          Mostrando del {formatoFechaCorta(desde)} al {formatoFechaCorta(hasta)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Utilidad</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Ingresos por ventas</dt>
              <dd className="text-gray-900">{formatoMoneda(fila.ingresos_por_ventas)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Costo de ventas</dt>
              <dd className="text-gray-900">− {formatoMoneda(fila.costo_de_ventas)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-medium">
              <dt className="text-gray-700">Utilidad bruta</dt>
              <dd className="text-gray-900">{formatoMoneda(fila.utilidad_bruta)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Otros ingresos</dt>
              <dd className="text-gray-900">+ {formatoMoneda(fila.otros_ingresos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Gastos operacionales</dt>
              <dd className="text-gray-900">− {formatoMoneda(fila.gastos_operacionales)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
              <dt className="text-gray-900">Utilidad neta</dt>
              <dd className={fila.utilidad_neta >= 0 ? "text-green-700" : "text-red-600"}>
                {formatoMoneda(fila.utilidad_neta)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Deudas pendientes</h2>
            <Link href="/pyg/pasivos" className="text-xs text-gray-500 hover:text-gray-700">
              Ver todas
            </Link>
          </div>
          <p className="text-base font-semibold text-gray-900">{formatoMoneda(totalPendiente)}</p>
          <p className="mb-3 text-xs text-gray-400">
            No hace parte de la utilidad — es dinero que debes, se muestra aparte.
          </p>
          {pasivos.filter((p) => p.estado !== "pagado").length === 0 ? (
            <p className="text-sm text-gray-400">No tienes deudas pendientes registradas.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 text-sm">
                {pasivos
                  .filter((p) => p.estado !== "pagado")
                  .slice(0, 5)
                  .map((p) => (
                    <li key={p.id} className="flex justify-between py-1.5">
                      <span className="text-gray-700">{p.descripcion}</span>
                      <span className="text-gray-900">
                        {formatoMoneda(p.monto_total - p.monto_pagado)}
                      </span>
                    </li>
                  ))}
              </ul>
              <PagoRapidoDeuda pasivos={pasivos.filter((p) => p.estado !== "pagado")} />
            </>
          )}
        </div>
      </div>

      {empresaUsaPuntos && (
        <p className="text-xs text-gray-400">
          El desglose de utilidad por categoría y por producto se ve en Panel de control — ahí sí
          se puede combinar con otros filtros.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Gastos operacionales</h2>
          <Link href="/pyg/movimientos" className="text-xs text-gray-500 hover:text-gray-700">
            Ver todos
          </Link>
        </div>
        <p className="mb-4 text-xs text-gray-400">
          Del {formatoFechaCorta(desde)} al {formatoFechaCorta(hasta)} — total {formatoMoneda(fila.gastos_operacionales)}.
        </p>
        {gastos.length === 0 ? (
          <p className="text-sm text-gray-400">No hay gastos registrados en este período.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {gastos.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-gray-900">{g.categoria || "Sin categoría"}</p>
                  <p className="text-xs text-gray-400">
                    {formatoFechaCorta(g.fecha)}
                    {g.nota ? ` · ${g.nota}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatoMoneda(g.monto)}</p>
                  <p className="text-xs text-gray-400">
                    {g.recurrente
                      ? `Recurrente${g.frecuencia ? ` · ${g.frecuencia}` : ""}`
                      : "Costo puntual"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
