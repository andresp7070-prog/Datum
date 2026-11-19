"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

// Activa o desactiva el acceso completo de una empresa (ver el gate en
// (app)/layout.tsx y schema.sql, "ACTIVAR/DESACTIVAR UNA EMPRESA DESDE EL
// ADMIN"). Sesión normal del admin: basta con que es_admin() reconozca
// 'super_admin' (corregido 2026-11-19) para que la política "actualizar mi
// propia empresa" deje escribir esta columna — no hace falta la llave de
// servicio.
export async function cambiarEstadoEmpresa(
  empresaId: string,
  activa: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requerirAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("empresas").update({ activa }).eq("id", empresaId);
  if (error) {
    return { ok: false, error: `No se pudo actualizar: ${error.message}` };
  }
  return { ok: true };
}
