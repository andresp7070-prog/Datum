import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { EtapasForm } from "./etapas-form";

export default async function EtapasCrmPage() {
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

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { data: etapas } = await supabase
    .from("crm_etapas")
    .select("id, nombre, orden, es_cierre, dias_inactividad, etapa_destino_inactividad_id")
    .eq("empresa_id", perfil.empresa_id)
    .order("orden");

  return <EtapasForm etapas={etapas ?? []} />;
}
