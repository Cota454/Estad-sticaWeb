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
 * Cleans a cable string, removing surrounding parentheses if any
 */
export function cleanCableName(str: any): string {
  if (str === null || str === undefined) return '';
  let s = String(str).trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Checks if a cable pattern matches an item's Cable P or Cable S
 * Supports exact matches, substrings, letters, numbers, and inner parenthesis patterns.
 */
export function matchCableInItem(item: IpCableRow, targetPattern: string): boolean {
  const targetClean = cleanCableName(targetPattern).toUpperCase();
  if (!targetClean) return false;

  const cableValues = [
    item.cableP,
    item.cableS,
    item.cable
  ].filter(Boolean) as string[];

  for (const rawVal of cableValues) {
    if (!rawVal) continue;

    // Check each sub-cable if split by '/'
    const subCables = rawVal.split('/').map(c => cleanCableName(c).toUpperCase());

    for (const c of subCables) {
      if (!c) continue;

      // 1. Direct equality
      if (c === targetClean) return true;

      // 2. Substring match
      if (c.includes(targetClean) || targetClean.includes(c)) return true;

      // 3. Extract contents inside parentheses, e.g. "CABLE A (C12)" -> inside = "C12"
      const parenMatches = c.match(/\(([^)]+)\)/g);
      if (parenMatches) {
        for (const pm of parenMatches) {
          const inside = cleanCableName(pm.replace(/[()]/g, '')).toUpperCase();
          if (inside === targetClean || inside.includes(targetClean) || targetClean.includes(inside)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Classifies a row into Red Rígida, Red Flexible, Outdoor, or Other
 * Evaluates both Cable P and Cable S
 */
export function classifyNetworkType(
  cablePVal: string,
  cableSVal: string,
  centralVal: string,
  rules: CableClassificationRules
): { networkType: 'rigida' | 'flexible' | 'outdoor' | 'other'; networkTypeLabel: string } {
  const normCableP = cleanCableName(cablePVal).toUpperCase();
  const normCableS = cleanCableName(cableSVal).toUpperCase();
  const normCentral = (centralVal || '').toString().trim().toUpperCase();

  // 1. Check Red Rígida (Matches in rules.rigidaCables against Cable P or Cable S)
  const isRigida = rules.rigidaCables.some(r => {
    const rawPatterns = r.toString().split(',');
    return rawPatterns.some(p => {
      const target = cleanCableName(p).toUpperCase();
      if (!target) return false;
      return (
        (normCableP && (normCableP === target || normCableP.includes(target) || target.includes(normCableP))) ||
        (normCableS && (normCableS === target || normCableS.includes(target) || target.includes(normCableS)))
      );
    });
  });

  if (isRigida) {
    return { networkType: 'rigida', networkTypeLabel: 'Red Rígida' };
  }

  // 2. Check Red Flexible (Matches in rules.flexibleRules against Cable P or Cable S)
  const flexibleRuleMatch = rules.flexibleRules.find(rule => {
    const rawPatterns = (rule.pattern || '').toString().split(',');
    return rawPatterns.some(p => {
      const pat = cleanCableName(p).toUpperCase();
      if (!pat) return false;
      return (normCableP && normCableP.includes(pat)) || (normCableS && normCableS.includes(pat));
    });
  });

  if (flexibleRuleMatch) {
    return {
      networkType: 'flexible',
      networkTypeLabel: `Red Flexible (${flexibleRuleMatch.assignedName || flexibleRuleMatch.pattern})`
    };
  }

  // 3. Check Outdoor (Matches in rules.outdoorRules against Central)
  const outdoorRuleMatch = rules.outdoorRules.find(rule => {
    const rawPatterns = (rule.centralPattern || '').toString().split(',');
    return rawPatterns.some(p => {
      const pat = cleanCableName(p).toUpperCase();
      return pat && normCentral.includes(pat);
    });
  });

  if (outdoorRuleMatch) {
    return {
      networkType: 'outdoor',
      networkTypeLabel: `Outdoor (${outdoorRuleMatch.assignedName || outdoorRuleMatch.centralPattern})`
    };
  }

  // If Cable S exists, treat as Flexible network by default
  if (normCableS) {
    return { networkType: 'flexible', networkTypeLabel: 'Red Flexible (Secundario)' };
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
  let fechaIdx = -1;

  const cableIndices: number[] = [];
  const parIndices: number[] = [];

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
      cableIndices.push(idx);
    }
    if (norm.includes('par')) {
      parIndices.push(idx);
    }
    if (norm.includes('fecha') || norm.includes('reporte')) {
      if (fechaIdx === -1) fechaIdx = idx;
    }
  });

  // Assign double column labels for Cable and Par if present
  if (cableIndices.length > 0) rawHeaders[cableIndices[0]] = 'Cable P';
  if (cableIndices.length > 1) rawHeaders[cableIndices[1]] = 'Cable S';
  if (parIndices.length > 0) rawHeaders[parIndices[0]] = 'Par P';
  if (parIndices.length > 1) rawHeaders[parIndices[1]] = 'Par S';

  const cablePIdx = cableIndices.length > 0 ? cableIndices[0] : -1;
  const cableSIdx = cableIndices.length > 1 ? cableIndices[1] : -1;
  const parPIdx = parIndices.length > 0 ? parIndices[0] : -1;
  const parSIdx = parIndices.length > 1 ? parIndices[1] : -1;

  // Fallbacks if header names differ
  if (servicioIdx === -1) servicioIdx = 0;
  if (centralIdx === -1) centralIdx = Math.min(1, rawHeaders.length - 1);
  if (grupoIdx === -1) grupoIdx = Math.min(2, rawHeaders.length - 1);
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

    const rawCableP = cablePIdx !== -1 && row[cablePIdx] !== undefined ? cleanCableName(row[cablePIdx]) : '';
    const rawCableS = cableSIdx !== -1 && row[cableSIdx] !== undefined ? cleanCableName(row[cableSIdx]) : '';
    const rawParP = parPIdx !== -1 && row[parPIdx] !== undefined ? String(row[parPIdx]).trim() : '';
    const rawParS = parSIdx !== -1 && row[parSIdx] !== undefined ? String(row[parSIdx]).trim() : '';

    const combinedCable = [rawCableP, rawCableS].filter(Boolean).join(' / ') || 'SIN CABLE';

    const rawFecha = row[fechaIdx] !== undefined ? row[fechaIdx] : new Date();
    const normalizedFecha = normalizeDateStr(rawFecha);
    const key = rawServicio.toUpperCase() || `NO_SERVICE_${rowIdx}`;

    // Extract dynamic raw object for full detail
    const rowObj: Record<string, any> = {};
    rawHeaders.forEach((h, i) => {
      if (h) rowObj[h] = row[i] !== undefined ? row[i] : '';
    });
    rowObj['Cable P'] = rawCableP;
    rowObj['Cable S'] = rawCableS;
    rowObj['Par P'] = rawParP;
    rowObj['Par S'] = rawParS;

    const classification = classifyNetworkType(rawCableP, rawCableS, rawCentral, rules);

    if (consolidatedMap.has(key)) {
      // Merge with existing consolidated row without duplicating values
      const existing = consolidatedMap.get(key)!;
      existing.count += 1;

      // Merge Central if missing or default
      if ((!existing.central || existing.central === 'SIN CENTRAL' || existing.central === 'CENTRAL GENERAL') && rawCentral && rawCentral !== 'CENTRAL GENERAL' && rawCentral !== 'SIN CENTRAL') {
        existing.central = rawCentral;
      } else if (rawCentral && rawCentral !== 'CENTRAL GENERAL' && rawCentral !== 'SIN CENTRAL' && existing.central && !existing.central.includes(rawCentral)) {
        existing.central = `${existing.central} / ${rawCentral}`;
      }

      // Merge Grupo if missing or append unique
      if (!existing.grupo || existing.grupo === 'SIN GRUPO' || existing.grupo === 'GRUPO GENERAL') {
        if (rawGrupo && rawGrupo !== 'GRUPO GENERAL' && rawGrupo !== 'SIN GRUPO') {
          existing.grupo = rawGrupo;
        }
      } else if (rawGrupo && rawGrupo !== 'GRUPO GENERAL' && rawGrupo !== 'SIN GRUPO' && !existing.grupo.includes(rawGrupo)) {
        existing.grupo = `${existing.grupo} / ${rawGrupo}`;
      }

      // Merge Cable P / S if missing or append unique
      if (rawCableP && existing.cableP && !existing.cableP.includes(rawCableP)) {
        existing.cableP = `${existing.cableP} / ${rawCableP}`;
      } else if (rawCableP && !existing.cableP) {
        existing.cableP = rawCableP;
      }

      if (rawCableS && existing.cableS && !existing.cableS.includes(rawCableS)) {
        existing.cableS = `${existing.cableS} / ${rawCableS}`;
      } else if (rawCableS && !existing.cableS) {
        existing.cableS = rawCableS;
      }

      if (rawParP && existing.parP && !existing.parP.includes(rawParP)) {
        existing.parP = `${existing.parP} / ${rawParP}`;
      } else if (rawParP && !existing.parP) {
        existing.parP = rawParP;
      }

      if (rawParS && existing.parS && !existing.parS.includes(rawParS)) {
        existing.parS = `${existing.parS} / ${rawParS}`;
      } else if (rawParS && !existing.parS) {
        existing.parS = rawParS;
      }

      existing.cable = [existing.cableP, existing.cableS].filter(Boolean).join(' / ') || 'SIN CABLE';

      // Re-evaluate network classification with merged cables and central
      const updatedClassification = classifyNetworkType(existing.cableP || '', existing.cableS || '', existing.central || '', rules);
      existing.networkType = updatedClassification.networkType;
      existing.networkTypeLabel = updatedClassification.networkTypeLabel;

      // Merge rawRowData across all Excel columns
      if (!existing.rawRowData) {
        existing.rawRowData = {};
      }
      rawHeaders.forEach(h => {
        if (!h) return;
        const newCellVal = rowObj[h] !== undefined && rowObj[h] !== null ? String(rowObj[h]).trim() : '';
        const existingCellVal = existing.rawRowData[h] !== undefined && existing.rawRowData[h] !== null ? String(existing.rawRowData[h]).trim() : '';

        if (!existingCellVal && newCellVal) {
          // Fill empty cell with data from duplicate row
          existing.rawRowData[h] = newCellVal;
        } else if (existingCellVal && newCellVal && existingCellVal !== newCellVal) {
          // Combine distinct values cleanly
          const parts = existingCellVal.split('/').map(p => p.trim());
          if (!parts.includes(newCellVal)) {
            existing.rawRowData[h] = `${existingCellVal} / ${newCellVal}`;
          }
        }
      });

      // Keep key headers synced in rawRowData
      existing.rawRowData['Cable P'] = existing.cableP;
      existing.rawRowData['Cable S'] = existing.cableS;
      existing.rawRowData['Par P'] = existing.parP;
      existing.rawRowData['Par S'] = existing.parS;
      if (existing.central) existing.rawRowData['CENTRAL'] = existing.central;
      if (existing.grupo) existing.rawRowData['GRUPO'] = existing.grupo;

      if (existing.combinedDetails) {
        existing.combinedDetails.push(`Fila ${rowIdx + 5}: Central=${rawCentral}, Cable P=${rawCableP}, Cable S=${rawCableS}, Grupo=${rawGrupo}`);
      }
    } else {
      // New consolidated entry
      consolidatedMap.set(key, {
        id: `ip_row_${rowIdx}_${Date.now()}`,
        servicio: rawServicio || `SRV-${rowIdx + 1}`,
        central: rawCentral || 'SIN CENTRAL',
        grupo: rawGrupo || 'SIN GRUPO',
        cable: combinedCable,
        cableP: rawCableP,
        parP: rawParP,
        cableS: rawCableS,
        parS: rawParS,
        fechaReporte: normalizedFecha,
        rawRowData: rowObj,
        networkType: classification.networkType,
        networkTypeLabel: classification.networkTypeLabel,
        count: 1,
        combinedDetails: [`Fila ${rowIdx + 5}: Central=${rawCentral}, Cable P=${rawCableP}, Cable S=${rawCableS}, Grupo=${rawGrupo}`]
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
    { srv: 'SER-10023', cnt: 'CTA SE', grp: 'BRIGADA NORTE 1', cblP: 'CR-101', parP: '12', cblS: 'CS-01', parS: '45', fch: '2026-08-01' },
    { srv: 'SER-10023', cnt: 'CTA SE', grp: 'BRIGADA NORTE 1', cblP: 'CR-101', parP: '12', cblS: 'CS-01', parS: '45', fch: '2026-08-01' }, // Repeat for consolidation test
    { srv: 'SER-10024', cnt: 'CTA SE', grp: 'BRIGADA NORTE 2', cblP: 'CR-102', parP: '18', cblS: 'CS-02', parS: '50', fch: '2026-08-02' },
    { srv: 'SER-10025', cnt: 'PLAZA NORTE', grp: 'BRIGADA NORTE 1', cblP: 'CF-201', parP: '04', cblS: '', parS: '', fch: '2026-08-03' },
    { srv: 'SER-10026', cnt: 'PLAZA NORTE', grp: 'BRIGADA SUR 1', cblP: 'CF-202', parP: '33', cblS: 'CS-05', parS: '11', fch: '2026-08-04' },
    { srv: 'SER-10027', cnt: 'CENTRAL SUR', grp: 'BRIGADA SUR 1', cblP: 'CABLE-05', parP: '10', cblS: '', parS: '', fch: '2026-08-05' },
    { srv: 'SER-10028', cnt: 'CENTRAL SUR', grp: 'BRIGADA SUR 2', cblP: 'OUT-301', parP: '01', cblS: 'CS-09', parS: '88', fch: '2026-08-06' },
    { srv: 'SER-10029', cnt: 'CORE CENTRAL', grp: 'NOC CORE', cblP: 'CR-103', parP: '15', cblS: '', parS: '', fch: '2026-08-07' },
    { srv: 'SER-10030', cnt: 'CORE CENTRAL', grp: 'NOC CORE', cblP: 'CF-203', parP: '22', cblS: 'CS-10', parS: '03', fch: '2026-08-08' },
    { srv: 'SER-10031', cnt: 'OUTDOOR EXT-1', grp: 'BRIGADA EXTERIOR', cblP: 'CAB-EXT', parP: '09', cblS: '', parS: '', fch: '2026-08-09' }
  ];

  const map = new Map<string, IpCableRow>();

  sampleDataRaw.forEach((item, idx) => {
    const classification = classifyNetworkType(item.cblP, item.cblS, item.cnt, rules);
    const combinedCable = [item.cblP, item.cblS].filter(Boolean).join(' / ') || 'SIN CABLE';

    if (map.has(item.srv)) {
      const existing = map.get(item.srv)!;
      existing.count += 1;
    } else {
      map.set(item.srv, {
        id: `sample_${idx}`,
        servicio: item.srv,
        central: item.cnt,
        grupo: item.grp,
        cable: combinedCable,
        cableP: item.cblP,
        parP: item.parP,
        cableS: item.cblS,
        parS: item.parS,
        fechaReporte: item.fch,
        rawRowData: {
          SERVICIO: item.srv,
          CENTRAL: item.cnt,
          GRUPO: item.grp,
          'Cable P': item.cblP,
          'Par P': item.parP,
          'Cable S': item.cblS,
          'Par S': item.parS,
          FECHA: item.fch
        },
        networkType: classification.networkType,
        networkTypeLabel: classification.networkTypeLabel,
        count: 1
      });
    }
  });

  const consolidatedRows = Array.from(map.values());

  return {
    totalRowsRead: sampleDataRaw.length,
    totalHeaderCols: 7,
    headers: ['SERVICIO', 'CENTRAL TELEFÓNICA', 'GRUPO', 'Cable P', 'Par P', 'Cable S', 'Par S', 'FECHA REPORTE'],
    consolidatedRows,
    uniqueServicesCount: consolidatedRows.length,
    uniqueCentrales: ['CENTRAL SUR', 'CORE CENTRAL', 'CTA SE', 'OUTDOOR EXT-1', 'PLAZA NORTE'],
    uniqueGroups: ['BRIGADA EXTERIOR', 'BRIGADA NORTE 1', 'BRIGADA NORTE 2', 'BRIGADA SUR 1', 'BRIGADA SUR 2', 'NOC CORE'],
    uniqueCables: ['CAB-EXT', 'CABLE-05', 'CF-201', 'CF-202', 'CF-203', 'CR-101', 'CR-102', 'CR-103', 'CS-01', 'CS-02', 'CS-05', 'CS-09', 'CS-10', 'OUT-301'],
    uniqueMonthsYears: [{ year: 2026, month: 8, label: 'Agosto 2026' }],
    parseDate: new Date().toISOString(),
    fileName: 'Muestra_Consolidada_IP_Cables.xlsx'
  };
}
