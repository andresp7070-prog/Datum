"use server";

import { createClient } from "@/lib/supabase/server";
import {
  enviarCorreoBienvenida,
  enviarCorreoFinDePrueba,
  enviarCorreoPagoFallido,
  enviarCorreoResumenSemanal,
  enviarCorreoReunionAgendada,
  enviarCorreoPruebaActivada,
  enviarCorreoContrasenaActualizada,
  enviarCorreoPruebaVencida,
  enviarCorreoMetodoPagoAgregado,
  enviarCorreoPagoRealizado,
  enviarCorreoPagoRealizadoDesglosado,
  enviarCorreoCambioPlan,
} from "@/lib/email";

export type TipoCorreoPrueba =
  | "bienvenida"
  | "fin_prueba"
  | "pago_fallido"
  | "resumen_semanal"
  | "reunion_agendada"
  | "prueba_activada"
  | "contrasena_actualizada"
  | "prueba_vencida"
  | "metodo_pago_agregado"
  | "pago_realizado"
  | "pago_realizado_desglosado"
  | "cambio_plan";

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
        monto: 199000,
      });
    case "resumen_semanal":
      return enviarCorreoResumenSemanal({
        correo,
        nombreEmpresa: "Aseo Total",
        ventasSemana: 1240000,
        ventasSemanaAnterior: 1050000,
      });
    case "reunion_agendada":
      return enviarCorreoReunionAgendada({
        correo,
        nombre: "Andrés",
        empresa: "Aseo Total",
        fechaHoraISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        meetLink: "https://meet.google.com/abc-defg-hij",
        modulosInteres: ["Ventas", "Inventario"],
      });
    case "prueba_activada":
      return enviarCorreoPruebaActivada({
        correo,
        nombreEmpresa: "Aseo Total",
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        modulos: ["Ventas", "CRM", "Inventario"],
      });
    case "contrasena_actualizada":
      return enviarCorreoContrasenaActualizada({
        correo,
        nombreEmpresa: "Aseo Total",
      });
    case "prueba_vencida":
      return enviarCorreoPruebaVencida({
        correo,
        nombreEmpresa: "Aseo Total",
      });
    case "metodo_pago_agregado":
      return enviarCorreoMetodoPagoAgregado({
        correo,
        nombreEmpresa: "Aseo Total",
        descripcionMetodo: "Visa •••• 4242",
      });
    case "pago_realizado":
      return enviarCorreoPagoRealizado({
        correo,
        nombreEmpresa: "Aseo Total",
        monto: 199000,
        plan: "Basic",
        descripcionMetodo: "Visa •••• 4242",
      });
    case "pago_realizado_desglosado":
      return enviarCorreoPagoRealizadoDesglosado({
        correo,
        nombreEmpresa: "Aseo Total",
        items: [
          { descripcion: "Suscripción — Plan Startup", monto: 409000 },
          { descripcion: "Facturación electrónica (42 facturas)", monto: 18900 },
        ],
        descripcionMetodo: "Visa •••• 4242",
      });
    case "cambio_plan":
      return enviarCorreoCambioPlan({
        correo,
        nombreEmpresa: "Aseo Total",
        plan: "Pyme",
        montoMensual: 649000,
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
