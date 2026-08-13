import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { NuevoLeadForm } from "./nuevo-lead-form";

export default async function NuevoLeadPage() {
  await requerirAdmin();

  const supabase = await createClient();

  // Ninguna depende de la otra.
  const [{ data: camposGenerales }, { data: primeraEtapa }] = await Promise.all([
    supabase.from("datum_crm_campos_generales").select("id, nombre, tipo, opciones").order("orden"),
    supabase.from("datum_crm_etapas").select("id").order("orden").limit(1).maybeSingle(),
  ]);

  const { data: camposPrimeraEtapa } = primeraEtapa
    ? await supabase
        .from("datum_crm_etapa_campos")
        .select("id, nombre, tipo, opciones")
        .eq("etapa_id", primeraEtapa.id)
        .order("orden")
    : { data: [] };

  const camposObligatorios = [...(camposGenerales ?? []), ...(camposPrimeraEtapa ?? [])];

  return <NuevoLeadForm camposObligatorios={camposObligatorios} />;
}
