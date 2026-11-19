import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { SignOutButton } from "@/components/signout-button";

// Lo que ve cualquier cuenta de una empresa que Andrés desactivó desde
// /admin/clientes/[id] — ver el gate en (app)/layout.tsx. Si la empresa se
// reactiva, ese mismo gate deja de redirigir acá en el siguiente ingreso.
export default async function CuentaDesactivadaPage() {
  const perfil = await getPerfilActual();

  if (!perfil || esRolDePlataforma(perfil.rol) || perfil.empresas?.activa !== false) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Cuenta desactivada</h1>
        <p className="mb-6 text-sm text-gray-500">
          El acceso de {perfil.empresas?.nombre ?? "tu empresa"} a Datum está temporalmente
          desactivado. Si crees que esto es un error, escríbenos a{" "}
          <a href="mailto:andresp7070@gmail.com" className="text-accent hover:underline">
            andresp7070@gmail.com
          </a>
          .
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
