import * as XLSX from 'xlsx-js-style';
import Papa from 'papaparse';
import { IpCableRow, IpCableExcelParseResult, CableClassificationRules, ZoneConfig } from '../types/ipCablesTypes';

/**
 * Calculates delay in days from item raw data or fechaReporte
 */
export function getDemoraDays(item: IpCableRow): number {
  if (item.rawRowData) {
    for (const key of Object.keys(item.rawRowData)) {
      const k = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (k.includes('demora') || k.includes('dias')) {
        const val = item.rawRowData[key];
        if (val !== undefined && val !== null && val !== '') {
          const num = parseInt(String(val).trim(), 10);
          if (!isNaN(num)) return Math.max(0, num);
        }
      }
    }
  }

  // Fallback to fechaReporte
  if (item.fechaReporte) {
    const reportDate = new Date(item.fechaReporte);
    if (!isNaN(reportDate.getTime())) {
      const now = new Date();
      const d1 = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
      const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffMs = d2.getTime() - d1.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  return 0;
}

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
 * Checks if a specific cable string contains an exact match for targetPattern.
 * Strictly checks full equality or isolated token equality, without allowing partial substring matches.
 */
export function isCableExactMatch(cableString: string, targetPattern: string): boolean {
  if (!cableString || !targetPattern) return false;
  const targetClean = cleanCableName(targetPattern).trim().toUpperCase();
  if (!targetClean) return false;

  // Split by common cable delimiters: '/', ',', ';', '|', and newlines
  const subTokens = String(cableString).split(/[\/,;|\r\n]+/).map(s => s.trim()).filter(Boolean);

  for (const rawToken of subTokens) {
    const cleanToken = cleanCableName(rawToken).trim().toUpperCase();
    if (!cleanToken) continue;

    // 1. Direct exact equality
    if (cleanToken === targetClean) return true;

    // 2. Exact match when removing parenthetical annotations, e.g. "CR-101 (PAR 20)" -> "CR-101"
    const withoutParens = cleanCableName(cleanToken.replace(/\s*\([^)]*\)/g, '')).trim().toUpperCase();
    if (withoutParens && withoutParens === targetClean) return true;

    // 3. Exact match when removing bracket annotations, e.g. "CR-101 [PAR 20]" -> "CR-101"
    const withoutBrackets = cleanCableName(cleanToken.replace(/\s*\[[^\]]*\]/g, '')).trim().toUpperCase();
    if (withoutBrackets && withoutBrackets === targetClean) return true;

    // 4. Exact match with contents inside parentheses, e.g. "CABLE GENERAL (CR-101)" -> inside = "CR-101"
    const parenMatches = cleanToken.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const inside = cleanCableName(pm.replace(/[()]/g, '')).trim().toUpperCase();
        if (inside === targetClean) {
          return true;
        }
      }
    }

    // 5. Exact match with contents inside brackets
    const bracketMatches = cleanToken.match(/\[([^\]]+)\]/g);
    if (bracketMatches) {
      for (const bm of bracketMatches) {
        const inside = cleanCableName(bm.replace(/[\[\]]/g, '')).trim().toUpperCase();
        if (inside === targetClean) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Checks if a cable pattern matches an item's Cable P, Cable S, or Cable strictly/exactly.
 */
export function matchCableInItemExact(item: IpCableRow, targetPattern: string): boolean {
  if (!item || !targetPattern) return false;
  const targetClean = cleanCableName(targetPattern).trim().toUpperCase();
  if (!targetClean) return false;

  const cableValues = [
    item.cableP,
    item.cableS,
    item.cable,
    item.rawRowData?.['Cable P'],
    item.rawRowData?.['Cable S'],
    item.rawRowData?.['Cable'],
    item.rawRowData?.['CABLE'],
    item.rawRowData?.['CABLE P'],
    item.rawRowData?.['CABLE S']
  ].filter(Boolean) as string[];

  for (const rawVal of cableValues) {
    if (isCableExactMatch(rawVal, targetClean)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts the Terminal value from an item's rawRowData looking for Terminal column aliases.
 * Handles uppercase, lowercase, with/without accent (TERMINAL, Terminal, Términal, etc.)
 */
export function extractTerminalFromItem(item: IpCableRow): string {
  if (!item || !item.rawRowData) return '';
  const raw = item.rawRowData;
  const keys = Object.keys(raw);
  
  // Direct exact match
  const exactKey = keys.find(k => {
    const norm = normalizeHeader(k);
    return norm === 'terminal' || norm === 'term' || norm === 'cajaterminal' || norm === 'caja';
  });
  if (exactKey && raw[exactKey] !== undefined && raw[exactKey] !== null && String(raw[exactKey]).trim() !== '') {
    return String(raw[exactKey]).trim();
  }

  // Alias / partial matches
  const aliasKey = keys.find(k => {
    const norm = normalizeHeader(k);
    return norm.includes('terminal');
  });

  if (aliasKey && raw[aliasKey] !== undefined && raw[aliasKey] !== null && String(raw[aliasKey]).trim() !== '') {
    return String(raw[aliasKey]).trim();
  }

  return '';
}

/**
 * Extracts the Dirección value from an item's rawRowData looking for Direccion column aliases.
 * Handles uppercase, lowercase, with/without accent (DIRECCION, Dirección, etc.)
 */
export function extractDireccionFromItem(item: IpCableRow): string {
  if (!item || !item.rawRowData) return '';
  const raw = item.rawRowData;
  const keys = Object.keys(raw);

  // Exact normalized matches
  const exactKey = keys.find(k => {
    const norm = normalizeHeader(k);
    return norm === 'direccion' || norm === 'dir' || norm === 'domicilio' || norm === 'ubicacion';
  });
  if (exactKey && raw[exactKey] !== undefined && raw[exactKey] !== null && String(raw[exactKey]).trim() !== '') {
    return String(raw[exactKey]).trim();
  }

  // Partial / alias matches
  const partialKey = keys.find(k => {
    const norm = normalizeHeader(k);
    return (norm.includes('direccion') || norm.includes('domicilio') || norm.includes('ubicacion')) && !norm.includes('ip');
  });
  if (partialKey && raw[partialKey] !== undefined && raw[partialKey] !== null && String(raw[partialKey]).trim() !== '') {
    return String(raw[partialKey]).trim();
  }

  return '';
}

/**
 * Extracts the Teléfono value from an item's rawRowData.
 */
export function extractTelefonoFromItem(item: IpCableRow): string {
  if (!item) return '';
  if (item.rawRowData) {
    const raw = item.rawRowData;
    const keys = Object.keys(raw);

    // Exact matching aliases
    const exactKey = keys.find(k => {
      const norm = normalizeHeader(k);
      return norm === 'telefono' || norm === 'tel' || norm === 'servicio' || norm === 'linea' || norm === 'numero';
    });
    if (exactKey && raw[exactKey] !== undefined && raw[exactKey] !== null && String(raw[exactKey]).trim() !== '') {
      return String(raw[exactKey]).trim();
    }

    // Partial matching aliases
    const partialKey = keys.find(k => {
      const norm = normalizeHeader(k);
      return (norm.includes('telefono') || norm.includes('servicio') || norm.includes('abonado')) && !norm.includes('asoc');
    });
    if (partialKey && raw[partialKey] !== undefined && raw[partialKey] !== null && String(raw[partialKey]).trim() !== '') {
      return String(raw[partialKey]).trim();
    }
  }

  return item.servicio || '';
}

/**
 * Extracts the Asociado value from an item's rawRowData.
 */
export function extractAsociadoFromItem(item: IpCableRow): string {
  if (!item || !item.rawRowData) return '';
  const raw = item.rawRowData;
  const keys = Object.keys(raw);

  const key = keys.find(k => {
    const norm = normalizeHeader(k);
    return norm === 'asociado' || norm === 'telasoc' || norm === 'telefonoasociado' || norm === 'servicioasociado' ||
      norm === 'asoc' || norm.includes('asociado') || norm.includes('asoc');
  });

  if (key && raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
    const val = String(raw[key]).trim();
    const upper = val.toUpperCase();
    if (['N/A', 'NA', 'SIN ASOCIADO', 'NINGUNO', 'NONE', '0', '-', 'S/A', 'SIN', 'NO'].includes(upper)) {
      return '';
    }
    return val;
  }

  return '';
}

export type TelefonoTypeFilter = 'all' | 'telefono' | 'txd_dato';

/**
 * Evaluates whether an item matches the Teléfono column filter:
 * - 'telefono': Only numbers in the Teléfono column (taking into account whitespace)
 * - 'txd_dato': At least one letter in the Teléfono column (taking into account whitespace)
 */
export function matchTelefonoTypeFilter(item: IpCableRow, filter: TelefonoTypeFilter): boolean {
  if (filter === 'all') return true;

  const rawTel = extractTelefonoFromItem(item);
  if (!rawTel) return false;

  const clean = rawTel.trim();
  if (!clean) return false;

  // Check if it has at least one letter (a-z, A-Z, accents)
  const hasLetters = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(clean);

  if (filter === 'txd_dato') {
    return hasLetters;
  }

  if (filter === 'telefono') {
    // Only numbers taking into account whitespace and phone separators
    const digitsOnly = clean.replace(/[\s\-\.\(\)\/]/g, '');
    const isNumeric = digitsOnly.length > 0 && /^\d+$/.test(digitsOnly);
    return isNumeric && !hasLetters;
  }

  return true;
}

/**
 * Optimizes dataset by comparing Teléfono and Asociado columns,
 * collapsing records that match / cross-reference into a single consolidated record.
 */
export function optimizeAndSimplifyRows(rows: IpCableRow[]): IpCableRow[] {
  if (!rows || rows.length <= 1) return rows;

  const parent = new Map<string, string>();

  const find = (i: string): string => {
    let root = i;
    while (parent.has(root) && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let curr = i;
    while (curr !== root) {
      const nxt = parent.get(curr) || curr;
      parent.set(curr, root);
      curr = nxt;
    }
    return root;
  };

  const union = (i: string, j: string) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent.set(rootI, rootJ);
    }
  };

  const cleanVal = (val: string): string => {
    if (!val) return '';
    return String(val).trim().toUpperCase();
  };

  // 1. Establish union-find sets between Teléfono and Asociado
  rows.forEach(item => {
    const tel = cleanVal(extractTelefonoFromItem(item));
    const asoc = cleanVal(extractAsociadoFromItem(item));

    if (tel) {
      if (!parent.has(tel)) parent.set(tel, tel);
    }
    if (asoc) {
      if (!parent.has(asoc)) parent.set(asoc, asoc);
    }
    if (tel && asoc) {
      union(tel, asoc);
    }
  });

  // 2. Group items by their canonical connected key
  const groups = new Map<string, IpCableRow>();

  rows.forEach(item => {
    const tel = cleanVal(extractTelefonoFromItem(item));
    const asoc = cleanVal(extractAsociadoFromItem(item));

    let key = '';
    if (tel) {
      key = find(tel);
    } else if (asoc) {
      key = find(asoc);
    } else {
      key = item.id || item.servicio;
    }

    if (!groups.has(key)) {
      groups.set(key, item);
    }
  });

  return Array.from(groups.values());
}

/**
 * Validates whether an item matches a specific Zone Cable Rule (evaluating both Cable and optional Terminal check)
 */
export function matchZoneCableRule(
  item: IpCableRow,
  rule: { cableName: string; matchTerminal?: boolean; terminals?: string[] }
): boolean {
  const cableMatches = matchCableInItemExact(item, rule.cableName);
  if (!cableMatches) return false;

  // If no terminal verification is required, matching the cable is sufficient
  if (!rule.matchTerminal || !rule.terminals || rule.terminals.length === 0) {
    return true;
  }

  // Terminal verification is active
  const itemTerminal = extractTerminalFromItem(item).toUpperCase();
  if (!itemTerminal) {
    // If the row doesn't have a terminal, it fails strict terminal filter
    return false;
  }

  const validTerminals = rule.terminals.map(t => t.trim().toUpperCase()).filter(Boolean);
  return validTerminals.some(t => {
    // Exact or substring match (e.g., "1210" matches "1210" or "T-1210")
    return itemTerminal === t || itemTerminal.includes(t) || t.includes(itemTerminal);
  });
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
): {
  networkType: 'rigida' | 'flexible' | 'outdoor' | 'other';
  networkTypeLabel: string;
  flexibleRuleId?: string;
  flexibleAssignedName?: string;
} {
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

  // 2. Check Red Flexible (Matches strictly against rules.flexibleRules defined in Ajustes de Cables)
  const flexibleRuleMatch = (rules.flexibleRules || []).find(rule => {
    const rawPatterns = (rule.pattern || '').toString().split(',');
    return rawPatterns.some(p => {
      const pat = cleanCableName(p).toUpperCase();
      if (!pat) return false;
      return (
        (normCableP && (normCableP === pat || isCableExactMatch(cablePVal, pat))) ||
        (normCableS && (normCableS === pat || isCableExactMatch(cableSVal, pat)))
      );
    });
  });

  if (flexibleRuleMatch) {
    const assigned = flexibleRuleMatch.assignedName || `Red Flexible (${flexibleRuleMatch.pattern})`;
    return {
      networkType: 'flexible',
      networkTypeLabel: assigned,
      flexibleRuleId: flexibleRuleMatch.id,
      flexibleAssignedName: assigned
    };
  }

  // 3. Check Outdoor (Matches in rules.outdoorRules against Central)
  const outdoorRuleMatch = (rules.outdoorRules || []).find(rule => {
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

  return { networkType: 'other', networkTypeLabel: 'Otra Red / General' };
}

/**
 * Exclusive, prioritized zone matching:
 * Step 1: If item's central belongs to a zone's centralNames, assign AUTOMATICALLY to that zone.
 * Step 2: If item's central is NOT in any zone, analyze strictly by Cable against zone cableNames (exact match).
 * Step 3: Returns null if no zone matched (Sin Zonificar).
 */
export function findMatchingZoneForItem(item: IpCableRow, zoneList: ZoneConfig[]): ZoneConfig | null {
  if (!item || !zoneList || zoneList.length === 0) return null;
  const itemCentral = (item.central || '').trim().toUpperCase();

  // STEP 1: Priority by Central Telefónica (EXACT match)
  if (itemCentral) {
    const centralParts = itemCentral.split('/').map(p => p.trim()).filter(Boolean);
    for (const z of zoneList) {
      const validCentralNames = (z.centralNames || []).map(cn => cn.trim().toUpperCase()).filter(Boolean);
      if (validCentralNames.length > 0) {
        const matchesCentral = validCentralNames.some(cn => {
          return centralParts.some(part => part === cn) || itemCentral === cn;
        });
        if (matchesCentral) {
          return z; // Automatically assigned to this zone by Central!
        }
      }
    }
  }

  // STEP 2: Priority by Cable and optional Terminal (only for services whose Central is not assigned to any zone)
  for (const z of zoneList) {
    // 2a. Check detailed cableRules if present
    if (z.cableRules && z.cableRules.length > 0) {
      const matchesDetailedRule = z.cableRules.some(rule => matchZoneCableRule(item, rule));
      if (matchesDetailedRule) {
        return z; // Assigned to this zone by Cable & Terminal!
      }
    }

    // 2b. Check simple cableNames (legacy or simple cable names without specific rules)
    const validCableNames = (z.cableNames || []).map(cb => cb.trim().toUpperCase()).filter(Boolean);
    if (validCableNames.length > 0) {
      const matchesCable = validCableNames.some(cb => matchCableInItemExact(item, cb));
      if (matchesCable) {
        return z; // Assigned to this zone by Cable!
      }
    }
  }

  // STEP 3: Unassigned (Sin Zonificar)
  return null;
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
      existing.flexibleRuleId = updatedClassification.flexibleRuleId;
      existing.flexibleAssignedName = updatedClassification.flexibleAssignedName;

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
        flexibleRuleId: classification.flexibleRuleId,
        flexibleAssignedName: classification.flexibleAssignedName,
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
    if (r.central) {
      r.central.split('/').forEach(c => {
        const trimmed = c.trim();
        if (trimmed) uniqueCentralesSet.add(trimmed);
      });
    }
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
    { srv: '72210023', cnt: 'CTA SE', grp: 'BRIGADA NORTE 1', cblP: 'CR-101', parP: '12', cblS: 'CS-01', parS: '45', fch: '2026-08-01', tel: '72210023', asoc: '' },
    { srv: '72210023', cnt: 'CTA SE', grp: 'BRIGADA NORTE 1', cblP: 'CR-101', parP: '12', cblS: 'CS-01', parS: '45', fch: '2026-08-01', tel: '72210023', asoc: '' }, // Repeat for consolidation test
    { srv: '72210024', cnt: 'CTA SE', grp: 'BRIGADA NORTE 2', cblP: 'CR-102', parP: '18', cblS: 'CS-02', parS: '50', fch: '2026-08-02', tel: '72210024', asoc: '' },
    { srv: '72210025', cnt: 'PLAZA NORTE', grp: 'BRIGADA NORTE 1', cblP: 'CF-201', parP: '04', cblS: '', parS: '', fch: '2026-08-03', tel: '72210025', asoc: '' },
    { srv: '72210026', cnt: 'PLAZA NORTE', grp: 'BRIGADA SUR 1', cblP: 'CF-202', parP: '33', cblS: 'CS-05', parS: '11', fch: '2026-08-04', tel: '72210026', asoc: '' },
    { srv: 'TXD-DAT-501', cnt: 'CENTRAL SUR', grp: 'BRIGADA SUR 1', cblP: 'CABLE-05', parP: '10', cblS: '', parS: '', fch: '2026-08-05', tel: 'TXD-501', asoc: '' },
    { srv: 'TXD-DAT-502', cnt: 'CENTRAL SUR', grp: 'BRIGADA SUR 2', cblP: 'OUT-301', parP: '01', cblS: 'CS-09', parS: '88', fch: '2026-08-06', tel: 'IP-DAT-502', asoc: '' },
    { srv: '72210029', cnt: 'CORE CENTRAL', grp: 'NOC CORE', cblP: 'CR-103', parP: '15', cblS: '', parS: '', fch: '2026-08-07', tel: '72210029', asoc: '' },
    { srv: 'TXD-CORP-901', cnt: 'CORE CENTRAL', grp: 'NOC CORE', cblP: 'CF-203', parP: '22', cblS: 'CS-10', parS: '03', fch: '2026-08-08', tel: 'TXD-CORP-901', asoc: '' },
    { srv: 'TXD-EXT-777', cnt: 'OUTDOOR EXT-1', grp: 'BRIGADA EXTERIOR', cblP: 'CAB-EXT', parP: '09', cblS: '', parS: '', fch: '2026-08-09', tel: 'DATO-EXT-777', asoc: '' }
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
          TELÉFONO: item.tel,
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
        flexibleRuleId: classification.flexibleRuleId,
        flexibleAssignedName: classification.flexibleAssignedName,
        count: 1
      });
    }
  });

  const consolidatedRows = Array.from(map.values());

  return {
    totalRowsRead: sampleDataRaw.length,
    totalHeaderCols: 8,
    headers: ['SERVICIO', 'TELÉFONO', 'CENTRAL TELEFÓNICA', 'GRUPO', 'Cable P', 'Par P', 'Cable S', 'Par S', 'FECHA REPORTE'],
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
