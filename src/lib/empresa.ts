import { createClient } from "@/lib/supabase/server";

type Empresa = {
  id: string;
  nombre: string;
  tipo_negocio: string | null;
  pagina_entrada: string;
};

type Perfil = {
  rol: string;
  nombre: string | null;
  empresa_id: string | null;
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
    .select("rol, nombre, empresa_id, empresas ( id, nombre, tipo_negocio, pagina_entrada )")
    .eq("id", user.id)
    .single();

  // La relación empresa_id -> empresas.id es uno-a-uno; Supabase la tipa como
  // arreglo por falta de tipos generados, pero en tiempo de ejecución es un objeto.
  return perfil as unknown as Perfil | null;
}
