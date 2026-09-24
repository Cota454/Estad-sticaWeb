import { RepairRecord, IncoherentAuditConfig, IncoherentEvent, IncoherentTechnicianSummary } from '../types';
import { getStorageKey } from '../data/mockData';
import { getIdbItem, setIdbItem } from './indexedDbStorage';
import * as XLSX from 'xlsx-js-style';
import { saveXlsxWorkbook } from './fileDownloadHelper';

const INCOHERENT_CONFIG_STORAGE_KEY = 'telecom_incoherent_audit_config_v1';

export const DEFAULT_INCOHERENT_CONFIG: IncoherentAuditConfig = {
  windowDays: 30, // 30 días como solicitó el usuario
  detectionMode: 'all_different', // 'all_different' | 'effective_vs_non_effective' | 'custom_rules'
  nonEffectiveClaves: [
    'C-01',
    'SIN FALLA',
    'PRUEBAS OK',
    'OK EN CASA',
    'ACOMETIDA OK',
    'NO HUBO QUIEN ATENDIERA',
    'CLIENTE AUSENTE',
    'CANCELADO'
  ],
  effectiveClaves: [
    'C-02',
    'C-03',
    'C-04',
    'C-05',
    'C-06',
    'PAR DAÑADO',
    'CABLE ROTO',
    'TERMINAL SULFATADA',
    'FALLA DE RED',
    'CENTRAL'
  ],
  customPairs: []
};

export function loadIncoherentConfig(userEmail?: string): IncoherentAuditConfig {
  try {
    const key = getStorageKey(INCOHERENT_CONFIG_STORAGE_KEY, userEmail);
    let raw = localStorage.getItem(key);
    if (!raw && userEmail) {
      raw = localStorage.getItem(INCOHERENT_CONFIG_STORAGE_KEY);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_INCOHERENT_CONFIG,
        ...parsed
      };
    }
  } catch (e) {
    console.warn('Error reading incoherent config from localStorage:', e);
  }
  return { ...DEFAULT_INCOHERENT_CONFIG };
}

export async function loadIncoherentConfigAsync(userEmail?: string): Promise<IncoherentAuditConfig> {
  const sync = loadIncoherentConfig(userEmail);
  try {
    const key = getStorageKey(INCOHERENT_CONFIG_STORAGE_KEY, userEmail);
    const idbVal = await getIdbItem<IncoherentAuditConfig>(key);
    if (idbVal) return { ...DEFAULT_INCOHERENT_CONFIG, ...idbVal };
  } catch (e) {
    // fallback
  }
  return sync;
}

