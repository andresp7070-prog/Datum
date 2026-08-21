"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { formatearValorHistorial } from "@/lib/historial";

type ValorCampo = string | boolean | { nombre: string; url: string } | null;

function campoEstaVacio(valor: ValorCampo, tipo: string): boolean {
  if (tipo === "si_no") return false;
  if (tipo === "enlace") {
    return !valor || typeof valor !== "object" || !valor.nombre.trim() || !valor.url.trim();
  }
  return valor === null || valor === undefined || (typeof valor === "string" && !valor.trim());
}

export async function crearLead(input: {
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  camposValores: Record<string, ValorCampo>;
}): Promise<{ error: string | null; id?: string }> {
  await requerirAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Mismo criterio que crearCliente(): se vuelve a calcular del lado del
  // servidor cuáles campos son obligatorios, no basta con la validación
  // del formulario.
  const { data: camposGenerales } = await supabase
    .from("datum_crm_campos_generales")
    .select("id, nombre, tipo");

  const { data: primeraEtapa } = await supabase
    .from("datum_crm_etapas")
    .select("id")
    .order("orden")
    .limit(1)
    .maybeSingle();

  const { data: camposPrimeraEtapa } = primeraEtapa
    ? await supabase.from("datum_crm_etapa_campos").select("id, nombre, tipo").eq("etapa_id", primeraEtapa.id)
    : { data: [] };

  const camposObligatorios = [...(camposGenerales ?? []), ...(camposPrimeraEtapa ?? [])];

  const campoFaltante = camposObligatorios.find((campo) =>
    campoEstaVacio(input.camposValores[campo.id] ?? null, campo.tipo),
  );
  if (campoFaltante) return { error: `El campo "${campoFaltante.nombre}" es obligatorio.` };

  const { data, error } = await supabase
    .from("datum_leads")
    .insert({
      nombre: input.nombre,
      empresa: input.empresa || null,
      telefono: input.telefono || null,
      email: input.email || null,
      campos_etapa: input.camposValores,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (camposObligatorios.length > 0) {
    const historial = camposObligatorios.map((campo) => ({
      lead_id: data.id as string,
      perfil_id: user?.id ?? null,
      campo: campo.nombre,
      valor_anterior: null,
      valor_nuevo: formatearValorHistorial(input.camposValores[campo.id] ?? null),
    }));
    await supabase.from("datum_crm_historial_lead").insert(historial);
  }

  return { error: null, id: data.id as string };
}
