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

  const etapaIds = (etapas ?? []).map((e) => e.id);

  const { data: campos } =
    etapaIds.length > 0
      ? await supabase
          .from("datum_crm_etapa_campos")
          .select("id, etapa_id, nombre, tipo, opciones, requerido")
          .in("etapa_id", etapaIds)
          .order("orden")
      : { data: [] };

  return <EtapasForm etapas={etapas ?? []} campos={campos ?? []} />;
}
