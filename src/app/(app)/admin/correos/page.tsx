import { requerirAdmin } from "@/lib/empresa";
import { CorreosForm } from "./correos-form";

export default async function CorreosPage() {
  await requerirAdmin();
  return <CorreosForm />;
}
