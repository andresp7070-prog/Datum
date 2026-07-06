import Link from "next/link";

export default function VentasPage() {
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
      <p className="text-gray-400">El historial de ventas todavía no está construido.</p>
    </div>
  );
}
