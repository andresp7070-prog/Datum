// Apagado a propósito: solo la pestaña Insights (el motor de anomalías +
// el resumen con IA de Claude, que todavía no está activo porque falta la
// API key de Anthropic) muestra "Próximamente". Panel de control
// (Gráficas) es una pestaña aparte y no depende de esto — funciona normal
// siempre. Este flag lo usa únicamente hallazgos/page.tsx.
export const INSIGHTS_DISPONIBLE = false;
