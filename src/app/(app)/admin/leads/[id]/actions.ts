"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { crearEventoCalendar, eliminarEventoCalendar } from "@/lib/google";

export async function cambiarEtapaLead(
  leadId: string,
  etapaId: string,
  valorVenta?: number,
): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const actualizacion: { etapa_id: string; valor_venta?: number } = { etapa_id: etapaId };
  if (valorVenta !== undefined) actualizacion.valor_venta = valorVenta;

  const { error } = await supabase.from("datum_leads").update(actualizacion).eq("id", leadId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function guardarCampoValorLead(input: {
  leadId: string;
  campoId: string;
  valor: string | boolean | { nombre: string; url: string } | null;
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

// Mismo criterio que agendarSeguimiento() en el CRM de clientes.
const DURACION_SEGUIMIENTO_MINUTOS = 30;

export async function agendarSeguimientoLead(input: {
  leadId: string;
  nombreLead: string;
  fechaInicio: string;
  nota: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const inicio = new Date(input.fechaInicio);
  if (Number.isNaN(inicio.getTime())) return { error: "Elige una fecha y hora válidas." };
  const fin = new Date(inicio.getTime() + DURACION_SEGUIMIENTO_MINUTOS * 60 * 1000);
  const titulo = `Seguimiento: ${input.nombreLead}`;

  const resultado = await crearEventoCalendar({
    perfilId: user.id,
    titulo,
    descripcion: input.nota || "Seguimiento agendado desde Datum.",
    fechaInicioISO: inicio.toISOString(),
    fechaFinISO: fin.toISOString(),
  });
  if ("error" in resultado) return { error: resultado.error };

  const { error } = await supabase.from("datum_crm_eventos_calendar").insert({
    lead_id: input.leadId,
    perfil_id: user.id,
    google_event_id: resultado.googleEventId,
    link: resultado.link,
    titulo,
    fecha: inicio.toISOString(),
    nota: input.nota || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function cancelarSeguimientoLead(eventoId: string): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: evento } = await supabase
    .from("datum_crm_eventos_calendar")
    .select("google_event_id")
    .eq("id", eventoId)
    .single();

  if (evento) {
    const resultado = await eliminarEventoCalendar(user.id, evento.google_event_id);
    if (resultado.error) return { error: resultado.error };
  }

  const { error } = await supabase.from("datum_crm_eventos_calendar").delete().eq("id", eventoId);
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
