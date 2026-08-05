import * as XLSX from 'xlsx-js-style';
import Papa from 'papaparse';
import { Central, WorkGroup, DailyReport } from '../types';
import { isFutureDate, getTodayStr } from './dateUtils';

export interface ColumnMapping {
  folioColIndex: number;
  centralColIndex: number;
  groupColIndex: number;
  dateColIndex: number;
}

export interface ParsedFolioRecord {
  folio: string;
  rawCentral: string;
  matchedCentralId: string | null;
  matchedCentralName: string | null;
  rawGroup: string;
  matchedGroupId: string | null;
  matchedGroupName: string | null;
  rawDate: string;
  normalizedDate: string;
  isValidDate: boolean;
  isFuture: boolean;
  lineNum: number;
}

export interface ExcelImportAudit {
  totalRowsRead: number;
  validFoliosCount: number;
  uniqueDates: string[];
  unmatchedCentrales: string[];
  unmatchedGroups: string[];
  futureDatesDetected: string[];
  invalidDatesDetected: number;
  
  // Aggregated reports ready to be imported
  aggregatedReports: DailyReport[];
  
  // Clean records for detailed table view
  records: ParsedFolioRecord[];
  
  // Suggested auto-creations
  suggestedCentralesToCreate: Central[];
  suggestedGroupsToCreate: WorkGroup[];
}

/**
 * Normalizes strings for flexible comparison
 */
function normalize(str: string): string {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Robustly normalizes raw dates into YYYY-MM-DD
 */
export function normalizeDateString(rawVal: any, defaultFallbackDate: string): { dateStr: string; isValid: boolean } {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return { dateStr: defaultFallbackDate, isValid: true };
  }

  if (rawVal instanceof Date) {
    if (!isNaN(rawVal.getTime())) {
      const yyyy = rawVal.getFullYear();
      const mm = String(rawVal.getMonth() + 1).padStart(2, '0');
      const dd = String(rawVal.getDate()).padStart(2, '0');
      return { dateStr: `${yyyy}-${mm}-${dd}`, isValid: true };
    }
  }

  const strVal = String(rawVal).trim();
  if (!strVal) return { dateStr: defaultFallbackDate, isValid: true };

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(strVal)) {
    const parts = strVal.split(/[\/\-\.]/);
    const yyyy = parts[0];
    const mm = String(parseInt(parts[1], 10)).padStart(2, '0');
    const dd = String(parseInt(parts[2], 10)).padStart(2, '0');
    return { dateStr: `${yyyy}-${mm}-${dd}`, isValid: true };
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = strVal.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return { dateStr: `${yyyy}-${mm}-${dd}`, isValid: true };
  }

  // Excel numeric date
  const num = Number(strVal);
  if (!isNaN(num) && num > 20000 && num < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const targetDate = new Date(excelEpoch.getTime() + num * 86400000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return { dateStr: `${yyyy}-${mm}-${dd}`, isValid: true };
  }

  return { dateStr: defaultFallbackDate, isValid: false };
}

/**
 * Auto-detects column indices from header array
 */
export function detectColumnIndices(headers: string[]): ColumnMapping {
  let folioColIndex = -1;
  let centralColIndex = -1;
  let groupColIndex = -1;
  let dateColIndex = -1;

  headers.forEach((h, idx) => {
    const cleanH = normalize(h);
    if (!cleanH) return;

    // Folio detection
    if (folioColIndex === -1 && (
      cleanH.includes('folio') || cleanH.includes('ticket') || cleanH.includes('id') ||
      cleanH.includes('num') || cleanH.includes('reporte') || cleanH.includes('incidencia')
    )) {
      folioColIndex = idx;
    }

    // Central detection
    if (centralColIndex === -1 && (
      cleanH.includes('central') || cleanH.includes('nodo') || cleanH.includes('sitio') ||
      cleanH.includes('ubicacion') || cleanH.includes('telefonia') || cleanH.includes('centrales')
    )) {
      centralColIndex = idx;
    }

    // Group detection
    if (groupColIndex === -1 && (
      cleanH.includes('grupo') || cleanH.includes('area') || cleanH.includes('especialidad') ||
      cleanH.includes('equipo') || cleanH.includes('gti') || cleanH.includes('codigo')
    )) {
      groupColIndex = idx;
    }

    // Date detection
    if (dateColIndex === -1 && (
      cleanH.includes('fecha') || cleanH.includes('date') || cleanH.includes('dia')
    )) {
      dateColIndex = idx;
    }
  });

  // Fallbacks if not detected by keywords
  if (folioColIndex === -1) folioColIndex = 0;
  if (groupColIndex === -1) groupColIndex = headers.length > 1 ? 1 : 0;
  if (centralColIndex === -1) centralColIndex = headers.length > 2 ? 2 : 0;
  if (dateColIndex === -1) dateColIndex = headers.length > 3 ? 3 : -1;

  return { folioColIndex, centralColIndex, groupColIndex, dateColIndex };
}

