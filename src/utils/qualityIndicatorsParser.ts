import * as XLSX from 'xlsx-js-style';
import {
  CentroTelefonicoConfig,
  IndicadorPlanConfig,
  QualityFileParseSummary,
  QualityIndicatorRow,
  RawQualityExcelRow,
  QualityFormulasConfig,
  DEFAULT_QUALITY_FORMULAS,
  DEFAULT_PLANES_CALIDAD,
  DEFAULT_CENTROS_TELEFONICOS
} from '../types/qualityIndicators';

/**
 * Safely evaluates a custom mathematical formula with given variables
 */
export function safeEvaluateFormula(
  formulaStr: string,
  scope: Record<string, number>,
  fallbackValue: number
): number {
  if (!formulaStr || typeof formulaStr !== 'string') return fallbackValue;
  try {
    const cleaned = formulaStr.trim();
    // Allow basic operators, parens, numbers, variables and Math functions
    const allowedPattern = /^[a-zA-Z0-9_\s\+\-\*\/\%\(\)\.\,\?\:\>\<\=]+$/;
    if (!allowedPattern.test(cleaned)) {
      return fallbackValue;
    }

    const varNames = Object.keys(scope);
    const varValues = Object.values(scope);

    const fn = new Function(...varNames, `
      try {
        const val = (${cleaned});
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          return ${fallbackValue};
        }
        return val;
      } catch (err) {
        return ${fallbackValue};
      }
    `);

    const result = fn(...varValues);
    return typeof result === 'number' && !isNaN(result) && isFinite(result) ? result : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

/**
 * Checks if a service / phone string is strictly numeric (Basic Telephony)
 * Rejects any alphanumeric service (TxD, links, data, letters).
 */
export function isNumericTelephonyService(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (!str) return false;
  // Strictly digits only (allowing standard lengths of 6-12 digits)
  return /^\d+$/.test(str);
}

/**
 * Normalizes central names for loose matching
 */
export function normalizeCentroName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^CENTRAL\s+/i, '')
    .replace(/^CENTRO\s+TELEFONICO\s+/i, '')
    .replace(/^CENTRO\s+/i, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Auto-detects column names in a raw row
 */
export function detectQualityColumns(headers: string[]): {
  centroCol?: string;
  servicioCol?: string;
  demoraDiasCol?: string;
  demoraHrsCol?: string;
} {
  const normalize = (h: string) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  let centroCol: string | undefined;
  let servicioCol: string | undefined;
  let demoraDiasCol: string | undefined;
  let demoraHrsCol: string | undefined;

  for (const h of headers) {
    const norm = normalize(h);

    // Centro Telefónico
    if (
      !centroCol &&
      (norm.includes('centrotelefonico') ||
        norm.includes('centraltelefonica') ||
        norm.includes('central') ||
        norm.includes('centro') ||
        norm.includes('cta') ||
        norm.includes('localidad'))
    ) {
      centroCol = h;
    }

    // Servicio / Teléfono
    if (
      !servicioCol &&
      (norm === 'servicio' ||
        norm === 'servicios' ||
        norm === 'telefono' ||
        norm === 'telefonos' ||
        norm === 'numero' ||
        norm === 'num' ||
        norm === 'linea' ||
        norm.includes('servicio') ||
        norm.includes('telefono'))
    ) {
      servicioCol = h;
    }

    // Demora en Días
    if (
      !demoraDiasCol &&
      (norm.includes('demoradia') ||
        norm.includes('demoradias') ||
        norm.includes('diasdemora') ||
        norm === 'dias' ||
        norm === 'demora' ||
        norm.includes('demoraendia'))
    ) {
      demoraDiasCol = h;
    }

    // Demora en Horas / DTR
    if (
      !demoraHrsCol &&
      (norm.includes('demorahrs') ||
        norm.includes('demorahoras') ||
        norm.includes('horasdemora') ||
        norm === 'hrs' ||
        norm === 'horas' ||
        norm.includes('dtr') ||
        norm.includes('demoraenhrs') ||
        norm.includes('demoraenhora'))
    ) {
      demoraHrsCol = h;
    }
  }

  // Fallbacks if not detected
  if (!servicioCol) {
    servicioCol = headers.find(h => /servicio|telefono|numero/i.test(h)) || headers[0];
  }
  if (!centroCol) {
    centroCol = headers.find(h => /centro|central/i.test(h)) || headers[1];
  }

  return { centroCol, servicioCol, demoraDiasCol, demoraHrsCol };
}

/**
 * Parses an Excel or CSV file buffer for quality indicators
 */
export async function parseQualityFile(
  file: File,
  forcedFileType?: 'inicial' | 'final' | 'reparadas'
): Promise<{
  rows: RawQualityExcelRow[];
  summary: QualityFileParseSummary;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    throw new Error('El archivo Excel no contiene hojas de datos legibles.');
  }

  // Convert to array of objects
  const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false
  });

  if (!rawJson || rawJson.length === 0) {
    throw new Error('El archivo no contiene filas de datos.');
  }

  // Find headers
  const headers = Object.keys(rawJson[0]);
  const cols = detectQualityColumns(headers);

  const parsedRows: RawQualityExcelRow[] = [];
  const centrosSet = new Set<string>();
  let numericCount = 0;
  let nonNumericCount = 0;

  rawJson.forEach(row => {
    const rawServicio = cols.servicioCol ? row[cols.servicioCol] : '';
    const rawCentro = cols.centroCol ? row[cols.centroCol] : 'CENTRAL GENERAL';
    const cleanCentro = String(rawCentro || 'CENTRAL GENERAL').trim();

    const isNumeric = isNumericTelephonyService(rawServicio);
    if (isNumeric) {
      numericCount++;
      if (cleanCentro) centrosSet.add(cleanCentro);
    } else {
      nonNumericCount++;
    }

    // Demora en días
    let demoraDias: number | undefined = undefined;
    if (cols.demoraDiasCol && row[cols.demoraDiasCol] !== undefined && row[cols.demoraDiasCol] !== '') {
      const parsedD = parseFloat(String(row[cols.demoraDiasCol]).replace(',', '.'));
      if (!isNaN(parsedD)) {
        demoraDias = parsedD;
      }
    }

    // Demora en hrs
    let demoraHrs: number | undefined = undefined;
    if (cols.demoraHrsCol && row[cols.demoraHrsCol] !== undefined && row[cols.demoraHrsCol] !== '') {
      const parsedH = parseFloat(String(row[cols.demoraHrsCol]).replace(',', '.'));
      if (!isNaN(parsedH)) {
        demoraHrs = parsedH;
      }
    }

    parsedRows.push({
      centro: cleanCentro,
      servicioOrTelefono: String(rawServicio || '').trim(),
      isNumericOnly: isNumeric,
      demoraDias,
      demoraHrs,
      rawRow: row
    });
  });

  const summary: QualityFileParseSummary = {
    fileName: file.name,
    totalRows: rawJson.length,
    numericRowsCount: numericCount,
    nonNumericRowsCount: nonNumericCount,
    centrosFound: Array.from(centrosSet).sort(),
    parsedAt: new Date().toISOString()
  };

  return { rows: parsedRows, summary };
}

