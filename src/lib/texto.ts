export function sinTildes(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function primeraMayuscula(texto: string) {
  const t = texto.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Los precios y cantidades en un CSV a veces vienen con signo de pesos y
// coma como separador de miles (ej. "$10,000", tal como Excel los exporta
// si la celda tiene formato de moneda) — los pesos colombianos casi nunca
// llevan decimales, así que una coma siempre se lee como separador de
// miles, nunca como separador decimal. Sin esto, Number("$10,000") da NaN
// y la importación lo marca como error.
export function numeroDesdeTexto(texto: string): number {
  return Number(texto.replace(/[$,\s]/g, ""));
}
