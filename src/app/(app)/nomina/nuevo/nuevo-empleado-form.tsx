"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearEmpleado } from "../actions";

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

export function NuevoEmpleadoForm() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [cargo, setCargo] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(hoyIso());
  const [tipoContrato, setTipoContrato] = useState("indefinido");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const salarioNum = Number(salarioBase);
    if (salarioBase.trim() === "" || Number.isNaN(salarioNum) || salarioNum <= 0) {
      setError("El salario es obligatorio y debe ser un número mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearEmpleado({
        nombre: nombre.trim(),
        cedula: cedula.trim(),
        cargo: cargo.trim(),
        salarioBase: salarioNum,
        fechaIngreso,
        tipoContrato,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.push("/nomina");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar empleado</h1>
        <Link href="/nomina" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. María Pérez"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cédula (opcional)</label>
          <input
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cargo (opcional)</label>
          <input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ej. Vendedora"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Salario mensual *</label>
          <input
            type="number"
            min={0}
            value={salarioBase}
            onChange={(e) => setSalarioBase(e.target.value)}
            placeholder="Ej. 1462000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de ingreso *</label>
          <input
            type="date"
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de contrato *</label>
          <select
            value={tipoContrato}
            onChange={(e) => setTipoContrato(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="indefinido">Término indefinido</option>
            <option value="fijo">Término fijo</option>
            <option value="obra_labor">Obra o labor</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Define cómo se calcula la indemnización si algún día hay que finalizar el contrato sin
            justa causa — para término fijo u obra/labor esa parte se calcula a mano.
          </p>
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
