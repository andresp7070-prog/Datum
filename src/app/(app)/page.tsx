import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/empresa";

export default async function HomePage() {
  const perfil = await getPerfilActual();
  const paginaEntrada = perfil?.empresas?.pagina_entrada;

  redirect(paginaEntrada ? `/${paginaEntrada}` : "/resumen");
}
