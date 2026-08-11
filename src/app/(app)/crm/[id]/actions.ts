"use server";

import { createClient } from "@/lib/supabase/server";

export async function cambiarEtapa(
  contactoId: string,
  etapaId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_contactos")
    .update({ etapa_id: etapaId })
    .eq("id", contactoId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function guardarCampoValor(input: {
  contactoId: string;
  campoId: string;
  valor: string | boolean | { nombre: string; url: string } | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: contacto, error: errorLectura } = await supabase
    .from("crm_contactos")
    .select("campos_etapa")
    .eq("id", input.contactoId)
    .single();

  if (errorLectura || !contacto) {
    return { error: errorLectura?.message ?? "No se encontró el contacto." };
  }

  const camposActualizados = { ...(contacto.campos_etapa ?? {}), [input.campoId]: input.valor };

  const { error } = await supabase
    .from("crm_contactos")
    .update({ campos_etapa: camposActualizados })
    .eq("id", input.contactoId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function agregarInteraccion(input: {
  contactoId: string;
  fecha: string;
  tipo: string;
  nota: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_interacciones").insert({
    contacto_id: input.contactoId,
    fecha: input.fecha,
    tipo: input.tipo,
    nota: input.nota,
  });

  if (error) return { error: error.message };
  return { error: null };
}
