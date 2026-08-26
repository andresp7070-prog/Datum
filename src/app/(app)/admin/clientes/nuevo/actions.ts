"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";

const PAGINAS_ENTRADA = ["ventas", "crm", "inventario", "pyg", "insights"] as const;

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
  paginaEntrada: string;
  nombreCliente: string;
  correoCliente: string;
}): Promise<
  | { ok: true; contrasena: string; correoEnviado: boolean; errorCorreo: string | null }
  | { ok: false; error: string }
> {
  await requerirAdmin();

  const nombreEmpresa = input.nombreEmpresa.trim();
  const nombreCliente = input.nombreCliente.trim();
  const correoCliente = input.correoCliente.trim().toLowerCase();

  if (!nombreEmpresa || !nombreCliente || !correoCliente) {
    return { ok: false, error: "Completa el nombre de la empresa, el nombre del cliente y su correo." };
  }
  if (!correoValido(correoCliente)) {
    return { ok: false, error: "El correo no parece válido." };
  }
  if (input.modulosActivos.length === 0) {
    return { ok: false, error: "Elige al menos un módulo." };
  }
  if (!PAGINAS_ENTRADA.includes(input.paginaEntrada as (typeof PAGINAS_ENTRADA)[number])) {
    return { ok: false, error: "Elige una página de entrada válida." };
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
      modulos_activos: input.modulosActivos,
      pagina_entrada: input.paginaEntrada,
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

  // 4. Correo de bienvenida — si falla, la cuenta ya quedó creada y
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
