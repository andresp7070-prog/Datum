import { notFound } from "next/navigation";
import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { CambiarEtapa } from "./cambiar-etapa";
import { NuevaInteraccionForm } from "./nueva-interaccion-form";
import { Estrellas } from "@/app/(app)/crm/estrellas";
import { CamposAdicionales } from "./campos-adicionales";
import { SeguimientoCalendar } from "./seguimiento";

const etiquetaTipoInteraccion: Record<string, string> = {
  llamada: "Llamada",
  email: "Correo",
  reunion: "Reunión",
  otro: "Otro",
};

export default async function FichaLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string; google_conectado?: string; google_error?: string }>;
}) {
  await requerirAdmin();

  const { id } = await params;
  const { creado, google_conectado, google_error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead } = await supabase
    .from("datum_leads")
    .select("id, nombre, empresa, telefono, email, etapa_id, valor_venta, notas, campos_etapa")
    .eq("id", id)
    .single();

  if (!lead) notFound();

  // La calificación ya no se pone a mano — se calcula sola según el valor
  // de venta que generó el lead (ver vista_calificacion_leads_datum).
  const { data: calificacionData } = await supabase
    .from("vista_calificacion_leads_datum")
    .select("calificacion_automatica")
    .eq("lead_id", id)
    .maybeSingle();

  const { data: etapas } = await supabase
    .from("datum_crm_etapas")
    .select("id, nombre, orden, es_cierre")
    .order("orden");

  // Igual criterio que en la ficha del cliente: se muestran los campos de
  // la etapa actual del lead y de todas las anteriores.
  const etapaActual = (etapas ?? []).find((e) => e.id === lead.etapa_id);
  const etapaIdsHastaAhora = (etapas ?? [])
    .filter((e) => !etapaActual || e.orden <= etapaActual.orden)
    .map((e) => e.id);

  const { data: camposDefinidos } =
    etapaIdsHastaAhora.length > 0
      ? await supabase
          .from("datum_crm_etapa_campos")
          .select("id, etapa_id, nombre, tipo, opciones, requerido")
          .in("etapa_id", etapaIdsHastaAhora)
          .order("orden")
      : { data: [] };

  // Los campos generales aplican a todo lead sin importar la etapa.
  const { data: camposGenerales } = await supabase
    .from("datum_crm_campos_generales")
    .select("id, nombre, tipo, opciones, requerido")
    .order("orden");

  const todosLosCampos = [
    ...(camposGenerales ?? []).map((c) => ({ ...c, etapa_id: null })),
    ...(camposDefinidos ?? []),
  ];

  const { data: interacciones } = await supabase
    .from("datum_crm_interacciones")
    .select("*")
    .eq("lead_id", id)
    .order("fecha", { ascending: false });

  const { data: historial } = await supabase
    .from("datum_crm_historial_lead")
    .select("id, campo, valor_anterior, valor_nuevo, created_at, perfiles ( nombre )")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  let googleConectado = false;
  let eventosCalendar: {
    id: string;
    fecha: string;
    nota: string | null;
    link: string | null;
    meet_link: string | null;
  }[] = [];
  if (user) {
    const { data: integracion } = await supabase
      .from("integraciones_google")
      .select("perfil_id")
      .eq("perfil_id", user.id)
      .maybeSingle();
    googleConectado = Boolean(integracion);

    const { data: eventos } = await supabase
      .from("datum_crm_eventos_calendar")
      .select("id, fecha, nota, link, meet_link")
      .eq("lead_id", id)
      .order("fecha", { ascending: true });
    eventosCalendar = eventos ?? [];
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/leads" className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver a Leads
      </Link>

      {creado === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Lead creado correctamente.
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

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{lead.nombre}</h1>
            {lead.empresa && <p className="text-sm text-gray-500">{lead.empresa}</p>}
            <p className="mt-1 text-sm text-gray-500">
              {lead.telefono ?? "Sin teléfono"} · {lead.email ?? "Sin correo"}
            </p>
            {lead.valor_venta != null && (
              <p className="mt-1 text-sm text-gray-500">
                Valor de venta:{" "}
                <span className="font-medium text-gray-900">
                  {Number(lead.valor_venta).toLocaleString("es-CO", {
                    style: "currency",
                    currency: "COP",
                  })}
                </span>
              </p>
            )}
            <div className="mt-2">
              <Estrellas valor={calificacionData?.calificacion_automatica ?? null} />
              {calificacionData && (
                <p className="mt-1 text-xs text-gray-400">
                  Calculada sola según el valor de venta vs. el promedio de tus demás leads
                  cerrados.
                </p>
              )}
            </div>
          </div>
          <CambiarEtapa
            leadId={lead.id}
            etapas={etapas ?? []}
            etapaActualId={lead.etapa_id}
            tieneValorVenta={lead.valor_venta != null}
          />
        </div>
      </div>

      <CamposAdicionales
        leadId={lead.id}
        campos={todosLosCampos}
        valores={
          (lead.campos_etapa as Record<string, string | boolean | { nombre: string; url: string } | null>) ?? {}
        }
      />

      <SeguimientoCalendar
        leadId={lead.id}
        nombreLead={lead.nombre}
        emailLead={lead.email}
        conectado={googleConectado}
        eventos={eventosCalendar}
        rutaConexion={`/admin/leads/${lead.id}`}
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

        <NuevaInteraccionForm leadId={lead.id} />
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Historial</h2>
        {historial && historial.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {historial.map((item) => {
              const nombreQuien = (item.perfiles as unknown as { nombre: string | null } | null)?.nombre;
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
  );
}
