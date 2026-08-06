import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { primeraMayuscula } from "@/lib/texto";
import { obtenerContextoPunto } from "@/lib/puntos";
import { VentasTabs } from "../ventas-tabs";

type FilaMes = {
  mes: string;
  ingresos_por_ventas: number;
};

type FilaVentaItemRaw = {
  cantidad: number;
  item_id: string | null;
  inventario_items: { nombre: string } | { nombre: string }[] | null;
  ventas: { fecha: string } | { fecha: string }[] | null;
};

type ProductoTendencia = {
  itemId: string;
  nombre: string;
  unidadesRecientes: number;
  unidadesAnteriores: number;
  crecimiento: number;
  proyeccion: number;
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function etiquetaMes(mes: string) {
  return primeraMayuscula(
    new Date(mes).toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
  );
}

function mesSiguiente(mes: string) {
  const fecha = new Date(mes);
  fecha.setUTCMonth(fecha.getUTCMonth() + 1);
  return etiquetaMes(fecha.toISOString());
}

function sumarDiasIso(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Junta los meses (ya combinados por punto de venta, orden descendente) en
// bloques de "tamanoMeses" consecutivos — 1 para mes, 3 para trimestre, 6
// para semestre, 12 para año — y promedia hasta los últimos 3 bloques
// completos para proyectar el siguiente. Un bloque incompleto (menos meses
// de historia de los que hacen falta) no cuenta, para no subestimar el
// promedio con un período a medias.
function proyectarPeriodo(mesesDesc: FilaMes[], tamanoMeses: number) {
  const bloques: number[] = [];
  for (let i = 0; i + tamanoMeses <= mesesDesc.length && bloques.length < 3; i += tamanoMeses) {
    const grupo = mesesDesc.slice(i, i + tamanoMeses);
    bloques.push(grupo.reduce((suma, f) => suma + f.ingresos_por_ventas, 0));
  }
  if (bloques.length === 0) return null;
  const promedio = bloques.reduce((suma, v) => suma + v, 0) / bloques.length;
  return { promedio, bloquesUsados: bloques.length };
}

export default async function ProyeccionesVentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id, empresas ( permite_apartados )")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa como
  // arreglo por falta de tipos generados, pero en tiempo de ejecución es un objeto.
  const empresa = perfil.empresas as unknown as { permite_apartados: boolean } | null;

  const { puntoSeleccionado } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    perfil.punto_venta_id,
  );

  let query = supabase
    .from("vista_estado_resultados")
    .select("mes, punto_venta_id, ingresos_por_ventas")
    .eq("empresa_id", perfil.empresa_id)
    .order("mes", { ascending: false });

  if (puntoSeleccionado) query = query.eq("punto_venta_id", puntoSeleccionado);

  const hoyIso = new Date().toISOString().slice(0, 10);
  let itemsQuery = supabase
    .from("ventas_items")
    .select("cantidad, item_id, inventario_items ( nombre ), ventas!inner ( fecha, empresa_id )")
    .eq("ventas.empresa_id", perfil.empresa_id)
    .gte("ventas.fecha", `${sumarDiasIso(hoyIso, -60)}T00:00:00`);

  if (puntoSeleccionado) itemsQuery = itemsQuery.eq("ventas.punto_venta_id", puntoSeleccionado);

  const [{ data }, { data: itemsData }] = await Promise.all([query, itemsQuery]);
  const filasCrudas = (data ?? []) as (FilaMes & { punto_venta_id: string | null })[];

  // Con "todos los puntos", la vista trae una fila por mes y punto — hay
  // que sumarlas para tener el ingreso combinado de cada mes, como antes.
  const combinadoPorMes = new Map<string, FilaMes>();
  for (const f of filasCrudas) {
    const clave = f.mes.slice(0, 7);
    const acumulado = combinadoPorMes.get(clave) ?? { mes: f.mes, ingresos_por_ventas: 0 };
    acumulado.ingresos_por_ventas += Number(f.ingresos_por_ventas);
    combinadoPorMes.set(clave, acumulado);
  }
  const mesesDesc = Array.from(combinadoPorMes.values()).sort((a, b) => b.mes.localeCompare(a.mes));

  const meses = mesesDesc.slice(0, 3);
  const promedioMes =
    meses.length > 0 ? meses.reduce((suma, f) => suma + f.ingresos_por_ventas, 0) / meses.length : 0;

  const periodos = [
    { etiqueta: "Trimestre", tamanoMeses: 3, resultado: proyectarPeriodo(mesesDesc, 3) },
    { etiqueta: "Semestre", tamanoMeses: 6, resultado: proyectarPeriodo(mesesDesc, 6) },
    { etiqueta: "Año", tamanoMeses: 12, resultado: proyectarPeriodo(mesesDesc, 12) },
  ];

  // ---- Ranking de productos con proyección a más ventas ----
  // Compara unidades vendidas en los últimos 30 días contra los 30 días
  // anteriores, y proyecta el próximo período extendiendo ese mismo
  // crecimiento — así se ve qué productos vienen subiendo, no solo cuáles
  // ya venden más hoy.
  const unidadesPorProducto = new Map<string, { nombre: string; recientes: number; anteriores: number }>();
  for (const fila of (itemsData ?? []) as unknown as FilaVentaItemRaw[]) {
    const venta = Array.isArray(fila.ventas) ? fila.ventas[0] : fila.ventas;
    const item = Array.isArray(fila.inventario_items) ? fila.inventario_items[0] : fila.inventario_items;
    if (!fila.item_id || !venta?.fecha || !item?.nombre) continue;

    const diaVenta = venta.fecha.slice(0, 10);
    const entrada = unidadesPorProducto.get(fila.item_id) ?? {
      nombre: item.nombre,
      recientes: 0,
      anteriores: 0,
    };
    if (diaVenta >= sumarDiasIso(hoyIso, -29)) {
      entrada.recientes += Number(fila.cantidad);
    } else {
      entrada.anteriores += Number(fila.cantidad);
    }
    unidadesPorProducto.set(fila.item_id, entrada);
  }

  const productosTendencia: ProductoTendencia[] = Array.from(unidadesPorProducto.entries())
    .map(([itemId, v]) => {
      const crecimiento = v.recientes - v.anteriores;
      return {
        itemId,
        nombre: v.nombre,
        unidadesRecientes: v.recientes,
        unidadesAnteriores: v.anteriores,
        crecimiento,
        proyeccion: Math.max(0, v.recientes + crecimiento),
      };
    })
    .filter((p) => p.unidadesRecientes > 0 || p.unidadesAnteriores > 0)
    .sort((a, b) => b.crecimiento - a.crecimiento)
    .slice(0, 8);

  return (
    <div>
      <VentasTabs permiteApartados={Boolean(empresa?.permite_apartados)} />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Proyecciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Promedio de los últimos {meses.length || 0} mes{meses.length === 1 ? "" : "es"} con
          ventas, proyectado hacia el próximo mes.
        </p>
      </div>

      {meses.length === 0 ? (
        <p className="text-gray-400">
          Todavía no hay suficientes ventas registradas para proyectar.
        </p>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Ventas proyectadas para {mesSiguiente(meses[0].mes)}</p>
            <p className="text-2xl font-semibold text-gray-900">{formatoMoneda(promedioMes)}</p>
            <p className="mt-1 text-xs text-gray-400">Basado en {meses.length} mes{meses.length === 1 ? "" : "es"}</p>
          </div>

          {periodos.map((p) => (
            <div key={p.etiqueta} className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400">Próximo {p.etiqueta.toLowerCase()}</p>
              {p.resultado ? (
                <>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatoMoneda(p.resultado.promedio)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Basado en {p.resultado.bloquesUsados} {p.etiqueta.toLowerCase()}
                    {p.resultado.bloquesUsados === 1 ? "" : "s"} completo
                    {p.resultado.bloquesUsados === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-400">
                  Aún no tienes {p.tamanoMeses} meses de historial para proyectar esto.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mb-8 max-w-md rounded-xl border border-gray-200 p-4">
        <p className="mb-2 text-xs font-medium text-gray-700">Basado en:</p>
        {meses.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos todavía.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {meses.map((f) => (
              <li key={f.mes} className="flex justify-between py-1.5">
                <span className="text-gray-500">{etiquetaMes(f.mes)}</span>
                <span className="text-gray-900">{formatoMoneda(f.ingresos_por_ventas)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">
          Productos con proyección a más ventas
        </h2>
        <p className="mb-4 text-xs text-gray-400">
          Comparando las unidades vendidas en los últimos 30 días contra los 30 anteriores.
        </p>
        {productosTendencia.length === 0 ? (
          <p className="text-sm text-gray-400">
            Todavía no hay suficiente historial de ventas por producto para proyectar esto.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {productosTendencia.map((p, i) => (
              <li key={p.itemId} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-xs font-medium text-gray-400">{i + 1}</span>
                  <div>
                    <p className="font-medium text-gray-900">{p.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {p.unidadesRecientes} unidad(es) en los últimos 30 días
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      p.crecimiento > 0
                        ? "text-green-600"
                        : p.crecimiento < 0
                          ? "text-red-600"
                          : "text-gray-500"
                    }`}
                  >
                    {p.crecimiento > 0 && `▲ +${p.crecimiento}`}
                    {p.crecimiento < 0 && `▼ ${p.crecimiento}`}
                    {p.crecimiento === 0 && "Sin cambio"}
                  </p>
                  <p className="text-xs text-gray-400">Proyectado: {p.proyeccion} unidad(es)</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
