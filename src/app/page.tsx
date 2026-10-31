import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { Landing } from "./landing";

// La raíz es la landing pública — sin sesión, cualquiera la ve. Con sesión
// ya no tiene sentido mostrarla, así que redirige directo adentro de la
// plataforma (misma lógica que antes vivía en (app)/page.tsx).
export default async function RootPage() {
  const perfil = await getPerfilActual();

  if (!perfil) {
    // Diagnóstico temporal (2026-10-31) — quitar en cuanto se resuelva el
    // caso real de una cuenta que no entra en Preview. Nunca se muestra en
    // producción (VERCEL_ENV), aunque esta rama se fusione sin limpiarlo.
    if (process.env.VERCEL_ENV !== "production") {
      const detalle = await diagnosticoSesion();
      return (
        <>
          <div
            style={{
              background: "#fef3c7",
              color: "#92400e",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: "13px",
              wordBreak: "break-all",
            }}
          >
            DIAGNÓSTICO TEMPORAL: {detalle}
          </div>
          <Landing />
        </>
      );
    }
    return <Landing />;
  }

  if (esRolDePlataforma(perfil.rol)) {
    redirect("/admin");
  }

  if (perfil.rol_empresa === "vendedor") {
    redirect("/ventas");
  }

  // La página de entrada siempre es el resumen — ya no varía por empresa
  // (antes lo decidía empresas.pagina_entrada).
  redirect("/resumen");
}

async function diagnosticoSesion(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error: errorUser,
  } = await supabase.auth.getUser();

  if (!user) {
    return errorUser
      ? `sin sesión — error al pedir el usuario: ${errorUser.message}`
      : "sin sesión de Supabase (getUser() no encontró ningún usuario, sin error)";
  }

  const { error: errorPerfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();

  if (errorPerfil) {
    return `hay sesión (usuario ${user.id}), pero la consulta a perfiles falló: "${errorPerfil.message}" (código ${errorPerfil.code}, status ${(errorPerfil as { status?: number }).status ?? "?"})`;
  }

  return `hay sesión (usuario ${user.id}) y la consulta a perfiles funcionó bien — revisar la consulta con el join a empresas en getPerfilActual()`;
}
