import { ReportSettings } from '../types';

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  documentTitle: 'ESTADÍSTICA DE LAS IP CTA SE',
  documentSubtitle: 'Informe Técnico Operativo de Redes y Centrales Telefónicas',
  departmentName: 'Dirección IP CTA SE — Departamento Estadística & Operaciones',
  fileNamePrefix: 'Estadística de las IP CTA SE',

  includeExecutiveSummary: true,
  includeMatrixTable: true,
  includeTechInstalledTable: true,
  includeDayOfWeekStats: true,
  includeHistoricalEvolution: true,
  includeConclusions: true,

  customExecutiveSummary: 'El presente informe consolida la estadística de averías e incidencias registradas en la red de centrales telefónicas de la dirección IP CTA SE. Los datos se calculan excluyendo los días domingos por no ser días laborables.',
  matrixExplanation: 'La matriz de averías detalla la distribución de incidencias reportadas por cada especialidad técnica (grupo de trabajo) en las distintas centrales telefónicas. Permite identificar de forma inmediata qué grupos acumulan mayor demanda operativa.',
  techInstalledExplanation: 'El porcentaje de interrupción evalúa el impacto relativo de las averías en relación con la capacidad física instalada (puertos y pares activos) de cada central. Valores superiores al 3% señalan prioridad alta de atención.',
  dayOfWeekExplanation: 'El comportamiento histórico acumulado de Lunes a Sábado muestra los patrones de notificación diaria de averías. Tradicionalmente, los primeros días laborables de la semana presentan la mayor concentración de reportes.',
  historicalExplanation: 'La tendencia evolutiva diaria y semanal refleja la curva de estabilidad de la red telecom, permitiendo medir el comportamiento tras intervenciones de mantenimiento correctivo y preventivo.',
  customConclusions: '1. Mantener las rutinas de supervisión preventiva en las centrales con mayor tasa de interrupción relativa.\n2. Reforzar el personal de respuesta operativa a principios de semana para atender el acumulado.\n3. Asegurar la actualización constante de los registros de técnica instalada para preservar la exactitud de los indicadores.'
};

const SETTINGS_KEY = 'telecom_report_settings_v1';

export function loadReportSettings(): ReportSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_REPORT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_REPORT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_REPORT_SETTINGS;
  }
}

export function saveReportSettings(settings: ReportSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save report settings to localStorage:', err);
  }
}

export function resetReportSettings(): ReportSettings {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {}
  return DEFAULT_REPORT_SETTINGS;
}
