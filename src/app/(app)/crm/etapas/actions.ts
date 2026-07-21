"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function empresaIdDeSesion(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  return perfil?.empresa_id ?? null;
}

export async function crearEtapa(nombre: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const empresaId = await empresaIdDeSesion(supabase);
  if (!empresaId) return { error: "No hay sesión activa." };

  if (!nombre.trim()) return { error: "El nombre es obligatorio." };

  const { data: ultima } = await supabase
    .from("crm_etapas")
    .select("orden")
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("crm_etapas").insert({
    empresa_id: empresaId,
    nombre: nombre.trim(),
    orden: (ultima?.orden ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: `Ya existe una etapa llamada "${nombre.trim()}".` };
    return { error: error.message };
  }
  revalidatePath("/crm/etapas");
  return { error: null };
}

export async function renombrarEtapa(
  etapaId: string,
  nombre: string,
): Promise<{ error: string | null }> {
  if (!nombre.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_etapas")
    .update({ nombre: nombre.trim() })
    .eq("id", etapaId);

  if (error) {
    if (error.code === "23505") return { error: `Ya existe una etapa llamada "${nombre.trim()}".` };
    return { error: error.message };
  }
  revalidatePath("/crm/etapas");
  return { error: null };
}

export async function moverEtapa(
  etapaId: string,
  direccion: "arriba" | "abajo",
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_etapa_crm", {
    p_etapa_id: etapaId,
    p_direccion: direccion,
  });

  if (error) return { error: error.message };
  revalidatePath("/crm/etapas");
  return { error: null };
}

export async function marcarEtapaCierre(etapaId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_etapa_cierre", { p_etapa_id: etapaId });

  if (error) return { error: error.message };
  revalidatePath("/crm/etapas");
  return { error: null };
}

export async function actualizarReglaInactividad(input: {
  etapaId: string;
  diasInactividad: number | null;
  etapaDestinoId: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_etapas")
    .update({
      dias_inactividad: input.diasInactividad,
      etapa_destino_inactividad_id: input.etapaDestinoId,
    })
    .eq("id", input.etapaId);

  if (error) return { error: error.message };
  revalidatePath("/crm/etapas");
  return { error: null };
}
