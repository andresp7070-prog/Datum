// Prendido 2026-08-14: el motor de anomalías no necesita ninguna API key,
// así que ya no hace falta esperar. El "Resumen del día" con Claude sí
// necesita ANTHROPIC_API_KEY en Vercel — mientras esa variable no exista,
// generarResumenInsights() devuelve null y ese párrafo simplemente no
// aparece (ver src/lib/anthropic.ts); el resto de la pestaña (gráficas,
// hallazgos resaltados) funciona igual. El día que se agregue la key en
// Vercel, el resumen empieza a aparecer solo, sin tocar código.
export const INSIGHTS_DISPONIBLE = true;
