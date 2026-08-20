import { NextResponse } from "next/server";
import { consultarDisponibilidad } from "@/lib/agendar";

// Ruta pública (sin sesión) para el formulario de agendamiento de la
// landing — ver CLAUDE.md, sección "Formulario de agendamiento", y
// src/lib/agendar.ts para toda la lógica real.
export async function GET() {
  const resultado = await consultarDisponibilidad();
  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 200 });
  }
  return NextResponse.json({ franjas: resultado.franjas.map((f) => f.inicioISO) });
}
