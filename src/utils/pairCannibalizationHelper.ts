import { RepairRecord, PairCannibalizationEvent, PairMatchType, PairSuspicionLevel, TechnicianCollateralDamageSummary } from '../types';
import { IpCableRow } from '../types/ipCablesTypes';
import { loadParsedIpData } from './ipCablesStorage';
import { extractTerminalFromItem, extractTelefonoFromItem, extractDireccionFromItem, cleanCableName } from './ipCablesExcelParser';
import * as XLSX from 'xlsx-js-style';
import { saveXlsxWorkbook } from './fileDownloadHelper';

/**
 * List of 26 generic/internal terminal codes strictly omitted as per user specifications:
 * 1A, 1C, 1D, 1E, 1F, 1G, 1H, 1J, 1I
 * 3A, 3B, 3C, 3D, 3E, 3F
 * 2A, 2B, 2C
 * 3J, 3K, 3L, 3M, 3N, 3O, 3P, 3Q
 */
export const EXCLUDED_EXACT_TERMINALS: Set<string> = new Set([
  '1A', '1C', '1D', '1E', '1F', '1G', '1H', '1J', '1I',
  '3A', '3B', '3C', '3D', '3E', '3F',
  '2A', '2B', '2C',
  '3J', '3K', '3L', '3M', '3N', '3O', '3P', '3Q'
]);

/**
 * Checks whether a given terminal code matches any of the excluded generic terminals.
 */
export function isTerminalExcluded(term: string): boolean {
  if (!term) return true;
  const clean = term.trim().toUpperCase();
  if (EXCLUDED_EXACT_TERMINALS.has(clean)) return true;

  // Strip prefixes such as 'TERM', 'TERMINAL', 'CAJA', 'BLOQUE', 'REGLETA', 'TRM'
  const stripped = clean.replace(/^(TERM|TERMINAL|CAJA|BLOQUE|REGLETA|TRM)\s*[:-]?\s*/i, '').trim();
  if (EXCLUDED_EXACT_TERMINALS.has(stripped)) return true;

  return false;
}

/**
 * Extracts and cleans the cable identifier from a RepairRecord
 */
export function getRecordCable(r: RepairRecord): string {
  if (r.cable && r.cable.trim()) return r.cable.trim();
  if (r.rawRowData) {
    for (const key of Object.keys(r.rawRowData)) {
      if (/^(cable|falla_cable|averia_cable|alimentador)/i.test(key.trim())) {
        const v = String(r.rawRowData[key] || '').trim();
        if (v) return v;
      }
    }
  }
  return 'Cable Sin Especificar';
}

/**
 * Extracts and cleans the terminal identifier from a RepairRecord
 */
export function getRecordTerminal(r: RepairRecord): string {
  if (r.terminal && r.terminal.trim()) return r.terminal.trim();
  if (r.rawRowData) {
    for (const key of Object.keys(r.rawRowData)) {
      if (/^(terminal|term|trm|caja|bloque|regleta|dispersion)/i.test(key.trim())) {
        const v = String(r.rawRowData[key] || '').trim();
        if (v) return v;
      }
    }
  }
  // Fallback: check if cable or issueType mentions a terminal pattern like "T:B2" or "B2"
  const text = `${r.cable || ''} ${r.issueType || ''}`;
  const m = text.match(/\b([A-Za-z]\d{1,3})\b/);
  if (m) {
    return m[1].toUpperCase();
  }
  return '';
}

/**
 * Extracts pair identifier from a RepairRecord
 */
export function getRecordPair(r: RepairRecord): string {
  if (r.pair && r.pair.trim()) return r.pair.trim();
  if (r.rawRowData) {
    for (const key of Object.keys(r.rawRowData)) {
      if (/^(par|par_sec|par_prim|par_telefonico)/i.test(key.trim())) {
        const v = String(r.rawRowData[key] || '').trim();
        if (v) return v;
      }
    }
  }
  return '';
}

/**
 * Extracts terminal components (letter and number)
 * e.g. "B2" -> { letter: "B", num: "2", raw: "B2" }
 *      "B-04" -> { letter: "B", num: "04", raw: "B-04" }
 *      "C12" -> { letter: "C", num: "12", raw: "C12" }
 */
