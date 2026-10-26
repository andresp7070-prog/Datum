"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esRolDePlataforma } from "@/lib/empresa";
import { VERSION_CONTRATO } from "./contrato";

export async function aceptarTerminos() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, empresa_id")
    .eq("id", user.id)
    .single();

  // Una cuenta de plataforma no le "firma" un contrato a sí misma — esta
  // acción es exclusiva de cuentas cliente, igual que el gate en
  // (app)/layout.tsx.
  if (!perfil?.empresa_id || esRolDePlataforma(perfil.rol)) {
    redirect("/");
  }

  const { error } = await supabase
    .from("empresas")
    .update({ terminos_aceptados_en: new Date().toISOString(), terminos_version: VERSION_CONTRATO })
    .eq("id", perfil.empresa_id);
  if (error) {
    redirect(`/aceptar-terminos?error=${encodeURIComponent("No se pudo guardar tu aceptación — intenta de nuevo.")}`);
  }

  redirect("/");
}
