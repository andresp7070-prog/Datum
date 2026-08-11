import { requerirAdmin } from "@/lib/empresa";
import { NuevoMovimientoForm } from "./nuevo-movimiento-form";

export default async function NuevoMovimientoDatumPage() {
  await requerirAdmin();
  return <NuevoMovimientoForm />;
}
