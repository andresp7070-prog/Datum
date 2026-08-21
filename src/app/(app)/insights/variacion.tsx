function formatoMonedaCorta(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

// formato "moneda" (por defecto) muestra la diferencia en pesos; "numero" la
// muestra como cantidad simple — para tarjetas que no son plata (unidades,
// clientes, productos por día).
export function VariacionBadge({
  actual,
  anterior,
  formato = "moneda",
}: {
  actual: number;
  anterior: number;
  formato?: "moneda" | "numero";
}) {
  const diferencia = actual - anterior;
  if (anterior === 0) {
    if (actual === 0) return null;
    return <span className="text-xs font-medium text-gray-400">Sin período anterior para comparar</span>;
  }

  const porcentaje = (diferencia / Math.abs(anterior)) * 100;
  const subio = diferencia > 0;
  const igual = diferencia === 0;
  const textoDiferencia =
    formato === "moneda"
      ? formatoMonedaCorta(Math.abs(diferencia))
      : Math.abs(diferencia).toLocaleString("es-CO", { maximumFractionDigits: 1 });

  return (
    <span
      className={`text-xs font-medium ${igual ? "text-gray-400" : subio ? "text-green-600" : "text-red-600"}`}
    >
      {igual ? "Igual" : subio ? "▲" : "▼"} {Math.abs(porcentaje).toFixed(1)}% (
      {subio ? "+" : diferencia === 0 ? "" : "-"}
      {textoDiferencia}) vs. período anterior
    </span>
  );
}
