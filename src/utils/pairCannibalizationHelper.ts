import { RepairRecord, PairCannibalizationEvent, PairMatchType, PairSuspicionLevel, TechnicianCollateralDamageSummary } from '../types';
import * as XLSX from 'xlsx-js-style';
import { saveXlsxWorkbook } from './fileDownloadHelper';

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
  const clean = term.trim().toUpperCase().replace(/^(TERM|TERMINAL|CAJA|BLOQUE|REGLETA)\s*[:-]?\s*/i, '');
  
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
 */
export function compareTerminals(term1: string, term2: string): { match: boolean; matchType?: PairMatchType; blockLetter: string } {
  if (!term1 || !term2) return { match: false, blockLetter: '' };

  const norm1 = term1.trim().toUpperCase();
  const norm2 = term2.trim().toUpperCase();

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
}

/**
 * Main Detection Algorithm:
 * Scans repair records to identify pair cannibalization and interrupted neighbor services.
 */
export function detectPairCannibalizationEvents(
  records: RepairRecord[],
  options: PairFilterOptions
): PairCannibalizationEvent[] {
  if (!records || records.length < 2) return [];

  // Filter valid records and sort chronologically
  const validRecords = records
    .filter(r => r.date && r.serviceNumber)
    .sort((a, b) => a.date.localeCompare(b.date));

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

  // Compare each record with subsequent records
  for (let i = 0; i < validRecords.length; i++) {
    const r1 = validRecords[i];
    const s1 = (r1.serviceNumber || '').trim().toLowerCase();
    const cable1 = getRecordCable(r1);
    const term1 = getRecordTerminal(r1);

    // If there is no terminal or cable, skip
    if (!term1 || !cable1 || cable1 === 'Cable Sin Especificar') continue;

    // Filter by manual custom date if provided
    if (options.customDateFrom && r1.date < options.customDateFrom) continue;
    if (options.customDateTo && r1.date > options.customDateTo) continue;

    for (let j = i + 1; j < validRecords.length; j++) {
      const r2 = validRecords[j];
      const s2 = (r2.serviceNumber || '').trim().toLowerCase();

      // Must be DIFFERENT services (Neighbor services, not the same line)
      if (s1 === s2) continue;

      const cable2 = getRecordCable(r2);
      // Must match Cable (Same cable / feeder)
      if (cable1.toLowerCase() !== cable2.toLowerCase()) continue;

      // Calculate time interval
      const diffDays = calculateDaysDifference(r1.date, r2.date);
      if (diffDays > maxDays) {
        // Since records are sorted chronologically, if diffDays exceeds maxDays + 35, we can break early
        if (diffDays > maxDays + 35) break;
        continue;
      }

      // Check terminal relation
      const term2 = getRecordTerminal(r2);
      if (!term2) continue;

      const comp = compareTerminals(term1, term2);
      if (!comp.match || !comp.matchType) continue;

      // Filter by match type if selected
      if (options.matchTypeFilter !== 'all' && options.matchTypeFilter !== comp.matchType) {
        continue;
      }

      // Avoid duplicate event pairs
      const pairKey = `${r1.id}_${r2.id}`;
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
        r1.technician && r2.technician &&
        r1.technician.trim().toLowerCase() === r2.technician.trim().toLowerCase()
      );

      const relationText = comp.matchType === 'SAME_TERMINAL'
        ? `Mismo terminal exacto (${term1})`
        : `Terminal hermano (Caja Bloque ${comp.blockLetter}: ${term1} vs ${term2})`;

      const description = `El servicio ${r1.serviceNumber} fue reparado por "${r1.technician}" el ${r1.date} en ${cable1}, ${relationText}. A los ${diffDays === 0 ? 'pocas horas' : `${diffDays} día(s)`} (${r2.date}), el servicio vecino ${r2.serviceNumber} presentó avería y fue intervenido por "${r2.technician}". Posible cambio o desconexión de par.`;

      events.push({
        id: `pair_ev_${r1.id}_${r2.id}`,
        centralName: r1.centralName || r2.centralName || 'Central General',
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

        // First intervention
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

        // Second intervention (Interrupted neighbour)
        secondRepairId: r2.id,
        secondTicket: r2.ticketCode || 'S/N',
        secondService: r2.serviceNumber,
        secondDate: r2.date,
        secondTech: r2.technician || 'Operario No Asignado',
        secondTerminal: term2,
        secondPair: getRecordPair(r2),
        secondClave: r2.claveCode || 'C-01',
        secondIssue: r2.issueType || 'Avería Vecino',
        secondStatus: r2.status,
        secondRawRowData: r2.rawRowData
      });
    }
  }

  // Sort events by date of 1st intervention descending or severity
  return events.sort((a, b) => {
    // Critical first, then High, then Medium
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
    'Servicio 2 (Interrumpido)': ev.secondService,
    'Terminal 2': ev.secondTerminal,
    'Fecha 2 (Caída/Avería)': ev.secondDate,
    'Técnico 2': ev.secondTech,
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
