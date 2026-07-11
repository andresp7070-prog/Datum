"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONDICIONES_PAGO } from "@/lib/proveedores";
import { crearProveedor } from "../actions";

export function NuevoProveedorForm() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [condicionPago, setCondicionPago] = useState("contado");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearProveedor({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        condicionPago,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.push("/inventario/proveedores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar proveedor</h1>
        <Link href="/inventario/proveedores" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Aseo Distribuciones S.A.S."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Teléfono (opcional)
          </label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Condición de pago *
          </label>
          <select
            value={condicionPago}
            onChange={(e) => setCondicionPago(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {CONDICIONES_PAGO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400">* Campos obligatorios</p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
