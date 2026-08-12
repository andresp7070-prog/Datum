import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { GraficoBarras, type Barra } from "@/app/(app)/insights/graficos";

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

export default async function PanelDatumPage() {
  await requerirAdmin();
  const supabase = await createClient();

  const [
    { data: etapas, error: errorEtapas },
    { data: leads, error: errorLeads },
    { data: movimientos, error: errorMovimientos },
    { data: pasivos, error: errorPasivos },
  ] = await Promise.all([
    supabase.from("datum_crm_etapas").select("id, nombre, orden, es_cierre").order("orden"),
    supabase.from("datum_leads").select("id, etapa_id"),
    supabase.from("datum_movimientos").select("tipo, categoria, monto, fecha"),
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

  const hoy = new Date();
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const movimientosMes = listaMovimientos.filter((m) => m.fecha >= inicioMes);
  const ingresosMes = movimientosMes
    .filter((m) => m.tipo === "ingreso")
    .reduce((suma, m) => suma + Number(m.monto), 0);
  const gastosMes = movimientosMes
    .filter((m) => m.tipo === "gasto")
    .reduce((suma, m) => suma + Number(m.monto), 0);
  const utilidadMes = ingresosMes - gastosMes;

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
    .slice(-6)
    .map(([mes, { ingresos, gastos }]) => {
      const utilidad = ingresos - gastos;
      return {
        etiqueta: nombreMes(mes),
        valor: utilidad,
        textoValor: formatoMoneda(utilidad),
        tono: utilidad >= 0 ? "positivo" : "negativo",
      };
    });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver al panel
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">Panel de control</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar datos: {error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Leads totales</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totalLeads}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Tasa de cierre</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{tasaConversion}%</p>
          <p className="mt-1 text-xs text-gray-400">
            {leadsCerrados} de {totalLeads} leads
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Utilidad este mes</p>
          <p
            className={`mt-1 text-2xl font-semibold ${utilidadMes >= 0 ? "text-green-700" : "text-red-600"}`}
          >
            {formatoMoneda(utilidadMes)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Deudas pendientes</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{formatoMoneda(deudaPendiente)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Leads por etapa</h2>
        {totalLeads === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay leads registrados.</p>
        ) : (
          <GraficoBarras datos={barrasLeads} />
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Utilidad por mes</h2>
        {barrasUtilidad.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay gastos ni ingresos registrados.</p>
        ) : (
          <GraficoBarras datos={barrasUtilidad} />
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Gastos por categoría</h2>
        {barrasGastos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay gastos registrados.</p>
        ) : (
          <GraficoBarras datos={barrasGastos} />
        )}
      </div>
    </div>
  );
}