export function extractTerminalComponents(term: string): { letter: string; num: string; raw: string } {
  if (!term) return { letter: '', num: '', raw: '' };
  const clean = term.trim().toUpperCase().replace(/^(TERM|TERMINAL|CAJA|BLOQUE|REGLETA|TRM)\s*[:-]?\s*/i, '');
  
  // Format letter followed by numbers: "B2", "B-04", "B/4", "TB1"
  const m = clean.match(/^([A-Z]+)[-_/\s]*(\d+)/i);
  if (m) {
    return { letter: m[1].toUpperCase(), num: m[2], raw: term.trim() };
  }
  
  // Inverse format: "2B", "04-B"
  const mInv = clean.match(/^(\d+)[-_/\s]*([A-Z]+)/i);
  if (mInv) {
    return { letter: mInv[2].toUpperCase(), num: mInv[1], raw: term.trim() };
  }

  // Single letter or general prefix
  const singleLetterMatch = clean.match(/^([A-Z])/i);
  return {
    letter: singleLetterMatch ? singleLetterMatch[1].toUpperCase() : clean,
    num: '',
    raw: term.trim()
  };
}

/**
 * Evaluates whether two terminals share a relationship:
 * - SAME_TERMINAL: 100% exact match
 * - SIBLING_TERMINAL: Same cable, share common block letter (e.g. B2 and B4 share 'B')
 * Automatically respects the omission rule for generic terminals (1A, 3B, 2C, etc.)
 */
export function compareTerminals(
  term1: string,
  term2: string,
  omitExcluded: boolean = true
): { match: boolean; matchType?: PairMatchType; blockLetter: string; isExcluded?: boolean } {
  if (!term1 || !term2) return { match: false, blockLetter: '' };

  const norm1 = term1.trim().toUpperCase();
  const norm2 = term2.trim().toUpperCase();

  // Omit generic excluded terminals (1A, 3A-3Q, 2A-2C, etc.)
  if (omitExcluded) {
    if (isTerminalExcluded(norm1) || isTerminalExcluded(norm2)) {
      return { match: false, blockLetter: '', isExcluded: true };
    }
  }

  // 1. Exact match (Mismo Terminal)
  if (norm1 === norm2) {
    const comp = extractTerminalComponents(norm1);
    return {
      match: true,
      matchType: 'SAME_TERMINAL',
      blockLetter: comp.letter || norm1
    };
  }

  // 2. Sibling match (Misma letra de caja/bloque, ej. B2 y B4)
  const comp1 = extractTerminalComponents(norm1);
  const comp2 = extractTerminalComponents(norm2);

  if (comp1.letter && comp2.letter && comp1.letter === comp2.letter) {
    return {
      match: true,
      matchType: 'SIBLING_TERMINAL',
      blockLetter: comp1.letter
    };
  }

  return { match: false, blockLetter: '' };
}

/**
 * Calculates day difference between two YYYY-MM-DD date strings
 */
