import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calcularDiasRestantes, calcularMaxProducible } from "@/lib/inventario";
import { NuevaVentaForm } from "./nueva-venta-form";

export default async function NuevaVentaPage() {
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

  const { data: itemsData } = await supabase
    .from("inventario_items")
    .select("id, nombre, categoria, unidad, cantidad, precio_venta, marca:atributos->>marca")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const { data: velocidadData } = await supabase
    .from("vista_velocidad_ventas")
    .select("item_id, unidades_por_dia")
    .eq("empresa_id", perfil.empresa_id);

  const velocidadPorItem = new Map(
    (velocidadData ?? []).map((v) => [v.item_id, Number(v.unidades_por_dia)]),
  );

  // Productos con receta (compuestos): su "cantidad" propia no significa nada,
  // lo que hay disponible depende del insumo más escaso — mismo cálculo que
  // usa la ficha de Inventario.
  const itemIds = (itemsData ?? []).map((item) => item.id);

  type RecetaFila = {
    item_resultante_id: string;
    cantidad_insumo: number;
    inventario_items: { cantidad: number } | null;
  };

  const { data: recetaRowsRaw } =
    itemIds.length > 0
      ? await supabase
          .from("inventario_receta")
          .select(
            "item_resultante_id, cantidad_insumo, inventario_items!inventario_receta_item_insumo_id_fkey ( cantidad )",
          )
          .in("item_resultante_id", itemIds)
      : { data: [] };

  const recetaRows = (recetaRowsRaw ?? []) as unknown as RecetaFila[];

  const recetaPorItem: Record<string, { cantidadInsumo: number; stockInsumo: number }[]> = {};
  for (const fila of recetaRows) {
    const lista = recetaPorItem[fila.item_resultante_id] ?? [];
    lista.push({ cantidadInsumo: fila.cantidad_insumo, stockInsumo: fila.inventario_items?.cantidad ?? 0 });
    recetaPorItem[fila.item_resultante_id] = lista;
  }

  const items = (itemsData ?? []).map((item) => {
    const disponible = calcularMaxProducible(recetaPorItem[item.id] ?? []);
    const cantidadEfectiva = disponible ?? item.cantidad;
    return {
      ...item,
      cantidad: cantidadEfectiva,
      diasRestantes: calcularDiasRestantes(cantidadEfectiva, velocidadPorItem.get(item.id)),
    };
  });

  const { data: empresa } = await supabase
    .from("empresas")
    .select("metodos_pago_disponibles, modulos_activos")
    .eq("id", perfil.empresa_id)
    .single();

  const crmActivo = (empresa?.modulos_activos ?? []).includes("crm");

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: promocionesData } = await supabase
    .from("promociones")
    .select(
      "id, nombre, tipo_promocion, valor, aplica_a_categoria, item_regalo_id, promocion_items ( item_id )",
    )
    .eq("empresa_id", perfil.empresa_id)
    .eq("activo", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy);

  const promociones = (promocionesData ?? []).map((p) => {
    const regalo = p.item_regalo_id ? items.find((i) => i.id === p.item_regalo_id) : null;
    return {
      id: p.id,
      nombre: p.nombre,
      tipoPromocion: p.tipo_promocion as "descuento_porcentaje" | "descuento_fijo" | "2x1" | "lleve_x_gratis",
      valor: p.valor,
      aplicaACategoria: p.aplica_a_categoria,
      itemIds: (p.promocion_items ?? []).map((pi) => pi.item_id),
      itemRegaloId: p.item_regalo_id,
      regaloNombre: regalo?.nombre ?? null,
      regaloPrecio: regalo?.precio_venta ?? 0,
    };
  });

  return (
    <NuevaVentaForm
      items={items}
      metodosPago={empresa?.metodos_pago_disponibles ?? []}
      promociones={promociones}
      crmActivo={crmActivo}
    />
  );
}
