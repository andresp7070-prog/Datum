"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";

const DIAS_VALIDOS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
const PLANES_VALIDOS = ["basic", "startup", "pyme", "enterprise"] as const;

// Mismo límite que nuevo-cliente-form.tsx (ver CLAUDE.md, "Planes y
// precios") — se valida de nuevo acá por si algún día algo llega a este
// action sin pasar por ese formulario.
const LIMITE_MODULOS_POR_PLAN: Record<string, number> = {
  basic: 1,
  startup: 3,
  pyme: 5,
  enterprise: 6,
};

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Legible pero al azar (2 mayúsculas, 2 minúsculas, 2 dígitos, un guion en
// medio) — no hace falta que sea indescifrable: es temporal, y la app obliga
// a cambiarla en el primer inicio de sesión (perfiles.debe_cambiar_password).
function generarContrasenaTemporal(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const digitos = "23456789";
  const azar = (fuente: string) => fuente[Math.floor(Math.random() * fuente.length)];
  const parte1 = Array.from({ length: 4 }, () => azar(letras)).join("");
  const parte2 = Array.from({ length: 4 }, () => azar(digitos)).join("");
  return `${parte1}-${parte2}`;
}

export async function crearCliente(input: {
  nombreEmpresa: string;
  modulosActivos: string[];
  crmModo: string;
  nominaFrecuenciaPago: string;
  horaApertura: string;
  horaCierre: string;
  diasAtencion: string[];
  plan: string;
  montoMensual: string;
  facturacion: string;
  diaPago: string;
  nombreCliente: string;
  correoCliente: string;
  nit: string;
  ciudad: string;
  representanteLegalNombre: string;
  representanteLegalCc: string;
}): Promise<
  | { ok: true; contrasena: string; correoEnviado: boolean; errorCorreo: string | null }
  | { ok: false; error: string }
> {
  await requerirAdmin();

  const nombreEmpresa = input.nombreEmpresa.trim();
  const nombreCliente = input.nombreCliente.trim();
  const correoCliente = input.correoCliente.trim().toLowerCase();
  const nit = input.nit.trim();
  const ciudad = input.ciudad.trim();
  const representanteLegalNombre = input.representanteLegalNombre.trim();
  const representanteLegalCc = input.representanteLegalCc.trim();

  if (!nombreEmpresa || !nombreCliente || !correoCliente) {
    return { ok: false, error: "Completa el nombre de la empresa, el nombre del cliente y su correo." };
  }
  if (!correoValido(correoCliente)) {
    return { ok: false, error: "El correo no parece válido." };
  }
  // Estos 4 datos los pide el contrato (ver src/app/aceptar-terminos/)
  // para identificar a EL CLIENTE — a esta altura (ya se decidió crearle
  // la cuenta) ya se conversó con la persona, así que no hay razón para
  // dejarlos a medias y tener que completarlos después a mano en Supabase.
  if (!nit || !ciudad || !representanteLegalNombre || !representanteLegalCc) {
    return {
      ok: false,
      error: "Completa el NIT/cédula, la ciudad, y el nombre y cédula del representante legal.",
    };
  }
  if (input.modulosActivos.length === 0) {
    return { ok: false, error: "Elige al menos un módulo." };
  }
  if (input.crmModo !== "ventas" && input.crmModo !== "leads") {
    return { ok: false, error: "Elige un modo de CRM válido." };
  }
  if (input.nominaFrecuenciaPago !== "mensual" && input.nominaFrecuenciaPago !== "quincenal") {
    return { ok: false, error: "Elige una frecuencia de pago de nómina válida." };
  }
  if (!input.diasAtencion.every((d) => (DIAS_VALIDOS as readonly string[]).includes(d))) {
    return { ok: false, error: "Uno de los días de atención no es válido." };
  }
  if (!PLANES_VALIDOS.includes(input.plan as (typeof PLANES_VALIDOS)[number])) {
    return { ok: false, error: "Elige un plan válido." };
  }
  const limiteModulos = LIMITE_MODULOS_POR_PLAN[input.plan] ?? 6;
  if (input.modulosActivos.length > limiteModulos) {
    return { ok: false, error: `El plan elegido permite hasta ${limiteModulos} módulo(s) — quita alguno.` };
  }
  const montoMensual = Number(input.montoMensual);
  if (!Number.isFinite(montoMensual) || montoMensual <= 0) {
    return { ok: false, error: "El monto mensual no es válido." };
  }
  if (input.facturacion !== "mensual" && input.facturacion !== "anual") {
    return { ok: false, error: "Elige una frecuencia de facturación válida." };
  }
  let diaPago: number | null = null;
  if (input.diaPago.trim()) {
    diaPago = Number(input.diaPago);
    if (!Number.isInteger(diaPago) || diaPago < 1 || diaPago > 31) {
      return { ok: false, error: "El día de pago debe ser un número entre 1 y 31." };
    }
  }

  const supabase = createAdminClient();
  const contrasena = generarContrasenaTemporal();

  // 1. Usuario de acceso (Auth). email_confirm:true porque el correo de
  // bienvenida (paso 4, más abajo) ya es la comunicación oficial — no hace
  // falta que Supabase mande el suyo propio de confirmación encima.
  const { data: usuarioCreado, error: errorUsuario } = await supabase.auth.admin.createUser({
    email: correoCliente,
    password: contrasena,
    email_confirm: true,
  });
  if (errorUsuario || !usuarioCreado.user) {
    return { ok: false, error: `No se pudo crear el usuario: ${errorUsuario?.message ?? "error desconocido"}` };
  }
  const usuarioId = usuarioCreado.user.id;

  // 2. Empresa. Si falla, se limpia el usuario recién creado en el paso 1 —
  // sin este paso, quedaría un usuario de Auth huérfano, sin empresa ni
  // perfil, que nadie podría usar ni volver a crear (el correo ya estaría
  // tomado).
  const { data: empresaCreada, error: errorEmpresa } = await supabase
    .from("empresas")
    .insert({
      nombre: nombreEmpresa,
      // "insights" (Panel de control) siempre va incluido y gratis, sin
      // ocupar cupo del plan — no lo pide el formulario, se agrega acá.
      modulos_activos: [...input.modulosActivos, "insights"],
      crm_modo: input.crmModo,
      nomina_frecuencia_pago: input.nominaFrecuenciaPago,
      hora_apertura: input.horaApertura || null,
      hora_cierre: input.horaCierre || null,
      dias_atencion: input.diasAtencion.length > 0 ? input.diasAtencion : null,
      monto_mensual: montoMensual,
      // Datos que pide el contrato para identificar a EL CLIENTE (ver
      // src/app/aceptar-terminos/) — obligatorios, ya validados arriba.
      nit,
      ciudad,
      representante_legal_nombre: representanteLegalNombre,
      representante_legal_cc: representanteLegalCc,
    })
    .select("id")
    .single();
  if (errorEmpresa || !empresaCreada) {
    await supabase.auth.admin.deleteUser(usuarioId);
    return { ok: false, error: `No se pudo crear la empresa: ${errorEmpresa?.message ?? "error desconocido"}` };
  }

  // 3. Perfil — conecta el usuario de Auth con la empresa. debe_cambiar_password
  // se queda en su default (true): la app ya obliga a cambiarla en el primer
  // inicio de sesión (ver src/app/(app)/layout.tsx).
  const { error: errorPerfil } = await supabase.from("perfiles").insert({
    id: usuarioId,
    empresa_id: empresaCreada.id,
    rol: "cliente",
    rol_empresa: "administrador",
    nombre: nombreCliente,
  });
  if (errorPerfil) {
    await supabase.auth.admin.deleteUser(usuarioId);
    await supabase.from("empresas").delete().eq("id", empresaCreada.id);
    return { ok: false, error: `No se pudo crear el perfil: ${errorPerfil.message}` };
  }

  // 4. Suscripción — plan, monto, si se factura mensual o anual, y día de
  // pago acordados, y arranca en 'prueba' (fecha_fin_prueba usa su default
  // de 15 días calendario, la misma prueba gratuita del contrato). El cobro
  // sigue siendo manual por ahora (ver sección "Cobros" en CLAUDE.md); esto
  // es solo el dato para saber cuánto y cuándo cobrarle.
  const { error: errorSuscripcion } = await supabase.from("suscripciones").insert({
    empresa_id: empresaCreada.id,
    monto_mensual: montoMensual,
    plan: input.plan,
    facturacion: input.facturacion,
    dia_pago: diaPago,
  });
  if (errorSuscripcion) {
    await supabase.auth.admin.deleteUser(usuarioId);
    await supabase.from("empresas").delete().eq("id", empresaCreada.id);
    return { ok: false, error: `No se pudo crear la suscripción: ${errorSuscripcion.message}` };
  }

  // 5. Correo de bienvenida — si falla, la cuenta ya quedó creada y
  // funcionando igual (no se deshace nada); se devuelve la contraseña para
  // que quede visible en pantalla y se pueda mandar por otro medio.
  const resultadoCorreo = await enviarCorreoBienvenida({
    correo: correoCliente,
    nombreEmpresa,
    contrasena,
  });

  return {
    ok: true,
    contrasena,
    correoEnviado: !resultadoCorreo.error,
    errorCorreo: resultadoCorreo.error,
  };
}
