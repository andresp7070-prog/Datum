"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

export async function crearLead(input: {
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
}): Promise<{ error: string | null; id?: string }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("datum_leads")
    .insert({
      nombre: input.nombre,
      empresa: input.empresa || null,
      telefono: input.telefono || null,
      email: input.email || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}
