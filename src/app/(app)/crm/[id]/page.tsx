import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { CambiarEtapa } from "./cambiar-etapa";
import { NuevaInteraccionForm } from "./nueva-interaccion-form";
import { Estrellas } from "../estrellas";
import { CamposAdicionales } from "./campos-adicionales";
import { SeguimientoCalendar } from "./seguimiento";
import { EliminarContacto } from "./eliminar-contacto";
import { DetallesLead } from "./detalles-lead";

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
  searchParams: Promise<{ creado?: string; google_conectado?: string; google_error?: string }>;
}) {
  await requerirModulo("crm");

  const { id } = await params;
  const { creado, google_conectado, google_error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, empresas ( crm_modo, modulos_activos )")
    .eq("id", user.id)
    .single();

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa
  // como arreglo por falta de tipos generados, pero en tiempo de ejecución
  // es un objeto (mismo caso que getPerfilActual() en lib/empresa.ts).
  const empresaInfo = perfil?.empresas as unknown as {
    crm_modo: string;
    modulos_activos: string[];
  } | null;
  const crmModo = empresaInfo?.crm_modo ?? "ventas";

  const { data: contacto } = await supabase
    .from("crm_contactos")
    .select(
      "id, nombre, telefono, email, etapa_id, campos_etapa, empresa_cliente:atributos->>empresa, valor_estimado, prioridad, productos_interes, responsable_id, created_at, responsable:responsable_id ( nombre )",
    )
    .eq("id", id)
    .single();

  if (!contacto) notFound();

  const { data: responsables } =
    crmModo === "leads" && perfil?.empresa_id
      ? await supabase
          .from("crm_responsables")
          .select("id, nombre")
          .eq("empresa_id", perfil.empresa_id)
          .order("nombre")
      : { data: [] };

  const { data: itemsInventario } =
    crmModo === "leads" && perfil?.empresa_id && empresaInfo?.modulos_activos?.includes("inventario")
      ? await supabase
          .from("inventario_items")
          .select("id, nombre")
          .eq("empresa_id", perfil.empresa_id)
          .order("nombre")
      : { data: null };

  // La calificación ya no se pone a mano — se calcula sola según el
  // historial de compras (ver vista_calificacion_clientes).
  const { data: calificacionData } = await supabase
    .from("vista_calificacion_clientes")
    .select("calificacion_automatica")
    .eq("contacto_id", id)
    .maybeSingle();

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

  // Los campos generales aplican a todo contacto sin importar la etapa —
  // se muestran siempre, junto con los que sí dependen de la etapa.
  const { data: camposGenerales } = perfil?.empresa_id
    ? await supabase
        .from("crm_campos_generales")
        .select("id, nombre, tipo, opciones, requerido")
        .eq("empresa_id", perfil.empresa_id)
        .order("orden")
    : { data: [] };

  const todosLosCampos = [
    ...(camposGenerales ?? []).map((c) => ({ ...c, etapa_id: null })),
    ...(camposDefinidos ?? []),
  ];

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

  const { data: historial } =
    crmModo === "leads"
      ? await supabase
          .from("crm_historial_contacto")
          .select("id, campo, valor_anterior, valor_nuevo, created_at, perfiles ( nombre )")
          .eq("contacto_id", id)
          .order("created_at", { ascending: false })
      : { data: [] };

  const { data: cupones } = await supabase
    .from("cupones")
    .select("id, monto, monto_usado, fecha_vencimiento, estado")
    .eq("contacto_id", id)
    .eq("estado", "activo")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  const diasPromedio = perfilCompra?.dias_promedio_entre_compras
    ? Math.ceil(Number(perfilCompra.dias_promedio_entre_compras))
    : null;

  // Solo se pide si la empresa tiene el CRM en modo 'leads' — en modo
  // 'ventas' ni siquiera se consulta, mismo criterio que "Configurar
  // etapas" y las reglas de inactividad.
  let googleConectado = false;
  let eventosCalendar: {
    id: string;
    fecha: string;
    nota: string | null;
    link: string | null;
    meet_link: string | null;
  }[] = [];
  if (crmModo === "leads") {
    const { data: integracion } = await supabase
      .from("integraciones_google")
      .select("perfil_id")
      .eq("perfil_id", user.id)
      .maybeSingle();
    googleConectado = Boolean(integracion);

    const { data: eventos } = await supabase
      .from("crm_eventos_calendar")
      .select("id, fecha, nota, link, meet_link")
      .eq("contacto_id", id)
      .order("fecha", { ascending: true });
    eventosCalendar = eventos ?? [];
  }

  const banners = (
    <>
      {creado === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Cliente creado correctamente.
        </p>
      )}
      {google_conectado === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Google Calendar conectado correctamente.
        </p>
      )}
      {google_error === "1" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo conectar con Google Calendar. Intenta de nuevo.
        </p>
      )}
    </>
  );

  const encabezado = (
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
            <Estrellas valor={calificacionData?.calificacion_automatica ?? null} />
            {calificacionData && (
              <p className="mt-1 text-xs text-gray-400">
                Calculada sola según cuánto compra vs. el promedio de tus demás clientes.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CambiarEtapa contactoId={contacto.id} etapas={etapas ?? []} etapaActualId={contacto.etapa_id} />
          {crmModo === "leads" && <EliminarContacto contactoId={contacto.id} />}
        </div>
      </div>

      {crmModo === "leads" && (
        <DetallesLead
          contactoId={contacto.id}
          valorEstimado={contacto.valor_estimado}
          prioridad={contacto.prioridad}
          fechaLead={contacto.created_at}
          productosInteres={contacto.productos_interes ?? []}
          itemsDisponibles={
            itemsInventario ? itemsInventario.map((item) => ({ value: item.id, label: item.nombre })) : null
          }
          responsableNombre={(contacto.responsable as unknown as { nombre: string } | null)?.nombre ?? null}
          responsables={responsables ?? []}
        />
      )}
    </div>
  );

  // Datos del cliente: perfil de compra, cupones, historial de compras y
  // campos personalizados — lo mismo de siempre, solo que en modo 'leads'
  // se acomoda en la columna izquierda en vez de quedar todo apilado.
  const datosCliente = (
    <>
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
              <li key={venta.venta_id} className="flex items-center justify-between py-2 text-sm">
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
        campos={todosLosCampos}
        valores={
          (contacto.campos_etapa as Record<
            string,
            string | boolean | { nombre: string; url: string } | null
          >) ?? {}
        }
      />
    </>
  );

  if (crmModo !== "leads") {
    return (
      <div className="max-w-3xl space-y-6">
        {banners}
        {encabezado}
        {datosCliente}
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

  return (
    <div className="max-w-5xl space-y-6">
      {banners}
      {encabezado}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">{datosCliente}</div>

        <div className="space-y-6">
          <SeguimientoCalendar
            contactoId={contacto.id}
            nombreContacto={contacto.nombre}
            emailContacto={contacto.email}
            conectado={googleConectado}
            eventos={eventosCalendar}
            rutaConexion={`/crm/${contacto.id}`}
          />

          <div className="rounded-xl border border-gray-200 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Agregar interacción</h2>
            <NuevaInteraccionForm contactoId={contacto.id} />
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Historial</h2>
            {historial && historial.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {historial.map((item) => {
                  const nombreQuien = (item.perfiles as unknown as { nombre: string | null } | null)
                    ?.nombre;
                  return (
                    <li key={item.id} className="py-2 text-sm">
                      <p className="text-gray-500">
                        {new Date(item.created_at).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {nombreQuien ? ` · ${nombreQuien}` : ""}
                      </p>
                      <p className="text-gray-900">
                        <span className="font-medium">{item.campo}:</span>{" "}
                        {item.valor_anterior ? `${item.valor_anterior} → ` : ""}
                        {item.valor_nuevo ?? "(vacío)"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Sin cambios registrados todavía.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
