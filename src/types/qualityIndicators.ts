/**
 * Quality Indicators Data Types and Interfaces
 * Module: Cálculo de los Indicadores de Calidad (Telefonía Básica)
 */

export interface CentroTelefonicoConfig {
  id: string;
  name: string;
  ls: number; // Técnica Instalada
  active: boolean;
}

export type PlanOperator = '<=' | '>=';

export interface IndicadorPlanConfig {
  id: 'reporte_inicial' | 'rep_3dias' | 'rep_1dia' | 'demora_promedio';
  name: string;
  targetValue: number;
  operator: PlanOperator; // '<=' for faults/delays, '>=' for repair speed
  unit: '%' | 'hrs';
  description: string;
}

export interface RawQualityExcelRow {
  centro: string;
  servicioOrTelefono: string;
  isNumericOnly: boolean;
  demoraDias?: number;
  demoraHrs?: number;
  rawRow: Record<string, any>;
}

export interface QualityFileParseSummary {
  fileName: string;
  totalRows: number;
  numericRowsCount: number;
  nonNumericRowsCount: number;
  centrosFound: string[];
  parsedAt: string;
}

export interface QualityIndicatorRow {
  centroId: string;
  centroName: string;
  ls: number; // Técnica Instalada
  ipInicial: number;
  ipFinal: number;
  totalReparaciones: number;
  rer: number; // TOTAL DE REPARACIONES - IP INICIAL + IP FINAL
  rep3dias: number; // Total Rep <= 3 días
  ip3diasInicial: number; // Total IP <= 3 días INICIAL
  ip3diasFinal: number; // Total IP <= 3 días FINAL
  rep1dia: number; // Total Rep <= 1 día
  ip1diaInicial: number; // Total IP <= 1 día INICIAL
  ip1diaFinal: number; // Total IP <= 1 día FINAL
  dtr: number; // Sumatoria de Demora en hrs (solo teléfonos numéricos)

  // Calculated Indicators
  reporteInicial: number; // (RER / LS) * 100
  pctRep3dias: number; // Total Rep -3d / (RER + IP-3d INICIAL - IP-3d FINAL) * 100
  pctRep1dia: number; // Total Rep -1d / (RER + IP-1d INICIAL - IP-1d FINAL) * 100
  demoraPromedio: number; // DTR / Total Reparaciones

  // Compliance Flags (true = fulfills plan, false = breach)
  compliesReporteInicial: boolean;
  compliesRep3dias: boolean;
  compliesRep1dia: boolean;
  compliesDemoraPromedio: boolean;
}

export interface QualityDailyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  filesSummary: {
    ipInicial?: QualityFileParseSummary;
    ipFinal?: QualityFileParseSummary;
    reparadas?: QualityFileParseSummary;
  };
  rows: QualityIndicatorRow[];
  totalGeneral: QualityIndicatorRow;
  plansSnapshot: Record<string, IndicadorPlanConfig>;
  notes?: string;
  createdAt: string;
}

export const DEFAULT_PLANES_CALIDAD: Record<string, IndicadorPlanConfig> = {
  reporte_inicial: {
    id: 'reporte_inicial',
    name: 'Reporte Inicial',
    targetValue: 2.50,
    operator: '<=',
    unit: '%',
    description: 'Proporción de reparaciones equivalentes sobre técnica instalada (Menor es mejor)'
  },
  rep_3dias: {
    id: 'rep_3dias',
    name: '% Reparadas -3 Días',
    targetValue: 85.00,
    operator: '>=',
    unit: '%',
    description: 'Averías resueltas en 3 días o menos sobre el balance operativo (Mayor es mejor)'
  },
  rep_1dia: {
    id: 'rep_1dia',
    name: '% Reparadas -1 Día',
    targetValue: 60.00,
    operator: '>=',
    unit: '%',
    description: 'Averías resueltas en 24 horas sobre el balance operativo (Mayor es mejor)'
  },
  demora_promedio: {
    id: 'demora_promedio',
    name: 'Demora Promedio (DTR)',
    targetValue: 18.00,
    operator: '<=',
    unit: 'hrs',
    description: 'Tiempo medio de reparación en horas por avería numérica cerrada (Menor es mejor)'
  }
};

export const DEFAULT_CENTROS_TELEFONICOS: CentroTelefonicoConfig[] = [
  { id: 'cnt_metro', name: 'Central Metropolitana', ls: 18500, active: true },
  { id: 'cnt_norte', name: 'Central Norte', ls: 13000, active: true },
  { id: 'cnt_sur', name: 'Central Sur', ls: 14500, active: true },
  { id: 'cnt_este', name: 'Central Este', ls: 10800, active: true },
  { id: 'cnt_oeste', name: 'Central Oeste', ls: 11200, active: true },
  { id: 'cnt_miramar', name: 'Central Miramar', ls: 16000, active: true },
  { id: 'cnt_vedado', name: 'Central Vedado', ls: 15400, active: true },
  { id: 'cnt_hab_vieja', name: 'Central Habana Vieja', ls: 12200, active: true },
  { id: 'cnt_centro_hab', name: 'Central Centro Habana', ls: 14100, active: true },
  { id: 'cnt_diez_oct', name: 'Central Diez de Octubre', ls: 13800, active: true }
];

export interface QualityColumnNamesConfig {
  centroName: string;
  ls: string;
  ipInicial: string;
  ipFinal: string;
  totalReparaciones: string;
  rer: string;
  rep3dias: string;
  rep1dia: string;
  dtr: string;
  reporteInicial: string;
  pctRep3dias: string;
  pctRep1dia: string;
  demoraPromedio: string;
}

export const DEFAULT_QUALITY_COLUMN_NAMES: QualityColumnNamesConfig = {
  centroName: 'Centro Telefónico',
  ls: 'Técnica (LS)',
  ipInicial: 'IP Inicial',
  ipFinal: 'IP Final',
  totalReparaciones: 'Reparaciones',
  rer: 'RER',
  rep3dias: 'Rep ≤3d',
  rep1dia: 'Rep ≤1d',
  dtr: 'DTR (hrs)',
  reporteInicial: 'Reporte Inicial',
  pctRep3dias: '% Rep -3 Días',
  pctRep1dia: '% Rep -1 Día',
  demoraPromedio: 'Demora Promedio'
};

export interface QualityFormulasConfig {
  rer: string; // e.g. "reparaciones - ipInicial + ipFinal"
  reporteInicial: string; // e.g. "(rer / ls) * 100"
  pctRep3dias: string; // e.g. "(rep3dias / (rer + ip3diasInicial - ip3diasFinal)) * 100"
  pctRep1dia: string; // e.g. "(rep1dia / (rer + ip1diaInicial - ip1diaFinal)) * 100"
  demoraPromedio: string; // e.g. "dtr / reparaciones"
}

export const DEFAULT_QUALITY_FORMULAS: QualityFormulasConfig = {
  rer: 'reparaciones - ipInicial + ipFinal',
  reporteInicial: '(rer / ls) * 100',
  pctRep3dias: '(rep3dias / (rer + ip3diasInicial - ip3diasFinal)) * 100',
  pctRep1dia: '(rep1dia / (rer + ip1diaInicial - ip1diaFinal)) * 100',
  demoraPromedio: 'dtr / reparaciones'
};

export interface QualityCustomization {
  columnNames: QualityColumnNamesConfig;
  formulas: QualityFormulasConfig;
}
