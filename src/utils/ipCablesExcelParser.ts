import * as XLSX from 'xlsx-js-style';
import Papa from 'papaparse';
import { IpCableRow, IpCableExcelParseResult, CableClassificationRules } from '../types/ipCablesTypes';

function normalizeHeader(str: string): string {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Classifies a row into Red Rígida, Red Flexible, Outdoor, or Other
 */
export function classifyNetworkType(
  cableVal: string,
  centralVal: string,
  rules: CableClassificationRules
): { networkType: 'rigida' | 'flexible' | 'outdoor' | 'other'; networkTypeLabel: string } {
  const normCable = (cableVal || '').toString().trim().toUpperCase();
  const normCentral = (centralVal || '').toString().trim().toUpperCase();

  // 1. Check Red Rígida (Exact or match in rules.rigidaCables)
  const isRigida = rules.rigidaCables.some(r => {
    const target = r.toString().trim().toUpperCase();
    return target && (normCable === target || normCable.includes(target) || target.includes(normCable));
  });

  if (isRigida) {
    return { networkType: 'rigida', networkTypeLabel: 'Red Rígida' };
  }

  // 2. Check Red Flexible (Pattern match in CABLE column)
  const flexibleRuleMatch = rules.flexibleRules.find(rule => {
    const pat = rule.pattern.toString().trim().toUpperCase();
    return pat && normCable.includes(pat);
  });

  if (flexibleRuleMatch) {
    return {
      networkType: 'flexible',
      networkTypeLabel: `Red Flexible (${flexibleRuleMatch.assignedName || flexibleRuleMatch.pattern})`
    };
  }

  // 3. Check Outdoor (Pattern match in CENTRAL TELEFONICA column)
  const outdoorRuleMatch = rules.outdoorRules.find(rule => {
    const pat = rule.centralPattern.toString().trim().toUpperCase();
    return pat && normCentral.includes(pat);
  });

  if (outdoorRuleMatch) {
    return {
      networkType: 'outdoor',
      networkTypeLabel: `Outdoor (${outdoorRuleMatch.assignedName || outdoorRuleMatch.centralPattern})`
    };
  }

  return { networkType: 'other', networkTypeLabel: 'Otra Red / General' };
}

/**
 * Normalizes date to YYYY-MM-DD
 */
export function normalizeDateStr(rawDate: any): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];

  if (typeof rawDate === 'number') {
    // Excel serial date
    const dateObj = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(rawDate).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;

  // DD/MM/YYYY or MM/DD/YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let p1 = parseInt(parts[0], 10);
    let p2 = parseInt(parts[1], 10);
    let p3 = parseInt(parts[2], 10);

    if (p3 > 1000) {
      // DD/MM/YYYY
      const y = p3;
      const m = String(p2).padStart(2, '0');
      const d = String(p1).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else if (p1 > 1000) {
      // YYYY/MM/DD
      const y = p1;
      const m = String(p2).padStart(2, '0');
      const d = String(p3).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Main parser:
 * Ignores first 3 rows (0, 1, 2).
 * Row 4 (index 3) is the header row.
 * Rows index 4+ are data rows.
 * Consolidates rows by 'SERVICIO' column.
 */
export async function parseIpCablesExcelFile(
  file: File,
  rules: CableClassificationRules
): Promise<IpCableExcelParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert worksheet to array of arrays
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawMatrix.length < 4) {
    throw new Error('El archivo Excel debe contener al menos 4 filas (las 3 primeras se ignoran y la 4ª fila contiene los encabezados).');
  }

  // Row index 3 is 4th row in 1-based indexing
  const headerRow = rawMatrix[3] || [];
  const rawHeaders = headerRow.map(h => (h !== undefined && h !== null ? String(h).trim() : ''));

  // Find column indices
  let servicioIdx = -1;
  let centralIdx = -1;
  let grupoIdx = -1;
  let cableIdx = -1;
  let fechaIdx = -1;

  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (norm.includes('servicio') || norm.includes('abonado') || norm.includes('linea') || norm.includes('telefono')) {
      if (servicioIdx === -1) servicioIdx = idx;
    }
    if (norm.includes('central') || norm.includes('telefonica')) {
      if (centralIdx === -1) centralIdx = idx;
    }
    if (norm.includes('grupo') || norm.includes('brigada') || norm.includes('tecnico')) {
      if (grupoIdx === -1) grupoIdx = idx;
    }
    if (norm.includes('cable')) {
      if (cableIdx === -1) cableIdx = idx;
    }
    if (norm.includes('fecha') || norm.includes('reporte')) {
      if (fechaIdx === -1) fechaIdx = idx;
    }
  });

  // Fallbacks if header names differ
  if (servicioIdx === -1) servicioIdx = 0;
  if (centralIdx === -1) centralIdx = Math.min(1, rawHeaders.length - 1);
  if (grupoIdx === -1) grupoIdx = Math.min(2, rawHeaders.length - 1);
  if (cableIdx === -1) cableIdx = Math.min(3, rawHeaders.length - 1);
  if (fechaIdx === -1) fechaIdx = Math.min(4, rawHeaders.length - 1);

  // Map to hold consolidated rows by SERVICIO
  const consolidatedMap: Map<string, IpCableRow> = new Map();

  const dataRows = rawMatrix.slice(4); // Rows starting from 5th row
  let rowCounter = 0;

  dataRows.forEach((row, rowIdx) => {
    if (!row || row.length === 0) return;

    // Check if entire row is empty
    const hasAnyContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (!hasAnyContent) return;

    rowCounter++;

    const rawServicio = row[servicioIdx] !== undefined ? String(row[servicioIdx]).trim() : `SRV-${rowIdx + 1}`;
    const rawCentral = row[centralIdx] !== undefined ? String(row[centralIdx]).trim() : 'CENTRAL GENERAL';
    const rawGrupo = row[grupoIdx] !== undefined ? String(row[grupoIdx]).trim() : 'GRUPO GENERAL';
    const rawCable = row[cableIdx] !== undefined ? String(row[cableIdx]).trim() : 'CABLE SIN NOMBRE';
    const rawFecha = row[fechaIdx] !== undefined ? row[fechaIdx] : new Date();

    const normalizedFecha = normalizeDateStr(rawFecha);
    const key = rawServicio.toUpperCase() || `NO_SERVICE_${rowIdx}`;

    // Extract dynamic raw object for full detail
    const rowObj: Record<string, any> = {};
    rawHeaders.forEach((h, i) => {
      if (h) rowObj[h] = row[i] !== undefined ? row[i] : '';
    });

    const classification = classifyNetworkType(rawCable, rawCentral, rules);

    if (consolidatedMap.has(key)) {
      // Merge with existing consolidated row without duplicating values
      const existing = consolidatedMap.get(key)!;
      existing.count += 1;

      // Merge Central if missing
      if (!existing.central && rawCentral) existing.central = rawCentral;

      // Merge Grupo if missing or append unique
      if (rawGrupo && !existing.grupo.includes(rawGrupo)) {
        existing.grupo = `${existing.grupo} / ${rawGrupo}`;
      }

      // Merge Cable if missing or append unique
      if (rawCable && !existing.cable.includes(rawCable)) {
        existing.cable = `${existing.cable} / ${rawCable}`;
      }

      if (existing.combinedDetails) {
        existing.combinedDetails.push(`Fila ${rowIdx + 5}: Central=${rawCentral}, Cable=${rawCable}, Grupo=${rawGrupo}`);
      }
    } else {
      // New consolidated entry
      consolidatedMap.set(key, {
        id: `ip_row_${rowIdx}_${Date.now()}`,
        servicio: rawServicio || `SRV-${rowIdx + 1}`,
        central: rawCentral || 'SIN CENTRAL',
        grupo: rawGrupo || 'SIN GRUPO',
        cable: rawCable || 'SIN CABLE',
        fechaReporte: normalizedFecha,
        rawRowData: rowObj,
        networkType: classification.networkType,
        networkTypeLabel: classification.networkTypeLabel,
        count: 1,
        combinedDetails: [`Fila ${rowIdx + 5}: Central=${rawCentral}, Cable=${rawCable}, Grupo=${rawGrupo}`]
      });
    }
  });

  const consolidatedRows = Array.from(consolidatedMap.values());

  // Extract unique metadata
  const uniqueCentralesSet = new Set<string>();
  const uniqueGroupsSet = new Set<string>();
  const uniqueCablesSet = new Set<string>();
  const monthYearSet = new Map<string, { year: number; month: number; label: string }>();

  consolidatedRows.forEach(r => {
    if (r.central) uniqueCentralesSet.add(r.central);
    if (r.grupo) {
      r.grupo.split('/').forEach(g => uniqueGroupsSet.add(g.trim()));
    }
    if (r.cable) {
      r.cable.split('/').forEach(c => uniqueCablesSet.add(c.trim()));
    }

    if (r.fechaReporte && r.fechaReporte.length >= 7) {
      const parts = r.fechaReporte.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        const key = `${y}-${m}`;
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        monthYearSet.set(key, { year: y, month: m, label: `${monthNames[m - 1]} ${y}` });
      }
    }
  });

  return {
    totalRowsRead: rowCounter,
    totalHeaderCols: rawHeaders.length,
    headers: rawHeaders,
    consolidatedRows,
    uniqueServicesCount: consolidatedRows.length,
    uniqueCentrales: Array.from(uniqueCentralesSet).sort(),
    uniqueGroups: Array.from(uniqueGroupsSet).sort(),
    uniqueCables: Array.from(uniqueCablesSet).sort(),
    uniqueMonthsYears: Array.from(monthYearSet.values()).sort((a, b) => b.year - a.year || b.month - a.month),
    parseDate: new Date().toISOString(),
    fileName: file.name
  };
}

