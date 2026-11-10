import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoFinDePrueba } from "@/lib/email";

// Dispara Vercel Cron una vez al día (ver vercel.json). Avisa sola a cada
// empresa todavía en prueba cuando le quedan exactamente 3 días de los 15
// (decidido 2026-11-10 — ver CLAUDE.md, "Pendientes") — antes solo se podía
// mandar a mano desde /admin/correos. Usa la service role key por el mismo
// motivo que resumen-semanal/route.ts: no hay ninguna persona con sesión
// iniciada en ese momento.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Ventana de un día completo, exactamente 3 días adelante de hoy. No se
  // guarda ningún "ya se mandó" aparte: como fecha_fin_prueba es un
  // instante fijo por suscripción, cada una solo cae dentro de esta
  // ventana una vez en toda su vida — correr el cron dos veces el mismo
  // día es el único caso en que se repetiría.
  const inicioVentana = new Date();
  inicioVentana.setUTCDate(inicioVentana.getUTCDate() + 3);
  inicioVentana.setUTCHours(0, 0, 0, 0);
  const finVentana = new Date(inicioVentana);
  finVentana.setUTCDate(finVentana.getUTCDate() + 1);

  const { data: suscripciones, error: errorSuscripciones } = await supabase
    .from("suscripciones")
    .select("empresa_id, empresas(nombre)")
    .eq("estado", "prueba")
    .gte("fecha_fin_prueba", inicioVentana.toISOString())
    .lt("fecha_fin_prueba", finVentana.toISOString());

  if (errorSuscripciones) {
    return NextResponse.json({ error: errorSuscripciones.message }, { status: 500 });
  }

  let enviados = 0;
  const errores: string[] = [];

  for (const suscripcion of suscripciones ?? []) {
    const empresa = suscripcion.empresas as unknown as { nombre: string } | null;
    const nombreEmpresa = empresa?.nombre ?? "tu empresa";

    const { data: administradores } = await supabase
      .from("perfiles")
      .select("id")
      .eq("empresa_id", suscripcion.empresa_id)
      .eq("rol_empresa", "administrador");

    for (const administrador of administradores ?? []) {
      const { data: usuario } = await supabase.auth.admin.getUserById(administrador.id);
      const correo = usuario?.user?.email;
      if (!correo) continue;

      const { error } = await enviarCorreoFinDePrueba({ correo, nombreEmpresa, diasRestantes: 3 });

      if (error) errores.push(`${nombreEmpresa} (${correo}): ${error}`);
      else enviados++;
    }
  }

  return NextResponse.json({ enviados, errores });
}
