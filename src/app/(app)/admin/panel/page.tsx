import { Suspense } from "react";
import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { GraficoBarras, type Barra } from "@/app/(app)/insights/graficos";
import { VariacionBadge } from "@/app/(app)/insights/variacion";
import { calcularRango, type Periodo } from "@/lib/periodos";
import { FiltroPeriodo } from "./filtro-periodo";

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function nombreMes(mes: string) {
  const [anio, mesNum] = mes.split("-");
  return new Date(Number(anio), Number(mesNum) - 1, 1).toLocaleDateString("es-CO", {
    month: "short",
    year: "2-digit",
  });
}

function sumarDiasIso(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function ContenidoPanelDatum({
  searchParams,
}: {
  searchParams: { periodo?: string; desde?: string; hasta?: string };
}) {
  const supabase = await createClient();

  const { periodo = "todo", desde: desdeParam, hasta: hastaParam } = searchParams;
  const rango = calcularRango(periodo as Periodo, desdeParam, hastaParam);
  const hayComparacion = Boolean(rango);

  let leadsQuery = supabase.from("datum_leads").select("id, etapa_id");
  if (rango) {
    leadsQuery = leadsQuery
      .gte("created_at", `${rango.desde}T00:00:00`)
      .lt("created_at", `${sumarDiasIso(rango.hasta, 1)}T00:00:00`);
  }

  let movimientosQuery = supabase.from("datum_movimientos").select("tipo, categoria, monto, fecha");
  if (rango) {
    movimientosQuery = movimientosQuery.gte("fecha", rango.desde).lte("fecha", rango.hasta);
  }

  const [
    { data: etapas, error: errorEtapas },
    { data: leads, error: errorLeads },
    { data: movimientos, error: errorMovimientos },
    { data: pasivos, error: errorPasivos },
  ] = await Promise.all([
    supabase.from("datum_crm_etapas").select("id, nombre, orden, es_cierre").order("orden"),
    leadsQuery,
    movimientosQuery,
    supabase.from("datum_pasivos").select("monto_total, monto_pagado, estado"),
  ]);

  const error = errorEtapas || errorLeads || errorMovimientos || errorPasivos;

  const listaEtapas = etapas ?? [];
  const listaLeads = leads ?? [];
  const listaMovimientos = movimientos ?? [];
  const listaPasivos = pasivos ?? [];

  const totalLeads = listaLeads.length;
  const etapaCierre = listaEtapas.find((e) => e.es_cierre);
  const leadsCerrados = etapaCierre
    ? listaLeads.filter((l) => l.etapa_id === etapaCierre.id).length
    : 0;
  const tasaConversion = totalLeads > 0 ? Math.round((leadsCerrados / totalLeads) * 100) : 0;

  const deudaPendiente = listaPasivos
    .filter((p) => p.estado !== "pagado")
    .reduce((suma, p) => suma + (p.monto_total - p.monto_pagado), 0);

  const ingresos = listaMovimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((suma, m) => suma + Number(m.monto), 0);
  const gastos = listaMovimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((suma, m) => suma + Number(m.monto), 0);
  const utilidad = ingresos - gastos;

  const barrasLeads: Barra[] = listaEtapas.map((etapa) => {
    const cantidad = listaLeads.filter((l) => l.etapa_id === etapa.id).length;
    return {
      etiqueta: etapa.nombre,
      valor: cantidad,
      textoValor: String(cantidad),
      tono: etapa.es_cierre ? "positivo" : "default",
    };
  });

  const gastosPorCategoria = new Map<string, number>();
  for (const m of listaMovimientos) {
    if (m.tipo !== "gasto") continue;
    const categoria = m.categoria || "Sin categoría";
    gastosPorCategoria.set(categoria, (gastosPorCategoria.get(categoria) ?? 0) + Number(m.monto));
  }
  const barrasGastos: Barra[] = Array.from(gastosPorCategoria.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([categoria, monto]) => ({
      etiqueta: categoria,
      valor: monto,
      textoValor: formatoMoneda(monto),
    }));

  const mesesMap = new Map<string, { ingresos: number; gastos: number }>();
  for (const m of listaMovimientos) {
    const mes = m.fecha.slice(0, 7);
    const actual = mesesMap.get(mes) ?? { ingresos: 0, gastos: 0 };
    if (m.tipo === "ingreso") actual.ingresos += Number(m.monto);
    else actual.gastos += Number(m.monto);
    mesesMap.set(mes, actual);
  }
  const barrasUtilidad: Barra[] = Array.from(mesesMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([mes, { ingresos: ingresosMes, gastos: gastosMes }]) => {
      const utilidadMes = ingresosMes - gastosMes;
      return {
        etiqueta: nombreMes(mes),
        valor: utilidadMes,
        textoValor: formatoMoneda(utilidadMes),
        tono: utilidadMes >= 0 ? "positivo" : "negativo",
      };
    });

  // Comparación contra el período anterior — solo se calcula (y se muestra)
  // cuando hay un filtro de fecha explícito, igual que el Panel de control
  // que ven las empresas clientes.
  let totalLeadsAnterior = 0;
  let utilidadAnterior = 0;
  let gastosAnterior = 0;

  if (rango) {
    const [{ data: leadsAnteriorData }, { data: movimientosAnteriorData }] = await Promise.all([
      supabase
        .from("datum_leads")
        .select("id")
        .gte("created_at", `${rango.desdeAnterior}T00:00:00`)
        .lt("created_at", `${sumarDiasIso(rango.hastaAnterior, 1)}T00:00:00`),
      supabase
        .from("datum_movimientos")
        .select("tipo, monto")
        .gte("fecha", rango.desdeAnterior)
        .lte("fecha", rango.hastaAnterior),
    ]);

    totalLeadsAnterior = (leadsAnteriorData ?? []).length;

    const movimientosAnterior = movimientosAnteriorData ?? [];
    const ingresosAnterior = movimientosAnterior
      .filter((m) => m.tipo === "ingreso")
      .reduce((suma, m) => suma + Number(m.monto), 0);
    gastosAnterior = movimientosAnterior
      .filter((m) => m.tipo === "gasto")
      .reduce((suma, m) => suma + Number(m.monto), 0);
    utilidadAnterior = ingresosAnterior - gastosAnterior;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver al panel
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">Panel de control</h1>
        <p className="mt-1 text-sm text-gray-500">Cómo va Datum, con datos reales.</p>
      </div>

      <FiltroPeriodo periodoActual={periodo} />

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar datos: {error.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
          <h3 className="text-xs font-medium text-gray-700">Leads totales</h3>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-gray-900 sm:text-5xl">
            {totalLeads}
          </p>
          {hayComparacion && (
            <div className="mt-2">
              <VariacionBadge actual={totalLeads} anterior={totalLeadsAnterior} formato="numero" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
          <h3 className="text-xs font-medium text-gray-700">Tasa de cierre</h3>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-gray-900 sm:text-5xl">
            {tasaConversion}%
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {leadsCerrados} de {totalLeads} leads
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
          <h3 className="text-xs font-medium text-gray-700">Utilidad del período</h3>
          <p
            className={`mt-2 text-4xl font-semibold tabular-nums sm:text-5xl ${utilidad >= 0 ? "text-gray-900" : "text-red-600"}`}
          >
            {formatoMoneda(utilidad)}
          </p>
          {hayComparacion && (
            <div className="mt-2">
              <VariacionBadge actual={utilidad} anterior={utilidadAnterior} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
          <h3 className="text-xs font-medium text-gray-700">Deudas pendientes</h3>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-gray-900 sm:text-5xl">
            {formatoMoneda(deudaPendiente)}
          </p>
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-gray-700">Leads por etapa</h3>
            {hayComparacion && <VariacionBadge actual={totalLeads} anterior={totalLeadsAnterior} formato="numero" />}
          </div>
          {totalLeads === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay leads registrados en este período.</p>
          ) : (
            <GraficoBarras datos={barrasLeads} />
          )}
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-gray-700">Gastos por categoría</h3>
            {hayComparacion && <VariacionBadge actual={gastos} anterior={gastosAnterior} />}
          </div>
          {barrasGastos.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay gastos registrados en este período.</p>
          ) : (
            <GraficoBarras datos={barrasGastos} />
          )}
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-gray-700">Utilidad por mes</h3>
            {hayComparacion && <VariacionBadge actual={utilidad} anterior={utilidadAnterior} />}
          </div>
          {barrasUtilidad.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay gastos ni ingresos registrados.</p>
          ) : (
            <GraficoBarras datos={barrasUtilidad} />
          )}
        </div>
      </div>
    </div>
  );
}

export default async function PanelDatumPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  await requerirAdmin();
  const params = await searchParams;
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Cargando…</p>}>
      <ContenidoPanelDatum searchParams={params} />
    </Suspense>
  );
}