/**
 * Computes all Quality Indicators by Centro Telefónico and Total General
 */
export function calculateQualityIndicators(params: {
  centros: CentroTelefonicoConfig[];
  planes: Record<string, IndicadorPlanConfig>;
  pendientesInicialRows: RawQualityExcelRow[];
  pendientesFinalRows: RawQualityExcelRow[];
  reparadasRows: RawQualityExcelRow[];
  formulas?: QualityFormulasConfig;
}): {
  rows: QualityIndicatorRow[];
  indicatorRows: QualityIndicatorRow[];
  totalGeneral: QualityIndicatorRow;
} {
  const {
    centros = [],
    planes = DEFAULT_PLANES_CALIDAD,
    pendientesInicialRows = [],
    pendientesFinalRows = [],
    reparadasRows = [],
    formulas = DEFAULT_QUALITY_FORMULAS
  } = params || {};

  // Find all unique normalized centros
  const allCentrosMap = new Map<string, { id: string; name: string; ls: number }>();

  // Add configured centros first
  (centros || []).forEach(c => {
    if (c.active !== false) {
      const norm = normalizeCentroName(c.name);
      allCentrosMap.set(norm, { id: c.id, name: c.name, ls: c.ls });
    }
  });

  // Helper matcher
  const findCentroKey = (rawCentro: string): string => {
    const norm = normalizeCentroName(rawCentro);
    if (allCentrosMap.has(norm)) return norm;
    // Partial substring match
    for (const [key, val] of allCentrosMap.entries()) {
      if (norm.includes(key) || key.includes(norm)) {
        return key;
      }
    }
    // If not found in configured centros, add on the fly with default LS = 10000
    allCentrosMap.set(norm, {
      id: `cnt_${norm.toLowerCase().replace(/\s+/g, '_')}`,
      name: rawCentro.trim(),
      ls: 10000
    });
    return norm;
  };

  // Group counters by centro key
  interface Counters {
    ipInicial: number;
    ipFinal: number;
    totalReparaciones: number;
    rep3dias: number;
    ip3diasInicial: number;
    ip3diasFinal: number;
    rep1dia: number;
    ip1diaInicial: number;
    ip1diaFinal: number;
    dtr: number;
  }

  const dataByCentro = new Map<string, Counters>();

  // Initialize
  allCentrosMap.forEach((_, key) => {
    dataByCentro.set(key, {
      ipInicial: 0,
      ipFinal: 0,
      totalReparaciones: 0,
      rep3dias: 0,
      ip3diasInicial: 0,
      ip3diasFinal: 0,
      rep1dia: 0,
      ip1diaInicial: 0,
      ip1diaFinal: 0,
      dtr: 0
    });
  });

  const getCounters = (key: string): Counters => {
    let c = dataByCentro.get(key);
    if (!c) {
      c = {
        ipInicial: 0,
        ipFinal: 0,
        totalReparaciones: 0,
        rep3dias: 0,
        ip3diasInicial: 0,
        ip3diasFinal: 0,
        rep1dia: 0,
        ip1diaInicial: 0,
        ip1diaFinal: 0,
        dtr: 0
      };
      dataByCentro.set(key, c);
    }
    return c;
  };

  // 1. Process IntPendientes INICIAL
  pendientesInicialRows.forEach(r => {
    if (!r.isNumericOnly) return; // Strict numeric basic telephony filter
    const key = findCentroKey(r.centro);
    const c = getCounters(key);
    c.ipInicial++;

    if (r.demoraDias !== undefined && r.demoraDias <= 3) {
      c.ip3diasInicial++;
    }
    if (r.demoraDias !== undefined && r.demoraDias <= 1) {
      c.ip1diaInicial++;
    }
  });

  // 2. Process IntPendientes FINAL
  pendientesFinalRows.forEach(r => {
    if (!r.isNumericOnly) return; // Strict numeric basic telephony filter
    const key = findCentroKey(r.centro);
    const c = getCounters(key);
    c.ipFinal++;

    if (r.demoraDias !== undefined && r.demoraDias <= 3) {
      c.ip3diasFinal++;
    }
    if (r.demoraDias !== undefined && r.demoraDias <= 1) {
      c.ip1diaFinal++;
    }
  });

  // 3. Process IntReparadas
  reparadasRows.forEach(r => {
    if (!r.isNumericOnly) return; // Strict numeric basic telephony filter
    const key = findCentroKey(r.centro);
    const c = getCounters(key);
    c.totalReparaciones++;

    if (r.demoraDias !== undefined && r.demoraDias <= 3) {
      c.rep3dias++;
    }
    if (r.demoraDias !== undefined && r.demoraDias <= 1) {
      c.rep1dia++;
    }
    if (r.demoraHrs !== undefined && !isNaN(r.demoraHrs)) {
      c.dtr += r.demoraHrs;
    }
  });

  // Compute rows
  const rows: QualityIndicatorRow[] = [];

  let totLs = 0;
  let totIpInicial = 0;
  let totIpFinal = 0;
  let totReparaciones = 0;
  let totRep3dias = 0;
  let totIp3diasInicial = 0;
  let totIp3diasFinal = 0;
  let totRep1dia = 0;
  let totIp1diaInicial = 0;
  let totIp1diaFinal = 0;
  let totDtr = 0;

  allCentrosMap.forEach((config, key) => {
    const c = getCounters(key);
    const ls = config.ls > 0 ? config.ls : 10000;

    // Base default calculations
    const defaultRer = c.totalReparaciones - c.ipInicial + c.ipFinal;
    const defaultReporteInicial = ls > 0 ? (defaultRer / ls) * 100 : 0;
    const denom3d = defaultRer + c.ip3diasInicial - c.ip3diasFinal;
    const defaultPctRep3dias = denom3d > 0 ? Math.min(100, Math.max(0, (c.rep3dias / denom3d) * 100)) : (c.rep3dias > 0 ? 100 : 0);
    const denom1d = defaultRer + c.ip1diaInicial - c.ip1diaFinal;
    const defaultPctRep1dia = denom1d > 0 ? Math.min(100, Math.max(0, (c.rep1dia / denom1d) * 100)) : (c.rep1dia > 0 ? 100 : 0);
    const defaultDemoraPromedio = c.totalReparaciones > 0 ? c.dtr / c.totalReparaciones : 0;

    // Evaluate custom formulas if provided
    const rerScope = {
      reparaciones: c.totalReparaciones,
      totalReparaciones: c.totalReparaciones,
      ipInicial: c.ipInicial,
      ipFinal: c.ipFinal,
      ls
    };
    const rer = safeEvaluateFormula(formulas.rer, rerScope, defaultRer);

    const fullScope = {
      rer,
      ls,
      reparaciones: c.totalReparaciones,
      totalReparaciones: c.totalReparaciones,
      ipInicial: c.ipInicial,
      ipFinal: c.ipFinal,
      rep3dias: c.rep3dias,
      ip3diasInicial: c.ip3diasInicial,
      ip3diasFinal: c.ip3diasFinal,
      rep1dia: c.rep1dia,
      ip1diaInicial: c.ip1diaInicial,
      ip1diaFinal: c.ip1diaFinal,
      dtr: c.dtr
    };

    const reporteInicial = safeEvaluateFormula(formulas.reporteInicial, fullScope, defaultReporteInicial);
    const pctRep3dias = safeEvaluateFormula(formulas.pctRep3dias, fullScope, defaultPctRep3dias);
    const pctRep1dia = safeEvaluateFormula(formulas.pctRep1dia, fullScope, defaultPctRep1dia);
    const demoraPromedio = safeEvaluateFormula(formulas.demoraPromedio, fullScope, defaultDemoraPromedio);

    // Compliance
    const planRepIni = planes?.reporte_inicial || DEFAULT_PLANES_CALIDAD.reporte_inicial;
    const planRep3 = planes?.rep_3dias || DEFAULT_PLANES_CALIDAD.rep_3dias;
    const planRep1 = planes?.rep_1dia || DEFAULT_PLANES_CALIDAD.rep_1dia;
    const planDemora = planes?.demora_promedio || DEFAULT_PLANES_CALIDAD.demora_promedio;

    const compliesReporteInicial = (planRepIni?.operator === '<=')
      ? reporteInicial <= planRepIni.targetValue
      : reporteInicial >= (planRepIni?.targetValue ?? 2.5);

    const compliesRep3dias = (planRep3?.operator === '>=')
      ? pctRep3dias >= planRep3.targetValue
      : pctRep3dias <= (planRep3?.targetValue ?? 85);

    const compliesRep1dia = (planRep1?.operator === '>=')
      ? pctRep1dia >= planRep1.targetValue
      : pctRep1dia <= (planRep1?.targetValue ?? 60);

    const compliesDemoraPromedio = (planDemora?.operator === '<=')
      ? demoraPromedio <= planDemora.targetValue
      : demoraPromedio >= (planDemora?.targetValue ?? 18);

    // Accumulate for Total General
    totLs += ls;
    totIpInicial += c.ipInicial;
    totIpFinal += c.ipFinal;
    totReparaciones += c.totalReparaciones;
    totRep3dias += c.rep3dias;
    totIp3diasInicial += c.ip3diasInicial;
    totIp3diasFinal += c.ip3diasFinal;
    totRep1dia += c.rep1dia;
    totIp1diaInicial += c.ip1diaInicial;
    totIp1diaFinal += c.ip1diaFinal;
    totDtr += c.dtr;

    rows.push({
      centroId: config.id,
      centroName: config.name,
      ls,
      ipInicial: c.ipInicial,
      ipFinal: c.ipFinal,
      totalReparaciones: c.totalReparaciones,
      rer,
      rep3dias: c.rep3dias,
      ip3diasInicial: c.ip3diasInicial,
      ip3diasFinal: c.ip3diasFinal,
      rep1dia: c.rep1dia,
      ip1diaInicial: c.ip1diaInicial,
      ip1diaFinal: c.ip1diaFinal,
      dtr: Math.round(c.dtr * 10) / 10,
      reporteInicial: Math.round(reporteInicial * 100) / 100,
      pctRep3dias: Math.round(pctRep3dias * 10) / 10,
      pctRep1dia: Math.round(pctRep1dia * 10) / 10,
      demoraPromedio: Math.round(demoraPromedio * 10) / 10,
      compliesReporteInicial,
      compliesRep3dias,
      compliesRep1dia,
      compliesDemoraPromedio
    });
  });

  // Calculate Total General applying exact formulas to aggregated totals
  const defaultTotRer = totReparaciones - totIpInicial + totIpFinal;
  const defaultTotReporteInicial = totLs > 0 ? (defaultTotRer / totLs) * 100 : 0;
  const totDenom3d = defaultTotRer + totIp3diasInicial - totIp3diasFinal;
  const defaultTotPctRep3dias = totDenom3d > 0 ? Math.min(100, Math.max(0, (totRep3dias / totDenom3d) * 100)) : (totRep3dias > 0 ? 100 : 0);
  const totDenom1d = defaultTotRer + totIp1diaInicial - totIp1diaFinal;
  const defaultTotPctRep1dia = totDenom1d > 0 ? Math.min(100, Math.max(0, (totRep1dia / totDenom1d) * 100)) : (totRep1dia > 0 ? 100 : 0);
  const defaultTotDemoraPromedio = totReparaciones > 0 ? totDtr / totReparaciones : 0;

  const totRerScope = {
    reparaciones: totReparaciones,
    totalReparaciones: totReparaciones,
    ipInicial: totIpInicial,
    ipFinal: totIpFinal,
    ls: totLs
  };
  const totRer = safeEvaluateFormula(formulas.rer, totRerScope, defaultTotRer);

  const totFullScope = {
    rer: totRer,
    ls: totLs,
    reparaciones: totReparaciones,
    totalReparaciones: totReparaciones,
    ipInicial: totIpInicial,
    ipFinal: totIpFinal,
    rep3dias: totRep3dias,
    ip3diasInicial: totIp3diasInicial,
    ip3diasFinal: totIp3diasFinal,
    rep1dia: totRep1dia,
    ip1diaInicial: totIp1diaInicial,
    ip1diaFinal: totIp1diaFinal,
    dtr: totDtr
  };

  const totReporteInicial = safeEvaluateFormula(formulas.reporteInicial, totFullScope, defaultTotReporteInicial);
  const totPctRep3dias = safeEvaluateFormula(formulas.pctRep3dias, totFullScope, defaultTotPctRep3dias);
  const totPctRep1dia = safeEvaluateFormula(formulas.pctRep1dia, totFullScope, defaultTotPctRep1dia);
  const totDemoraPromedio = safeEvaluateFormula(formulas.demoraPromedio, totFullScope, defaultTotDemoraPromedio);

  const planRepIni = planes?.reporte_inicial || DEFAULT_PLANES_CALIDAD.reporte_inicial;
  const planRep3 = planes?.rep_3dias || DEFAULT_PLANES_CALIDAD.rep_3dias;
  const planRep1 = planes?.rep_1dia || DEFAULT_PLANES_CALIDAD.rep_1dia;
  const planDemora = planes?.demora_promedio || DEFAULT_PLANES_CALIDAD.demora_promedio;

  const totalGeneral: QualityIndicatorRow = {
    centroId: 'TOTAL_GENERAL',
    centroName: 'TOTAL GENERAL',
    ls: totLs,
    ipInicial: totIpInicial,
    ipFinal: totIpFinal,
    totalReparaciones: totReparaciones,
    rer: totRer,
    rep3dias: totRep3dias,
    ip3diasInicial: totIp3diasInicial,
    ip3diasFinal: totIp3diasFinal,
    rep1dia: totRep1dia,
    ip1diaInicial: totIp1diaInicial,
    ip1diaFinal: totIp1diaFinal,
    dtr: Math.round(totDtr * 10) / 10,
    reporteInicial: Math.round(totReporteInicial * 100) / 100,
    pctRep3dias: Math.round(totPctRep3dias * 10) / 10,
    pctRep1dia: Math.round(totPctRep1dia * 10) / 10,
    demoraPromedio: Math.round(totDemoraPromedio * 10) / 10,
    compliesReporteInicial: planRepIni?.operator === '<=' ? totReporteInicial <= (planRepIni?.targetValue ?? 2.5) : totReporteInicial >= (planRepIni?.targetValue ?? 2.5),
    compliesRep3dias: planRep3?.operator === '>=' ? totPctRep3dias >= (planRep3?.targetValue ?? 85) : totPctRep3dias <= (planRep3?.targetValue ?? 85),
    compliesRep1dia: planRep1?.operator === '>=' ? totPctRep1dia >= (planRep1?.targetValue ?? 60) : totPctRep1dia <= (planRep1?.targetValue ?? 60),
    compliesDemoraPromedio: planDemora?.operator === '<=' ? totDemoraPromedio <= (planDemora?.targetValue ?? 18) : totDemoraPromedio >= (planDemora?.targetValue ?? 18)
  };

  return { rows, indicatorRows: rows, totalGeneral };
}

