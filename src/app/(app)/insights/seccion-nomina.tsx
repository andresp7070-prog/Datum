import { createClient } from "@/lib/supabase/server";
import { GraficoBarras, GraficoBarrasHorizontal, type Barra } from "./graficos";
import { primeraMayuscula } from "@/lib/texto";
import type { RangoFechas } from "@/lib/periodos";

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

export async function SeccionNomina({
  empresaId,
  rango,
}: {
  empresaId: string;
  rango: RangoFechas | null;
}) {
  const supabase = await createClient();

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

  const { data: detallesData } =
    idsPeriodos.length > 0
      ? await supabase
          .from("nomina_detalles")
          .select(
            "periodo_id, neto_pagado, total_aportes_patronales, aporte_pension_patronal, aporte_arl, aporte_caja_compensacion, aporte_salud_patronal, aporte_icbf, aporte_sena, provision_cesantias, provision_intereses_cesantias, provision_prima",
          )
          .in("periodo_id", idsPeriodos)
      : { data: [] };
  const detalles = detallesData ?? [];

  const sueldosPorMes = new Map<string, number>();
  const aportesPorMes = new Map<string, number>();
  const prestacionesPorMes = new Map<string, number>();
  let pension = 0;
  let arl = 0;
  let caja = 0;
  let salud = 0;
  let icbfSena = 0;

  for (const d of detalles) {
    const mes = mesPorPeriodo.get(d.periodo_id) ?? "otro";
    sueldosPorMes.set(mes, (sueldosPorMes.get(mes) ?? 0) + Number(d.neto_pagado));
    aportesPorMes.set(mes, (aportesPorMes.get(mes) ?? 0) + Number(d.total_aportes_patronales));
    prestacionesPorMes.set(
      mes,
      (prestacionesPorMes.get(mes) ?? 0) +
        Number(d.provision_cesantias) +
        Number(d.provision_intereses_cesantias) +
        Number(d.provision_prima),
    );
    pension += Number(d.aporte_pension_patronal);
    arl += Number(d.aporte_arl);
    caja += Number(d.aporte_caja_compensacion);
    salud += Number(d.aporte_salud_patronal);
    icbfSena += Number(d.aporte_icbf) + Number(d.aporte_sena);
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
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Nómina</h2>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
          <h3 className="text-xs font-medium text-gray-700">Empleados activos</h3>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-gray-900 sm:text-5xl">
            {empleadosActivos ?? 0}
          </p>
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-3">
          <h3 className="mb-3 text-xs font-medium text-gray-700">Gasto mensual en sueldos</h3>
          {barrasSueldos.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
          ) : (
            <GraficoBarras datos={barrasSueldos} />
          )}
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
          <h3 className="mb-3 text-xs font-medium text-gray-700">Gasto mensual en aportes patronales</h3>
          {barrasAportes.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
          ) : (
            <GraficoBarras datos={barrasAportes} />
          )}
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
          <h3 className="mb-3 text-xs font-medium text-gray-700">Aportes patronales por tipo</h3>
          {barrasAportesPorTipo.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
          ) : (
            <GraficoBarrasHorizontal datos={barrasAportesPorTipo} />
          )}
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-4">
          <h3 className="mb-3 text-xs font-medium text-gray-700">
            Gasto mensual en prestaciones sociales
          </h3>
          {barrasPrestaciones.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay nóminas pagadas.</p>
          ) : (
            <GraficoBarras datos={barrasPrestaciones} />
          )}
        </div>
      </div>
    </div>
  );
}
