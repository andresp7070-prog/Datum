import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { EtapasForm } from "./etapas-form";

export default async function EtapasLeadsDatumPage() {
  await requerirAdmin();
  const supabase = await createClient();

  // camposGenerales no depende de etapas — sale al mismo tiempo.
  const [{ data: etapas }, { data: camposGenerales }] = await Promise.all([
    supabase
      .from("datum_crm_etapas")
      .select("id, nombre, orden, es_cierre, dias_inactividad, etapa_destino_inactividad_id")
      .order("orden"),
    supabase.from("datum_crm_campos_generales").select("id, nombre, tipo, opciones, requerido").order("orden"),
  ]);

  const etapaIds = (etapas ?? []).map((e) => e.id);

  const { data: campos } =
    etapaIds.length > 0
      ? await supabase
          .from("datum_crm_etapa_campos")
          .select("id, etapa_id, nombre, tipo, opciones, requerido")
          .in("etapa_id", etapaIds)
          .order("orden")
      : { data: [] };

  return (
    <EtapasForm etapas={etapas ?? []} campos={campos ?? []} camposGenerales={camposGenerales ?? []} />
  );
}
