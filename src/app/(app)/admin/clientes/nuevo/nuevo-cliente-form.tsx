"use client";

import { useState } from "react";
import { crearCliente } from "./actions";

const MODULOS = [
  { value: "ventas", label: "Ventas" },
  { value: "crm", label: "CRM" },
  { value: "inventario", label: "Inventario" },
  { value: "pyg", label: "Estado P y G" },
  { value: "nomina", label: "Nómina" },
  { value: "promociones", label: "Promociones" },
  { value: "insights", label: "Panel de control" },
];

const PAGINAS_ENTRADA = [
  { value: "ventas", label: "Ventas" },
  { value: "crm", label: "CRM" },
  { value: "inventario", label: "Inventario" },
  { value: "pyg", label: "Estado P y G" },
  { value: "insights", label: "Panel de control" },
];

type Resultado =
  | { ok: true; contrasena: string; correoEnviado: boolean; errorCorreo: string | null }
  | { ok: false; error: string };

export function NuevoClienteForm() {
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [modulosActivos, setModulosActivos] = useState<string[]>([]);
  const [paginaEntrada, setPaginaEntrada] = useState("ventas");
  const [nombreCliente, setNombreCliente] = useState("");
  const [correoCliente, setCorreoCliente] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function alternarModulo(valor: string) {
    setModulosActivos((actuales) =>
      actuales.includes(valor) ? actuales.filter((m) => m !== valor) : [...actuales, valor],
    );
  }

  async function crear() {
    setError(null);
    setResultado(null);

    if (!nombreEmpresa.trim() || !nombreCliente.trim() || !correoCliente.trim()) {
      setError("Completa el nombre de la empresa, el nombre del cliente y su correo.");
      return;
    }
    if (modulosActivos.length === 0) {
      setError("Elige al menos un módulo.");
      return;
    }

    setEnviando(true);
    try {
      const res = await crearCliente({
        nombreEmpresa,
        modulosActivos,
        paginaEntrada,
        nombreCliente,
        correoCliente,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResultado(res);
      setNombreEmpresa("");
      setModulosActivos([]);
      setPaginaEntrada("ventas");
      setNombreCliente("");
      setCorreoCliente("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Crear cliente</h1>
      <p className="mb-6 text-sm text-gray-500">
        Crea el usuario, la empresa y el perfil de un cliente nuevo en un solo paso, y le manda
        el correo de bienvenida con sus datos de acceso.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de la empresa</label>
          <input
            value={nombreEmpresa}
            onChange={(e) => setNombreEmpresa(e.target.value)}
            placeholder="Ej. Distribuidora de aseo JM"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

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
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Página de entrada</label>
          <select
            value={paginaEntrada}
            onChange={(e) => setPaginaEntrada(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {PAGINAS_ENTRADA.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">A dónde llega esta empresa al iniciar sesión.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre del cliente</label>
          <input
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
            placeholder="Quién va a usar esta cuenta"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Correo del cliente</label>
          <input
            type="email"
            value={correoCliente}
            onChange={(e) => setCorreoCliente(e.target.value)}
            placeholder="cliente@correo.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {resultado?.ok && (
        <div className="mt-3 space-y-1 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <p>Cuenta creada correctamente.</p>
          <p>
            Contraseña temporal: <strong>{resultado.contrasena}</strong>
          </p>
          {resultado.correoEnviado ? (
            <p>El correo de bienvenida ya se envió.</p>
          ) : (
            <p className="text-amber-700">
              La cuenta quedó creada, pero el correo no se pudo enviar
              {resultado.errorCorreo ? ` (${resultado.errorCorreo})` : ""} — manda la contraseña de
              arriba por otro medio.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={crear}
        disabled={enviando}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {enviando ? "Creando..." : "Crear cliente"}
      </button>
    </div>
  );
}