export function calculateDaysDifference(date1: string, date2: string): number {
  try {
    const d1 = new Date(date1.trim());
    const d2 = new Date(date2.trim());
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Generic Fault / Breakdown record that can originate from Recuadro 2 (IP / Cables),
 * Recuadro 1 (Reportes), Recuadro 3 (Reparadas), or a directly uploaded Excel file.
 */
export interface GenericFaultRecord {
  id: string;
  serviceNumber: string;
  centralName?: string;
  cable: string;
  terminal: string;
  pair?: string;
  date: string; // YYYY-MM-DD
  ticketCode?: string;
  technician?: string;
  issueType?: string;
  claveCode?: string;
  status?: string;
  address?: string;
  source: 'RECUADRO_2_IP' | 'RECUADRO_3_REPARADAS' | 'RECUADRO_1_REPORTES' | 'EXCEL_DIRECTO';
  sourceLabel: string;
  rawRowData?: Record<string, any>;
}

/**
 * Converts a RepairRecord into a GenericFaultRecord
 */
export function repairRecordToGenericFault(r: RepairRecord): GenericFaultRecord {
  return {
    id: r.id,
    serviceNumber: r.serviceNumber,
    centralName: r.centralName,
    cable: getRecordCable(r),
    terminal: getRecordTerminal(r),
    pair: getRecordPair(r),
    date: r.date,
    ticketCode: r.ticketCode || 'S/N',
    technician: r.technician || 'Operario de Reparación',
    issueType: r.issueType || 'Reparación Concluida',
    claveCode: r.claveCode || 'C-01',
    status: r.status,
    source: 'RECUADRO_3_REPARADAS',
    sourceLabel: 'Reparación (Recuadro 3)',
    rawRowData: r.rawRowData
  };
}

/**
 * Converts an IpCableRow from Recuadro 2 into a GenericFaultRecord
 */
export function ipCableRowToGenericFault(row: IpCableRow): GenericFaultRecord {
  const terminal = extractTerminalFromItem(row) || '';
  const service = row.servicio || extractTelefonoFromItem(row) || '';
  const address = extractDireccionFromItem(row) || '';

  // Extract date from row.fechaReporte or rawRowData
  let dateStr = row.fechaReporte || '';
  if (!dateStr && row.rawRowData) {
    const dKey = Object.keys(row.rawRowData).find(k => /^(fecha|date|dia|reporte)/i.test(k.trim()));
    if (dKey && row.rawRowData[dKey]) {
      dateStr = String(row.rawRowData[dKey]).trim();
    }
  }
  if (!dateStr || dateStr.length < 8) {
    dateStr = new Date().toISOString().split('T')[0];
  }

  // Extract ticket / folio
  let ticketCode = 'FOL-IP';
  if (row.rawRowData) {
    const tKey = Object.keys(row.rawRowData).find(k => /^(ticket|folio|orden|codigo|id)/i.test(k.trim()));
    if (tKey && row.rawRowData[tKey]) {
      ticketCode = String(row.rawRowData[tKey]).trim();
    }
  }

  // Extract pair
  const pair = row.parP || row.parS || '';

  // Extract issue or group
  const issue = row.grupo || 'Avería en Red / IP Cables';

  return {
    id: row.id,
    serviceNumber: service,
    centralName: row.central,
    cable: cleanCableName(row.cable || row.cableP || row.cableS || 'Cable Sin Especificar'),
    terminal,
    pair,
    date: dateStr,
    ticketCode,
    technician: 'Pendiente / No Asignado',
    issueType: issue,
    claveCode: 'REP-IP',
    status: 'pending',
    address,
    source: 'RECUADRO_2_IP',
    sourceLabel: 'Avería Recuadro 2 (IP / Cables)',
    rawRowData: row.rawRowData
  };
}

/**
 * Loads all available fault records from Recuadro 2 (Análisis de IP y Gestión de Cables)
 */
export function loadRecuadro2Faults(): GenericFaultRecord[] {
  try {
    const ipData = loadParsedIpData();
    if (ipData && Array.isArray(ipData.consolidatedRows) && ipData.consolidatedRows.length > 0) {
      return ipData.consolidatedRows.map(ipCableRowToGenericFault);
    }
  } catch (e) {
    console.warn('Error loading Recuadro 2 IP faults for cross-referencing', e);
  }
  return [];
}

/**
 * Parses any uploaded Excel file containing reported faults to cross-reference
 */
export async function parseDirectExcelToFaultRecords(file: File): Promise<GenericFaultRecord[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });

  return rawRows.map((row, idx) => {
    const keys = Object.keys(row);
    const findVal = (regex: RegExp) => {
      const k = keys.find(key => regex.test(key.trim()));
      return k && row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
    };

    const srv = findVal(/^(servicio|telefono|tel|linea|abonado|numero)/i) || `SRV-EXT-${idx + 1}`;
    const cab = findVal(/^(cable|falla_cable|averia_cable|alimentador)/i) || 'Cable General';
    const term = findVal(/^(terminal|term|caja|bloque|trm|regleta)/i) || '';
    const par = findVal(/^(par|pares|par_sec|par_prim)/i) || '';
    const ticket = findVal(/^(ticket|folio|orden|codigo|id)/i) || `FOL-EXT-${idx + 1}`;
    const central = findVal(/^(central|cta|nodo|sucursal)/i) || 'Central Externa';
    const fecha = findVal(/^(fecha|date|dia|reporte|creacion)/i) || new Date().toISOString().split('T')[0];
    const tech = findVal(/^(tecnico|brigada|contrata|personal)/i) || 'Personal Externo';
    const issue = findVal(/^(falla|averia|problema|sintoma|incidencia)/i) || 'Reclamo Vecino';

    return {
      id: `ext_fault_${idx}_${Date.now()}`,
      serviceNumber: srv,
      centralName: central,
      cable: cleanCableName(cab),
      terminal: term,
      pair: par,
      date: fecha,
      ticketCode: ticket,
      technician: tech,
      issueType: issue,
      claveCode: 'EXT-01',
      status: 'pending',
      source: 'EXCEL_DIRECTO',
      sourceLabel: `Excel Externo (${file.name})`,
      rawRowData: row
    };
  });
}

