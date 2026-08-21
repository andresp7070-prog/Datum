type ValorCampo = string | boolean | { nombre: string; url: string } | null | undefined;

// Convierte cualquier valor que pueda tener un campo personalizado (texto,
// número, fecha, sí/no, selección o enlace) a un texto legible para una
// línea de historial. null/"" se guardan como null (columna vacía), no
// como el texto "null".
export function formatearValorHistorial(valor: ValorCampo): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "object") return valor.nombre ? `${valor.nombre} (${valor.url})` : valor.url;
  return valor;
}