/**
 * Generates initial sample dataset for demonstration if no file is uploaded yet
 */
export function generateSampleIpCablesData(rules: CableClassificationRules): IpCableExcelParseResult {
  const sampleDataRaw = [
    { srv: 'SER-10023', cnt: 'CTA SE', grp: 'BRIGADA NORTE 1', cbl: 'CR-101', fch: '2026-08-01' },
    { srv: 'SER-10023', cnt: 'CTA SE', grp: 'BRIGADA NORTE 1', cbl: 'CR-101', fch: '2026-08-01' }, // Repeat for consolidation test
    { srv: 'SER-10024', cnt: 'CTA SE', grp: 'BRIGADA NORTE 2', cbl: 'CR-102', fch: '2026-08-02' },
    { srv: 'SER-10025', cnt: 'PLAZA NORTE', grp: 'BRIGADA NORTE 1', cbl: 'CF-201', fch: '2026-08-03' },
    { srv: 'SER-10026', cnt: 'PLAZA NORTE', grp: 'BRIGADA SUR 1', cbl: 'CF-202', fch: '2026-08-04' },
    { srv: 'SER-10027', cnt: 'CENTRAL SUR', grp: 'BRIGADA SUR 1', cbl: 'CABLE-05', fch: '2026-08-05' },
    { srv: 'SER-10028', cnt: 'CENTRAL SUR', grp: 'BRIGADA SUR 2', cbl: 'OUT-301', fch: '2026-08-06' },
    { srv: 'SER-10029', cnt: 'CORE CENTRAL', grp: 'NOC CORE', cbl: 'CR-103', fch: '2026-08-07' },
    { srv: 'SER-10030', cnt: 'CORE CENTRAL', grp: 'NOC CORE', cbl: 'CF-203', fch: '2026-08-08' },
    { srv: 'SER-10031', cnt: 'OUTDOOR EXT-1', grp: 'BRIGADA EXTERIOR', cbl: 'CAB-EXT', fch: '2026-08-09' }
  ];

  const map = new Map<string, IpCableRow>();

  sampleDataRaw.forEach((item, idx) => {
    const classification = classifyNetworkType(item.cbl, item.cnt, rules);
    if (map.has(item.srv)) {
      const existing = map.get(item.srv)!;
      existing.count += 1;
    } else {
      map.set(item.srv, {
        id: `sample_${idx}`,
        servicio: item.srv,
        central: item.cnt,
        grupo: item.grp,
        cable: item.cbl,
        fechaReporte: item.fch,
        rawRowData: { SERVICIO: item.srv, CENTRAL: item.cnt, GRUPO: item.grp, CABLE: item.cbl, FECHA: item.fch },
        networkType: classification.networkType,
        networkTypeLabel: classification.networkTypeLabel,
        count: 1
      });
    }
  });

  const consolidatedRows = Array.from(map.values());

  return {
    totalRowsRead: sampleDataRaw.length,
    totalHeaderCols: 5,
    headers: ['SERVICIO', 'CENTRAL TELEFÓNICA', 'GRUPO', 'CABLE', 'FECHA REPORTE'],
    consolidatedRows,
    uniqueServicesCount: consolidatedRows.length,
    uniqueCentrales: ['CENTRAL SUR', 'CORE CENTRAL', 'CTA SE', 'OUTDOOR EXT-1', 'PLAZA NORTE'],
    uniqueGroups: ['BRIGADA EXTERIOR', 'BRIGADA NORTE 1', 'BRIGADA NORTE 2', 'BRIGADA SUR 1', 'BRIGADA SUR 2', 'NOC CORE'],
    uniqueCables: ['CAB-EXT', 'CABLE-05', 'CF-201', 'CF-202', 'CF-203', 'CR-101', 'CR-102', 'CR-103', 'OUT-301'],
    uniqueMonthsYears: [{ year: 2026, month: 8, label: 'Agosto 2026' }],
    parseDate: new Date().toISOString(),
    fileName: 'Muestra_Consolidada_IP_Cables.xlsx'
  };
}