export type CrossSourceMode = 'all' | 'recuadro2_ip' | 'recuadro3_reparadas' | 'excel_directo';

export interface PairFilterOptions {
  windowPreset: '24h' | '48h' | '7d' | '15d' | '30d' | 'custom';
  customDateFrom?: string;
  customDateTo?: string;
  customMaxDays?: number;
  matchTypeFilter: 'all' | 'SAME_TERMINAL' | 'SIBLING_TERMINAL';
  cableFilter?: string;
  techFilter?: string;
  centralFilter?: string;
  searchTerm?: string;
  sourceMode?: CrossSourceMode;
  omitGenericTerminals?: boolean; // Defaults to true (omits 1A, 3B, 2C, etc.)
}

/**
 * Main Detection Algorithm:
 * Scans repair records (1st intervention / reparada) against target faults
 * (from Recuadro 2 IP, Recuadro 1, Reparadas, or directly uploaded Excel).
 */
export function detectPairCannibalizationEvents(
  records: RepairRecord[],
  options: PairFilterOptions,
  customFaultsList?: GenericFaultRecord[]
): PairCannibalizationEvent[] {
  if (!records || records.length === 0) return [];

  // Filter valid 1st interventions (reparadas) and sort chronologically
  const validRepairs = records
    .filter(r => r.date && r.serviceNumber)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build the target faults list based on sourceMode
  const omitExcluded = options.omitGenericTerminals !== false;
  let targetFaults: GenericFaultRecord[] = [];

  const sourceMode = options.sourceMode || 'all';

  if (customFaultsList && customFaultsList.length > 0) {
    targetFaults.push(...customFaultsList);
  }

  if (sourceMode === 'all' || sourceMode === 'recuadro2_ip') {
    const rec2Faults = loadRecuadro2Faults();
    targetFaults.push(...rec2Faults);
  }

  if (sourceMode === 'all' || sourceMode === 'recuadro3_reparadas') {
    const rec3Faults = validRepairs.map(repairRecordToGenericFault);
    targetFaults.push(...rec3Faults);
  }

  // Filter targets with valid service, date, cable, and terminal
  const validTargets = targetFaults.filter(t => t.serviceNumber && t.date && t.cable && t.terminal);

  // Determine maximum days allowed based on preset or custom options
  let maxDays = 31;
  if (options.windowPreset === '24h') maxDays = 1;
  else if (options.windowPreset === '48h') maxDays = 2;
  else if (options.windowPreset === '7d') maxDays = 7;
  else if (options.windowPreset === '15d') maxDays = 15;
  else if (options.windowPreset === '30d') maxDays = 31;
  else if (options.windowPreset === 'custom' && options.customMaxDays) {
    maxDays = options.customMaxDays;
  }

  const events: PairCannibalizationEvent[] = [];
  const processedPairKeys = new Set<string>();

  // Compare each 1st repair intervention against target faults
  for (let i = 0; i < validRepairs.length; i++) {
    const r1 = validRepairs[i];
    const s1 = (r1.serviceNumber || '').trim().toLowerCase();
    const cable1 = getRecordCable(r1);
    const term1 = getRecordTerminal(r1);

    // If there is no terminal or cable, skip
    if (!term1 || !cable1 || cable1 === 'Cable Sin Especificar') continue;

    // Check if terminal is excluded (1A, 3B, 2C, etc.)
    if (omitExcluded && isTerminalExcluded(term1)) continue;

    // Filter by manual custom date if provided
    if (options.customDateFrom && r1.date < options.customDateFrom) continue;
    if (options.customDateTo && r1.date > options.customDateTo) continue;

    for (let j = 0; j < validTargets.length; j++) {
      const target = validTargets[j];
      const s2 = (target.serviceNumber || '').trim().toLowerCase();

      // Must be DIFFERENT services (Neighbor service, not the same subscriber)
      if (s1 === s2) continue;

      // Do not pair a record with itself if from same source
      if (r1.id === target.id) continue;

      // Must match Cable (Same cable / feeder)
      const cleanCable1 = cleanCableName(cable1).toLowerCase();
      const cleanCable2 = cleanCableName(target.cable).toLowerCase();
      if (cleanCable1 !== cleanCable2 && !cleanCable1.includes(cleanCable2) && !cleanCable2.includes(cleanCable1)) {
        continue;
      }

      // Chronological causality check:
      // The breakdown/reclamation on the neighbor MUST happen on or after the 1st repair intervention (target.date >= r1.date)
      // Allow at most 1 day grace if dates are close
      if (target.date < r1.date) {
        continue;
      }

      // Calculate time interval
      const diffDays = calculateDaysDifference(r1.date, target.date);
      if (diffDays > maxDays) {
        continue;
      }

      // Check terminal relation
      const term2 = target.terminal;
      if (!term2) continue;

      // Check if term2 is excluded (1A, 3B, 2C, etc.)
      if (omitExcluded && isTerminalExcluded(term2)) continue;

      const comp = compareTerminals(term1, term2, omitExcluded);
      if (!comp.match || !comp.matchType) continue;

      // Filter by match type if selected
      if (options.matchTypeFilter !== 'all' && options.matchTypeFilter !== comp.matchType) {
        continue;
      }

      // Avoid duplicate event pairs
      const pairKey = `${r1.id}_${target.id}`;
      if (processedPairKeys.has(pairKey)) continue;
      processedPairKeys.add(pairKey);

      // Determine Interval Category
      let intervalCategory = 'Mes (16 a 31 días)';
      if (diffDays === 0) intervalCategory = 'Mismo Día (Inmediato)';
      else if (diffDays === 1) intervalCategory = '24 Horas (Inmediato)';
      else if (diffDays === 2) intervalCategory = '48 Horas';
      else if (diffDays <= 7) intervalCategory = `Misma Semana (${diffDays} días)`;
      else if (diffDays <= 15) intervalCategory = `Quincena (${diffDays} días)`;

      // Determine Suspicion Level
      let suspicionLevel: PairSuspicionLevel = 'MEDIUM';
      if (diffDays <= 2 && comp.matchType === 'SAME_TERMINAL') {
        suspicionLevel = 'CRITICAL';
      } else if (diffDays <= 1 && comp.matchType === 'SIBLING_TERMINAL') {
        suspicionLevel = 'CRITICAL';
      } else if (diffDays <= 7) {
        suspicionLevel = 'HIGH';
      } else if (diffDays <= 15 && comp.matchType === 'SAME_TERMINAL') {
        suspicionLevel = 'HIGH';
      }

      const isSameTech = Boolean(
        r1.technician && target.technician &&
        r1.technician.trim().toLowerCase() === target.technician.trim().toLowerCase()
      );

      const relationText = comp.matchType === 'SAME_TERMINAL'
        ? `Mismo terminal exacto (${term1})`
        : `Terminal hermano (Caja Bloque ${comp.blockLetter}: ${term1} vs ${term2})`;

      const description = `El servicio ${r1.serviceNumber} fue reparado por "${r1.technician}" el ${r1.date} en ${cable1}, ${relationText}. A los ${diffDays === 0 ? 'pocas horas' : `${diffDays} día(s)`} (${target.date}), el servicio vecino ${target.serviceNumber} presentó avería (${target.sourceLabel}). Posible cambio o desconexión de par en la bornera de dispersión.`;

      events.push({
        id: `pair_ev_${r1.id}_${target.id}`,
        centralName: r1.centralName || target.centralName || 'Central General',
        cable: cable1,
        matchType: comp.matchType,
        blockLetter: comp.blockLetter,
        diffDays,
        diffHoursEstimate: diffDays * 24,
        intervalCategory,
        suspicionLevel,
        suspectedTechnician: r1.technician || 'Operario No Asignado',
        isSameTech,
        description,

        // First intervention (La Reparada)
        firstRepairId: r1.id,
        firstTicket: r1.ticketCode || 'S/N',
        firstService: r1.serviceNumber,
        firstDate: r1.date,
        firstTech: r1.technician || 'Operario No Asignado',
        firstTerminal: term1,
        firstPair: getRecordPair(r1),
        firstClave: r1.claveCode || 'C-01',
        firstIssue: r1.issueType || 'Reparación Exitosa',
        firstStatus: r1.status,
        firstRawRowData: r1.rawRowData,

        // Second intervention (Avería vecina de Recuadro 2, 1, 3 o Excel)
        secondRepairId: target.id,
        secondTicket: target.ticketCode || 'S/N',
        secondService: target.serviceNumber,
        secondDate: target.date,
        secondTech: target.technician || 'Operario No Asignado',
        secondTerminal: term2,
        secondPair: target.pair || '',
        secondClave: target.claveCode || 'C-01',
        secondIssue: target.issueType || 'Avería Vecino',
        secondStatus: target.status,
        secondAddress: target.address,
        secondSource: target.source,
        secondSourceLabel: target.sourceLabel,
        secondRawRowData: target.rawRowData
      });
    }
  }

  // Sort events by severity then chronological date of 1st intervention descending
  return events.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    if (order[a.suspicionLevel] !== order[b.suspicionLevel]) {
      return order[a.suspicionLevel] - order[b.suspicionLevel];
    }
    return b.firstDate.localeCompare(a.firstDate);
  });
}

