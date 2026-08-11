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

export async function borrarEtapaDatum(etapaId: string): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("datum_leads")
    .select("id", { count: "exact", head: true })
    .eq("etapa_id", etapaId);

  if (count && count > 0) {
    return {
      error: `No puedes borrar esta etapa: todavía tiene ${count} lead(s) en ella. Muévelos a otra etapa primero.`,
    };
  }

  const { error } = await supabase.from("datum_crm_etapas").delete().eq("id", etapaId);

  if (error) {
    // 23503: otra etapa la usa como destino de su regla de inactividad.
    if (error.code === "23503") {
      return {
        error: "No puedes borrar esta etapa: otra etapa la tiene como destino de su regla de inactividad. Quita esa regla primero.",
      };
    }
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

export async function crearCampoEtapaDatum(input: {
  etapaId: string;
  nombre: string;
  tipo: string;
  opciones: string[];
  requerido: boolean;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  if (!input.nombre.trim()) return { error: "El nombre del campo es obligatorio." };
  if (input.tipo === "seleccion" && input.opciones.length === 0) {
    return { error: "Escribe al menos una opción para un campo de selección." };
  }

  const supabase = await createClient();

  const { data: ultimo } = await supabase
    .from("datum_crm_etapa_campos")
    .select("orden")
    .eq("etapa_id", input.etapaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("datum_crm_etapa_campos").insert({
    etapa_id: input.etapaId,
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    opciones: input.tipo === "seleccion" ? input.opciones : null,
    requerido: input.requerido,
    orden: (ultimo?.orden ?? 0) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/leads/etapas");
  return { error: null };
}

export async function borrarCampoEtapaDatum(campoId: string): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("datum_crm_etapa_campos").delete().eq("id", campoId);

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
