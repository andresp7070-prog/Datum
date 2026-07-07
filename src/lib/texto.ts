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
