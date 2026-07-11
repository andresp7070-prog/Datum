export const CONDICIONES_PAGO = [
  { valor: "contado", etiqueta: "De contado" },
  { valor: "15_dias", etiqueta: "A 15 días" },
  { valor: "30_dias", etiqueta: "A 30 días" },
  { valor: "60_dias", etiqueta: "A 60 días" },
  { valor: "90_dias", etiqueta: "A 90 días" },
] as const;

export function etiquetaCondicionPago(valor: string): string {
  return CONDICIONES_PAGO.find((c) => c.valor === valor)?.etiqueta ?? valor;
}
