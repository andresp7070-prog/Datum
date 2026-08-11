"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { crearEventoCalendar, eliminarEventoCalendar } from "@/lib/google";
import { formatearValorHistorial } from "@/lib/historial";

export async function cambiarEtapaLead(
  leadId: string,
  etapaId: string,
  valorVenta?: number,
): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leadActual } = await supabase
    .from("datum_leads")
    .select("etapa_id, valor_venta")
    .eq("id", leadId)
    .single();

  const actualizacion: { etapa_id: string; valor_venta?: number } = { etapa_id: etapaId };
  if (valorVenta !== undefined) actualizacion.valor_venta = valorVenta;

  const { error } = await supabase.from("datum_leads").update(actualizacion).eq("id", leadId);

  if (error) return { error: error.message };

  const historial: { lead_id: string; perfil_id: string | null; campo: string; valor_anterior: string | null; valor_nuevo: string | null }[] = [];

  if (leadActual && leadActual.etapa_id !== etapaId) {
    const idsEtapas = [leadActual.etapa_id, etapaId].filter(Boolean) as string[];
    const { data: etapas } = await supabase.from("datum_crm_etapas").select("id, nombre").in("id", idsEtapas);
    const nombreEtapa = (id: string | null) => etapas?.find((e) => e.id === id)?.nombre ?? null;

    historial.push({
      lead_id: leadId,
      perfil_id: user?.id ?? null,
      campo: "Etapa",
      valor_anterior: nombreEtapa(leadActual.etapa_id),
      valor_nuevo: nombreEtapa(etapaId),
    });
  }

  if (valorVenta !== undefined && leadActual?.valor_venta !== valorVenta) {
    historial.push({
      lead_id: leadId,
      perfil_id: user?.id ?? null,
      campo: "Valor de venta",
      valor_anterior: formatearValorHistorial(
        leadActual?.valor_venta != null ? String(leadActual.valor_venta) : null,
      ),
      valor_nuevo: formatearValorHistorial(String(valorVenta)),
    });
  }

  if (historial.length > 0) await supabase.from("datum_crm_historial_lead").insert(historial);

  return { error: null };
}

export async function guardarCampoValorLead(input: {
  leadId: string;
  campoId: string;
  valor: string | boolean | { nombre: string; url: string } | null;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead, error: errorLectura } = await supabase
    .from("datum_leads")
    .select("campos_etapa")
    .eq("id", input.leadId)
    .single();

  if (errorLectura || !lead) {
    return { error: errorLectura?.message ?? "No se encontró el lead." };
  }

  const valorAnterior = (lead.campos_etapa ?? {})[input.campoId] ?? null;
  const camposActualizados = { ...(lead.campos_etapa ?? {}), [input.campoId]: input.valor };

  const { error } = await supabase
    .from("datum_leads")
    .update({ campos_etapa: camposActualizados })
    .eq("id", input.leadId);

  if (error) return { error: error.message };

  const [{ data: campoEtapa }, { data: campoGeneral }] = await Promise.all([
    supabase.from("datum_crm_etapa_campos").select("nombre").eq("id", input.campoId).maybeSingle(),
    supabase.from("datum_crm_campos_generales").select("nombre").eq("id", input.campoId).maybeSingle(),
  ]);

  await supabase.from("datum_crm_historial_lead").insert({
    lead_id: input.leadId,
    perfil_id: user?.id ?? null,
    campo: campoEtapa?.nombre ?? campoGeneral?.nombre ?? "Campo personalizado",
    valor_anterior: formatearValorHistorial(valorAnterior),
    valor_nuevo: formatearValorHistorial(input.valor),
  });

  return { error: null };
}

// Mismo criterio que agendarSeguimiento() en el CRM de clientes.
const DURACION_SEGUIMIENTO_MINUTOS = 30;

export async function agendarSeguimientoLead(input: {
  leadId: string;
  titulo: string;
  fechaInicio: string;
  nota: string;
  invitados: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
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

  const { error } = await supabase.from("datum_crm_eventos_calendar").insert({
    lead_id: input.leadId,
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
