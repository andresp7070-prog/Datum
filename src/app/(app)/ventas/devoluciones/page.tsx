import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { VentasTabs } from "../ventas-tabs";
import { ResolverDevolucionForm } from "./resolver-devolucion-form";

type ItemDevolucion = {
  id: string;
  cantidad: number;
  estado_producto: "buen_estado" | "danado";
  nombre_libre: string | null;
  inventario_items: { nombre: string } | null;
};

type Devolucion = {
  id: string;
  tipo: "devolucion" | "garantia";
  motivo: string | null;
  fecha: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  resolucion: "reembolso" | "cambio" | "cupon" | null;
  monto_reembolso: number | null;
  contacto_id: string | null;
  ventas: { numero_venta: number | null; cliente_nombre: string | null } | null;
  devoluciones_items: ItemDevolucion[];
};

const etiquetaEstado: Record<string, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

const colorEstado: Record<string, string> = {
  pendiente: "bg-amber-50 text-amber-700",
  aceptada: "bg-green-50 text-green-700",
  rechazada: "bg-red-50 text-red-700",
};

const etiquetaTipo: Record<string, string> = {
  devolucion: "Devolución",
  garantia: "Garantía",
};

const ordenEstado: Record<string, number> = { pendiente: 0, aceptada: 1, rechazada: 2 };

export default async function DevolucionesPage() {
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

  // Ninguna depende de la otra — ambas solo necesitan empresa_id.
  const [{ data }, { data: catalogo }] = await Promise.all([
    supabase
      .from("devoluciones")
      .select(
        "id, tipo, motivo, fecha, estado, resolucion, monto_reembolso, contacto_id, ventas ( numero_venta, cliente_nombre ), devoluciones_items ( id, cantidad, estado_producto, nombre_libre, inventario_items ( nombre ) )",
      )
      .eq("empresa_id", perfil.empresa_id)
      .order("fecha", { ascending: false }),
    supabase
      .from("inventario_items")
      .select("id, nombre, cantidad, precio_venta")
      .eq("empresa_id", perfil.empresa_id)
      .eq("tipo", "producto")
      .order("nombre"),
  ]);

  const devoluciones = ((data ?? []) as unknown as Devolucion[]).sort(
    (a, b) => ordenEstado[a.estado] - ordenEstado[b.estado],
  );

  function formatoMoneda(valor: number) {
    return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
  }

  return (
    <div>
      <VentasTabs />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Devoluciones y garantías</h1>
        <Link
          href="/ventas/devoluciones/nueva"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Nueva devolución
        </Link>
      </div>

      {devoluciones.length === 0 ? (
        <p className="text-gray-400">Todavía no hay devoluciones registradas.</p>
      ) : (
        <ul className="space-y-3">
          {devoluciones.map((devolucion) => {
            const productos = devolucion.devoluciones_items
              .map(
                (item) =>
                  `${item.inventario_items?.nombre ?? item.nombre_libre ?? "Producto eliminado"} ×${item.cantidad}`,
              )
              .join(", ");

            return (
              <li key={devolucion.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {etiquetaTipo[devolucion.tipo]} — Venta #{devolucion.ventas?.numero_venta ?? "—"}
                      {devolucion.ventas?.cliente_nombre
                        ? ` · ${devolucion.ventas.cliente_nombre}`
                        : ""}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(devolucion.fecha).toLocaleString("es-CO")}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{productos}</p>
                    {devolucion.motivo && (
                      <p className="mt-1 text-xs text-gray-500">Motivo: {devolucion.motivo}</p>
                    )}
                    {devolucion.estado === "aceptada" && (
                      <p className="mt-1 text-xs text-gray-500">
                        Resuelta con {devolucion.resolucion === "reembolso" && "reembolso"}
                        {devolucion.resolucion === "cambio" && "cambio de producto"}
                        {devolucion.resolucion === "cupon" && "cupón"}
                        {devolucion.resolucion === "reembolso" &&
                          devolucion.monto_reembolso !== null &&
                          ` de ${formatoMoneda(Number(devolucion.monto_reembolso))}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${colorEstado[devolucion.estado]}`}
                  >
                    {etiquetaEstado[devolucion.estado]}
                  </span>
                </div>

                {devolucion.estado === "pendiente" && (
                  <ResolverDevolucionForm
                    devolucionId={devolucion.id}
                    tieneCliente={devolucion.contacto_id !== null}
                    catalogo={catalogo ?? []}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
