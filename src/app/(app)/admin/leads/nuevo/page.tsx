import { requerirAdmin } from "@/lib/empresa";
import { NuevoLeadForm } from "./nuevo-lead-form";

export default async function NuevoLeadPage() {
  await requerirAdmin();
  return <NuevoLeadForm />;
}
