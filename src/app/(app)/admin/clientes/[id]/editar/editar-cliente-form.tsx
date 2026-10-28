"use client";

import { useState } from "react";
import { CampoMoneda } from "@/components/campo-moneda";
import { actualizarPlanCliente } from "./actions";

// Mismos valores que nuevo-cliente-form.tsx (Crear cliente) — se duplican acá
// a propósito, igual criterio que ya acepta este proyecto con PLANES en
// landing.tsx/contrato.tsx: son pocas líneas, y mantenerlas en archivos
// separados es más simple que una abstracción compartida nueva.
const MODULOS = [
  { value: "ventas", label: "Ventas" },
  { value: "crm", label: "CRM" },
  { value: "inventario", label: "Inventario" },
  { value: "pyg", label: "Estado P y G" },
  { value: "nomina", label: "Nómina" },
  { value: "promociones", label: "Promociones" },
];

const PLANES = [
  { value: "basic", label: "Basic — $199.000/mes (1 módulo)" },
  { value: "startup", label: "Startup — $409.000/mes (hasta 3 módulos)" },
  { value: "pyme", label: "Pyme — $649.000/mes (hasta 5 módulos)" },
  { value: "enterprise", label: "Enterprise — $799.000/mes (todos los módulos)" },
];

const MONTO_SUGERIDO_POR_PLAN: Record<string, string> = {
  basic: "199000",
  startup: "409000",
  pyme: "649000",
  enterprise: "799000",
};

// Mismo descuento que DESCUENTO_ANUAL en landing.tsx.
const DESCUENTO_ANUAL = 0.15;

function formatoCOP(valor: number) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

export function EditarClienteForm({
  empresaId,
  nombreEmpresa,
  modulosActivos: modulosIniciales,
  plan: planInicial,
  montoMensual: montoInicial,
  facturacion: facturacionInicial,
  tieneSuscripcion,
}: {
  empresaId: string;
  nombreEmpresa: string;
  modulosActivos: string[];
  plan: string;
  montoMensual: string;
  facturacion: string;
  tieneSuscripcion: boolean;
}) {
  const [modulosActivos, setModulosActivos] = useState<string[]>(modulosIniciales);
  const [plan, setPlan] = useState(planInicial);
  const [montoMensual, setMontoMensual] = useState(montoInicial);
  const [facturacion, setFacturacion] = useState(facturacionInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function alternarModulo(valor: string) {
    setModulosActivos((actuales) =>
      actuales.includes(valor) ? actuales.filter((m) => m !== valor) : [...actuales, valor],
    );
  }

  async function guardar() {
    setError(null);
    setGuardado(false);

    if (modulosActivos.length === 0) {
      setError("Elige al menos un módulo.");
      return;
    }
    if (!montoMensual.trim()) {
      setError("Completa el monto mensual.");
      return;
    }

    setGuardando(true);
    try {
      const res = await actualizarPlanCliente({
        empresaId,
        modulosActivos,
        plan,
        montoMensual,
        facturacion,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Editar plan</h1>
      <p className="mb-6 text-sm text-gray-500">{nombreEmpresa}</p>

      {!tieneSuscripcion && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Esta empresa todavía no tiene ninguna suscripción registrada — guardar acá creará una
          nueva, pero no va a tener fecha de prueba ni tarjeta guardada. Si no era lo que
          esperabas, revisa primero en Supabase.
        </p>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Módulos activos</label>
          <div className="flex flex-wrap gap-2">
            {MODULOS.map((m) => {
              const activo = modulosActivos.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => alternarModulo(m.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activo
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Panel de control va incluido gratis siempre — no hace falta elegirlo acá.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plan</label>
            <select
              value={plan}
              onChange={(e) => {
                const nuevoPlan = e.target.value;
                setPlan(nuevoPlan);
                setMontoMensual(MONTO_SUGERIDO_POR_PLAN[nuevoPlan] ?? montoMensual);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            >
              {PLANES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <CampoMoneda
            id="montoMensual"
            label="Monto mensual"
            value={montoMensual}
            onChange={setMontoMensual}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Frecuencia de pago</label>
          <div className="flex gap-2">
            {[
              { value: "mensual", label: "Mensual" },
              { value: "anual", label: "Anual (-15%)" },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFacturacion(f.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  facturacion === f.value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {facturacion === "anual" &&
            (() => {
              const base = Number(montoMensual) || 0;
              const totalSinDescuento = base * 12;
              const totalConDescuento = totalSinDescuento * (1 - DESCUENTO_ANUAL);
              return (
                <p className="mt-1 text-xs text-gray-400">
                  Se le cobra una sola vez al año: {formatoCOP(totalConDescuento)} (ahorra{" "}
                  {formatoCOP(totalSinDescuento - totalConDescuento)} frente a pagar mes a mes).
                </p>
              );
            })()}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {guardado && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Cambios guardados. El nuevo monto se cobra desde el próximo cobro ya programado — no se
          cobra la diferencia de inmediato.
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
