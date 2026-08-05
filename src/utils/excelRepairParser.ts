import * as XLSX from 'xlsx-js-style';
import Papa from 'papaparse';
import { Central, WorkGroup, RepairRecord, RepairColumnMapping, CustomTableSchema } from '../types';
import { getTodayStr } from './dateUtils';
import { normalizeDateString } from './excelFolioParser';

export interface RawExcelSheetData {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

/**
 * Reads an uploaded Excel (.xlsx, .xls) or CSV file into raw rows and column headers
 */
export async function parseExcelFileToRawTable(file: File): Promise<RawExcelSheetData> {
  const fileName = file.name;
  const isCsv = fileName.toLowerCase().endsWith('.csv');

  if (isCsv) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, any>[];
          resolve({
            fileName,
            sheetName: 'CSV_Data',
            headers,
            rows,
            totalRows: rows.length
          });
        },
        error: (err) => reject(new Error(`Error al leer archivo CSV: ${err.message}`))
      });
    });
  }

  // Handle Excel (.xlsx, .xls) using XLSX
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0] || 'Hoja1';
        const worksheet = workbook.Sheets[sheetName];

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd'
        });

        if (!jsonRows || jsonRows.length === 0) {
          resolve({
            fileName,
            sheetName,
            headers: [],
            rows: [],
            totalRows: 0
          });
          return;
        }

        // Get column headers from the first row object keys
        const headers = Object.keys(jsonRows[0] || {});

        resolve({
          fileName,
          sheetName,
          headers,
          rows: jsonRows,
          totalRows: jsonRows.length
        });
      } catch (err: any) {
        reject(new Error(`Error al procesar el archivo Excel: ${err.message || err}`));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Maps raw Excel rows into structured RepairRecord items based on user-defined column mapping
 */
export function processRepairRowsWithMapping(
  rawRows: Record<string, any>[],
  mapping: RepairColumnMapping,
  centrales: Central[],
  workGroups: WorkGroup[]
): RepairRecord[] {
  if (!rawRows || rawRows.length === 0) return [];

  const startIdx = Math.max(0, (mapping.startRow || 1) - 2); // 1-indexed to 0-indexed adjustment
  const endIdx = mapping.endRow && mapping.endRow > 0 ? mapping.endRow - 1 : rawRows.length;
  const targetRows = rawRows.slice(startIdx, endIdx);

  const todayStr = getTodayStr();
  const records: RepairRecord[] = [];
  const seenTicketsSet = new Set<string>();

  targetRows.forEach((row, idx) => {
    // 1. Extract raw column values
    const rawDate = row[mapping.dateCol];
    const rawReportDate = mapping.reportDateCol ? row[mapping.reportDateCol] : '';
    const rawCentral = String(row[mapping.centralCol] || '').trim();
    const rawService = String(row[mapping.serviceCol] || '').trim();
    const rawTicket = mapping.ticketCol ? String(row[mapping.ticketCol] || '').trim() : '';
    const rawTech = mapping.technicianCol ? String(row[mapping.technicianCol] || '').trim() : '';
    const rawCable = mapping.cableCol ? String(row[mapping.cableCol] || '').trim() : (mapping.issueCol ? String(row[mapping.issueCol] || '').trim() : '');
    const rawGrupo = mapping.grupoCol ? String(row[mapping.grupoCol] || '').trim() : (mapping.statusCol ? String(row[mapping.statusCol] || '').trim() : '');
    const rawClave = mapping.claveCol ? String(row[mapping.claveCol] || '').trim() : '';
    const rawMttr = mapping.mttrCol ? row[mapping.mttrCol] : '';

    // Ignore row if key fields are completely empty
    if (!rawCentral && !rawService && !rawTicket) return;

    // Ignore row if it contains header label titles
    const centralLower = rawCentral.toLowerCase();
    const ticketLower = rawTicket.toLowerCase();
    const serviceLower = rawService.toLowerCase();
    if (
      centralLower === 'central' || centralLower === 'cta' || centralLower === 'nodo' ||
      ticketLower === 'ticket' || ticketLower === 'folio' || ticketLower === 'folio/ticket' ||
      serviceLower === 'servicio' || serviceLower === 'telefono' || serviceLower === 'abonado'
    ) {
      return;
    }

    // Deduplicate by ticket or service+central+date
    const dedupKey = ticketLower
      ? ticketLower
      : `${serviceLower}_${centralLower}_${String(rawDate).trim().toLowerCase()}`;
    if (dedupKey && seenTicketsSet.has(dedupKey)) {
      // Skip duplicate record
      return;
    }
    if (dedupKey) {
      seenTicketsSet.add(dedupKey);
    }

    // 2. Normalize dates
    const { dateStr } = normalizeDateString(rawDate, todayStr);
    const reportDateNorm = rawReportDate ? normalizeDateString(rawReportDate, dateStr).dateStr : dateStr;

    // 3. Match Central CTA
    let matchedCentralId: string | undefined = undefined;
    let matchedCentralName = rawCentral || 'Central Sin Especificar';

    if (rawCentral) {
      const normCentral = rawCentral.toLowerCase().trim();
      const foundCentral = centrales.find(c => 
        c.name.toLowerCase().trim() === normCentral ||
        c.code.toLowerCase().trim() === normCentral ||
        normCentral.includes(c.code.toLowerCase().trim()) ||
        c.name.toLowerCase().trim().includes(normCentral)
      );
      if (foundCentral) {
        matchedCentralId = foundCentral.id;
        matchedCentralName = foundCentral.name;
      }
    }

    // 4. Normalize Status
    let status: 'resolved' | 'in_progress' | 'pending' = 'resolved';
    const sLower = rawGrupo.toLowerCase();
    if (sLower.includes('proceso') || sLower.includes('pendiente') || sLower.includes('abierto')) {
      status = sLower.includes('proceso') ? 'in_progress' : 'pending';
    }

    // 5. Parse MTTR Hours
    let mttrHours = 1.5;
    if (rawMttr !== undefined && rawMttr !== null && rawMttr !== '') {
      const parsed = parseFloat(String(rawMttr).replace(',', '.'));
      if (!isNaN(parsed) && parsed >= 0) {
        mttrHours = parseFloat(parsed.toFixed(1));
      }
    }

    const ticketCode = rawTicket || `REP-${dateStr.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
    const serviceNumber = rawService || `SRV-${String(idx + 1).padStart(4, '0')}`;

    records.push({
      id: `rep_excel_${Date.now()}_${idx}`,
      ticketCode,
      date: dateStr,
      reportDate: reportDateNorm,
      centralId: matchedCentralId,
      centralName: matchedCentralName,
      serviceNumber,
      technician: rawTech || 'Brigada de Campo',
      issueType: rawCable || 'Avería General',
      cable: rawCable || 'Cable Principal',
      grupo: rawGrupo || 'Planta Exterior',
      claveCode: rawClave || 'C-01',
      status,
      mttrHours,
      rawRowData: row
    });
  });

  return records;
}

/**
 * Creates a Custom Table Schema from selected Excel columns and row bounds
 */
export function createCustomTableFromExcel(
  tableName: string,
  rawRows: Record<string, any>[],
  selectedColumns: string[],
  startRow: number,
  endRow?: number,
  description?: string
): CustomTableSchema {
  const startIdx = Math.max(0, startRow - 2);
  const endIdx = endRow && endRow > 0 ? endRow - 1 : rawRows.length;
  const targetRows = rawRows.slice(startIdx, endIdx);

  const processedData = targetRows.map(row => {
    const customRow: Record<string, any> = {};
    selectedColumns.forEach(col => {
      customRow[col] = row[col] !== undefined ? row[col] : '';
    });
    return customRow;
  });

  return {
    id: `tbl_custom_${Date.now()}`,
    tableName: tableName || 'Nueva Tabla Procesada',
    description: description || `Tabla creada desde Excel con ${selectedColumns.length} columnas.`,
    columnsToProcess: selectedColumns,
    startRow,
    endRow,
    createdDate: getTodayStr(),
    rowCount: processedData.length,
    data: processedData
  };
}
