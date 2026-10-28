import { NextResponse } from "next/server";

// Página temporal de diagnóstico — solo dice si cada variable existe
// (nunca su valor), para encontrar por qué LLAVE_PUBLICA_WOMPI no le
// está llegando al despliegue de Preview. Borrar una vez resuelto.
const VARIABLES_A_REVISAR = [
  "LLAVE_PUBLICA_WOMPI",
  "LLAVE_PRIVADA_WOMPI",
  "SECRETO_EVENTOS_WOMPI",
  "INTEGRIDAD_EVENTOS_WOMPI",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];

export async function GET() {
  const estado = Object.fromEntries(
    VARIABLES_A_REVISAR.map((nombre) => [
      nombre,
      process.env[nombre] ? `presente (${process.env[nombre]!.length} caracteres)` : "FALTA",
    ]),
  );

  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? "desconocido",
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? "desconocido",
    variables: estado,
  });
}
