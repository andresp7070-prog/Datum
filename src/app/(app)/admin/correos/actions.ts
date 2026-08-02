"use server";

import { createClient } from "@/lib/supabase/server";
import {
  enviarCorreoBienvenida,
  enviarCorreoFinDePrueba,
  enviarCorreoPagoFallido,
  enviarCorreoResumenSemanal,
} from "@/lib/email";

export type TipoCorreoPrueba = "bienvenida" | "fin_prueba" | "pago_fallido" | "resumen_semanal";

// Datos de ejemplo, los mismos que se usaron para revisar el diseño de cada
// correo — no hace falta llenar un formulario largo, solo el correo destino.
async function enviarSegunTipo(tipo: TipoCorreoPrueba, correo: string) {
  switch (tipo) {
    case "bienvenida":
      return enviarCorreoBienvenida({
        correo,
        nombreEmpresa: "Aseo Total",
        contrasena: "Xk4-p92R",
      });
    case "fin_prueba":
      return enviarCorreoFinDePrueba({
        correo,
        nombreEmpresa: "Aseo Total",
        diasRestantes: 5,
      });
    case "pago_fallido":
      return enviarCorreoPagoFallido({
        correo,
        nombreEmpresa: "Aseo Total",
      });
    case "resumen_semanal":
      return enviarCorreoResumenSemanal({
        correo,
        nombreEmpresa: "Aseo Total",
        ventasSemana: 1240000,
        ventasSemanaAnterior: 1050000,
      });
  }
}

export async function enviarCorreoDePrueba(input: {
  correo: string;
  tipo: TipoCorreoPrueba;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin" && perfil?.rol !== "super_admin") {
    return { error: "Solo un administrador puede enviar correos de prueba." };
  }

  if (!input.correo.trim()) {
    return { error: "Escribe un correo destino." };
  }

  return enviarSegunTipo(input.tipo, input.correo.trim());
}
