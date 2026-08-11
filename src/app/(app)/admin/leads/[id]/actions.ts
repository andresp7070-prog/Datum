"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

export async function cambiarEtapaLead(
  leadId: string,
  etapaId: string,
): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("datum_leads").update({ etapa_id: etapaId }).eq("id", leadId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function calificarLead(
  leadId: string,
  calificacion: number | null,
): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("datum_leads").update({ calificacion }).eq("id", leadId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function guardarCampoValorLead(input: {
  leadId: string;
  campoId: string;
  valor: string | boolean | null;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: lead, error: errorLectura } = await supabase
    .from("datum_leads")
    .select("campos_etapa")
    .eq("id", input.leadId)
    .single();

  if (errorLectura || !lead) {
    return { error: errorLectura?.message ?? "No se encontró el lead." };
  }

  const camposActualizados = { ...(lead.campos_etapa ?? {}), [input.campoId]: input.valor };

  const { error } = await supabase
    .from("datum_leads")
    .update({ campos_etapa: camposActualizados })
    .eq("id", input.leadId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function agregarInteraccionLead(input: {
  leadId: string;
  fecha: string;
  tipo: string;
  nota: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("datum_crm_interacciones").insert({
    lead_id: input.leadId,
    fecha: input.fecha,
    tipo: input.tipo,
    nota: input.nota,
  });

  if (error) return { error: error.message };
  return { error: null };
}