export function saveIncoherentConfig(config: IncoherentAuditConfig, userEmail?: string): void {
  try {
    const key = getStorageKey(INCOHERENT_CONFIG_STORAGE_KEY, userEmail);
    localStorage.setItem(key, JSON.stringify(config));
    if (userEmail) {
      localStorage.setItem(INCOHERENT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
  } catch (e) {
    console.warn('LocalStorage error while saving incoherent config:', e);
  }

  const idbKey = getStorageKey(INCOHERENT_CONFIG_STORAGE_KEY, userEmail);
  setIdbItem(idbKey, config).catch(() => {});
  if (userEmail) {
    setIdbItem(INCOHERENT_CONFIG_STORAGE_KEY, config).catch(() => {});
  }
}

/**
 * Normalizes a clave text for comparison (uppercase, trimmed, strips extra spaces)
 */
export function normalizeClave(clave?: string): string {
  if (!clave) return '';
  return clave.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Checks if a clave matches a list of claves (exact or contains)
 */
export function matchesClaveList(clave: string, list: string[]): boolean {
  const norm = normalizeClave(clave);
  if (!norm) return false;
  return list.some(item => {
    const normItem = normalizeClave(item);
    return norm === normItem || norm.startsWith(normItem) || normItem.startsWith(norm);
  });
}

/**
 * Helper to extract value across multiple candidate keys in rawRowData or fallback
 */
function extractRowVal(record: RepairRecord, candidateKeys: string[], fallbackVal: string = '-'): string {
  if (record.rawRowData && typeof record.rawRowData === 'object') {
    const rawKeys = Object.keys(record.rawRowData);
    for (const target of candidateKeys) {
      const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = rawKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normTarget);
      if (found && record.rawRowData[found] !== undefined && record.rawRowData[found] !== null) {
        const val = String(record.rawRowData[found]).trim();
        if (val) return val;
      }
    }
  }
  return fallbackVal;
}

/**
 * Computes all incoherent closure events (Falsos Cierres) across all repair records
 */
export function detectIncoherentEvents(
  records: RepairRecord[],
  config: IncoherentAuditConfig,
  filterDateFrom?: string,
  filterDateTo?: string,
  techFilter: string = 'all',
  centralFilter: string = 'all',
  searchTerm: string = ''
): IncoherentEvent[] {
  const windowDays = config.windowDays > 0 ? config.windowDays : 30;

  // Group records by subscriber / service number
  const serviceMap = new Map<string, RepairRecord[]>();

  records.forEach(rec => {
    const sNum = (rec.serviceNumber || '').trim();
    if (!sNum) return;
    if (!serviceMap.has(sNum)) {
      serviceMap.set(sNum, []);
    }
    serviceMap.get(sNum)!.push(rec);
  });

  const incoherentEvents: IncoherentEvent[] = [];

  serviceMap.forEach((subscriberVisits, sNum) => {
    // Only analyze services visited 2 or more times
    if (subscriberVisits.length < 2) return;

    // Sort chronologically by date
    const sorted = [...subscriberVisits].sort((a, b) => {
      const dateA = a.date || a.reportDate || '';
      const dateB = b.date || b.reportDate || '';
      return dateA.localeCompare(dateB);
    });

    // Check consecutive or intra-window visits
    for (let i = 0; i < sorted.length - 1; i++) {
      const visit1 = sorted[i];

      for (let j = i + 1; j < sorted.length; j++) {
        const visit2 = sorted[j];

        const date1Str = visit1.date || visit1.reportDate || '';
        const date2Str = visit2.date || visit2.reportDate || '';
        if (!date1Str || !date2Str) continue;

        const d1 = new Date(date1Str.replace(/-/g, '/')).getTime();
        const d2 = new Date(date2Str.replace(/-/g, '/')).getTime();
        if (isNaN(d1) || isNaN(d2)) continue;

        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

        // Must occur within the specified window (0 to windowDays, e.g. <= 30 days)
        if (diffDays < 0 || diffDays > windowDays) {
          // Since sorted chronologically, subsequent visits will have even larger diffDays
          break;
        }

        const clave1 = normalizeClave(visit1.claveCode || 'C-01');
        const clave2 = normalizeClave(visit2.claveCode || 'C-01');

        let isIncoherent = false;
        let incoherenceType = '';
        let severity: 'high' | 'medium' = 'medium';

        if (config.detectionMode === 'all_different') {
          if (clave1 !== clave2 && clave1 !== '' && clave2 !== '') {
            isIncoherent = true;
            const isNonEff1 = matchesClaveList(clave1, config.nonEffectiveClaves);
            const isEff2 = matchesClaveList(clave2, config.effectiveClaves);

            if (isNonEff1 && isEff2) {
              incoherenceType = `1ª Visita No Efectiva (${clave1}) ➔ 2ª Visita Falla Real (${clave2})`;
              severity = 'high';
            } else {
              incoherenceType = `Discrepancia de Clave (${clave1} ➔ ${clave2})`;
              severity = 'medium';
            }
          }
        } else if (config.detectionMode === 'effective_vs_non_effective') {
          const isNonEff1 = matchesClaveList(clave1, config.nonEffectiveClaves);
          const isEff2 = matchesClaveList(clave2, config.effectiveClaves);

          if (isNonEff1 && isEff2) {
            isIncoherent = true;
            incoherenceType = `Cierre No Efectivo (${clave1}) refutado por Cierre Efectivo (${clave2})`;
            severity = 'high';
          }
        } else if (config.detectionMode === 'custom_rules') {
          const matchedRule = config.customPairs.find(
            rule => normalizeClave(rule.fromClave) === clave1 && normalizeClave(rule.toClave) === clave2
          );
          if (matchedRule) {
            isIncoherent = true;
            incoherenceType = matchedRule.description || `Incoherencia Regla: ${clave1} ➔ ${clave2}`;
            severity = 'high';
          }
        }

        if (isIncoherent) {
          const eventDate = date2Str; // date of the refutation / 2nd visit
          // Check date filters
          if (filterDateFrom && eventDate < filterDateFrom) continue;
          if (filterDateTo && eventDate > filterDateTo) continue;

          const tech1 = visit1.technician || 'Sin Técnico 1';
          const tech2 = visit2.technician || 'Sin Técnico 2';

          // Filter by affected technician (tech 1) or tech 2
          if (techFilter !== 'all' && tech1 !== techFilter && tech2 !== techFilter) {
            continue;
          }

          const central = visit1.centralName || visit2.centralName || 'General';
          if (centralFilter !== 'all' && central !== centralFilter) {
            continue;
          }

          // Search term filter
          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchSearch =
              sNum.toLowerCase().includes(term) ||
              tech1.toLowerCase().includes(term) ||
              tech2.toLowerCase().includes(term) ||
              clave1.toLowerCase().includes(term) ||
              clave2.toLowerCase().includes(term) ||
              (visit1.ticketCode || '').toLowerCase().includes(term) ||
              (visit2.ticketCode || '').toLowerCase().includes(term);
            if (!matchSearch) continue;
          }

          incoherentEvents.push({
            id: `inc_${visit1.id || i}_${visit2.id || j}`,
            serviceNumber: sNum,
            centralName: central,
            firstRepairId: visit1.id || `rep_${i}`,
            firstTicket: visit1.ticketCode || `FOL-${i + 1}`,
            firstDate: date1Str,
            firstReportDate: visit1.reportDate,
            firstTech: tech1,
            firstClave: clave1,
            firstCable: visit1.cable || visit1.issueType || '-',
            firstGrupo: visit1.grupo,
            firstRawRowData: visit1.rawRowData,
            secondRepairId: visit2.id || `rep_${j}`,
            secondTicket: visit2.ticketCode || `FOL-${j + 1}`,
            secondDate: date2Str,
            secondReportDate: visit2.reportDate,
            secondTech: tech2,
            secondClave: clave2,
            secondCable: visit2.cable || visit2.issueType || '-',
            secondGrupo: visit2.grupo,
            secondRawRowData: visit2.rawRowData,
            diffDays,
            incoherenceType,
            isSameTech: tech1.toLowerCase() === tech2.toLowerCase(),
            affectedTech: tech1,
            severity
          });
        }
      }
    }
  });

  // Sort by most recent refutation date desc, then highest severity
  return incoherentEvents.sort((a, b) => {
    if (a.secondDate !== b.secondDate) {
      return b.secondDate.localeCompare(a.secondDate);
    }
    return a.diffDays - b.diffDays;
  });
}

/**
 * Summarizes the impact on the first technicians (the ones who performed the initial closure)
 */
export function calculateTechnicianIncoherenceSummaries(
  events: IncoherentEvent[],
  allRecords: RepairRecord[]
): IncoherentTechnicianSummary[] {
  // Count total initial visits per technician
  const firstVisitsByTech = new Map<string, number>();
  allRecords.forEach(r => {
    const t = (r.technician || '').trim();
    if (!t) return;
    firstVisitsByTech.set(t, (firstVisitsByTech.get(t) || 0) + 1);
  });

  const techMap = new Map<
    string,
    {
      incoherentCount: number;
      initialClaves: Map<string, number>;
      refutedByClaves: Map<string, number>;
      refutedByTechs: Map<string, number>;
    }
  >();

  events.forEach(evt => {
    const t = evt.affectedTech;
    if (!techMap.has(t)) {
      techMap.set(t, {
        incoherentCount: 0,
        initialClaves: new Map(),
        refutedByClaves: new Map(),
        refutedByTechs: new Map()
      });
    }

    const item = techMap.get(t)!;
    item.incoherentCount += 1;

    // Clave 1 used
    item.initialClaves.set(evt.firstClave, (item.initialClaves.get(evt.firstClave) || 0) + 1);
    // Clave 2 that refuted it
    item.refutedByClaves.set(evt.secondClave, (item.refutedByClaves.get(evt.secondClave) || 0) + 1);
    // Tech 2 who refuted it
    item.refutedByTechs.set(evt.secondTech, (item.refutedByTechs.get(evt.secondTech) || 0) + 1);
  });

  const summaries: IncoherentTechnicianSummary[] = [];

  techMap.forEach((data, techName) => {
    const totalFirst = firstVisitsByTech.get(techName) || data.incoherentCount;
    const rate = totalFirst > 0 ? (data.incoherentCount / totalFirst) * 100 : 0;

    const commonInitialClaves = Array.from(data.initialClaves.entries())
      .map(([clave, count]) => ({ clave, count }))
      .sort((a, b) => b.count - a.count);

    const commonRefutedByClaves = Array.from(data.refutedByClaves.entries())
      .map(([clave, count]) => ({ clave, count }))
      .sort((a, b) => b.count - a.count);

    const refutedByTechs = Array.from(data.refutedByTechs.entries())
      .map(([technician, count]) => ({ technician, count }))
      .sort((a, b) => b.count - a.count);

    summaries.push({
      technician: techName,
      totalIncoherentClosures: data.incoherentCount,
      totalFirstVisits: totalFirst,
      refutationRate: Math.round(rate * 10) / 10,
      commonInitialClaves,
      commonRefutedByClaves,
      refutedByTechs
    });
  });

  return summaries.sort((a, b) => b.totalIncoherentClosures - a.totalIncoherentClosures);
}

/**
 * Downloads a specialized Excel report with all incoherent closure audit details
 */
export async function exportIncoherenciasExcel(
  events: IncoherentEvent[],
  windowDays: number,
  dateFrom?: string,
  dateTo?: string
): Promise<void> {
  if (events.length === 0) {
    alert('No hay eventos de cierres incoherentes para exportar con los filtros seleccionados.');
    return;
  }

  const headers = [
    'No.',
    'Teléfono',
    'Central',
    'Folio 1ª Visita',
    'Fecha 1ª Visita',
    'Técnico 1 (Responsable)',
    'Clave 1ª Visita',
    'Cable 1',
    'Folio 2ª Visita',
    'Fecha 2ª Visita',
    'Técnico 2 (Auditor)',
    'Clave 2ª Visita',
    'Cable 2',
    'Días Transcurridos',
    'Tipo de Incoherencia',
    '¿Mismo Técnico?',
    'Afectación Operativa'
  ];

  const sheetData: any[][] = [];
  sheetData.push([`AUDITORÍA DE CIERRES INCOHERENTES Y FALSOS CIERRES (Ventana: ≤ ${windowDays} Días)`]);
  sheetData.push([`Período: ${dateFrom || 'Inicio'} al ${dateTo || 'Hoy'} | Total Casos Incoherentes: ${events.length}`]);
  sheetData.push([]);
  sheetData.push(headers);

  events.forEach((evt, idx) => {
    sheetData.push([
      idx + 1,
      evt.serviceNumber,
      evt.centralName,
      evt.firstTicket,
      evt.firstDate,
      evt.firstTech,
      evt.firstClave,
      evt.firstCable || '-',
      evt.secondTicket,
      evt.secondDate,
      evt.secondTech,
      evt.secondClave,
      evt.secondCable || '-',
      `${evt.diffDays} días`,
      evt.incoherenceType,
      evt.isSameTech ? 'SÍ (Mismo Técnico)' : 'NO (Técnico Distinto)',
      `Afecta a: ${evt.affectedTech}`
    ]);
  });

  // Summary row
  sheetData.push([]);
  sheetData.push([
    'TOTAL CASOS INCOHERENTES',
    events.length,
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    `Ventana: ≤ ${windowDays} días`
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  worksheet['!cols'] = [
    { wch: 6 },  // No.
    { wch: 16 }, // Teléfono
    { wch: 22 }, // Central
    { wch: 16 }, // Folio 1
    { wch: 14 }, // Fecha 1
    { wch: 22 }, // Técnico 1
    { wch: 14 }, // Clave 1
    { wch: 18 }, // Cable 1
    { wch: 16 }, // Folio 2
    { wch: 14 }, // Fecha 2
    { wch: 22 }, // Técnico 2
    { wch: 14 }, // Clave 2
    { wch: 18 }, // Cable 2
    { wch: 18 }, // Días Transcurridos
    { wch: 36 }, // Incoherencia
    { wch: 20 }, // Mismo técnico
    { wch: 26 }  // Afectación
  ];

  if (worksheet['A1']) {
    worksheet['A1'].s = {
      font: { bold: true, sz: 14, color: { rgb: '991B1B' } }
    };
  }
  if (worksheet['A2']) {
    worksheet['A2'].s = {
      font: { italic: true, sz: 10, color: { rgb: '64748B' } }
    };
  }

  const headerRowIdx = 3;
  const borderStyle = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  headers.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIdx });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        fill: { fgColor: { rgb: '1E293B' } },
        font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderStyle
      };
    }
  });

  for (let rIdx = 0; rIdx < events.length; rIdx++) {
    const sheetRow = headerRowIdx + 1 + rIdx;
    const isEven = rIdx % 2 === 0;
    const bgRgb = isEven ? 'FFFFFF' : 'F8FAFC';

    headers.forEach((_, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: sheetRow, c: cIdx });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = {
          fill: { fgColor: { rgb: bgRgb } },
          font: { sz: 9, color: { rgb: '0F172A' } },
          alignment: { horizontal: cIdx === 1 || cIdx === 4 || cIdx === 9 || cIdx === 13 ? 'center' : 'left', vertical: 'center' },
          border: borderStyle
        };
      }
    });
  }

  const totalRowIdx = headerRowIdx + 1 + events.length + 1;
  headers.forEach((_, cIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx, c: cIdx });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        fill: { fgColor: { rgb: 'FEE2E2' } },
        font: { bold: true, sz: 10, color: { rgb: '991B1B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle
      };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cierres_Incoherentes');

  const fileName = `Auditoria_Cierres_Incoherentes_${windowDays}dias_${dateFrom || 'Inicio'}_al_${dateTo || 'Fin'}`;
  await saveXlsxWorkbook(workbook, fileName);
}