/**
 * Generates realistic sample data for the 3 Excel files
 */
export function generateSampleQualityDataset(centros: CentroTelefonicoConfig[] = []): {
  pendientesInicialRows: RawQualityExcelRow[];
  pendientesFinalRows: RawQualityExcelRow[];
  reparadasRows: RawQualityExcelRow[];
  summaryInicial: QualityFileParseSummary;
  summaryFinal: QualityFileParseSummary;
  summaryReparadas: QualityFileParseSummary;
} {
  const pInicial: RawQualityExcelRow[] = [];
  const pFinal: RawQualityExcelRow[] = [];
  const rep: RawQualityExcelRow[] = [];

  let phoneCounter = 78301000;
  const targetCentros = (centros && centros.length > 0) ? centros : DEFAULT_CENTROS_TELEFONICOS;

  targetCentros.forEach((c, idx) => {
    const baseRep = 40 + idx * 8;
    const baseIpIni = 25 + idx * 5;
    const baseIpFin = 20 + idx * 4;

    // Pendientes Inicial
    for (let i = 0; i < baseIpIni; i++) {
      phoneCounter++;
      const isNum = i % 15 !== 0; // occasionally add non-numeric
      const delay = Math.floor(Math.random() * 8) + 1;
      pInicial.push({
        centro: c.name,
        servicioOrTelefono: isNum ? String(phoneCounter) : `TXD-${phoneCounter}`,
        isNumericOnly: isNum,
        demoraDias: delay,
        rawRow: { 'CENTRO TELEFÓNICO': c.name, 'SERVICIO': isNum ? String(phoneCounter) : `TXD-${phoneCounter}`, 'DEMORA EN DÍAS': delay }
      });
    }

    // Pendientes Final
    for (let i = 0; i < baseIpFin; i++) {
      phoneCounter++;
      const isNum = i % 18 !== 0;
      const delay = Math.floor(Math.random() * 6) + 1;
      pFinal.push({
        centro: c.name,
        servicioOrTelefono: isNum ? String(phoneCounter) : `TXD-${phoneCounter}`,
        isNumericOnly: isNum,
        demoraDias: delay,
        rawRow: { 'CENTRO TELEFÓNICO': c.name, 'SERVICIO': isNum ? String(phoneCounter) : `TXD-${phoneCounter}`, 'DEMORA EN DÍAS': delay }
      });
    }

    // Reparadas
    for (let i = 0; i < baseRep; i++) {
      phoneCounter++;
      const isNum = i % 20 !== 0;
      const delay = Math.random() < 0.65 ? 1 : (Math.random() < 0.85 ? (Math.random() < 0.5 ? 2 : 3) : Math.floor(Math.random() * 5) + 4);
      const hours = delay === 1 ? Math.floor(Math.random() * 18) + 4 : delay * 24 + Math.floor(Math.random() * 10);

      rep.push({
        centro: c.name,
        servicioOrTelefono: isNum ? String(phoneCounter) : `TXD-${phoneCounter}`,
        isNumericOnly: isNum,
        demoraDias: delay,
        demoraHrs: hours,
        rawRow: {
          'CENTRO TELEFÓNICO': c.name,
          'TELÉFONO': isNum ? String(phoneCounter) : `TXD-${phoneCounter}`,
          'DEMORA EN DÍAS': delay,
          'DEMORA EN HRS': hours
        }
      });
    }
  });

  const nowIso = new Date().toISOString();

  return {
    pendientesInicialRows: pInicial,
    pendientesFinalRows: pFinal,
    reparadasRows: rep,
    summaryInicial: {
      fileName: 'IntPendientes INICIAL.xls',
      totalRows: pInicial.length,
      numericRowsCount: pInicial.filter(r => r.isNumericOnly).length,
      nonNumericRowsCount: pInicial.filter(r => !r.isNumericOnly).length,
      centrosFound: targetCentros.map(c => c.name),
      parsedAt: nowIso
    },
    summaryFinal: {
      fileName: 'IntPendientes FINAL.xls',
      totalRows: pFinal.length,
      numericRowsCount: pFinal.filter(r => r.isNumericOnly).length,
      nonNumericRowsCount: pFinal.filter(r => !r.isNumericOnly).length,
      centrosFound: targetCentros.map(c => c.name),
      parsedAt: nowIso
    },
    summaryReparadas: {
      fileName: 'IntReparadas.xls',
      totalRows: rep.length,
      numericRowsCount: rep.filter(r => r.isNumericOnly).length,
      nonNumericRowsCount: rep.filter(r => !r.isNumericOnly).length,
      centrosFound: targetCentros.map(c => c.name),
      parsedAt: nowIso
    }
  };
}
