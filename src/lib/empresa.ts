import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Empresa = {
  id: string;
  nombre: string;
  tipo_negocio: string | null;
  pagina_entrada: string;
  modulos_activos: string[];
};

type Perfil = {
  rol: string;
  rol_empresa: "administrador" | "vendedor";
  nombre: string | null;
  empresa_id: string | null;
  debe_cambiar_password: boolean;
  empresas: Empresa | null;
};

export async function getPerfilActual(): Promise<Perfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select(
      "rol, rol_empresa, nombre, empresa_id, debe_cambiar_password, empresas ( id, nombre, tipo_negocio, pagina_entrada, modulos_activos )",
    )
    .eq("id", user.id)
    .single();

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa como
  // arreglo por falta de tipos generados, pero en tiempo de ejecución es un objeto.
  return perfil as unknown as Perfil | null;
}

// Bloquea el acceso directo por URL a un módulo que la empresa no tiene
// activo, o que el rol de la persona dentro de la empresa no le permite ver
// (aunque no aparezca en el menú, alguien podría intentar entrar escribiendo
// la dirección a mano). Un "vendedor" solo puede ver Ventas.
export async function requerirModulo(modulo: string) {
  const perfil = await getPerfilActual();
  if (perfil?.rol === "admin") return;

  if (perfil?.rol_empresa === "vendedor" && modulo !== "ventas") {
    redirect("/ventas");
  }

  const modulosActivos = perfil?.empresas?.modulos_activos ?? [];
  if (!modulosActivos.includes(modulo)) {
    redirect("/resumen");
  }
}

// Bloquea el acceso a pantallas exclusivas del administrador.
export async function requerirAdmin() {
  const perfil = await getPerfilActual();
  if (perfil?.rol !== "admin") {
    redirect("/resumen");
  }
}
