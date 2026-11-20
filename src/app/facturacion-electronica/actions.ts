"use server";

import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";

const PRECIO_CERTIFICADO: Record<string, number> = {
  anual: 150000,
  mensual: 15000,
};

export async function activarFacturacionElectronica(
  certificadoFacturacion: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.empresa_id || esRolDePlataforma(perfil.rol)) {
    redirect("/");
  }

  if (certificadoFacturacion !== "mensual" && certificadoFacturacion !== "anual") {
    return { ok: false, error: "Elige una opción de facturación válida." };
  }

  // La sesión normal del cliente no puede escribir esta tabla (RLS "solo
  // admin") — ver el comentario en facturacion-electronica/page.tsx.
  const supabase = createAdminClient();

  const { data: integracion } = await supabase
    .from("integraciones_factus")
    .select("id, estado")
    .eq("empresa_id", perfil.empresa_id)
    .maybeSingle();

  if (!integracion || integracion.estado !== "pendiente") {
    return { ok: false, error: "No hay ninguna activación pendiente para tu empresa." };
  }

  const { error } = await supabase
    .from("integraciones_factus")
    .update({
      estado: "activa",
      certificado_facturacion: certificadoFacturacion,
      certificado_monto: PRECIO_CERTIFICADO[certificadoFacturacion],
      terminos_aceptados_en: new Date().toISOString(),
    })
    .eq("id", integracion.id);

  if (error) {
    return { ok: false, error: `No se pudo activar: ${error.message}` };
  }

  // Copia de estado = 'activa' en empresas, para que "Agregar venta" (la
  // pantalla más visitada) pueda mostrar el check sin leer esta tabla —
  // ver schema.sql, "CHECK DE 'FACTURAR ELECTRÓNICAMENTE' EN AGREGAR VENTA".
  await supabase
    .from("empresas")
    .update({ factura_electronica_activa: true })
    .eq("id", perfil.empresa_id);

  redirect("/facturacion-electronica");
}
