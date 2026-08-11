"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function crearEtapaDatum(nombre: string): Promise<{ error: string | null }> {
  await requerirAdmin();
  if (!nombre.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();

  const { data: ultima } = await supabase
    .from("datum_crm_etapas")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("datum_crm_etapas").insert({
    nombre: nombre.trim(),
    orden: (ultima?.orden ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: `Ya existe una etapa llamada "${nombre.trim()}".` };
    return { error: error.message };
  }
  revalidatePath("/admin/leads/etapas");
  return { error: null };
}

export async function renombrarEtapaDatum(
  etapaId: string,
  nombre: string,
): Promise<{ error: string | null }> {
  if (!nombre.trim()) return { error: "El nombre es obligatorio." };
  await requerirAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("datum_crm_etapas")
    .update({ nombre: nombre.trim() })
    .eq("id", etapaId);

  if (error) {
    if (error.code === "23505") return { error: `Ya existe una etapa llamada "${nombre.trim()}".` };
    return { error: error.message };
  }
  revalidatePath("/admin/leads/etapas");
  return { error: null };
}

export async function moverEtapaDatum(
  etapaId: string,
  direccion: "arriba" | "abajo",
): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_etapa_datum", {
    p_etapa_id: etapaId,
    p_direccion: direccion,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/leads/etapas");
  return { error: null };
}

export async function marcarEtapaCierreDatum(etapaId: string): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_etapa_cierre_datum", { p_etapa_id: etapaId });

  if (error) return { error: error.message };
  revalidatePath("/admin/leads/etapas");
  return { error: null };
}

export async function actualizarReglaInactividadDatum(input: {
  etapaId: string;
  diasInactividad: number | null;
  etapaDestinoId: string | null;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("datum_crm_etapas")
    .update({
      dias_inactividad: input.diasInactividad,
      etapa_destino_inactividad_id: input.etapaDestinoId,
    })
    .eq("id", input.etapaId);

  if (error) return { error: error.message };
  revalidatePath("/admin/leads/etapas");
  return { error: null };
}
