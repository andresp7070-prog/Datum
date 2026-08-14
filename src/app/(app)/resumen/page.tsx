import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPerfilActual, esRolDePlataforma } from "@/lib/empresa";
import { obtenerContextoPunto } from "@/lib/puntos";
import { primeraMayuscula } from "@/lib/texto";
import { firmarFotoUrl } from "@/lib/fotos";
import { calcularDiasRestantes } from "@/lib/inventario";
import { LogoEmpresa } from "./logo-empresa";

const UMBRAL_DIAS_POR_AGOTARSE = 7;

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function diaColombia(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export default async function ResumenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resumen muestra datos de P y G e inventario — un vendedor solo debe ver Ventas.
  const perfilActual = await getPerfilActual();
  if (esRolDePlataforma(perfilActual?.rol)) redirect("/admin");
  if (perfilActual?.rol_empresa === "vendedor") redirect("/ventas");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { puntoSeleccionado } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    perfil.punto_venta_id,
  );

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const mesActual = hoy.slice(0, 7);

  const { data: empresaModulos } = await supabase
    .from("empresas")
    .select("modulos_activos")
    .eq("id", perfil.empresa_id)
    .single();
  const modulosActivos = (empresaModulos?.modulos_activos ?? []) as string[];
  const tieneVentas = modulosActivos.includes("ventas");
  const tienePyg = modulosActivos.includes("pyg");
  const tieneInventario = modulosActivos.includes("inventario");
  const tienePromociones = modulosActivos.includes("promociones");

  let ventasQuery = supabase.from("ventas").select("fecha, monto").eq("empresa_id", perfil.empresa_id);
  let resultadosQuery = supabase
    .from("vista_estado_resultados")
    .select("mes, punto_venta_id, utilidad_neta")
    .eq("empresa_id", perfil.empresa_id);
  // Sin filtro de cantidad: se trae todo el catálogo de productos para poder
  // calcular, con la velocidad de venta, cuáles ya están agotados y cuáles
  // se van a agotar pronto — no solo los que ya llegaron a cero.
  let itemsQuery = supabase
    .from("inventario_items")
    .select("id, nombre, cantidad, unidad")
    .eq("empresa_id", perfil.empresa_id)
    .eq("tipo", "producto")
    .order("nombre");
  // vista_velocidad_ventas no expone punto_venta_id (no se filtra por punto,
  // mismo alcance que ya usan /inventario/proyecciones y /ventas/nueva).
  const velocidadQuery = supabase
    .from("vista_velocidad_ventas")
    .select("item_id, unidades_por_dia")
    .eq("empresa_id", perfil.empresa_id);
  let promocionesQuery = supabase
    .from("promociones")
    .select("id, nombre, tipo_promocion, fecha_fin")
    .eq("empresa_id", perfil.empresa_id)
    .eq("activo", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy)
    .order("fecha_fin");

  if (puntoSeleccionado) {
    ventasQuery = ventasQuery.eq("punto_venta_id", puntoSeleccionado);
    resultadosQuery = resultadosQuery.eq("punto_venta_id", puntoSeleccionado);
    itemsQuery = itemsQuery.eq("punto_venta_id", puntoSeleccionado);
    promocionesQuery = promocionesQuery.eq("punto_venta_id", puntoSeleccionado);
  }

  const [
    { data: empresa },
    { data: ventasData },
    { data: resultadosData },
    { data: pasivosData },
    { data: itemsData },
    { data: velocidadData },
    { data: promocionesData },
  ] = await Promise.all([
    supabase.from("empresas").select("nombre, logo_path").eq("id", perfil.empresa_id).single(),
    tieneVentas ? ventasQuery : Promise.resolve({ data: [] }),
    tienePyg ? resultadosQuery : Promise.resolve({ data: [] }),
    tienePyg
      ? supabase
          .from("pasivos")
          .select("descripcion, monto_total, monto_pagado, fecha_vencimiento, estado")
          .eq("empresa_id", perfil.empresa_id)
      : Promise.resolve({ data: [] }),
    tieneInventario ? itemsQuery : Promise.resolve({ data: [] }),
    tieneInventario ? velocidadQuery : Promise.resolve({ data: [] }),
    tienePromociones ? promocionesQuery : Promise.resolve({ data: [] }),
  ]);

  // ---- Ventas de hoy ----
  const ventas = (ventasData ?? []) as { fecha: string; monto: number }[];
  const ventasHoy = ventas.filter((v) => diaColombia(v.fecha) === hoy);
  const totalVentasHoy = ventasHoy.length;
  const totalVendidoHoy = ventasHoy.reduce((suma, v) => suma + Number(v.monto), 0);

  const vendidoPorDia: Record<string, number> = {};
  for (const v of ventas) {
    const dia = diaColombia(v.fecha);
    vendidoPorDia[dia] = (vendidoPorDia[dia] ?? 0) + Number(v.monto);
  }
  const diasAnteriores = Object.entries(vendidoPorDia).filter(([dia]) => dia !== hoy);
  const promedioDiario =
    diasAnteriores.length > 0
      ? diasAnteriores.reduce((suma, [, monto]) => suma + monto, 0) / diasAnteriores.length
      : null;
  const diferenciaPromedio =
    promedioDiario !== null && promedioDiario > 0
      ? Math.round(((totalVendidoHoy - promedioDiario) / promedioDiario) * 100)
      : null;

  // ---- Ventas de este mes ----
  // Mismo arreglo "ventas" de arriba, sin consulta aparte — ya trae todo lo
  // necesario (fecha y monto).
  const ventasMes = ventas.filter((v) => diaColombia(v.fecha).slice(0, 7) === mesActual);
  const totalVendidoMes = ventasMes.reduce((suma, v) => suma + Number(v.monto), 0);

  // ---- Utilidad neta del mes ----
  // Con "todos los puntos" la vista trae una fila por punto — se suman para
  // tener la utilidad combinada del mes, igual que antes de tener puntos.
  const resultados = (resultadosData ?? []) as { mes: string; utilidad_neta: number }[];
  const utilidadNetaMes = resultados
    .filter((f) => f.mes.slice(0, 7) === mesActual)
    .reduce((suma, f) => suma + Number(f.utilidad_neta), 0);

  // ---- Deudas pendientes, con cuándo vencen ----
  const pasivos = (pasivosData ?? []) as {
    descripcion: string;
    monto_total: number;
    monto_pagado: number;
    fecha_vencimiento: string | null;
    estado: string;
  }[];
  const deudasPendientes = pasivos.filter((p) => p.estado !== "pagado");
  const totalPendiente = deudasPendientes.reduce(
    (suma, p) => suma + (p.monto_total - p.monto_pagado),
    0,
  );
  const proximasAVencer = [...deudasPendientes]
    .filter((p) => p.fecha_vencimiento !== null)
    .sort((a, b) => (a.fecha_vencimiento as string).localeCompare(b.fecha_vencimiento as string))
    .slice(0, 3);

  // ---- Inventario: agotado o por agotarse pronto ----
  // Cruza el catálogo con la velocidad de venta de cada producto (misma
  // fórmula que /inventario/proyecciones) para no solo avisar cuando ya
  // llegó a cero, sino cuando le quedan pocos días de stock.
  const velocidadPorItem = new Map(
    ((velocidadData ?? []) as { item_id: string; unidades_por_dia: number }[]).map((v) => [
      v.item_id,
      v.unidades_por_dia,
    ]),
  );
  const itemsInventario = (itemsData ?? []) as {
    id: string;
    nombre: string;
    cantidad: number;
    unidad: string;
  }[];
  const itemsPorAgotarse = itemsInventario
    .map((item) => ({
      ...item,
      agotado: item.cantidad <= 0,
      diasRestantes: calcularDiasRestantes(item.cantidad, velocidadPorItem.get(item.id)),
    }))
    .filter(
      (item) =>
        item.agotado || (item.diasRestantes !== null && item.diasRestantes <= UMBRAL_DIAS_POR_AGOTARSE),
    )
    .sort((a, b) => {
      if (a.agotado !== b.agotado) return a.agotado ? -1 : 1;
      return (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0);
    });

  // ---- Promociones activas ----
  // Se pide aparte (no en el Promise.all de arriba) porque depende de saber
  // primero cuáles promociones están activas — vista_efectividad_promociones
  // trae cuántas ventas ha generado cada una hasta ahora.
  const promocionesActivas = (promocionesData ?? []) as {
    id: string;
    nombre: string;
    tipo_promocion: string;
    fecha_fin: string;
  }[];

  const idsPromocionesActivas = promocionesActivas.map((p) => p.id);
  const { data: efectividadData } =
    idsPromocionesActivas.length > 0
      ? await supabase
          .from("vista_efectividad_promociones")
          .select("promocion_id, ventas_con_este_descuento")
          .in("promocion_id", idsPromocionesActivas)
      : { data: [] };

  const ventasPorPromocion = new Map(
    (efectividadData ?? []).map((e) => [e.promocion_id, e.ventas_con_este_descuento]),
  );

  const hoyDate = new Date(`${hoy}T00:00:00`);
  const promocionesConDetalle = promocionesActivas.map((promo) => ({
    ...promo,
    ventasGeneradas: ventasPorPromocion.get(promo.id) ?? 0,
    diasRestantes: Math.max(
      0,
      Math.ceil((new Date(`${promo.fecha_fin}T00:00:00`).getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24)),
    ),
  }));

  const logoUrl = await firmarFotoUrl(supabase, empresa?.logo_path ?? null, "empresas-logos");

  const fechaLegible = primeraMayuscula(
    new Date().toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Hola, {empresa?.nombre ?? "bienvenido"}
          </h1>
          <p className="text-sm text-gray-400">{fechaLegible}</p>
        </div>
        <LogoEmpresa logoUrl={logoUrl} />
      </div>

      {(tieneVentas || tienePyg) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tieneVentas && (
            <div className="rounded-xl border border-gray-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Ventas de hoy</h2>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-gray-900">{formatoMoneda(totalVendidoHoy)}</p>
              </div>
              <p className="text-xs text-gray-400">{totalVentasHoy} venta(s) hoy</p>
              {diferenciaPromedio !== null ? (
                <p
                  className={`mt-2 text-xs font-medium ${
                    diferenciaPromedio > 0
                      ? "text-green-600"
                      : diferenciaPromedio < 0
                        ? "text-red-600"
                        : "text-gray-400"
                  }`}
                >
                  {diferenciaPromedio > 0 && `▲ ${diferenciaPromedio}% sobre el promedio`}
                  {diferenciaPromedio < 0 && `▼ ${Math.abs(diferenciaPromedio)}% bajo el promedio`}
                  {diferenciaPromedio === 0 && "Igual al promedio"}
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-400">Aún no hay suficientes días para comparar</p>
              )}
            </div>
          )}

          {tieneVentas && (
            <div className="rounded-xl border border-gray-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Ventas de este mes</h2>
              <p className="text-2xl font-semibold text-gray-900">{formatoMoneda(totalVendidoMes)}</p>
              <p className="text-xs text-gray-400">{ventasMes.length} venta(s) en {mesActual}</p>
            </div>
          )}

          {tienePyg && (
            <div className="rounded-xl border border-gray-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Utilidad neta del mes</h2>
              <p
                className={`text-2xl font-semibold ${
                  utilidadNetaMes >= 0 ? "text-gray-900" : "text-red-600"
                }`}
              >
                {formatoMoneda(utilidadNetaMes)}
              </p>
              <p className="text-xs text-gray-400">Deudas pendientes: {formatoMoneda(totalPendiente)}</p>
            </div>
          )}
        </div>
      )}

      {tienePyg && deudasPendientes.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Deudas por vencer</h2>
            <Link href="/pyg/pasivos" className="text-xs text-gray-500 hover:text-gray-700">
              Ver todas
            </Link>
          </div>
          {proximasAVencer.length === 0 ? (
            <p className="text-sm text-gray-400">
              Tienes deudas pendientes sin fecha de vencimiento registrada.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {proximasAVencer.map((deuda, i) => {
                const dias = Math.ceil(
                  (new Date(`${deuda.fecha_vencimiento}T00:00:00`).getTime() - new Date(`${hoy}T00:00:00`).getTime()) /
                    (1000 * 60 * 60 * 24),
                );
                return (
                  <li key={i} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-gray-700">{deuda.descripcion}</p>
                      <p
                        className={`text-xs ${dias < 0 ? "text-red-600" : dias <= 7 ? "text-amber-600" : "text-gray-400"}`}
                      >
                        {dias < 0
                          ? `Venció hace ${Math.abs(dias)} día(s)`
                          : dias === 0
                            ? "Vence hoy"
                            : `Vence en ${dias} día(s)`}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatoMoneda(deuda.monto_total - deuda.monto_pagado)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tieneInventario && (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Inventario por agotarse</h2>
            <Link href="/inventario" className="text-xs text-gray-500 hover:text-gray-700">
              Ver inventario
            </Link>
          </div>
          {itemsPorAgotarse.length === 0 ? (
            <p className="text-sm text-gray-400">
              Ningún producto está en cero ni se va a agotar pronto — todo en orden.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {itemsPorAgotarse.slice(0, 5).map((item) => (
                <li key={item.id} className="flex justify-between py-1.5">
                  <span className="text-gray-700">{item.nombre}</span>
                  <span className={item.agotado ? "text-red-600" : "text-amber-600"}>
                    {item.agotado ? "Agotado" : `Quedan ${item.diasRestantes} día(s)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {itemsPorAgotarse.length > 5 && (
            <p className="mt-2 text-xs text-gray-400">y {itemsPorAgotarse.length - 5} más...</p>
          )}
        </div>
      )}

      {tienePromociones && (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Promociones activas</h2>
            <Link href="/promociones" className="text-xs text-gray-500 hover:text-gray-700">
              Ver promociones
            </Link>
          </div>
          {promocionesConDetalle.length === 0 ? (
            <p className="text-sm text-gray-400">Ninguna promoción activa en este momento.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {promocionesConDetalle.map((promo) => (
                <li key={promo.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-gray-700">{promo.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {promo.diasRestantes === 0
                        ? "Último día"
                        : `Queda${promo.diasRestantes === 1 ? "" : "n"} ${promo.diasRestantes} día${promo.diasRestantes === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <span className="text-gray-500">
                    {promo.ventasGeneradas} venta{promo.ventasGeneradas === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

    </div>
  );
}
