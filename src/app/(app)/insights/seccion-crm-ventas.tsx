import { createClient } from "@/lib/supabase/server";
import { GraficoBarras, type Barra } from "./graficos";
import type { RangoFechas } from "@/lib/periodos";

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

// Solo aplica a empresas con crm_modo = 'ventas' — "cliente nuevo vs.
// recurrente" y "productos comprados por cliente" son conceptos de venta
// directa (todo contacto ya compró), no de un embudo de leads.
export async function SeccionCrmVentas({
  empresaId,
  rango,
}: {
  empresaId: string;
  rango: RangoFechas | null;
}) {
  const supabase = await createClient();

  // Sin un rango de fechas activo ("todo"), "nuevo vs. recurrente" no tiene
  // contra qué medirse — se usa el mes calendario actual como período
  // implícito solo para esta sección.
  const desde = rango?.desde ?? primerDiaDelMesActual();
  const hasta = rango?.hasta ?? new Date().toISOString().slice(0, 10);

  const { data: ventasDelPeriodo } = await supabase
    .from("vista_resumen_ventas")
    .select("contacto_id, monto, unidades_totales")
    .eq("empresa_id", empresaId)
    .not("contacto_id", "is", null)
    .gte("fecha", `${desde}T00:00:00`)
    .lt("fecha", `${sumarDiasIso(hasta, 1)}T00:00:00`);

  const filas = ventasDelPeriodo ?? [];
  const contactoIds = Array.from(new Set(filas.map((f) => f.contacto_id as string)));

  const totalUnidades = filas.reduce((s, f) => s + Number(f.unidades_totales), 0);
  const totalMonto = filas.reduce((s, f) => s + Number(f.monto), 0);
  const promedioProductosPorCliente = contactoIds.length > 0 ? totalUnidades / contactoIds.length : 0;
  const promedioGastoPorCliente = contactoIds.length > 0 ? totalMonto / contactoIds.length : 0;

  let barrasNuevosRecurrentes: Barra[] = [];
  if (contactoIds.length > 0) {
    const { data: perfiles } = await supabase
      .from("vista_perfil_cliente")
      .select("contacto_id, primera_compra")
      .in("contacto_id", contactoIds);

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
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">CRM</h2>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
          <h3 className="text-xs font-medium text-gray-700">
            Promedio de productos comprados por cliente
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-gray-900">
                {promedioProductosPorCliente.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">unidades</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums text-gray-900">
                {formatoMonedaCorta(promedioGastoPorCliente)}
              </p>
              <p className="mt-1 text-xs text-gray-400">gasto</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
          <h3 className="mb-3 text-xs font-medium text-gray-700">
            Clientes nuevos vs. clientes recurrentes
          </h3>
          {barrasNuevosRecurrentes.length === 0 ? (
            <p className="text-sm text-gray-400">
              Aún no hay ventas con cliente asociado en este período.
            </p>
          ) : (
            <GraficoBarras datos={barrasNuevosRecurrentes} />
          )}
        </div>
      </div>
    </div>
  );
}
