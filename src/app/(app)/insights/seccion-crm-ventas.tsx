import { createClient } from "@/lib/supabase/server";
import { GraficoBarras, type Barra } from "./graficos";
import { VariacionBadge } from "./variacion";
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

function sumarDiasIso(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function primerDiaDelMesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

async function calcularResumenCrm(supabase: SupabaseClient, empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("vista_resumen_ventas")
    .select("contacto_id, monto, unidades_totales")
    .eq("empresa_id", empresaId)
    .not("contacto_id", "is", null)
    .gte("fecha", `${desde}T00:00:00`)
    .lt("fecha", `${sumarDiasIso(hasta, 1)}T00:00:00`);

  const filas = data ?? [];
  const contactoIds = Array.from(new Set(filas.map((f) => f.contacto_id as string)));
  const totalUnidades = filas.reduce((s, f) => s + Number(f.unidades_totales), 0);
  const totalMonto = filas.reduce((s, f) => s + Number(f.monto), 0);

  return {
    contactoIds,
    totalClientes: contactoIds.length,
    promedioProductosPorCliente: contactoIds.length > 0 ? totalUnidades / contactoIds.length : 0,
    promedioGastoPorCliente: contactoIds.length > 0 ? totalMonto / contactoIds.length : 0,
  };
}

// Solo aplica a empresas con crm_modo = 'ventas' — "cliente nuevo vs.
// recurrente" y "productos comprados por cliente" son conceptos de venta
// directa (todo contacto ya compró), no de un embudo de leads.
//
// Sin wrapper propio ni título: las tarjetas se insertan directo en la
// cuadrícula continua de Panel de control (ver insights/page.tsx).
export async function SeccionCrmVentas({
  empresaId,
  rango,
}: {
  empresaId: string;
  rango: RangoFechas | null;
}) {
  const supabase = await createClient();
  const hayComparacion = Boolean(rango);

  // Sin un rango de fechas activo ("todo"), "nuevo vs. recurrente" no tiene
  // contra qué medirse — se usa el mes calendario actual como período
  // implícito solo para esta sección. La comparativa con el período
  // anterior solo se calcula (y se muestra) cuando sí hay un filtro
  // explícito, igual que el resto de Panel de control.
  const desde = rango?.desde ?? primerDiaDelMesActual();
  const hasta = rango?.hasta ?? new Date().toISOString().slice(0, 10);

  const [actual, anterior] = await Promise.all([
    calcularResumenCrm(supabase, empresaId, desde, hasta),
    rango
      ? calcularResumenCrm(supabase, empresaId, rango.desdeAnterior, rango.hastaAnterior)
      : Promise.resolve(null),
  ]);

  let barrasNuevosRecurrentes: Barra[] = [];
  if (actual.contactoIds.length > 0) {
    const { data: perfiles } = await supabase
      .from("vista_perfil_cliente")
      .select("contacto_id, primera_compra")
      .in("contacto_id", actual.contactoIds);

    let nuevos = 0;
    let recurrentes = 0;
    for (const perfil of perfiles ?? []) {
      if (!perfil.primera_compra) continue;
      // Si la primera compra de siempre de este cliente cae dentro del
      // período, es un cliente nuevo; si fue antes, ya era recurrente.
      const primeraCompraIso = new Date(perfil.primera_compra).toISOString().slice(0, 10);
      if (primeraCompraIso >= desde) nuevos += 1;
      else recurrentes += 1;
    }

    barrasNuevosRecurrentes = [
      { etiqueta: "Nuevos", valor: nuevos, textoValor: String(nuevos) },
      { etiqueta: "Recurrentes", valor: recurrentes, textoValor: String(recurrentes) },
    ];
  }

  return (
    <>
      <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
        <h3 className="text-xs font-medium text-gray-700">
          Promedio de productos comprados por cliente
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-gray-900">
              {actual.promedioProductosPorCliente.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
            </p>
            <p className="mt-1 text-xs text-gray-400">unidades</p>
            {hayComparacion && anterior && (
              <div className="mt-1">
                <VariacionBadge
                  actual={actual.promedioProductosPorCliente}
                  anterior={anterior.promedioProductosPorCliente}
                  formato="numero"
                />
              </div>
            )}
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums text-gray-900">
              {formatoMonedaCorta(actual.promedioGastoPorCliente)}
            </p>
            <p className="mt-1 text-xs text-gray-400">gasto</p>
            {hayComparacion && anterior && (
              <div className="mt-1">
                <VariacionBadge actual={actual.promedioGastoPorCliente} anterior={anterior.promedioGastoPorCliente} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-gray-700">
            Clientes nuevos vs. clientes recurrentes
          </h3>
          {hayComparacion && anterior && (
            <VariacionBadge actual={actual.totalClientes} anterior={anterior.totalClientes} formato="numero" />
          )}
        </div>
        {barrasNuevosRecurrentes.length === 0 ? (
          <p className="text-sm text-gray-400">
            Aún no hay ventas con cliente asociado en este período.
          </p>
        ) : (
          <GraficoBarras datos={barrasNuevosRecurrentes} />
        )}
      </div>
    </>
  );
}
