import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requerirModulo } from "@/lib/empresa";
import { NominaTabs } from "../nomina-tabs";

function formatoFecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PeriodosNominaPage() {
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

  const { data: periodosData } = await supabase
    .from("nomina_periodos")
    .select("id, fecha_inicio, fecha_fin, fecha_pago, estado")
    .eq("empresa_id", perfil.empresa_id)
    .order("fecha_inicio", { ascending: false });

  const periodos = periodosData ?? [];

  return (
    <div>
      <NominaTabs />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Períodos de nómina</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cada corrida de nómina, con su fecha de pago y si ya está pagada.
          </p>
        </div>
        <Link
          href="/nomina/periodos/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Generar nómina
        </Link>
      </div>

      {periodos.length === 0 ? (
        <p className="text-gray-400">Todavía no has generado ningún período de nómina.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {periodos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/nomina/periodos/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatoFecha(p.fecha_inicio)} — {formatoFecha(p.fecha_fin)}
                  </p>
                  <p className="text-xs text-gray-400">Pago: {formatoFecha(p.fecha_pago)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    p.estado === "pagado" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {p.estado === "pagado" ? "Pagada" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
