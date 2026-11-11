import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoFinDePrueba, enviarCorreoPruebaVencida } from "@/lib/email";

// Dispara Vercel Cron una vez al día (ver vercel.json). Hace dos avisos
// aparte en la misma corrida, cada uno a su propia ventana de suscripciones
// en prueba: (1) cuando le quedan exactamente 3 días de los 15 (decidido
// 2026-11-10), y (2) cuando la prueba se cumple justo hoy (agregado
// 2026-11-11, "los enlaces" — ver CLAUDE.md, "Lista completa de correos
// transaccionales") — mismo cron para los dos, en vez de uno nuevo, porque
// son la misma consulta con una ventana de fecha distinta. Antes del (1)
// solo se podía mandar a mano desde /admin/correos. Usa la service role
// key por el mismo motivo que los demás crons: no hay ninguna persona con
// sesión iniciada en ese momento.
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

  // Vencimiento: ventana de hoy (0 días restantes), misma lógica que arriba.
  const inicioVentanaVencida = new Date();
  inicioVentanaVencida.setUTCHours(0, 0, 0, 0);
  const finVentanaVencida = new Date(inicioVentanaVencida);
  finVentanaVencida.setUTCDate(finVentanaVencida.getUTCDate() + 1);

  const { data: suscripcionesVencidas, error: errorVencidas } = await supabase
    .from("suscripciones")
    .select("empresa_id, empresas(nombre)")
    .eq("estado", "prueba")
    .gte("fecha_fin_prueba", inicioVentanaVencida.toISOString())
    .lt("fecha_fin_prueba", finVentanaVencida.toISOString());

  if (errorVencidas) {
    return NextResponse.json({ enviados, errores: [...errores, errorVencidas.message] });
  }

  for (const suscripcion of suscripcionesVencidas ?? []) {
    // Si ya agregó un método de pago, el aviso de "agrega uno" ya no
    // aplica — solo está esperando que cobro-suscripciones la cobre.
    const { count: metodosGuardados } = await supabase
      .from("metodos_pago")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", suscripcion.empresa_id);
    if (metodosGuardados) continue;

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

      const { error } = await enviarCorreoPruebaVencida({ correo, nombreEmpresa });

      if (error) errores.push(`${nombreEmpresa} (${correo}): ${error}`);
      else enviados++;
    }
  }

  return NextResponse.json({ enviados, errores });
}
