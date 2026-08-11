"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { agendarSeguimiento, cancelarSeguimiento } from "./actions";

type Evento = { id: string; fecha: string; nota: string | null; link: string | null };

export function SeguimientoCalendar({
  contactoId,
  nombreContacto,
  conectado,
  eventos,
  rutaConexion,
}: {
  contactoId: string;
  nombreContacto: string;
  conectado: boolean;
  eventos: Evento[];
  rutaConexion: string;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function agendar() {
    setError(null);
    if (!fecha) {
      setError("Elige fecha y hora del seguimiento.");
      return;
    }
    setGuardando(true);
    try {
      const resultado = await agendarSeguimiento({
        contactoId,
        nombreContacto,
        fechaInicio: fecha,
        nota: nota.trim(),
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setFecha("");
      setNota("");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar(eventoId: string) {
    setCancelandoId(eventoId);
    await cancelarSeguimiento(eventoId);
    setCancelandoId(null);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Seguimiento</h2>

      {!conectado ? (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            Conecta tu Google Calendar para agendar seguimientos de este cliente directo desde
            aquí.
          </p>
          <a
            href={`/api/auth/google/connect?next=${encodeURIComponent(rutaConexion)}`}
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Conectar Google Calendar
          </a>
        </div>
      ) : (
        <>
          {eventos.length > 0 ? (
            <ul className="mb-4 divide-y divide-gray-200">
              {eventos.map((evento) => (
                <li key={evento.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="text-gray-900">
                      {new Date(evento.fecha).toLocaleString("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    {evento.nota && <p className="text-gray-500">{evento.nota}</p>}
                    {evento.link && (
                      <a
                        href={evento.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline"
                      >
                        Ver en Google Calendar
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelar(evento.id)}
                    disabled={cancelandoId === evento.id}
                    className="shrink-0 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-gray-400">Sin seguimientos agendados todavía.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={guardando}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
            />
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              disabled={guardando}
              placeholder="Nota (opcional)"
              className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={agendar}
              disabled={guardando}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {guardando ? "Agendando..." : "Agendar seguimiento"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
