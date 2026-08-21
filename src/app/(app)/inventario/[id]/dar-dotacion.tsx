"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarDotacion } from "./actions";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export function DarDotacion({
  itemId,
  cantidadActual,
  unidad,
  empleados,
}: {
  itemId: string;
  cantidadActual: number;
  unidad: string;
  empleados: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const valor = Number(cantidad);
    if (cantidad.trim() === "" || Number.isNaN(valor) || valor <= 0) {
      setError("Escribe cuánto se entregó, un número mayor a cero.");
      return;
    }
    if (valor > cantidadActual) {
      setError(`No hay suficiente stock: quedan ${cantidadActual}.`);
      return;
    }
    if (!empleadoId) {
      setError("Selecciona a qué empleado se le entregó.");
      return;
    }
    if (!fecha) {
      setError("Selecciona la fecha de entrega.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await registrarDotacion({
        itemId,
        cantidad: valor,
        nota: nota.trim(),
        empleadoId,
        fecha,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setAbierto(false);
      setCantidad("");
      setEmpleadoId("");
      setFecha(hoy());
      setNota("");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        Dar dotación
      </button>
    );
  }

  if (empleados.length === 0) {
    return (
      <div className="w-64 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="mb-2 text-xs text-gray-500">
          No hay empleados registrados todavía. Agrega uno en Nómina antes de registrar una
          dotación, para poder vincularla a una persona.
        </p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs text-gray-500">
        Para entregas a empleados (uniformes, elementos de aseo, etc.) — descuenta del inventario
        y se registra como gasto en el estado de pérdidas y ganancias, no como venta.
      </p>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        Cantidad entregada ({unidad}) *
      </label>
      <input
        type="number"
        min={0}
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      />
      <label className="mb-1 block text-xs font-medium text-gray-700">Empleado *</label>
      <select
        value={empleadoId}
        onChange={(e) => setEmpleadoId(e.target.value)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      >
        <option value="">Selecciona un empleado</option>
        {empleados.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.nombre}
          </option>
        ))}
      </select>
      <label className="mb-1 block text-xs font-medium text-gray-700">Fecha de entrega *</label>
      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      />
      <label className="mb-1 block text-xs font-medium text-gray-700">Nota (opcional)</label>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Ej. uniforme talla M"
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      />
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
