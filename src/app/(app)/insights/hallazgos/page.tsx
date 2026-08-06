import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { InsightsTabs } from "../insights-tabs";
import { GraficoBarras, GraficoDispersion, type Barra, type PuntoDispersion } from "../graficos";
import { detectarAnomalias, type GrupoAnalizado, type Anomalia } from "../anomalias";
import { generarResumenInsights, type AnomaliaResumen } from "@/lib/anthropic";
import { INSIGHTS_DISPONIBLE } from "../config";
import { InsightsProximamente } from "../proximamente";

const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_ANALISIS_VENTAS = 90;
const DIAS_ANALISIS_GASTOS = 180;

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function formatoMonedaCorta(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDiasIso(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Convierte un grupo + lo que el motor de anomalías encontró en barras
// listas para dibujar: las que salen normales quedan en gris (tenue), las
// que el motor marcó quedan resaltadas — en positivo (dorado) si el valor
// alto es bueno para esa métrica, en alerta (rojo) si un valor alto es malo
// (ej. gasto) o si un valor bajo es la señal de alarma.
function construirBarras(
  grupos: GrupoAnalizado[],
  anomalias: Anomalia[],
  altoEsBueno: boolean,
  formato: (v: number) => string = formatoMonedaCorta,
): Barra[] {
  const zPorEtiqueta = new Map(anomalias.map((a) => [a.etiqueta, a.z]));
  return grupos.map((g) => {
    const z = zPorEtiqueta.get(g.etiqueta);
    let tono: Barra["tono"] = "tenue";
    if (z !== undefined) {
      const esAlto = z > 0;
      tono = esAlto === altoEsBueno ? "positivo" : "alerta";
    }
    return { etiqueta: g.etiqueta, valor: g.valor, textoValor: formato(g.valor), tono, enlace: g.enlace };
  });
}

type Seccion = {
  modulo: string;
  titulo: string;
  descripcion: string;
  tipo: "barras" | "dispersion";
  barras?: Barra[];
  dispersion?: { datos: PuntoDispersion[]; ejeXLabel: string; ejeYLabel: string };
};

export default async function HallazgosInsightsPage() {
  await requerirModulo("insights");
  if (!INSIGHTS_DISPONIBLE) return <InsightsProximamente />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const empresaId = perfil.empresa_id;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("modulos_activos, atiende_festivos")
    .eq("id", empresaId)
    .single();

  const modulosActivos: string[] = empresa?.modulos_activos ?? [];
  const atiendeFestivos = empresa?.atiende_festivos ?? true;
  const hoy = hoyIso();

  const secciones: Seccion[] = [];
  const notasCortas: { modulo: string; titulo: string; detalle: string }[] = [];
  const anomaliasParaResumen: AnomaliaResumen[] = [];

  // ---------------------------------------------------------------
  // VENTAS
  // ---------------------------------------------------------------
  if (modulosActivos.includes("ventas")) {
    const { data: ventasPorDiaData } = await supabase
      .from("vista_ventas_por_dia")
      .select("dia_semana, es_festivo, total_vendido")
      .eq("empresa_id", empresaId)
      .gte("dia", sumarDiasIso(hoy, -DIAS_ANALISIS_VENTAS));

    const filas = (ventasPorDiaData ?? []) as { dia_semana: string; es_festivo: boolean; total_vendido: number }[];

    if (filas.length > 0) {
      const gruposDia: GrupoAnalizado[] = ORDEN_DIAS.map((dia) => {
        const delDia = filas.filter((f) => f.dia_semana === dia);
        const total = delDia.reduce((s, f) => s + f.total_vendido, 0);
        return { etiqueta: dia, valor: delDia.length > 0 ? total / delDia.length : 0 };
      }).filter((g) => g.valor > 0);

      const anomaliasDia = detectarAnomalias(gruposDia);
      if (anomaliasDia.length > 0) {
        secciones.push({
          modulo: "Ventas",
          titulo: "Ventas por día de la semana",
          descripcion: "Promedio de venta de cada día en los últimos 90 días — el día resaltado se sale de lo normal para tu negocio.",
          tipo: "barras",
          barras: construirBarras(gruposDia, anomaliasDia, true),
        });
        const top = anomaliasDia[0];
        anomaliasParaResumen.push({
          modulo: "Ventas",
          titulo: "Ventas por día de la semana",
          detalle: `${top.etiqueta} está ${top.z > 0 ? "muy por encima" : "muy por debajo"} del resto de días, con un promedio de ${formatoMonedaCorta(top.valor)}.`,
        });
      }

      if (atiendeFestivos) {
        const festivos = filas.filter((f) => f.es_festivo);
        const noFestivos = filas.filter((f) => !f.es_festivo);
        if (festivos.length > 0 && noFestivos.length > 0) {
          const promedioFestivo = festivos.reduce((s, f) => s + f.total_vendido, 0) / festivos.length;
          const promedioNoFestivo = noFestivos.reduce((s, f) => s + f.total_vendido, 0) / noFestivos.length;
          if (promedioNoFestivo > 0 && Math.abs(promedioFestivo - promedioNoFestivo) / promedioNoFestivo >= 0.2) {
            secciones.push({
              modulo: "Ventas",
              titulo: "Festivos vs. días normales",
              descripcion: "Promedio de venta según si el día fue festivo, últimos 90 días.",
              tipo: "barras",
              barras: [
                {
                  etiqueta: "Normal",
                  valor: promedioNoFestivo,
                  textoValor: formatoMonedaCorta(promedioNoFestivo),
                  tono: promedioNoFestivo >= promedioFestivo ? "positivo" : "tenue",
                },
                {
                  etiqueta: "Festivo",
                  valor: promedioFestivo,
                  textoValor: formatoMonedaCorta(promedioFestivo),
                  tono: promedioFestivo > promedioNoFestivo ? "positivo" : "tenue",
                },
              ],
            });
            anomaliasParaResumen.push({
              modulo: "Ventas",
              titulo: "Festivos vs. días normales",
              detalle: `Los días festivos venden ${promedioFestivo > promedioNoFestivo ? "más" : "menos"} que un día normal (${formatoMonedaCorta(promedioFestivo)} vs. ${formatoMonedaCorta(promedioNoFestivo)} en promedio).`,
            });
          }
        }
      }
    }

    const { data: categoriaData } = await supabase
      .from("vista_utilidad_por_categoria")
      .select("categoria, ingresos")
      .eq("empresa_id", empresaId);

    const gruposCategoria: GrupoAnalizado[] = ((categoriaData ?? []) as { categoria: string | null; ingresos: number }[])
      .filter((c) => c.categoria && c.ingresos > 0)
      .map((c) => ({ etiqueta: c.categoria as string, valor: c.ingresos }));

    const anomaliasCategoria = detectarAnomalias(gruposCategoria);
    if (anomaliasCategoria.length > 0) {
      secciones.push({
        modulo: "Ventas",
        titulo: "Ingresos por categoría",
        descripcion: "Qué categorías se salen del patrón normal de facturación.",
        tipo: "barras",
        barras: construirBarras(gruposCategoria, anomaliasCategoria, true),
      });
      const top = anomaliasCategoria[0];
      anomaliasParaResumen.push({
        modulo: "Ventas",
        titulo: "Ingresos por categoría",
        detalle: `La categoría "${top.etiqueta}" factura ${top.z > 0 ? "muy por encima" : "muy por debajo"} de las demás (${formatoMonedaCorta(top.valor)}).`,
      });
    }
  }

  // ---------------------------------------------------------------
  // INVENTARIO
  // ---------------------------------------------------------------
  if (modulosActivos.includes("inventario")) {
    const { data: itemsData } = await supabase
      .from("inventario_items")
      .select("id, nombre, cantidad, precio_venta")
      .eq("empresa_id", empresaId)
      .eq("tipo", "producto");

    const items = (itemsData ?? []) as { id: string; nombre: string; cantidad: number; precio_venta: number | null }[];
    const itemIds = items.map((i) => i.id);

    const { data: utilidadProductoData } = await supabase
      .from("vista_utilidad_por_producto")
      .select("item_id, nombre, ingresos, margen_porcentaje")
      .eq("empresa_id", empresaId);

    const utilidadProducto = (utilidadProductoData ?? []) as {
      item_id: string;
      nombre: string;
      ingresos: number;
      margen_porcentaje: number;
    }[];

    // Margen vs. ingresos por producto — para ver de un vistazo cuáles
    // productos facturan fuerte pero dejan poco margen.
    const conVentas = utilidadProducto.filter((p) => p.ingresos > 0);
    if (conVentas.length >= 3) {
      const gruposMargen: GrupoAnalizado[] = conVentas.map((p) => ({ etiqueta: p.nombre, valor: p.margen_porcentaje }));
      const anomaliasMargen = detectarAnomalias(gruposMargen);
      const bajoMargen = anomaliasMargen.filter((a) => a.z < 0);
      const etiquetasDestacadas = new Set(bajoMargen.map((a) => a.etiqueta));

      secciones.push({
        modulo: "Inventario",
        titulo: "Margen vs. ingresos por producto",
        descripcion: "Cada punto es un producto. Los de margen inusualmente bajo quedan resaltados.",
        tipo: "dispersion",
        dispersion: {
          ejeXLabel: "Ingresos",
          ejeYLabel: "Margen %",
          datos: conVentas.map((p) => ({
            etiqueta: p.nombre,
            x: p.ingresos,
            y: p.margen_porcentaje,
            textoX: formatoMonedaCorta(p.ingresos),
            textoY: `${p.margen_porcentaje}%`,
            destacado: etiquetasDestacadas.has(p.nombre),
          })),
        },
      });
      if (bajoMargen.length > 0) {
        anomaliasParaResumen.push({
          modulo: "Inventario",
          titulo: "Margen vs. ingresos por producto",
          detalle: `"${bajoMargen[0].etiqueta}" tiene un margen inusualmente bajo comparado con el resto del catálogo.`,
        });
      }
    }

    // Velocidad de venta vs. días de stock — la rotación real: qué se
    // vende rápido pero casi no queda (riesgo de quiebre) vs. qué casi no
    // se vende y tiene mucho stock quieto.
    if (itemIds.length > 0) {
      const { data: velocidadData } = await supabase
        .from("vista_velocidad_ventas")
        .select("item_id, unidades_por_dia")
        .eq("empresa_id", empresaId)
        .in("item_id", itemIds);

      const velocidadPorItem = new Map(
        ((velocidadData ?? []) as { item_id: string; unidades_por_dia: number }[]).map((v) => [
          v.item_id,
          v.unidades_por_dia,
        ]),
      );

      const conRotacion = items
        .map((item) => {
          const velocidad = velocidadPorItem.get(item.id) ?? 0;
          const diasStock = velocidad > 0 ? item.cantidad / velocidad : null;
          return { item, velocidad, diasStock };
        })
        .filter((f) => f.velocidad > 0 && f.diasStock !== null);

      if (conRotacion.length >= 3) {
        const gruposDiasStock: GrupoAnalizado[] = conRotacion.map((f) => ({
          etiqueta: f.item.nombre,
          valor: f.diasStock as number,
        }));
        const anomaliasStock = detectarAnomalias(gruposDiasStock);
        const enRiesgoLista = anomaliasStock.filter((a) => a.z < 0);
        const enRiesgo = new Set(enRiesgoLista.map((a) => a.etiqueta));

        secciones.push({
          modulo: "Inventario",
          titulo: "Rotación: velocidad de venta vs. días de stock",
          descripcion: "Cada punto es un producto. Los que están por agotarse quedan resaltados.",
          tipo: "dispersion",
          dispersion: {
            ejeXLabel: "Unidades vendidas por día",
            ejeYLabel: "Días de stock restante",
            datos: conRotacion.map((f) => ({
              etiqueta: f.item.nombre,
              x: f.velocidad,
              y: f.diasStock as number,
              textoX: `${f.velocidad.toLocaleString("es-CO", { maximumFractionDigits: 2 })}/día`,
              textoY: `${Math.floor(f.diasStock as number)} días`,
              destacado: enRiesgo.has(f.item.nombre),
            })),
          },
        });
        if (enRiesgoLista.length > 0) {
          anomaliasParaResumen.push({
            modulo: "Inventario",
            titulo: "Rotación de inventario",
            detalle: `"${enRiesgoLista[0].etiqueta}" se vende rápido y le quedan pocos días de stock — riesgo de quiebre.`,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // CRM
  // ---------------------------------------------------------------
  if (modulosActivos.includes("crm")) {
    const { data: perfilesClienteData } = await supabase
      .from("vista_perfil_cliente")
      .select("contacto_id, inversion_total, ultima_compra, dias_promedio_entre_compras")
      .eq("empresa_id", empresaId)
      .not("dias_promedio_entre_compras", "is", null);

    type FilaPerfilCliente = {
      contacto_id: string;
      inversion_total: number;
      ultima_compra: string;
      dias_promedio_entre_compras: number;
    };

    const perfilesCliente = (perfilesClienteData ?? []) as FilaPerfilCliente[];
    const contactoIds = perfilesCliente.map((p) => p.contacto_id);

    if (contactoIds.length >= 3) {
      const { data: contactosData } = await supabase.from("crm_contactos").select("id, nombre").in("id", contactoIds);
      const nombrePorContacto = new Map(
        ((contactosData ?? []) as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]),
      );

      const conRatio = perfilesCliente
        .filter((p) => p.dias_promedio_entre_compras > 0)
        .map((p) => {
          const diasSinComprar = Math.floor((new Date(hoy).getTime() - new Date(p.ultima_compra).getTime()) / 86400000);
          return {
            nombre: nombrePorContacto.get(p.contacto_id) ?? "Cliente",
            diasSinComprar,
            ratio: diasSinComprar / p.dias_promedio_entre_compras,
            inversionTotal: p.inversion_total,
            diasPromedio: p.dias_promedio_entre_compras,
          };
        });

      if (conRatio.length >= 3) {
        const gruposRatio: GrupoAnalizado[] = conRatio.map((c) => ({ etiqueta: c.nombre, valor: c.ratio }));
        const anomaliasRatio = detectarAnomalias(gruposRatio);
        const enfriadosLista = anomaliasRatio.filter((a) => a.z > 0);
        const enfriados = new Set(enfriadosLista.map((a) => a.etiqueta));

        secciones.push({
          modulo: "CRM",
          titulo: "Clientes: valor vs. qué tan atrasados están",
          descripcion:
            "Cada punto es un cliente. Eje X: cuántas veces más de su propio ritmo lleva sin comprar. Los que valen mucho y se están enfriando quedan resaltados.",
          tipo: "dispersion",
          dispersion: {
            ejeXLabel: "Veces su propio ritmo de compra",
            ejeYLabel: "Invertido en total",
            datos: conRatio.map((c) => ({
              etiqueta: c.nombre,
              x: c.ratio,
              y: c.inversionTotal,
              textoX: `${c.ratio.toFixed(1)}x su ritmo (cada ${Math.round(c.diasPromedio)} días)`,
              textoY: formatoMonedaCorta(c.inversionTotal),
              destacado: enfriados.has(c.nombre),
            })),
          },
        });
        if (enfriadosLista.length > 0) {
          const top = conRatio.find((c) => c.nombre === enfriadosLista[0].etiqueta);
          anomaliasParaResumen.push({
            modulo: "CRM",
            titulo: "Clientes que se están enfriando",
            detalle: `"${enfriadosLista[0].etiqueta}" ha invertido ${top ? formatoMonedaCorta(top.inversionTotal) : "un valor alto"} en total y lleva mucho más tiempo del que acostumbra sin comprar.`,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // P Y G
  // ---------------------------------------------------------------
  if (modulosActivos.includes("pyg")) {
    const { data: porMesData } = await supabase
      .from("vista_estado_resultados")
      .select("mes, utilidad_neta")
      .eq("empresa_id", empresaId)
      .order("mes", { ascending: false })
      .limit(12);

    const porMes = (porMesData ?? []) as { mes: string; utilidad_neta: number }[];
    if (porMes.length >= 3) {
      const gruposMes: GrupoAnalizado[] = [...porMes]
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map((f) => ({
          etiqueta: new Date(f.mes).toLocaleDateString("es-CO", { month: "short", year: "2-digit" }),
          valor: f.utilidad_neta,
        }));

      const anomaliasMes = detectarAnomalias(gruposMes);
      if (anomaliasMes.length > 0) {
        secciones.push({
          modulo: "P y G",
          titulo: "Utilidad neta por mes",
          descripcion: "El mes resaltado se sale del patrón normal de utilidad de tu negocio.",
          tipo: "barras",
          barras: construirBarras(gruposMes, anomaliasMes, true),
        });
        const top = anomaliasMes[0];
        anomaliasParaResumen.push({
          modulo: "P y G",
          titulo: "Utilidad neta por mes",
          detalle: `${top.etiqueta} tuvo una utilidad neta ${top.z > 0 ? "muy por encima" : "muy por debajo"} de lo normal (${formatoMonedaCorta(top.valor)}).`,
        });
      }
    }

    const { data: gastosData } = await supabase
      .from("finanzas_movimientos")
      .select("categoria, monto")
      .eq("empresa_id", empresaId)
      .eq("tipo", "gasto")
      .gte("fecha", sumarDiasIso(hoy, -DIAS_ANALISIS_GASTOS));

    const gastosPorCategoria = new Map<string, number>();
    for (const g of (gastosData ?? []) as { categoria: string | null; monto: number }[]) {
      const categoria = g.categoria || "Sin categoría";
      gastosPorCategoria.set(categoria, (gastosPorCategoria.get(categoria) ?? 0) + g.monto);
    }
    const gruposGasto: GrupoAnalizado[] = Array.from(gastosPorCategoria.entries()).map(([etiqueta, valor]) => ({
      etiqueta,
      valor,
    }));
    const anomaliasGasto = detectarAnomalias(gruposGasto);
    if (anomaliasGasto.length > 0) {
      secciones.push({
        modulo: "P y G",
        titulo: "Gastos por categoría",
        descripcion: `Últimos ${DIAS_ANALISIS_GASTOS} días. La categoría resaltada pesa distinto a lo normal.`,
        tipo: "barras",
        barras: construirBarras(gruposGasto, anomaliasGasto, false),
      });
      const top = anomaliasGasto[0];
      anomaliasParaResumen.push({
        modulo: "P y G",
        titulo: "Gastos por categoría",
        detalle: `El gasto en "${top.etiqueta}" es ${top.z > 0 ? "inusualmente alto" : "inusualmente bajo"} frente a las demás categorías (${formatoMonedaCorta(top.valor)} en los últimos ${DIAS_ANALISIS_GASTOS} días).`,
      });
    }

    const { data: pasivosData } = await supabase
      .from("pasivos")
      .select("descripcion, monto_total, monto_pagado, fecha_vencimiento")
      .eq("empresa_id", empresaId)
      .eq("estado", "pendiente")
      .not("fecha_vencimiento", "is", null)
      .lte("fecha_vencimiento", sumarDiasIso(hoy, 15))
      .gte("fecha_vencimiento", hoy);

    for (const d of (pasivosData ?? []) as {
      descripcion: string;
      monto_total: number;
      monto_pagado: number;
      fecha_vencimiento: string;
    }[]) {
      const saldo = d.monto_total - d.monto_pagado;
      const diasParaVencer = Math.ceil(
        (new Date(`${d.fecha_vencimiento}T00:00:00`).getTime() - new Date(hoy).getTime()) / 86400000,
      );
      notasCortas.push({
        modulo: "P y G",
        titulo: `"${d.descripcion}" vence en ${diasParaVencer} días`,
        detalle: `Queda pendiente ${formatoMoneda(saldo)} de ${formatoMoneda(d.monto_total)}.`,
      });
      anomaliasParaResumen.push({
        modulo: "P y G",
        titulo: "Deuda por vencer",
        detalle: `"${d.descripcion}" vence en ${diasParaVencer} días, con ${formatoMoneda(saldo)} pendiente.`,
      });
    }
  }

  // ---------------------------------------------------------------
  // PROMOCIONES
  // ---------------------------------------------------------------
  if (modulosActivos.includes("promociones")) {
    const { data: promoData } = await supabase
      .from("vista_efectividad_promociones")
      .select("nombre, ventas_con_este_descuento, ingresos_de_esas_ventas")
      .eq("empresa_id", empresaId)
      .lte("fecha_inicio", hoy)
      .gte("fecha_fin", hoy);

    const activas = ((promoData ?? []) as {
      nombre: string;
      ventas_con_este_descuento: number;
      ingresos_de_esas_ventas: number;
    }[]).filter((p) => p.ventas_con_este_descuento > 0);

    if (activas.length > 0) {
      const barrasPromo: Barra[] = activas
        .sort((a, b) => b.ingresos_de_esas_ventas - a.ingresos_de_esas_ventas)
        .map((p, i) => ({
          etiqueta: p.nombre,
          valor: p.ingresos_de_esas_ventas,
          textoValor: formatoMonedaCorta(p.ingresos_de_esas_ventas),
          tono: i === 0 && activas.length > 1 ? "positivo" : "tenue",
        }));

      secciones.push({
        modulo: "Promociones",
        titulo: "Desempeño de campañas activas",
        descripcion: "Cuánto ha facturado cada campaña con descuento aplicado, mientras está vigente.",
        tipo: "barras",
        barras: barrasPromo,
      });
    }
  }

  // Resumen ejecutivo en lenguaje natural (Claude Haiku) sobre las
  // anomalías que el motor estadístico ya encontró — se cachea una vez al
  // día por empresa para mantener el costo mínimo. Si ANTHROPIC_API_KEY no
  // está configurada, o no hay ninguna anomalía, simplemente no aparece.
  let resumenIA: string | null = null;
  if (anomaliasParaResumen.length > 0) {
    const inicioHoy = `${hoy}T00:00:00.000Z`;
    const { data: cache } = await supabase
      .from("insights_resumen_ia")
      .select("contenido")
      .eq("empresa_id", empresaId)
      .gte("generado_en", inicioHoy)
      .order("generado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cache) {
      resumenIA = cache.contenido;
    } else {
      resumenIA = await generarResumenInsights(anomaliasParaResumen);
      if (resumenIA) {
        await supabase.from("insights_resumen_ia").insert({ empresa_id: empresaId, contenido: resumenIA });
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Panel de control</h1>
        <p className="mt-1 text-sm text-gray-500">Cómo va tu negocio, con datos reales.</p>
      </div>

      <InsightsTabs />

      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Insights</h2>
        <p className="text-xs text-gray-400">
          Cada gráfica se genera sola comparando tus propios datos contra tu propio promedio — sin
          reglas fijas iguales para todos. Solo aparece lo que de verdad se sale de lo normal.
        </p>
      </div>

      {resumenIA && (
        <div className="mb-4 rounded-xl border-2 border-gray-900 bg-gray-900 p-4">
          <p className="mb-1 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            Resumen del día
          </p>
          <p className="text-sm leading-relaxed text-white">{resumenIA}</p>
        </div>
      )}

      {secciones.length === 0 && notasCortas.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no hay suficientes datos, o todo está dentro de lo normal en los módulos que tienes
          activos — no hay nada que señalar por ahora.
        </p>
      ) : (
        <div className="space-y-4">
          {secciones.map((s, i) => (
            <div key={i} className="rounded-xl border-2 border-gray-200 p-4">
              <div className="mb-3">
                <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">{s.modulo}</p>
                <h3 className="text-sm font-semibold text-gray-900">{s.titulo}</h3>
                <p className="text-xs text-gray-500">{s.descripcion}</p>
              </div>
              {s.tipo === "barras" && s.barras && <GraficoBarras datos={s.barras} />}
              {s.tipo === "dispersion" && s.dispersion && (
                <GraficoDispersion
                  datos={s.dispersion.datos}
                  ejeXLabel={s.dispersion.ejeXLabel}
                  ejeYLabel={s.dispersion.ejeYLabel}
                />
              )}
            </div>
          ))}

          {notasCortas.length > 0 && (
            <div className="rounded-xl border-2 border-gray-200 p-4">
              <p className="mb-2 text-[11px] font-medium tracking-wide text-gray-400 uppercase">Fechas límite</p>
              <ul className="space-y-2">
                {notasCortas.map((n, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
                    <p className="text-xs text-gray-500">{n.detalle}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
