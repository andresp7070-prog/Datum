"use server";

import { createClient } from "@/lib/supabase/server";
import { crearEventoCalendar, eliminarEventoCalendar } from "@/lib/google";

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

// Duración fija de 30 minutos — no hay ningún campo en la app para elegir
// otra cosa todavía, y así se evita pedirle un dato más a alguien que solo
// quiere dejar un recordatorio rápido de seguimiento.
const DURACION_SEGUIMIENTO_MINUTOS = 30;

export async function agendarSeguimiento(input: {
  contactoId: string;
  titulo: string;
  fechaInicio: string;
  nota: string;
  invitados: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  if (!input.titulo.trim()) return { error: "Escribe un título para el evento." };

  const inicio = new Date(input.fechaInicio);
  if (Number.isNaN(inicio.getTime())) return { error: "Elige una fecha y hora válidas." };
  const fin = new Date(inicio.getTime() + DURACION_SEGUIMIENTO_MINUTOS * 60 * 1000);
  const invitados = input.invitados
    .split(",")
    .map((correo) => correo.trim())
    .filter(Boolean);

  const resultado = await crearEventoCalendar({
    perfilId: user.id,
    titulo: input.titulo.trim(),
    descripcion: input.nota || "Seguimiento agendado desde Datum.",
    fechaInicioISO: inicio.toISOString(),
    fechaFinISO: fin.toISOString(),
    invitados,
  });
  if ("error" in resultado) return { error: resultado.error };

  const { error } = await supabase.from("crm_eventos_calendar").insert({
    contacto_id: input.contactoId,
    perfil_id: user.id,
    google_event_id: resultado.googleEventId,
    link: resultado.link,
    meet_link: resultado.meetLink,
    titulo: input.titulo.trim(),
    fecha: inicio.toISOString(),
    nota: input.nota || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function cancelarSeguimiento(eventoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: evento } = await supabase
    .from("crm_eventos_calendar")
    .select("google_event_id")
    .eq("id", eventoId)
    .single();

  if (evento) {
    const resultado = await eliminarEventoCalendar(user.id, evento.google_event_id);
    if (resultado.error) return { error: resultado.error };
  }

  const { error } = await supabase.from("crm_eventos_calendar").delete().eq("id", eventoId);
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
