"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ItemVentaEncontrado = {
  ventaItemId: string;
  itemId: string | null;
  nombre: string;
  cantidad: number;
};

export type VentaEncontrada = {
  id: string;
  numeroVenta: number | null;
  fecha: string;
  monto: number;
  clienteNombre: string | null;
  contactoId: string | null;
  items: ItemVentaEncontrado[];
};

export async function buscarVentaParaDevolucion(input: {
  ventaId?: string;
  numeroVenta?: number;
}): Promise<{ error: string | null; venta?: VentaEncontrada }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();
  if (!perfil?.empresa_id) return { error: "Tu usuario no tiene una empresa asignada." };

  let query = supabase
    .from("ventas")
    .select(
      "id, numero_venta, fecha, monto, cliente_nombre, contacto_id, ventas_items ( id, item_id, cantidad, nombre_libre, inventario_items ( nombre ) )",
    )
    .eq("empresa_id", perfil.empresa_id);

  if (input.ventaId) {
    query = query.eq("id", input.ventaId);
  } else if (input.numeroVenta) {
    query = query.eq("numero_venta", input.numeroVenta);
  } else {
    return { error: "Escribe un número de venta para buscar." };
  }

  const { data: venta } = await query.maybeSingle();

  if (!venta) {
    return { error: "No se encontró ninguna venta con ese número." };
  }

  type ItemLinea = {
    id: string;
    item_id: string | null;
    cantidad: number;
    nombre_libre: string | null;
    inventario_items: { nombre: string } | null;
  };

  const items = (venta.ventas_items as unknown as ItemLinea[]).map((linea) => ({
    ventaItemId: linea.id,
    itemId: linea.item_id,
    nombre: linea.inventario_items?.nombre ?? linea.nombre_libre ?? "Producto eliminado",
    cantidad: Number(linea.cantidad),
  }));

  return {
    error: null,
    venta: {
      id: venta.id,
      numeroVenta: venta.numero_venta,
      fecha: venta.fecha,
      monto: Number(venta.monto),
      clienteNombre: venta.cliente_nombre,
      contactoId: venta.contacto_id,
      items,
    },
  };
}

export type ItemDevolucionInput = {
  itemId: string | null;
  cantidad: number;
  estadoProducto: "buen_estado" | "danado";
};

export async function registrarDevolucion(input: {
  ventaId: string;
  contactoId: string | null;
  tipo: "devolucion" | "garantia";
  motivo: string;
  items: ItemDevolucionInput[];
}): Promise<{ error: string | null; devolucionId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();
  if (!perfil?.empresa_id) return { error: "Tu usuario no tiene una empresa asignada." };

  const { data: devolucionId, error } = await supabase.rpc("registrar_devolucion", {
    p_empresa_id: perfil.empresa_id,
    p_venta_id: input.ventaId,
    p_contacto_id: input.contactoId,
    p_tipo: input.tipo,
    p_motivo: input.motivo || null,
    p_items: input.items.map((item) => ({
      item_id: item.itemId,
      cantidad: item.cantidad,
      estado_producto: item.estadoProducto,
    })),
  });

  if (error) return { error: error.message };

  revalidatePath("/ventas/devoluciones");
  return { error: null, devolucionId: devolucionId as string };
}

export async function resolverDevolucion(input: {
  devolucionId: string;
  estado: "aceptada" | "rechazada";
  resolucion?: "reembolso" | "cambio" | "cupon";
  montoReembolso?: number;
  itemCambioId?: string;
  cantidadCambio?: number;
  cuponMonto?: number;
  cuponVencimiento?: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("resolver_devolucion", {
    p_devolucion_id: input.devolucionId,
    p_estado: input.estado,
    p_resolucion: input.resolucion ?? null,
    p_monto_reembolso: input.montoReembolso ?? null,
    p_item_cambio_id: input.itemCambioId ?? null,
    p_cantidad_cambio: input.cantidadCambio ?? null,
    p_cupon_monto: input.cuponMonto ?? null,
    p_cupon_vencimiento: input.cuponVencimiento ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/ventas/devoluciones");
  return { error: null };
}
