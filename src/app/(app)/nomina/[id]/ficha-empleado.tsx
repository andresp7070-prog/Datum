"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  registrarVacaciones,
  simularLiquidacion,
  confirmarFinalizacionContrato,
  type Liquidacion,
  type MotivoSalida,
} from "../actions";

type Empleado = {
  id: string;
  nombre: string;
  cedula: string | null;
  cargo: string | null;
  salario_base: number;
  fecha_ingreso: string;
  fecha_retiro: string | null;
  activo: boolean;
  tipo_contrato: string;
};

const ETIQUETA_TIPO_CONTRATO: Record<string, string> = {
  indefinido: "Término indefinido",
  fijo: "Término fijo",
  obra_labor: "Obra o labor",
};

const ETIQUETA_MOTIVO: Record<MotivoSalida, string> = {
  renuncia: "Renuncia",
  despido_justa_causa: "Despido con justa causa",
  despido_sin_justa_causa: "Despido sin justa causa",
};

type Vacacion = {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
};

// numeric de Postgres llega como texto vía Supabase (para no perder precisión
// con decimales) — hay que convertirlo antes de formatear, si no, toLocaleString
// se ejecuta sobre el string y lo deja tal cual, sin darle forma de plata.
function formatoMoneda(valor: number | string) {
  return Number(valor).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatoFecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tiempoEnLaEmpresa(fechaIngreso: string, fechaRetiro: string | null) {
  const inicio = new Date(`${fechaIngreso}T00:00:00`);
  const fin = fechaRetiro ? new Date(`${fechaRetiro}T00:00:00`) : new Date();

  let meses = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth());
  if (fin.getDate() < inicio.getDate()) meses -= 1;
  meses = Math.max(0, meses);

  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;

  if (anios === 0) return `${mesesRestantes} ${mesesRestantes === 1 ? "mes" : "meses"}`;
  if (mesesRestantes === 0) return `${anios} ${anios === 1 ? "año" : "años"}`;
  return `${anios} ${anios === 1 ? "año" : "años"} y ${mesesRestantes} ${mesesRestantes === 1 ? "mes" : "meses"}`;
}

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FichaEmpleado({
  empleado,
  diasCausados,
  diasTomados,
  vacaciones,
}: {
  empleado: Empleado;
  diasCausados: number;
  diasTomados: number;
  vacaciones: Vacacion[];
}) {
  const router = useRouter();
  const diasPendientes = Math.max(0, diasCausados - diasTomados);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(hoyIso());
  const [fechaFin, setFechaFin] = useState(hoyIso());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarFinalizar, setMostrarFinalizar] = useState(false);
  const [fechaRetiro, setFechaRetiro] = useState(hoyIso());
  const [motivo, setMotivo] = useState<MotivoSalida>("renuncia");
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorLiquidacion, setErrorLiquidacion] = useState<string | null>(null);

  async function guardarVacaciones() {
    setError(null);
    if (!fechaInicio || !fechaFin) {
      setError("Las dos fechas son obligatorias.");
      return;
    }
    if (fechaFin < fechaInicio) {
      setError("La fecha de fin no puede ser antes de la fecha de inicio.");
      return;
    }
    setGuardando(true);
    const resultado = await registrarVacaciones({ empleadoId: empleado.id, fechaInicio, fechaFin });
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setMostrarForm(false);
    router.refresh();
  }

  async function calcularLiquidacion() {
    setErrorLiquidacion(null);
    setLiquidacion(null);
    if (!fechaRetiro) {
      setErrorLiquidacion("La fecha de retiro es obligatoria.");
      return;
    }
    setCalculando(true);
    const resultado = await simularLiquidacion(empleado.id, fechaRetiro, motivo);
    setCalculando(false);
    if (resultado.error) {
      setErrorLiquidacion(resultado.error);
      return;
    }
    setLiquidacion(resultado.liquidacion ?? null);
  }

  async function confirmarFinalizar() {
    setErrorLiquidacion(null);
    setConfirmando(true);
    const resultado = await confirmarFinalizacionContrato(empleado.id, fechaRetiro, motivo);
    setConfirmando(false);
    if (resultado.error) {
      setErrorLiquidacion(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/nomina" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver a Empleados
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">{empleado.nombre}</h1>
          {!empleado.activo && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              Retirado
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {empleado.cargo || "Sin cargo"}
          {empleado.cedula && ` · C.C. ${empleado.cedula}`}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-400">Salario</p>
          <p className="text-sm font-medium text-gray-900">{formatoMoneda(empleado.salario_base)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Tiempo en la empresa</p>
          <p className="text-sm font-medium text-gray-900">
            {tiempoEnLaEmpresa(empleado.fecha_ingreso, empleado.fecha_retiro)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Ingreso</p>
          <p className="text-sm font-medium text-gray-900">{formatoFecha(empleado.fecha_ingreso)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Días de vacaciones pendientes</p>
          <p className="text-sm font-medium text-gray-900">{diasPendientes} días</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Tipo de contrato</p>
          <p className="text-sm font-medium text-gray-900">
            {ETIQUETA_TIPO_CONTRATO[empleado.tipo_contrato] ?? empleado.tipo_contrato}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Vacaciones</h2>
          {empleado.activo && (
            <button
              type="button"
              onClick={() => setMostrarForm((v) => !v)}
              className="text-xs text-accent hover:underline"
            >
              {mostrarForm ? "Cancelar" : "Registrar vacaciones"}
            </button>
          )}
        </div>

        {mostrarForm && (
          <div className="mb-4 space-y-3 rounded-lg bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Desde</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Hasta</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              El salario de esos días se paga igual — solo se descuenta el auxilio de transporte
              proporcional en la próxima nómina que incluya estas fechas.
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={guardarVacaciones}
              disabled={guardando}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}

        {vacaciones.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no se han registrado vacaciones.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {vacaciones.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2">
                <span className="text-gray-700">
                  {formatoFecha(v.fecha_inicio)} — {formatoFecha(v.fecha_fin)}
                </span>
                <span className="text-gray-500">{v.dias} días</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {empleado.activo && (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Finalizar contrato</h2>
            <button
              type="button"
              onClick={() => {
                setMostrarFinalizar((v) => !v);
                setLiquidacion(null);
                setErrorLiquidacion(null);
              }}
              className="text-xs text-red-600 hover:underline"
            >
              {mostrarFinalizar ? "Cancelar" : "Finalizar contrato"}
            </button>
          </div>

          {mostrarFinalizar && (
            <div className="space-y-3 rounded-lg bg-gray-50 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Fecha de retiro</label>
                  <input
                    type="date"
                    value={fechaRetiro}
                    onChange={(e) => {
                      setFechaRetiro(e.target.value);
                      setLiquidacion(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Motivo de salida</label>
                  <select
                    value={motivo}
                    onChange={(e) => {
                      setMotivo(e.target.value as MotivoSalida);
                      setLiquidacion(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                  >
                    {(Object.keys(ETIQUETA_MOTIVO) as MotivoSalida[]).map((m) => (
                      <option key={m} value={m}>
                        {ETIQUETA_MOTIVO[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                La indemnización solo aplica en despido sin justa causa — renuncia y despido con
                justa causa no la generan.
              </p>

              {errorLiquidacion && <p className="text-xs text-red-600">{errorLiquidacion}</p>}

              {!liquidacion ? (
                <button
                  type="button"
                  onClick={calcularLiquidacion}
                  disabled={calculando}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  {calculando ? "Calculando..." : "Calcular liquidación"}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                    <p className="mb-2 text-xs text-gray-400">
                      Días no cubiertos por nómina ya generada: {formatoFecha(liquidacion.fecha_desde)} — {" "}
                      {formatoFecha(fechaRetiro)} ({liquidacion.dias_periodo} días)
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Salario proporcional</span>
                        <span className="text-gray-900">{formatoMoneda(liquidacion.salario_proporcional)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Auxilio de transporte proporcional</span>
                        <span className="text-gray-900">{formatoMoneda(liquidacion.auxilio_proporcional)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Salud y pensión (descuento)</span>
                        <span className="text-gray-900">-{formatoMoneda(liquidacion.deducciones_empleado)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700">Neto de esos días</span>
                        <span className="text-gray-900">{formatoMoneda(liquidacion.neto_periodo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cesantías, intereses y prima proporcionales</span>
                        <span className="text-gray-900">
                          {formatoMoneda(liquidacion.cesantias_intereses_prima)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Vacaciones pendientes ({liquidacion.dias_vacaciones_pendientes} días)
                        </span>
                        <span className="text-gray-900">
                          {formatoMoneda(liquidacion.monto_vacaciones_pendientes)}
                        </span>
                      </div>
                      {motivo === "despido_sin_justa_causa" && !liquidacion.indemnizacion_requiere_calculo_manual && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Indemnización ({liquidacion.dias_indemnizacion.toFixed(1)} días)
                          </span>
                          <span className="text-gray-900">{formatoMoneda(liquidacion.monto_indemnizacion)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-100 pt-1 text-base font-semibold">
                        <span className="text-gray-900">Total a pagar</span>
                        <span className="text-gray-900">{formatoMoneda(liquidacion.total_a_pagar_empleado)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      Aparte, la empresa paga {formatoMoneda(liquidacion.aportes_patronales)} en aportes
                      patronales de esos días — no le corresponde al empleado.
                    </p>
                    {motivo === "despido_sin_justa_causa" && liquidacion.indemnizacion_requiere_calculo_manual && (
                      <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                        Este contrato es a {ETIQUETA_TIPO_CONTRATO[empleado.tipo_contrato]?.toLowerCase()} — la
                        indemnización para este tipo de contrato depende del plazo pactado o de la obra, así
                        que no se calculó aquí. Calcúlala a mano y regístrala en Gastos e ingresos.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={confirmarFinalizar}
                    disabled={confirmando}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {confirmando ? "Finalizando..." : "Confirmar y finalizar contrato"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
