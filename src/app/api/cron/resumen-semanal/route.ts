import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoResumenSemanal } from "@/lib/email";

// Dispara Vercel Cron una vez por semana (ver vercel.json). Usa la service
// role key porque no hay ninguna persona con sesión iniciada en ese
// momento — necesita leer las ventas de todas las empresas para poder
// mandarle a cada una su propio resumen. Cada empresa solo recibe sus
// propios números, uno a la vez, nunca mezclados con los de otra.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: empresas, error: errorEmpresas } = await supabase
    .from("empresas")
    .select("id, nombre, modulos_activos");

  if (errorEmpresas) {
    return NextResponse.json({ error: errorEmpresas.message }, { status: 500 });
  }

  const ahora = new Date();
  const haceUnaSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const haceDosSemanas = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000);

  let enviados = 0;
  const errores: string[] = [];

  for (const empresa of empresas ?? []) {
    const modulosActivos = (empresa.modulos_activos ?? []) as string[];
    if (!modulosActivos.includes("ventas")) continue;

    const { data: administradores } = await supabase
      .from("perfiles")
      .select("id")
      .eq("empresa_id", empresa.id)
      .eq("rol_empresa", "administrador");

    if (!administradores || administradores.length === 0) continue;

    const [{ data: ventasSemanaData }, { data: ventasSemanaAnteriorData }] = await Promise.all([
      supabase
        .from("ventas")
        .select("monto")
        .eq("empresa_id", empresa.id)
        .gte("fecha", haceUnaSemana.toISOString())
        .lte("fecha", ahora.toISOString()),
      supabase
        .from("ventas")
        .select("monto")
        .eq("empresa_id", empresa.id)
        .gte("fecha", haceDosSemanas.toISOString())
        .lt("fecha", haceUnaSemana.toISOString()),
    ]);

    const ventasSemana = (ventasSemanaData ?? []).reduce((suma, v) => suma + Number(v.monto), 0);
    const ventasSemanaAnterior = (ventasSemanaAnteriorData ?? []).reduce(
      (suma, v) => suma + Number(v.monto),
      0,
    );

    // Sin ventas en ninguna de las dos semanas: no hay nada que contar
    // todavía (ej. una empresa recién creada) — se evita mandar un correo
    // vacío cada semana.
    if (ventasSemana === 0 && ventasSemanaAnterior === 0) continue;

    for (const administrador of administradores) {
      const { data: usuario } = await supabase.auth.admin.getUserById(administrador.id);
      const correo = usuario?.user?.email;
      if (!correo) continue;

      const { error } = await enviarCorreoResumenSemanal({
        correo,
        nombreEmpresa: empresa.nombre,
        ventasSemana,
        ventasSemanaAnterior,
      });

      if (error) errores.push(`${empresa.nombre} (${correo}): ${error}`);
      else enviados++;
    }
  }

  return NextResponse.json({ enviados, errores });
}
