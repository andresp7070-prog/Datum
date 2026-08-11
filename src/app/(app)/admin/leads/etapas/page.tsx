import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { EtapasForm } from "./etapas-form";

export default async function EtapasLeadsDatumPage() {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: etapas } = await supabase
    .from("datum_crm_etapas")
    .select("id, nombre, orden, es_cierre, dias_inactividad, etapa_destino_inactividad_id")
    .order("orden");

  return <EtapasForm etapas={etapas ?? []} />;
}