/**
 * Finds matching Central by code, name or fuzzy string
 */
export function matchCentral(rawName: string, centrales: Central[]): Central | null {
  if (!rawName) return null;
  const targetNorm = normalize(rawName);
  if (!targetNorm) return null;

  // 1. Exact match by code or name
  let found = centrales.find(
    c => normalize(c.code) === targetNorm || normalize(c.name) === targetNorm
  );
  if (found) return found;

  // 2. Contains match
  found = centrales.find(
    c => targetNorm.includes(normalize(c.name)) || normalize(c.name).includes(targetNorm)
  );
  if (found) return found;

  // 3. Match code prefix/suffix
  found = centrales.find(
    c => targetNorm.startsWith(normalize(c.code)) || targetNorm.includes(normalize(c.code))
  );

  return found || null;
}

/**
 * Finds matching WorkGroup by code, name or fuzzy string
 */
export function matchWorkGroup(rawName: string, workGroups: WorkGroup[]): WorkGroup | null {
  if (!rawName) return null;
  const targetNorm = normalize(rawName);
  if (!targetNorm) return null;

  // 1. Exact match by code or name
  let found = workGroups.find(
    g => normalize(g.code) === targetNorm || normalize(g.name) === targetNorm
  );
  if (found) return found;

  // 2. Contains match
  found = workGroups.find(
    g => targetNorm.includes(normalize(g.code)) || targetNorm.includes(normalize(g.name)) ||
         normalize(g.name).includes(targetNorm)
  );

  return found || null;
}

/**
 * Processes a 2D matrix of data (rows x cols) into an Audit structure with aggregated report counts
 */
