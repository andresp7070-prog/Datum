import { NextResponse, type NextRequest } from "next/server";
import { reservarReunion } from "@/lib/agendar";

// Ruta pública (sin sesión) para el formulario de agendamiento de la
// landing — ver CLAUDE.md, sección "Formulario de agendamiento", y
// src/lib/agendar.ts para toda la lógica real (incluida la validación,
// que nunca hay que asumir que ya se hizo del lado del cliente).
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const resultado = await reservarReunion({
    nombre: typeof b.nombre === "string" ? b.nombre : "",
    correo: typeof b.correo === "string" ? b.correo : "",
    telefono: typeof b.telefono === "string" ? b.telefono : "",
    empresa: typeof b.empresa === "string" ? b.empresa : "",
    nota: typeof b.nota === "string" ? b.nota : "",
    horarioISO: typeof b.horarioISO === "string" ? b.horarioISO : "",
    trampa: typeof b.trampa === "string" ? b.trampa : "",
    origen: typeof b.origen === "string" ? b.origen : "",
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 200 });
  }
  return NextResponse.json(resultado);
}
