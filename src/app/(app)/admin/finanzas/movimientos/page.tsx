import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { DirectorioMovimientos } from "./directorio-movimientos";

export default async function MovimientosDatumPage() {
  await requerirAdmin();
  const supabase = await createClient();

  // Los movimientos generados solos por un abono de deuda (pasivo_id no es
  // null) no aparecen acá — esos se ven y se corrigen desde Deudas.
  const { data: movimientos } = await supabase
    .from("datum_movimientos")
    .select("id, tipo, categoria, monto, fecha, nota, recurrente, frecuencia")
    .is("pasivo_id", null)
    .order("fecha", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/finanzas" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a Finanzas de Datum
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Gastos e ingresos</h1>
        </div>
        <Link
          href="/admin/finanzas/movimientos/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Agregar gasto o ingreso
        </Link>
      </div>

      <DirectorioMovimientos movimientos={movimientos ?? []} />
    </div>
  );
}
