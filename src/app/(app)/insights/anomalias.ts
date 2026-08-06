// Motor de anomalías — genérico a propósito. No sabe nada de ventas, CRM ni
// inventario: recibe cualquier lista de grupos con un valor numérico,
// calcula el promedio y la desviación estándar DE ESOS DATOS (nunca un
// umbral fijo igual para todos los negocios), y devuelve cuáles se salen de
// lo normal. Así el mismo algoritmo sirve para "ventas por día", "gasto por
// categoría" o "margen por producto" sin escribir una regla nueva cada vez
// — y cada empresa se mide contra su propia historia, no contra un número
// inventado igual para todos.

export type GrupoAnalizado = {
  etiqueta: string;
  valor: number;
  enlace?: string;
};

export type Anomalia = GrupoAnalizado & {
  z: number; // qué tan lejos del promedio, en desviaciones estándar
};

// z = 1.3 desviaciones ya es notable sin ser tan estricto que nunca salga
// nada — es un punto medio razonable para grupos de pocos datos (7 días de
// la semana, 5-10 categorías), no el 2-3 que se usaría con miles de datos.
const Z_MINIMO_DEFECTO = 1.3;

export function detectarAnomalias(grupos: GrupoAnalizado[], zMinimo = Z_MINIMO_DEFECTO): Anomalia[] {
  // Con muy pocos grupos, "el promedio" no dice mucho — mejor no inventar
  // una anomalía que en realidad es solo ruido de pocos datos.
  if (grupos.length < 3) return [];

  const valores = grupos.map((g) => g.valor);
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  const varianza = valores.reduce((a, b) => a + (b - promedio) ** 2, 0) / valores.length;
  const desviacion = Math.sqrt(varianza);

  if (desviacion === 0) return [];

  return grupos
    .map((g) => ({ ...g, z: (g.valor - promedio) / desviacion }))
    .filter((g) => Math.abs(g.z) >= zMinimo)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}
