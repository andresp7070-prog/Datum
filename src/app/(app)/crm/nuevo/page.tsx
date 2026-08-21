import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { NuevoClienteForm } from "./nuevo-cliente-form";

export default async function NuevoClientePage() {
  await requerirModulo("crm");

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

  // Los campos que se piden al crear (generales + los de la primera etapa
  // del embudo) son siempre obligatorios — así cada contacto nace con esa
  // información ya completa, en vez de quedar a medias hasta que alguien
  // la llene después en la ficha.
  // Ninguna de las dos depende de la otra — ambas solo necesitan empresa_id.
  const [{ data: camposGenerales }, { data: primeraEtapa }] = await Promise.all([
    perfil?.empresa_id
      ? supabase
          .from("crm_campos_generales")
          .select("id, nombre, tipo, opciones")
          .eq("empresa_id", perfil.empresa_id)
          .order("orden")
      : Promise.resolve({ data: [] }),
    perfil?.empresa_id
      ? supabase
          .from("crm_etapas")
          .select("id")
          .eq("empresa_id", perfil.empresa_id)
          .order("orden")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: camposPrimeraEtapa } = primeraEtapa
    ? await supabase
        .from("crm_etapa_campos")
        .select("id, nombre, tipo, opciones")
        .eq("etapa_id", primeraEtapa.id)
        .order("orden")
    : { data: [] };

  const camposObligatorios = [...(camposGenerales ?? []), ...(camposPrimeraEtapa ?? [])];

  return <NuevoClienteForm camposObligatorios={camposObligatorios} />;
}