export function processRawMatrixData(
  data: any[][],
  mapping: ColumnMapping,
  fallbackDate: string,
  centrales: Central[],
  workGroups: WorkGroup[],
  customCentralMappings: Record<string, string> = {}, // rawName -> centralId
  customGroupMappings: Record<string, string> = {}    // rawName -> groupId
): ExcelImportAudit {
  const todayStr = getTodayStr();
  
  if (!data || data.length < 2) {
    return {
      totalRowsRead: 0,
      validFoliosCount: 0,
      uniqueDates: [],
      unmatchedCentrales: [],
      unmatchedGroups: [],
      futureDatesDetected: [],
      invalidDatesDetected: 0,
      aggregatedReports: [],
      records: [],
      suggestedCentralesToCreate: [],
      suggestedGroupsToCreate: []
    };
  }

  const rows = data.slice(1); // skip header
  const parsedRecords: ParsedFolioRecord[] = [];
  
  const uniqueDatesSet = new Set<string>();
  const unmatchedCentralesMap = new Map<string, string>(); // raw -> cleaned
  const unmatchedGroupsMap = new Map<string, string>();     // raw -> cleaned
  const futureDatesSet = new Set<string>();
  let invalidDatesCount = 0;

  // Track seen folios to deduplicate repeated records
  const seenFoliosSet = new Set<string>();

  // Key for counting: `${date}_${centralId}_${groupId}` => count
  const reportCountMap = new Map<string, { date: string; centralId: string; workGroupId: string; count: number }>();

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    const folioVal = row[mapping.folioColIndex] !== undefined ? String(row[mapping.folioColIndex]).trim() : '';
    const rawCentral = row[mapping.centralColIndex] !== undefined ? String(row[mapping.centralColIndex]).trim() : '';
    const rawGroup = row[mapping.groupColIndex] !== undefined ? String(row[mapping.groupColIndex]).trim() : '';

    // Ignore row if it's a repeated header row or empty
    const folioLower = folioVal.toLowerCase();
    if (
      folioLower === 'folio' || folioLower === 'ticket' || folioLower === 'folio/ticket' ||
      folioLower === 'n° ticket' || folioLower === 'id' || folioLower === 'num' ||
      (rawCentral.toLowerCase() === 'central' && rawGroup.toLowerCase() === 'grupo')
    ) {
      return;
    }

    // Deduplicate by Folio (if folio is present)
    if (folioVal) {
      const folioKey = `${folioLower}_${rawCentral.toLowerCase()}_${rawGroup.toLowerCase()}`;
      if (seenFoliosSet.has(folioKey)) {
        // Skip duplicate folio entry
        return;
      }
      seenFoliosSet.add(folioKey);
    }

    // Extract date
    let rawDateVal = mapping.dateColIndex >= 0 && row[mapping.dateColIndex] !== undefined 
      ? row[mapping.dateColIndex] 
      : fallbackDate;
      
    const { dateStr, isValid } = normalizeDateString(rawDateVal, fallbackDate);
    
    if (!isValid) {
      invalidDatesCount++;
    }

    let finalDate = dateStr;
    const isFuture = isFutureDate(finalDate);
    if (isFuture) {
      futureDatesSet.add(finalDate);
      finalDate = todayStr; // Force to today if future date
    }

    uniqueDatesSet.add(finalDate);

    // Match Central
    let matchedC: Central | null = null;
    if (customCentralMappings[rawCentral]) {
      matchedC = centrales.find(c => c.id === customCentralMappings[rawCentral]) || null;
    }
    if (!matchedC) {
      matchedC = matchCentral(rawCentral, centrales);
    }

    if (!matchedC && rawCentral) {
      unmatchedCentralesMap.set(rawCentral, rawCentral);
    }

    // Match Group
    let matchedG: WorkGroup | null = null;
    if (customGroupMappings[rawGroup]) {
      matchedG = workGroups.find(g => g.id === customGroupMappings[rawGroup]) || null;
    }
    if (!matchedG) {
      matchedG = matchWorkGroup(rawGroup, workGroups);
    }

    if (!matchedG && rawGroup) {
      unmatchedGroupsMap.set(rawGroup, rawGroup);
    }

    const cId = matchedC ? matchedC.id : `cnt_temp_${normalize(rawCentral)}`;
    const gId = matchedG ? matchedG.id : `grp_temp_${normalize(rawGroup)}`;

    parsedRecords.push({
      folio: folioVal || `FOL-${idx + 1}`,
      rawCentral,
      matchedCentralId: matchedC ? matchedC.id : null,
      matchedCentralName: matchedC ? matchedC.name : rawCentral,
      rawGroup,
      matchedGroupId: matchedG ? matchedG.id : null,
      matchedGroupName: matchedG ? matchedG.name : rawGroup,
      rawDate: String(rawDateVal || ''),
      normalizedDate: finalDate,
      isValidDate: isValid,
      isFuture,
      lineNum: idx + 2
    });

    // Count towards report aggregation
    const key = `${finalDate}_${cId}_${gId}`;
    if (reportCountMap.has(key)) {
      reportCountMap.get(key)!.count += 1;
    } else {
      reportCountMap.set(key, {
        date: finalDate,
        centralId: cId,
        workGroupId: gId,
        count: 1
      });
    }
  });

  // Prepare aggregated DailyReport list
  const aggregatedReports: DailyReport[] = Array.from(reportCountMap.values()).map(item => ({
    id: `rep_excel_${item.date}_${item.centralId}_${item.workGroupId}`,
    date: item.date,
    centralId: item.centralId,
    workGroupId: item.workGroupId,
    reportCount: item.count,
    notes: 'Importación masiva desde Excel por Folios',
    updatedAt: new Date().toISOString()
  }));

  // Generate suggested new Centrales & WorkGroups for missing ones
  const suggestedCentralesToCreate: Central[] = Array.from(unmatchedCentralesMap.values()).map((rawName, index) => {
    const cleanCode = rawName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'C');
    return {
      id: `cnt_auto_${Date.now()}_${index}`,
      name: rawName,
      code: cleanCode || `C${index + 1}`,
      location: 'Ubicación Desconocida',
      installedTech: { total: 0 },
      active: true
    };
  });

  const colorsList = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];
  const suggestedGroupsToCreate: WorkGroup[] = Array.from(unmatchedGroupsMap.values()).map((rawName, index) => {
    const cleanCode = rawName.substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, 'GRP');
    return {
      id: `grp_auto_${Date.now()}_${index}`,
      name: rawName,
      code: cleanCode || `G${index + 1}`,
      description: `Grupo creado automáticamente desde importación Excel (${rawName})`,
      color: colorsList[index % colorsList.length]
    };
  });

  return {
    totalRowsRead: rows.length,
    validFoliosCount: parsedRecords.length,
    uniqueDates: Array.from(uniqueDatesSet).sort(),
    unmatchedCentrales: Array.from(unmatchedCentralesMap.values()),
    unmatchedGroups: Array.from(unmatchedGroupsMap.values()),
    futureDatesDetected: Array.from(futureDatesSet),
    invalidDatesDetected: invalidDatesCount,
    aggregatedReports,
    records: parsedRecords,
    suggestedCentralesToCreate,
    suggestedGroupsToCreate
  };
}

/**
 * Parse Excel file (.xlsx / .xls)
 */
export async function parseExcelFile(file: File): Promise<any[][]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El archivo Excel no contiene hojas de cálculo.');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    return rows;
  } catch (err: any) {
    console.error('Error reading xlsx file:', err);
    throw new Error('No se pudo leer el archivo Excel (.xlsx/.xls). Verifique el formato e intente nuevamente.');
  }
}

/**
 * Parse CSV file (.csv / .tsv)
 */
export function parseCsvFile(file: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as any[][]);
      },
      error: (err) => {
        reject(new Error(`Error al leer archivo CSV: ${err.message}`));
      }
    });
  });
}

/**
 * Parse pasted plain text (TSV / CSV)
 */
export function parsePastedTextTo2DArray(text: string): any[][] {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(',')) delimiter = ',';
  else if (firstLine.includes(';')) delimiter = ';';

  return lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
}
