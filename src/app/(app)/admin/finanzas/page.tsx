import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { SelectorRangoFinanzas } from "./selector-rango";
import { PagoRapidoDeuda } from "./pago-rapido-deuda";

type Pasivo = {
  id: string;
  descripcion: string;
  tipo: string | null;
  monto_total: number;
  monto_pagado: number;
  fecha_vencimiento: string | null;
  estado: string;
};

type MovimientoGasto = {
  id: string;
  categoria: string | null;
  monto: number;
  fecha: string;
  nota: string | null;
  recurrente: boolean;
  frecuencia: string | null;
};

function formatoMoneda(valor: number | null | undefined) {
  return (valor ?? 0).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function primerDiaMesActualIso() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function ultimoDiaMesActualIso() {
  const hoy = new Date();
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
}

function formatoFechaCorta(fechaIso: string) {
  return new Date(`${fechaIso}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function FinanzasDatumPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requerirAdmin();
  const { desde: desdeParam, hasta: hastaParam } = await searchParams;
  const desde = desdeParam || primerDiaMesActualIso();
  const hasta = hastaParam || ultimoDiaMesActualIso();

  const supabase = await createClient();

  const [{ data: finanzasData, error: errorFinanzas }, { data: pasivosData, error: errorPasivos }] =
    await Promise.all([
      supabase
        .from("datum_movimientos")
        .select("id, tipo, categoria, monto, fecha, nota, recurrente, frecuencia")
        .gte("fecha", desde)
        .lte("fecha", hasta),
      supabase
        .from("datum_pasivos")
        .select("id, descripcion, tipo, monto_total, monto_pagado, fecha_vencimiento, estado")
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
    ]);

  let ingresos = 0;
  let gastosOperacionales = 0;
  const gastos: MovimientoGasto[] = [];
  for (const mov of finanzasData ?? []) {
    if (mov.tipo === "ingreso") {
      ingresos += Number(mov.monto);
    } else {
      gastosOperacionales += Number(mov.monto);
      gastos.push({
        id: mov.id,
        categoria: mov.categoria,
        monto: Number(mov.monto),
        fecha: mov.fecha,
        nota: mov.nota,
        recurrente: mov.recurrente,
        frecuencia: mov.frecuencia,
      });
    }
  }
  gastos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const utilidadNeta = ingresos - gastosOperacionales;

  const pasivos = (pasivosData ?? []) as Pasivo[];
  const totalPendiente = pasivos
    .filter((p) => p.estado !== "pagado")
    .reduce((suma, p) => suma + (p.monto_total - p.monto_pagado), 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al panel
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Finanzas de Datum</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/finanzas/movimientos"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Gastos e ingresos
          </Link>
          <Link
            href="/admin/finanzas/pasivos"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Deudas
          </Link>
        </div>
      </div>

      {(errorFinanzas || errorPasivos) && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar finanzas: {errorFinanzas?.message || errorPasivos?.message}
        </div>
      )}

      <div>
        <SelectorRangoFinanzas desde={desde} hasta={hasta} />
        <p className="mt-2 text-xs text-gray-400">
          Mostrando del {formatoFechaCorta(desde)} al {formatoFechaCorta(hasta)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Utilidad</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Ingresos</dt>
              <dd className="text-gray-900">{formatoMoneda(ingresos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Gastos</dt>
              <dd className="text-gray-900">− {formatoMoneda(gastosOperacionales)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
              <dt className="text-gray-900">Utilidad neta</dt>
              <dd className={utilidadNeta >= 0 ? "text-green-700" : "text-red-600"}>
                {formatoMoneda(utilidadNeta)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-gray-400">
            Solo cuenta la plata que de verdad entra o sale — un ingreso o gasto se registra cuando
            ocurre, no antes.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Deudas pendientes</h2>
            <Link href="/admin/finanzas/pasivos" className="text-xs text-gray-500 hover:text-gray-700">
              Ver todas
            </Link>
          </div>
          <p className="text-base font-semibold text-gray-900">{formatoMoneda(totalPendiente)}</p>
          <p className="mb-3 text-xs text-gray-400">
            No hace parte de la utilidad — es dinero que debes, se muestra aparte.
          </p>
          {pasivos.filter((p) => p.estado !== "pagado").length === 0 ? (
            <p className="text-sm text-gray-400">No tienes deudas pendientes registradas.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 text-sm">
                {pasivos
                  .filter((p) => p.estado !== "pagado")
                  .slice(0, 5)
                  .map((p) => (
                    <li key={p.id} className="flex justify-between py-1.5">
                      <span className="text-gray-700">{p.descripcion}</span>
                      <span className="text-gray-900">
                        {formatoMoneda(p.monto_total - p.monto_pagado)}
                      </span>
                    </li>
                  ))}
              </ul>
              <PagoRapidoDeuda pasivos={pasivos.filter((p) => p.estado !== "pagado")} />
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Gastos</h2>
          <Link href="/admin/finanzas/movimientos" className="text-xs text-gray-500 hover:text-gray-700">
            Ver todos
          </Link>
        </div>
        <p className="mb-4 text-xs text-gray-400">
          Del {formatoFechaCorta(desde)} al {formatoFechaCorta(hasta)} — total{" "}
          {formatoMoneda(gastosOperacionales)}.
        </p>
        {gastos.length === 0 ? (
          <p className="text-sm text-gray-400">No hay gastos registrados en este período.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {gastos.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-gray-900">{g.categoria || "Sin categoría"}</p>
                  <p className="text-xs text-gray-400">
                    {formatoFechaCorta(g.fecha)}
                    {g.nota ? ` · ${g.nota}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatoMoneda(g.monto)}</p>
                  <p className="text-xs text-gray-400">
                    {g.recurrente
                      ? `Recurrente${g.frecuencia ? ` · ${g.frecuencia}` : ""}`
                      : "Costo puntual"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
