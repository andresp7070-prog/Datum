"use client";

import { useState } from "react";
import { guardarIntegracionFactus } from "./actions";

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente — el cliente todavía no activó",
  activa: "Activa — el cliente ya aceptó y está usando el servicio",
  suspendida: "Suspendida",
};

export function FactusClienteForm({
  empresaId,
  nombreEmpresa,
  factusClientId: clientIdInicial,
  factusClientSecret: clientSecretInicial,
  factusUsername: usernameInicial,
  factusPassword: passwordInicial,
  numberingRangeId: numberingRangeIdInicial,
  certificadoFacturacion: certificadoFacturacionInicial,
  estado,
}: {
  empresaId: string;
  nombreEmpresa: string;
  factusClientId: string;
  factusClientSecret: string;
  factusUsername: string;
  factusPassword: string;
  numberingRangeId: string;
  certificadoFacturacion: string;
  estado: string | null;
}) {
  const [factusClientId, setFactusClientId] = useState(clientIdInicial);
  const [factusClientSecret, setFactusClientSecret] = useState(clientSecretInicial);
  const [factusUsername, setFactusUsername] = useState(usernameInicial);
  const [factusPassword, setFactusPassword] = useState(passwordInicial);
  const [numberingRangeId, setNumberingRangeId] = useState(numberingRangeIdInicial);
  const [certificadoFacturacion, setCertificadoFacturacion] = useState(certificadoFacturacionInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setError(null);
    setGuardado(false);
    setGuardando(true);
    try {
      const res = await guardarIntegracionFactus({
        empresaId,
        factusClientId,
        factusClientSecret,
        factusUsername,
        factusPassword,
        numberingRangeId,
        certificadoFacturacion,
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
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Facturación electrónica — Factus</h1>
      <p className="mb-1 text-sm text-gray-500">{nombreEmpresa}</p>
      <p className="mb-6 text-xs text-gray-400">
        {estado ? ESTADO_LABEL[estado] ?? estado : "Todavía no se ha cargado ninguna cuenta de Factus."}
      </p>

      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Completa esto solo después de haber tramitado la cuenta real de este cliente con Factus
        (su propio NIT, certificado y rango de numeración). Al guardar, el cliente queda en
        &quot;pendiente&quot; — todavía tiene que entrar él mismo a activarlo y aceptar las
        condiciones.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Client ID</label>
          <input
            type="text"
            value={factusClientId}
            onChange={(e) => setFactusClientId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Client Secret</label>
          <input
            type="password"
            value={factusClientSecret}
            onChange={(e) => setFactusClientSecret(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Usuario (correo de la cuenta de Factus)
          </label>
          <input
            type="text"
            value={factusUsername}
            onChange={(e) => setFactusUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
          <input
            type="password"
            value={factusPassword}
            onChange={(e) => setFactusPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Id del rango de numeración
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={numberingRangeId}
            onChange={(e) => setNumberingRangeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            El que devuelve GET /v2/numbering-ranges para esta cuenta.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Facturación del certificado digital
          </label>
          <div className="flex gap-2">
            {[
              { value: "anual", label: "Anual — $150.000/año" },
              { value: "mensual", label: "Mensual — $15.000/mes" },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setCertificadoFacturacion(f.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  certificadoFacturacion === f.value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            El cliente puede confirmar o cambiar esto cuando active el servicio.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {guardado && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Guardado. El cliente ya puede entrar a activar el servicio.
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
