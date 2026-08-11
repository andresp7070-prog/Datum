import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { CambiarEtapa } from "./cambiar-etapa";
import { NuevaInteraccionForm } from "./nueva-interaccion-form";
import { CalificarCliente } from "./calificar-cliente";
import { CamposAdicionales } from "./campos-adicionales";

const etiquetaTipoInteraccion: Record<string, string> = {
  llamada: "Llamada",
  email: "Correo",
  reunion: "Reunión",
  otro: "Otro",
};

export default async function FichaClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await requerirModulo("crm");

  const { id } = await params;
  const { creado } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  const { data: contacto } = await supabase
    .from("crm_contactos")
    .select(
      "id, nombre, telefono, email, etapa_id, calificacion, campos_etapa, empresa_cliente:atributos->>empresa",
    )
    .eq("id", id)
    .single();

  if (!contacto) notFound();

  const { data: etapas } = perfil?.empresa_id
    ? await supabase
        .from("crm_etapas")
        .select("id, nombre, orden")
        .eq("empresa_id", perfil.empresa_id)
        .order("orden")
    : { data: [] };

  // Se muestran los campos de la etapa actual del contacto y de todas las
  // anteriores — así no se pierde de vista lo que ya se pidió en el camino
  // a medida que el contacto avanza en el embudo.
  const etapaActual = (etapas ?? []).find((e) => e.id === contacto.etapa_id);
  const etapaIdsHastaAhora = (etapas ?? [])
    .filter((e) => !etapaActual || e.orden <= etapaActual.orden)
    .map((e) => e.id);

  const { data: camposDefinidos } =
    etapaIdsHastaAhora.length > 0
      ? await supabase
          .from("crm_etapa_campos")
          .select("id, etapa_id, nombre, tipo, opciones, requerido")
          .in("etapa_id", etapaIdsHastaAhora)
          .order("orden")
      : { data: [] };

  const { data: perfilCompra } = await supabase
    .from("vista_perfil_cliente")
    .select("*")
    .eq("contacto_id", id)
    .maybeSingle();

  const { data: compras } = await supabase
    .from("vista_resumen_ventas")
    .select("*")
    .eq("contacto_id", id)
    .order("fecha", { ascending: false });

  const { data: interacciones } = await supabase
    .from("crm_interacciones")
    .select("*")
    .eq("contacto_id", id)
    .order("fecha", { ascending: false });

  const { data: cupones } = await supabase
    .from("cupones")
    .select("id, monto, monto_usado, fecha_vencimiento, estado")
    .eq("contacto_id", id)
    .eq("estado", "activo")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  const diasPromedio = perfilCompra?.dias_promedio_entre_compras
    ? Math.ceil(Number(perfilCompra.dias_promedio_entre_compras))
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      {creado === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Cliente creado correctamente.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{contacto.nombre}</h1>
            {contacto.empresa_cliente && (
              <p className="text-sm text-gray-500">{contacto.empresa_cliente}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {contacto.telefono ?? "Sin teléfono"} · {contacto.email ?? "Sin correo"}
            </p>
            <div className="mt-2">
              <CalificarCliente contactoId={contacto.id} calificacionInicial={contacto.calificacion} />
            </div>
          </div>
          <CambiarEtapa contactoId={contacto.id} etapas={etapas ?? []} etapaActualId={contacto.etapa_id} />
        </div>
      </div>

      {perfilCompra && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Perfil de compra</h2>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-gray-400">Inversión total</p>
              <p className="font-medium text-gray-900">
                {Number(perfilCompra.inversion_total).toLocaleString("es-CO", {
                  style: "currency",
                  currency: "COP",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Ticket medio</p>
              <p className="font-medium text-gray-900">
                {Number(perfilCompra.ticket_medio).toLocaleString("es-CO", {
                  style: "currency",
                  currency: "COP",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Total de compras</p>
              <p className="font-medium text-gray-900">{perfilCompra.total_compras}</p>
            </div>
            {diasPromedio !== null && (
              <div>
                <p className="text-gray-400">Días promedio entre compras</p>
                <p className="font-medium text-gray-900">
                  {diasPromedio} {diasPromedio === 1 ? "día" : "días"}
                </p>
              </div>
            )}
            {perfilCompra.producto_mas_comprado && (
              <div>
                <p className="text-gray-400">Producto más comprado</p>
                <p className="font-medium text-gray-900">
                  {perfilCompra.producto_mas_comprado}
                  {perfilCompra.unidades_producto_mas_comprado != null && (
                    <span className="text-gray-400">
                      {" "}
                      ({perfilCompra.unidades_producto_mas_comprado} unidad
                      {Number(perfilCompra.unidades_producto_mas_comprado) === 1 ? "" : "es"})
                    </span>
                  )}
                </p>
              </div>
            )}
            {perfilCompra.producto_mas_economico && (
              <div>
                <p className="text-gray-400">Producto más económico</p>
                <p className="font-medium text-gray-900">{perfilCompra.producto_mas_economico}</p>
              </div>
            )}
            {perfilCompra.producto_mas_costoso && (
              <div>
                <p className="text-gray-400">Producto más costoso</p>
                <p className="font-medium text-gray-900">{perfilCompra.producto_mas_costoso}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {cupones && cupones.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Cupones activos</h2>
          <ul className="divide-y divide-gray-200">
            {cupones.map((cupon) => {
              const disponible = Number(cupon.monto) - Number(cupon.monto_usado);
              return (
                <li key={cupon.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-500">
                    {cupon.fecha_vencimiento
                      ? `Vence el ${new Date(cupon.fecha_vencimiento).toLocaleDateString("es-CO")}`
                      : "Sin fecha de vencimiento"}
                  </span>
                  <span className="font-medium text-gray-900">
                    {disponible.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Historial de compras</h2>
        {compras && compras.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {compras.map((venta) => (
              <li
                key={venta.venta_id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-gray-500">
                  {new Date(venta.fecha).toLocaleString("es-CO")}
                </span>
                <span className="text-gray-500">
                  {venta.items_distintos} ítem(s), {venta.unidades_totales} unidad(es)
                </span>
                <span className="font-medium text-gray-900">
                  {Number(venta.monto).toLocaleString("es-CO", {
                    style: "currency",
                    currency: "COP",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Sin compras registradas todavía.</p>
        )}
      </div>

      <CamposAdicionales
        contactoId={contacto.id}
        campos={camposDefinidos ?? []}
        valores={(contacto.campos_etapa as Record<string, string | boolean | null>) ?? {}}
      />

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Interacciones</h2>
        {interacciones && interacciones.length > 0 ? (
          <ul className="mb-4 divide-y divide-gray-200">
            {interacciones.map((interaccion) => (
              <li key={interaccion.id} className="py-2 text-sm">
                <p className="text-gray-500">
                  {new Date(interaccion.fecha).toLocaleDateString("es-CO")} ·{" "}
                  {etiquetaTipoInteraccion[interaccion.tipo ?? "otro"] ?? interaccion.tipo}
                </p>
                <p className="text-gray-900">{interaccion.nota}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-gray-400">Sin interacciones registradas todavía.</p>
        )}

        <NuevaInteraccionForm contactoId={contacto.id} />
      </div>
    </div>
  );
}
