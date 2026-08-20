"use client";

import { useEffect, useMemo, useState } from "react";

// Widget de agendamiento público de la landing — ver CLAUDE.md, sección
// "Formulario de agendamiento". Toda la lógica de horarios/Google Calendar
// vive del lado del servidor (src/lib/agendar.ts); acá solo se pinta lo que
// esas dos rutas devuelven y se maneja el estado de la UI.

type Fase = "cargando" | "sin-horarios" | "eligiendo" | "enviando" | "confirmado" | "error";

const FORMATO_DIA = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "America/Bogota",
});
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function claveDia(iso: string): string {
  // Agrupa por día calendario en hora de Bogotá, no en la del navegador —
  // la reunión siempre se agenda en hora Colombia.
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).formatToParts(new Date(iso));
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
}

export function AgendarWidget() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [franjas, setFranjas] = useState<string[]>([]);
  const [mensajeError, setMensajeError] = useState("");
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [horarioElegido, setHorarioElegido] = useState<string | null>(null);
  const [enlaceEvento, setEnlaceEvento] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/agendar/disponibilidad")
      .then((res) => res.json())
      .then((data: { franjas?: string[]; error?: string }) => {
        if (cancelado) return;
        if (data.error || !data.franjas || data.franjas.length === 0) {
          setFase("sin-horarios");
          return;
        }
        setFranjas(data.franjas);
        setDiaElegido(claveDia(data.franjas[0]));
        setFase("eligiendo");
      })
      .catch(() => {
        if (!cancelado) setFase("sin-horarios");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const dias = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const iso of franjas) {
      const clave = claveDia(iso);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(iso);
    }
    return Array.from(mapa.entries());
  }, [franjas]);

  const horariosDelDia = useMemo(() => {
    if (!diaElegido) return [];
    return dias.find(([clave]) => clave === diaElegido)?.[1] ?? [];
  }, [dias, diaElegido]);

  async function confirmar(datos: { nombre: string; correo: string; telefono: string; empresa: string; nota: string; trampa: string }) {
    if (!horarioElegido) return;
    setFase("enviando");
    setMensajeError("");
    try {
      const res = await fetch("/api/agendar/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, horarioISO: horarioElegido }),
      });
      const data: { ok?: true; link?: string | null; error?: string } = await res.json();
      if (data.error) {
        setMensajeError(data.error);
        setFase("eligiendo");
        return;
      }
      setEnlaceEvento(data.link ?? null);
      setFase("confirmado");
    } catch {
      setMensajeError("No se pudo agendar la reunión — intenta de nuevo.");
      setFase("eligiendo");
    }
  }

  if (fase === "cargando") {
    return <p className="agendar-estado">Buscando horarios disponibles…</p>;
  }

  if (fase === "sin-horarios") {
    return (
      <div className="agendar-estado">
        <p>Por ahora no podemos mostrarte horarios disponibles.</p>
        <a
          className="btn"
          href="mailto:andresp7070@gmail.com?subject=Quiero%20agendar%20una%20reuni%C3%B3n%20con%20Datum"
        >
          Escríbenos directamente
        </a>
      </div>
    );
  }

  if (fase === "confirmado") {
    return (
      <div className="agendar-confirmado">
        <p className="agendar-confirmado-titulo">¡Listo! Tu reunión quedó agendada.</p>
        <p>Te llegará la invitación a tu correo, con el link para la videollamada.</p>
        {enlaceEvento && (
          <a className="agendar-link-evento" href={enlaceEvento} target="_blank" rel="noreferrer">
            Ver evento en Google Calendar
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="agendar-widget">
      <div className="agendar-dias">
        {dias.map(([clave, horas]) => (
          <button
            key={clave}
            type="button"
            className={"agendar-dia" + (clave === diaElegido ? " activo" : "")}
            onClick={() => {
              setDiaElegido(clave);
              setHorarioElegido(null);
            }}
          >
            {FORMATO_DIA.format(new Date(horas[0]))}
          </button>
        ))}
      </div>

      <div className="agendar-horas">
        {horariosDelDia.map((iso) => (
          <button
            key={iso}
            type="button"
            className={"agendar-hora" + (iso === horarioElegido ? " activo" : "")}
            onClick={() => setHorarioElegido(iso)}
          >
            {FORMATO_HORA.format(new Date(iso))}
          </button>
        ))}
      </div>
      <p className="agendar-nota-zona">Horarios en hora de Colombia.</p>

      {horarioElegido && (
        <FormularioDatos disabled={fase === "enviando"} error={mensajeError} onConfirmar={confirmar} />
      )}
    </div>
  );
}

function FormularioDatos({
  disabled,
  error,
  onConfirmar,
}: {
  disabled: boolean;
  error: string;
  onConfirmar: (datos: { nombre: string; correo: string; telefono: string; empresa: string; nota: string; trampa: string }) => void;
}) {
  return (
    <form
      className="agendar-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onConfirmar({
          nombre: String(form.get("nombre") ?? ""),
          correo: String(form.get("correo") ?? ""),
          telefono: String(form.get("telefono") ?? ""),
          empresa: String(form.get("empresa") ?? ""),
          nota: String(form.get("nota") ?? ""),
          trampa: String(form.get("sitio_web") ?? ""),
        });
      }}
    >
      <div className="agendar-form-fila">
        <input name="nombre" type="text" placeholder="Nombre *" required disabled={disabled} />
        <input name="telefono" type="tel" placeholder="Teléfono *" required disabled={disabled} />
      </div>
      <input name="correo" type="email" placeholder="Correo *" required disabled={disabled} />
      <input name="empresa" type="text" placeholder="Empresa (opcional)" disabled={disabled} />
      <textarea name="nota" placeholder="Cuéntanos brevemente qué necesitas (opcional)" rows={3} disabled={disabled} />
      {/* Campo trampa: oculto para una persona real, los bots suelen llenar todo. */}
      <input name="sitio_web" type="text" className="agendar-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {error && <p className="agendar-form-error">{error}</p>}
      <button type="submit" className="btn agendar-btn-confirmar" disabled={disabled}>
        {disabled ? "Agendando…" : "Confirmar reunión"}
      </button>
    </form>
  );
}
