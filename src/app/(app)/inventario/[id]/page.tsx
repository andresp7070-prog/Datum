import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { etiquetaUnidad } from "@/lib/unidades";
import { calcularMaxProducible, promedioDiasEntreVentas } from "@/lib/inventario";
import { etiquetaFrecuenciaPago } from "@/lib/proveedores";
import { firmarFotoUrl } from "@/lib/fotos";
import { FotoProducto } from "./foto-producto";
import { AjustarInventario } from "./ajustar-inventario";
import { DarDotacion } from "./dar-dotacion";

type RecetaFila = {
  cantidad_insumo: number;
  inventario_items: { nombre: string; unidad: string; cantidad: number } | null;
};

type VentaItemFila = {
  venta_id: string;
  ventas: { fecha: string } | { fecha: string }[] | null;
};

type DotacionFila = {
  id: string;
  cantidad: number;
  fecha: string;
  nota: string | null;
  empleados: { nombre: string } | { nombre: string }[] | null;
};

function formatoFecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatoMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function formatoDias(dias: number) {
  const redondeado = Math.round(dias * 10) / 10;
  return redondeado === 1 ? "1 día" : `${redondeado} días`;
}

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ninguna de las tres depende de las otras — todas solo necesitan el
  // usuario o el id de la ruta, así que salen juntas en vez de una detrás
  // de otra.
  const [{ data: perfil }, { data: item }, { data: recetaData }] = await Promise.all([
    supabase.from("perfiles").select("empresa_id").eq("id", user.id).single(),
    supabase
      .from("inventario_items")
      .select(
        "id, nombre, sku, categoria, unidad, cantidad, costo, precio_venta, es_insumo, foto_path, marca:atributos->>marca, contenido_por_unidad:atributos->>contenido_por_unidad, proveedor:proveedores ( nombre, frecuencia_pago, dia_semana_pago, dias_personalizado )",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("inventario_receta")
      .select(
        "cantidad_insumo, inventario_items!inventario_receta_item_insumo_id_fkey ( nombre, unidad, cantidad )",
      )
      .eq("item_resultante_id", id),
  ]);

  if (!item) notFound();
  if (!perfil?.empresa_id) notFound();

  const proveedor = Array.isArray(item.proveedor) ? item.proveedor[0] : item.proveedor;
  const receta = (recetaData ?? []) as unknown as RecetaFila[];

  const maxProducible = calcularMaxProducible(
    receta.map((fila) => ({
      cantidadInsumo: fila.cantidad_insumo,
      stockInsumo: fila.inventario_items?.cantidad ?? 0,
    })),
  );

  // fotoUrl, el historial de ventas, los empleados (para el selector de
  // dotación) y el historial de dotaciones no dependen entre sí — salen
  // todos juntos también.
  const [fotoUrl, { data: ventasItem }, { data: empleadosData }, { data: dotacionesData }] =
    await Promise.all([
      firmarFotoUrl(supabase, item.foto_path),
      item.es_insumo
        ? Promise.resolve({ data: null })
        : supabase.from("ventas_items").select("venta_id, ventas!inner(fecha)").eq("item_id", id),
      supabase
        .from("empleados")
        .select("id, nombre")
        .eq("empresa_id", perfil.empresa_id)
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("inventario_movimientos")
        .select("id, cantidad, fecha, nota, empleados(nombre)")
        .eq("item_id", id)
        .eq("motivo", "dotacion")
        .order("fecha", { ascending: false }),
    ]);

  const empleados = empleadosData ?? [];
  const dotaciones = (dotacionesData ?? []) as unknown as DotacionFila[];

  let totalVentas = 0;
  let promedioDias: number | null = null;
  if (!item.es_insumo) {
    const fechasPorVenta = new Map<string, number>();
    for (const fila of (ventasItem ?? []) as unknown as VentaItemFila[]) {
      const venta = Array.isArray(fila.ventas) ? fila.ventas[0] : fila.ventas;
      if (venta?.fecha && !fechasPorVenta.has(fila.venta_id)) {
        fechasPorVenta.set(fila.venta_id, new Date(venta.fecha).getTime());
      }
    }
    totalVentas = fechasPorVenta.size;
    promedioDias = promedioDiasEntreVentas(Array.from(fechasPorVenta.values()));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <FotoProducto itemId={item.id} empresaId={perfil.empresa_id} fotoUrl={fotoUrl} />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{item.nombre}</h1>
              <p className="mt-0.5 font-mono text-xs text-gray-400">SKU: {item.sku ?? "—"}</p>
              <p className="text-sm text-gray-500">
                {[item.categoria, item.marca].filter(Boolean).join(" · ") || "Sin categoría"}
              </p>
              {item.contenido_por_unidad && (
                <p className="mt-1 text-xs text-gray-400">
                  Cada unidad: {item.contenido_por_unidad} {etiquetaUnidad(item.unidad)}
                </p>
              )}
              {proveedor && (
                <p className="mt-1 text-xs text-gray-400">
                  Proveedor: {proveedor.nombre} ·{" "}
                  {etiquetaFrecuenciaPago(
                    proveedor.frecuencia_pago,
                    proveedor.dia_semana_pago,
                    proveedor.dias_personalizado,
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/inventario/${item.id}/receta`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Configurar receta
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Cantidad en stock</p>
            <p className={`font-medium ${item.cantidad <= 0 ? "text-red-600" : "text-gray-900"}`}>
              {item.cantidad} {etiquetaUnidad(item.unidad)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Costo por unidad</p>
            <p className="font-medium text-gray-900">{formatoMoneda(item.costo)}</p>
          </div>
          <div>
            <p className="text-gray-400">Precio de venta</p>
            <p className="font-medium text-gray-900">{formatoMoneda(item.precio_venta)}</p>
          </div>
        </div>
        {maxProducible !== null && (
          <p className="mt-2 text-xs text-gray-400">
            Con los insumos que tienes ahora, podrías producir hasta {maxProducible} más.
          </p>
        )}
        {!item.es_insumo && (
          <p className="mt-2 text-xs text-gray-400">
            {promedioDias !== null
              ? `Se vende cada ${formatoDias(promedioDias)} en promedio (basado en ${totalVentas} ventas).`
              : totalVentas === 1
                ? "Solo se ha vendido una vez — falta historial para calcular con qué frecuencia se vende."
                : "Todavía no se ha vendido — falta historial para calcular con qué frecuencia se vende."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <AjustarInventario
            itemId={item.id}
            cantidadActual={item.cantidad}
            unidad={etiquetaUnidad(item.unidad)}
            tieneReceta={receta.length > 0}
          />
          <DarDotacion
            itemId={item.id}
            cantidadActual={item.cantidad}
            unidad={etiquetaUnidad(item.unidad)}
            empleados={empleados}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Receta</h2>
        {receta.length === 0 ? (
          <p className="text-sm text-gray-400">
            Este producto no tiene receta configurada — ajustar su cantidad no descuenta ningún
            insumo.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {receta.map((fila, i) => (
              <li key={i} className="py-2 text-sm text-gray-900">
                {fila.cantidad_insumo}{" "}
                {fila.inventario_items ? etiquetaUnidad(fila.inventario_items.unidad) : ""} de{" "}
                {fila.inventario_items?.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>

      {dotaciones.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Historial de dotaciones</h2>
          <ul className="divide-y divide-gray-200">
            {dotaciones.map((dotacion) => {
              const empleado = Array.isArray(dotacion.empleados)
                ? dotacion.empleados[0]
                : dotacion.empleados;
              return (
                <li key={dotacion.id} className="flex items-start justify-between gap-4 py-2 text-sm">
                  <div>
                    <p className="text-gray-900">
                      {dotacion.cantidad} {etiquetaUnidad(item.unidad)} a{" "}
                      {empleado?.nombre ?? "empleado sin registrar"}
                    </p>
                    {dotacion.nota && <p className="text-xs text-gray-400">{dotacion.nota}</p>}
                  </div>
                  <span className="whitespace-nowrap text-xs text-gray-400">
                    {formatoFecha(dotacion.fecha)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
