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

const DIAS = [
  { value: "lunes", label: "Lun" },
  { value: "martes", label: "Mar" },
  { value: "miercoles", label: "Mié" },
  { value: "jueves", label: "Jue" },
  { value: "viernes", label: "Vie" },
  { value: "sabado", label: "Sáb" },
  { value: "domingo", label: "Dom" },
];

const PLANES = [
  { value: "startup", label: "Startup — $99.900/mes" },
  { value: "pyme", label: "Pyme — $199.900/mes" },
  { value: "enterprise", label: "Enterprise — $349.900/mes" },
];

type Resultado =
  | { ok: true; contrasena: string; correoEnviado: boolean; errorCorreo: string | null }
  | { ok: false; error: string };

export function NuevoClienteForm() {
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [modulosActivos, setModulosActivos] = useState<string[]>([]);
  const [crmModo, setCrmModo] = useState("ventas");
  const [nominaFrecuenciaPago, setNominaFrecuenciaPago] = useState("mensual");
  const [horaApertura, setHoraApertura] = useState("");
  const [horaCierre, setHoraCierre] = useState("");
  const [diasAtencion, setDiasAtencion] = useState<string[]>([]);
  const [plan, setPlan] = useState("startup");
  const [montoMensual, setMontoMensual] = useState("99900");
  const [diaPago, setDiaPago] = useState("");
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

  function alternarDia(valor: string) {
    setDiasAtencion((actuales) =>
      actuales.includes(valor) ? actuales.filter((d) => d !== valor) : [...actuales, valor],
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
    if (!montoMensual.trim()) {
      setError("Completa el monto mensual.");
      return;
    }

    setEnviando(true);
    try {
      const res = await crearCliente({
        nombreEmpresa,
        modulosActivos,
        crmModo,
        nominaFrecuenciaPago,
        horaApertura,
        horaCierre,
        diasAtencion,
        plan,
        montoMensual,
        diaPago,
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
      setCrmModo("ventas");
      setNominaFrecuenciaPago("mensual");
      setHoraApertura("");
      setHoraCierre("");
      setDiasAtencion([]);
      setPlan("startup");
      setMontoMensual("99900");
      setDiaPago("");
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
        Crea el usuario, la empresa, el perfil y la suscripción de un cliente nuevo en un solo
        paso, y le manda el correo de bienvenida con sus datos de acceso.
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Modo de CRM</label>
          <select
            value={crmModo}
            onChange={(e) => setCrmModo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="ventas">Ventas (embudo fijo, contactos que nacen de una venta)</option>
            <option value="leads">Leads (cotiza o negocia antes de vender, embudo configurable)</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Solo aplica si activas el módulo CRM, pero queda guardado desde ya.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Frecuencia de pago de nómina</label>
          <select
            value={nominaFrecuenciaPago}
            onChange={(e) => setNominaFrecuenciaPago(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="mensual">Mensual (paga el salario completo cada período)</option>
            <option value="quincenal">Quincenal (paga el 50% del salario cada período)</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Solo aplica si activas el módulo Nómina, pero queda guardado desde ya.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Horario de atención <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="time"
              value={horaApertura}
              onChange={(e) => setHoraApertura(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
            <input
              type="time"
              value={horaCierre}
              onChange={(e) => setHoraCierre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Días de atención <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d) => {
              const activo = diasAtencion.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => alternarDia(d.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activo
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Sin elegir ninguno, se asume que atiende todos los días.
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
                const sugerido = PLANES.find((p) => p.value === nuevoPlan);
                if (sugerido && nuevoPlan === "startup") setMontoMensual("99900");
                if (sugerido && nuevoPlan === "pyme") setMontoMensual("199900");
                if (sugerido && nuevoPlan === "enterprise") setMontoMensual("349900");
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Monto mensual</label>
            <input
              type="number"
              value={montoMensual}
              onChange={(e) => setMontoMensual(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Día de pago del mes <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={diaPago}
            onChange={(e) => setDiaPago(e.target.value)}
            placeholder="Ej. 5"
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Solo para saber cuándo recordarle el pago manual — el cobro sigue siendo por
            transferencia, no hay pasarela conectada todavía.
          </p>
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
