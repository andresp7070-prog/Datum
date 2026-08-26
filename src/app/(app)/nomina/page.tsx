import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requerirModulo } from "@/lib/empresa";
import { NominaTabs } from "./nomina-tabs";

// numeric de Postgres llega como texto vía Supabase (para no perder precisión
// con decimales) — hay que convertirlo antes de formatear, si no, toLocaleString
// se ejecuta sobre el string y lo deja tal cual, sin darle forma de plata.
function formatoMoneda(valor: number | string) {
  return Number(valor).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default async function NominaPage() {
  await requerirModulo("nomina");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { data: empleadosData } = await supabase
    .from("empleados")
    .select("id, nombre, cargo, salario_base, activo")
    .eq("empresa_id", perfil.empresa_id)
    .order("activo", { ascending: false })
    .order("nombre");

  const empleados = empleadosData ?? [];

  return (
    <div>
      <NominaTabs />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Nómina</h1>
          <p className="mt-1 text-sm text-gray-500">Empleados registrados y su salario.</p>
        </div>
        <Link
          href="/nomina/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Agregar empleado
        </Link>
      </div>

      {empleados.length === 0 ? (
        <p className="text-gray-400">Todavía no tienes empleados registrados.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {empleados.map((e) => (
            <li key={e.id}>
              <Link
                href={`/nomina/${e.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className={`text-sm font-medium ${e.activo ? "text-gray-900" : "text-gray-400"}`}>
                    {e.nombre}
                    {!e.activo && " (retirado)"}
                  </p>
                  <p className="text-xs text-gray-400">{e.cargo || "Sin cargo"}</p>
                </div>
                <span className="text-sm text-gray-700">{formatoMoneda(e.salario_base)}/mes</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