/**
 * Calculates technician collateral damage rankings:
 * Quantifies which operators leave the most interrupted neighbor services on the boxes they visit.
 */
export function calculateTechnicianCollateralRanking(
  events: PairCannibalizationEvent[]
): TechnicianCollateralDamageSummary[] {
  const map = new Map<string, {
    total: number;
    critical: number;
    high: number;
    sameTerm: number;
    siblingTerm: number;
    cablesMap: Map<string, number>;
    terminalsMap: Map<string, number>;
    affectedServices: Set<string>;
  }>();

  events.forEach(ev => {
    const tech = ev.suspectedTechnician || 'Sin Operario';
    if (!map.has(tech)) {
      map.set(tech, {
        total: 0,
        critical: 0,
        high: 0,
        sameTerm: 0,
        siblingTerm: 0,
        cablesMap: new Map(),
        terminalsMap: new Map(),
        affectedServices: new Set()
      });
    }

    const item = map.get(tech)!;
    item.total++;
    if (ev.suspicionLevel === 'CRITICAL') item.critical++;
    if (ev.suspicionLevel === 'HIGH') item.high++;
    if (ev.matchType === 'SAME_TERMINAL') item.sameTerm++;
    if (ev.matchType === 'SIBLING_TERMINAL') item.siblingTerm++;

    item.affectedServices.add(ev.secondService);

    // Cable stats
    const cCount = item.cablesMap.get(ev.cable) || 0;
    item.cablesMap.set(ev.cable, cCount + 1);

    // Terminal stats
    const tCount = item.terminalsMap.get(ev.firstTerminal) || 0;
    item.terminalsMap.set(ev.firstTerminal, tCount + 1);
  });

  const result: TechnicianCollateralDamageSummary[] = [];

  map.forEach((data, technician) => {
    const mostAffectedCables = Array.from(data.cablesMap.entries())
      .map(([cable, count]) => ({ cable, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const mostAffectedTerminals = Array.from(data.terminalsMap.entries())
      .map(([terminal, count]) => ({ terminal, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    result.push({
      technician,
      totalCollateralCases: data.total,
      criticalCases: data.critical,
      highCases: data.high,
      sameTerminalCases: data.sameTerm,
      siblingTerminalCases: data.siblingTerm,
      mostAffectedCables,
      mostAffectedTerminals,
      affectedServicesCount: data.affectedServices.size
    });
  });

  // Sort descending by total cases, then critical cases
  return result.sort((a, b) => {
    if (b.totalCollateralCases !== a.totalCollateralCases) {
      return b.totalCollateralCases - a.totalCollateralCases;
    }
    return b.criticalCases - a.criticalCases;
  });
}

/**
 * Generates an Excel report for Pair Cannibalization & Field Inspection
 */
export function exportPairCannibalizationExcel(
  events: PairCannibalizationEvent[],
  ranking: TechnicianCollateralDamageSummary[]
): void {
  const wb = XLSX.utils.book_new();

  // 1. Events Sheet
  const eventRows = events.map(ev => ({
    'Nivel Alerta': ev.suspicionLevel === 'CRITICAL' ? 'CRÍTICO (<=48h)' : ev.suspicionLevel === 'HIGH' ? 'ALTO (Semana)' : 'MEDIO',
    'Cable': ev.cable,
    'Tipo Relación': ev.matchType === 'SAME_TERMINAL' ? 'Mismo Terminal' : `Hermano (Letra ${ev.blockLetter})`,
    'Intervalo Tiempo': ev.intervalCategory,
    'Días Transcurridos': ev.diffDays,
    'Central': ev.centralName,
    'Operario Sospechoso': ev.suspectedTechnician,
    'Servicio 1 (Reparado)': ev.firstService,
    'Terminal 1': ev.firstTerminal,
    'Fecha 1 (Intervención)': ev.firstDate,
    'Ticket 1': ev.firstTicket,
    'Clave 1': ev.firstClave,
    'Servicio 2 (Interrumpido / Vecino)': ev.secondService,
    'Terminal 2': ev.secondTerminal,
    'Fecha 2 (Caída / Avería)': ev.secondDate,
    'Origen Avería 2': ev.secondSourceLabel || 'Desconocido',
    'Dirección Vecino': ev.secondAddress || '',
    'Técnico / Cuadrilla 2': ev.secondTech,
    'Ticket 2': ev.secondTicket,
    'Clave 2': ev.secondClave,
    'Mismo Operario': ev.isSameTech ? 'SÍ' : 'NO',
    'Diagnóstico de Auditoría': ev.description
  }));

  const wsEvents = XLSX.utils.json_to_sheet(eventRows);
  XLSX.utils.book_append_sheet(wb, wsEvents, 'Auditoría Canibalización Pares');

  // 2. Ranking Sheet
  const rankingRows = ranking.map(r => ({
    'Operario / Brigada': r.technician,
    'Total Casos Vecinos Afectados': r.totalCollateralCases,
    'Casos Críticos (<=48h)': r.criticalCases,
    'Casos Altos (<=7d)': r.highCases,
    'Mismo Terminal Exacto': r.sameTerminalCases,
    'Terminal Hermano (Misma Letra)': r.siblingTerminalCases,
    'Vecinos Afectados Únicos': r.affectedServicesCount,
    'Cables Más Afectados': r.mostAffectedCables.map(c => `${c.cable} (${c.count})`).join(', '),
    'Terminales Más Afectados': r.mostAffectedTerminals.map(t => `${t.terminal} (${t.count})`).join(', ')
  }));

  const wsRanking = XLSX.utils.json_to_sheet(rankingRows);
  XLSX.utils.book_append_sheet(wb, wsRanking, 'Ranking Daño Colateral');

  const today = new Date().toISOString().split('T')[0];
  saveXlsxWorkbook(wb, `Auditoria_Canibalizacion_Pares_${today}.xlsx`);
}
