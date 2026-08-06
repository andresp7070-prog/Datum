import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requerirModulo } from "@/lib/empresa";
import { NominaTabs } from "../nomina-tabs";

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

type FilaRaw = {
  empleado_id: string;
  provision_cesantias: number;
  provision_intereses_cesantias: number;
  provision_prima: number;
  provision_vacaciones: number;
  empleados: { nombre: string; activo: boolean } | { nombre: string; activo: boolean }[] | null;
};

export default async function PrestacionesPage() {
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

  const { data: filasData } = await supabase
    .from("nomina_detalles")
    .select(
      "empleado_id, provision_cesantias, provision_intereses_cesantias, provision_prima, provision_vacaciones, empleados!inner ( nombre, activo, empresa_id )",
    )
    .eq("empleados.empresa_id", perfil.empresa_id);

  const filas = (filasData ?? []) as FilaRaw[];

  const porEmpleado = new Map<
    string,
    { nombre: string; activo: boolean; cesantias: number; intereses: number; prima: number; vacaciones: number }
  >();

  for (const f of filas) {
    const empleado = Array.isArray(f.empleados) ? f.empleados[0] : f.empleados;
    if (!empleado) continue;
    const actual = porEmpleado.get(f.empleado_id) ?? {
      nombre: empleado.nombre,
      activo: empleado.activo,
      cesantias: 0,
      intereses: 0,
      prima: 0,
      vacaciones: 0,
    };
    actual.cesantias += f.provision_cesantias;
    actual.intereses += f.provision_intereses_cesantias;
    actual.prima += f.provision_prima;
    actual.vacaciones += f.provision_vacaciones;
    porEmpleado.set(f.empleado_id, actual);
  }

  const filasOrdenadas = Array.from(porEmpleado.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const totales = filasOrdenadas.reduce(
    (acc, f) => ({
      cesantias: acc.cesantias + f.cesantias,
      intereses: acc.intereses + f.intereses,
      prima: acc.prima + f.prima,
      vacaciones: acc.vacaciones + f.vacaciones,
    }),
    { cesantias: 0, intereses: 0, prima: 0, vacaciones: 0 },
  );
  const totalGeneral = totales.cesantias + totales.intereses + totales.prima + totales.vacaciones;

  return (
    <div>
      <NominaTabs />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Prestaciones sociales</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lo que se ha ido acumulando por empleado, según cada nómina generada. Cesantías, sus
          intereses y la prima ya quedan reflejados automáticamente en el Estado P y G mes a mes,
          junto con la nómina — cuando llegue el momento real de pagarlas, no hace falta registrar
          ese pago aparte en{" "}
          <Link href="/pyg/movimientos" className="text-accent hover:underline">
            Gastos e ingresos
          </Link>
          , porque ya está contado aquí y se duplicaría. <strong>Vacaciones es distinto</strong>: el
          empleado cobra el mismo salario de siempre en esos días (ya contado en la nómina), así que
          no genera gasto solo — es puramente informativo.
        </p>
      </div>

      {filasOrdenadas.length === 0 ? (
        <p className="text-gray-400">
          Todavía no hay nada acumulado — genera al menos un período de nómina primero.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-400">
              <tr>
                <th className="p-3 font-medium">Empleado</th>
                <th className="p-3 font-medium">Cesantías</th>
                <th className="p-3 font-medium">Intereses cesantías</th>
                <th className="p-3 font-medium">Prima</th>
                <th className="p-3 font-medium">Vacaciones</th>
                <th className="p-3 font-medium">Total acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filasOrdenadas.map((f) => (
                <tr key={f.nombre}>
                  <td className="p-3">
                    <span className={f.activo ? "text-gray-900" : "text-gray-400"}>
                      {f.nombre}
                      {!f.activo && " (retirado)"}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700">{formatoMoneda(f.cesantias)}</td>
                  <td className="p-3 text-gray-700">{formatoMoneda(f.intereses)}</td>
                  <td className="p-3 text-gray-700">{formatoMoneda(f.prima)}</td>
                  <td className="p-3 text-gray-700">{formatoMoneda(f.vacaciones)}</td>
                  <td className="p-3 font-medium text-gray-900">
                    {formatoMoneda(f.cesantias + f.intereses + f.prima + f.vacaciones)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-medium text-gray-900">
                <td className="p-3">Total</td>
                <td className="p-3">{formatoMoneda(totales.cesantias)}</td>
                <td className="p-3">{formatoMoneda(totales.intereses)}</td>
                <td className="p-3">{formatoMoneda(totales.prima)}</td>
                <td className="p-3">{formatoMoneda(totales.vacaciones)}</td>
                <td className="p-3">{formatoMoneda(totalGeneral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
