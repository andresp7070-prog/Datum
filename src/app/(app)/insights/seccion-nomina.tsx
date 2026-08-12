import { createClient } from "@/lib/supabase/server";
import { GraficoBarras, GraficoBarrasHorizontal, type Barra } from "./graficos";
import { VariacionBadge } from "./variacion";
import { primeraMayuscula } from "@/lib/texto";
import type { RangoFechas } from "@/lib/periodos";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatoMonedaCorta(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function etiquetaMesCorta(mes: string) {
  return primeraMayuscula(
    new Date(`${mes}-01T00:00:00`).toLocaleDateString("es-CO", { month: "short", year: "2-digit" }),
  );
}

function aBarras(mapa: Map<string, number>): Barra[] {
  return Array.from(mapa.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, valor]) => ({
      etiqueta: etiquetaMesCorta(mes),
      valor,
      textoValor: formatoMonedaCorta(valor),
    }));
}

// Totales de un período (sin desglose) — se usa solo para la comparativa
// contra el período anterior, ver calcularResumenNomina() para el desglose
// completo por mes/tipo que sí necesita el período actual.
async function calcularTotalesNomina(supabase: SupabaseClient, empresaId: string, desde: string, hasta: string) {
  const { data: periodosData } = await supabase
    .from("nomina_periodos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("estado", "pagado")
    .gte("fecha_pago", desde)
    .lte("fecha_pago", hasta);
  const ids = (periodosData ?? []).map((p) => p.id as string);
  if (ids.length === 0) return { sueldos: 0, aportes: 0, prestaciones: 0 };

  const { data: detallesData } = await supabase
    .from("nomina_detalles")
    .select("neto_pagado, total_aportes_patronales, provision_cesantias, provision_intereses_cesantias, provision_prima")
    .in("periodo_id", ids);

  let sueldos = 0;
  let aportes = 0;
  let prestaciones = 0;
  for (const d of detallesData ?? []) {
    sueldos += Number(d.neto_pagado);
    aportes += Number(d.total_aportes_patronales);
    prestaciones += Number(d.provision_cesantias) + Number(d.provision_intereses_cesantias) + Number(d.provision_prima);
  }
  return { sueldos, aportes, prestaciones };
}

export async function SeccionNomina({
  empresaId,
  rango,
}: {
  empresaId: string;
  rango: RangoFechas | null;
}) {
  const supabase = await createClient();
  const hayComparacion = Boolean(rango);

  const { count: empleadosActivos } = await supabase
    .from("empleados")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  // Criterio de caja: un período 'borrador' no es gasto real todavía — solo
  // cuentan los períodos ya marcados 'pagado' (mismo criterio que
  // marcar_nomina_pagada(), ver CLAUDE.md sección Nómina).
  let periodosQuery = supabase
    .from("nomina_periodos")
    .select("id, fecha_pago")
    .eq("empresa_id", empresaId)
    .eq("estado", "pagado");
  if (rango) {
    periodosQuery = periodosQuery.gte("fecha_pago", rango.desde).lte("fecha_pago", rango.hasta);
  }
  const { data: periodosData } = await periodosQuery;
  const periodos = periodosData ?? [];
  const mesPorPeriodo = new Map(periodos.map((p) => [p.id, p.fecha_pago.slice(0, 7)]));
  const idsPeriodos = periodos.map((p) => p.id);

  const [{ data: detallesData }, totalesAnteriores] = await Promise.all([
    idsPeriodos.length > 0
      ? supabase
          .from("nomina_detalles")
          .select(
            "periodo_id, neto_pagado, total_aportes_patronales, aporte_pension_patronal, aporte_arl, aporte_caja_compensacion, aporte_salud_patronal, aporte_icbf, aporte_sena, provision_cesantias, provision_intereses_cesantias, provision_prima",
          )
          .in("periodo_id", idsPeriodos)
      : Promise.resolve({ data: [] }),
    rango ? calcularTotalesNomina(supabase, empresaId, rango.desdeAnterior, rango.hastaAnterior) : Promise.resolve(null),
  ]);
  const detalles = detallesData ?? [];

  const sueldosPorMes = new Map<string, number>();
  const aportesPorMes = new Map<string, number>();
  const prestacionesPorMes = new Map<string, number>();
  let pension = 0;
  let arl = 0;
  let caja = 0;
  let salud = 0;
  let icbfSena = 0;
  let sueldosTotal = 0;
  let aportesTotal = 0;
  let prestacionesTotal = 0;

  for (const d of detalles) {
    const mes = mesPorPeriodo.get(d.periodo_id) ?? "otro";
    const prestacionesDetalle =
      Number(d.provision_cesantias) + Number(d.provision_intereses_cesantias) + Number(d.provision_prima);
    sueldosPorMes.set(mes, (sueldosPorMes.get(mes) ?? 0) + Number(d.neto_pagado));
    aportesPorMes.set(mes, (aportesPorMes.get(mes) ?? 0) + Number(d.total_aportes_patronales));
    prestacionesPorMes.set(mes, (prestacionesPorMes.get(mes) ?? 0) + prestacionesDetalle);
    pension += Number(d.aporte_pension_patronal);
    arl += Number(d.aporte_arl);
    caja += Number(d.aporte_caja_compensacion);
    salud += Number(d.aporte_salud_patronal);
    icbfSena += Number(d.aporte_icbf) + Number(d.aporte_sena);
    sueldosTotal += Number(d.neto_pagado);
    aportesTotal += Number(d.total_aportes_patronales);
    prestacionesTotal += prestacionesDetalle;
  }

  const barrasSueldos = aBarras(sueldosPorMes);
  const barrasAportes = aBarras(aportesPorMes);
  const barrasPrestaciones = aBarras(prestacionesPorMes);

  const barrasAportesPorTipo: Barra[] = [
    { etiqueta: "Pensión", valor: pension, textoValor: formatoMonedaCorta(pension) },
    { etiqueta: "ARL", valor: arl, textoValor: formatoMonedaCorta(arl) },
    { etiqueta: "Caja de compensación", valor: caja, textoValor: formatoMonedaCorta(caja) },
    { etiqueta: "Salud", valor: salud, textoValor: formatoMonedaCorta(salud) },
    { etiqueta: "ICBF + SENA", valor: icbfSena, textoValor: formatoMonedaCorta(icbfSena) },
  ].filter((b) => b.valor > 0);

  return (
    <>
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
        <h3 className="text-xs font-medium text-gray-700">Empleados activos</h3>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-gray-900 sm:text-5xl">
          {empleadosActivos ?? 0}
        </p>
      </div>

      <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-gray-700">Gasto mensual en sueldos</h3>
          {hayComparacion && totalesAnteriores && (
            <VariacionBadge actual={sueldosTotal} anterior={totalesAnteriores.sueldos} />
          )}
        </div>
        {barrasSueldos.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
        ) : (
          <GraficoBarras datos={barrasSueldos} />
        )}
      </div>

      <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-gray-700">Gasto mensual en aportes patronales</h3>
          {hayComparacion && totalesAnteriores && (
            <VariacionBadge actual={aportesTotal} anterior={totalesAnteriores.aportes} />
          )}
        </div>
        {barrasAportes.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
        ) : (
          <GraficoBarras datos={barrasAportes} />
        )}
      </div>

      <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-gray-700">Aportes patronales por tipo</h3>
          {hayComparacion && totalesAnteriores && (
            <VariacionBadge actual={aportesTotal} anterior={totalesAnteriores.aportes} />
          )}
        </div>
        {barrasAportesPorTipo.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
        ) : (
          <GraficoBarrasHorizontal datos={barrasAportesPorTipo} />
        )}
      </div>

      <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-gray-700">
            Gasto mensual en prestaciones sociales
          </h3>
          {hayComparacion && totalesAnteriores && (
            <VariacionBadge actual={prestacionesTotal} anterior={totalesAnteriores.prestaciones} />
          )}
        </div>
        {barrasPrestaciones.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
        ) : (
          <GraficoBarras datos={barrasPrestaciones} />
        )}
      </div>
    </>
  );
}
