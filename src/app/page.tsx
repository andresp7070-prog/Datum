import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { Landing } from "./landing";

// La raíz es la landing pública — sin sesión, cualquiera la ve. Con sesión
// ya no tiene sentido mostrarla, así que redirige directo adentro de la
// plataforma (misma lógica que antes vivía en (app)/page.tsx).
export default async function RootPage() {
  const perfil = await getPerfilActual();

  if (!perfil) {
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
