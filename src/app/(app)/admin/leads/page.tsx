import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { DirectorioLeads } from "./directorio-leads";

export default async function LeadsDatumPage() {
  await requerirAdmin();
  const supabase = await createClient();

  // Igual criterio que el CRM en modo 'leads' de los clientes: se aplican
  // las reglas de inactividad cada vez que alguien abre esta pantalla, no
  // en segundo plano.
  await supabase.rpc("aplicar_reglas_inactividad_crm_datum");

  // Ninguna de las tres depende de las otras — todas se piden después de
  // aplicar las reglas de inactividad, pero entre sí salen juntas.
  const [{ data: etapas }, { data: leads, error }, { data: calificaciones }] = await Promise.all([
    supabase.from("datum_crm_etapas").select("id, nombre, orden, es_cierre").order("orden"),
    supabase
      .from("datum_leads")
      .select("id, nombre, empresa, telefono, email, etapa_id, valor_venta, prioridad")
      .order("nombre"),
    // La calificación ya no se pone a mano — se calcula sola según el valor
    // de venta que generó cada lead (ver vista_calificacion_leads_datum).
    supabase.from("vista_calificacion_leads_datum").select("lead_id, calificacion_automatica"),
  ]);

  const calificacionPorLead = new Map(
    (calificaciones ?? []).map((c) => [c.lead_id, c.calificacion_automatica]),
  );

  const leadsConCalificacion = (leads ?? []).map((lead) => ({
    ...lead,
    calificacion: calificacionPorLead.get(lead.id) ?? null,
  }));

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar leads: {error.message}
        </div>
      )}
      <DirectorioLeads leads={leadsConCalificacion} etapas={etapas ?? []} />
    </>
  );
}
