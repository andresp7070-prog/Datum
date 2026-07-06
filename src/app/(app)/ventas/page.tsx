import Link from "next/link";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ guardada?: string }>;
}) {
  const { guardada } = await searchParams;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Ventas</h1>
        <Link
          href="/ventas/nueva"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Agregar venta
        </Link>
      </div>

      {guardada === "1" && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Venta registrada correctamente.
        </p>
      )}

      <p className="text-gray-400">El historial de ventas todavía no está construido.</p>
    </div>
  );
}
