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

  const { data: etapas } = await supabase
    .from("datum_crm_etapas")
    .select("id, nombre, orden")
    .order("orden");

  const { data: leads, error } = await supabase
    .from("datum_leads")
    .select("id, nombre, empresa, telefono, email, etapa_id, calificacion")
    .order("nombre");

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar leads: {error.message}
        </div>
      )}
      <DirectorioLeads leads={leads ?? []} etapas={etapas ?? []} />
    </>
  );
}
