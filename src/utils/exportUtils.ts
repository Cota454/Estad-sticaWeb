import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getSafeHtml2CanvasOptions } from './html2canvasFix';
import {
  Central,
  WorkGroup,
  DailyReport,
  RepairRecord,
  CustomTableSchema,
  RepairColumnMapping,
  SystemDataBackup,
  SystemConfigBackup,
  SystemHistoryBackup
} from '../types';
import { getTodayStr, formatDateLong } from './dateUtils';
import { loadZones, loadCableRules, loadParsedIpData, loadPrintedServices } from './ipCablesStorage';
import { loadReportSettings } from './settingsUtils';
import { loadWordReportProfiles } from './wordProfileUtils';

function generateTimestampStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function triggerFileDownload(filename: string, dataObject: any) {
  const jsonString = JSON.stringify(dataObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * BOTÓN 1: Descarga EXCLUSIVAMENTE todas las configuraciones de todos los recuadros del sistema
 */
export function downloadConfigBackup(
  centrales: Central[],
  workGroups: WorkGroup[],
  repairColumnMapping?: RepairColumnMapping,
  customTables?: CustomTableSchema[]
) {
  const configBackup: SystemConfigBackup = {
    backupType: 'configuration',
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    description: 'Copia de seguridad de todas las configuraciones del sistema (Centrales, Grupos, Reglas, Zonas, Ajustes y Perfiles)',
    centrales,
    workGroups,
    repairColumnMapping,
    reportSettings: loadReportSettings(),
    ipZones: loadZones(),
    ipCableRules: loadCableRules(),
    wordReportProfiles: loadWordReportProfiles(),
    customTableDefinitions: customTables?.map(t => ({
      id: t.id,
      tableName: t.tableName,
      description: t.description,
      columnsToProcess: t.columnsToProcess,
      startRow: t.startRow,
      endRow: t.endRow,
      createdDate: t.createdDate
    }))
  };

  const timestamp = generateTimestampStr();
  triggerFileDownload(`copia_configuraciones_sistema_${timestamp}.json`, configBackup);
}

/**
 * BOTÓN 2: Descarga EXCLUSIVAMENTE todo el historial y datos acumulados de todos los recuadros del sistema
 */
export function downloadHistoryBackup(
  reports: DailyReport[],
  repairRecords?: RepairRecord[],
  customTables?: CustomTableSchema[]
) {
  const historyBackup: SystemHistoryBackup = {
    backupType: 'history',
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    description: 'Copia de seguridad de todo el historial de datos y registros acumulados de todos los recuadros del sistema',
    reports,
    repairRecords: repairRecords || [],
    ipParsedData: loadParsedIpData() || undefined,
    ipPrintedServices: loadPrintedServices(),
    customTablesData: customTables || []
  };

  const timestamp = generateTimestampStr();
  triggerFileDownload(`copia_historial_sistema_${timestamp}.json`, historyBackup);
}

/**
 * Descarga Completa (Configuraciones + Historial juntos)
 */
export function downloadJSONBackup(
  centrales: Central[],
  workGroups: WorkGroup[],
  reports: DailyReport[],
  repairRecords?: RepairRecord[],
  customTables?: CustomTableSchema[],
  repairColumnMapping?: RepairColumnMapping
) {
  const backupData: SystemDataBackup = {
    backupType: 'full',
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    description: 'Copia de seguridad integral completa (Configuraciones + Historial)',
    centrales,
    workGroups,
    reports,
    repairRecords,
    customTables,
    repairColumnMapping,
    reportSettings: loadReportSettings(),
    ipZones: loadZones(),
    ipCableRules: loadCableRules(),
    wordReportProfiles: loadWordReportProfiles(),
    ipParsedData: loadParsedIpData() || undefined,
    ipPrintedServices: loadPrintedServices()
  };

  const timestamp = generateTimestampStr();
  triggerFileDownload(`copia_completa_sistema_${timestamp}.json`, backupData);
}

export interface ParsedBackupResult {
  backupType: 'configuration' | 'history' | 'full';
  data: SystemDataBackup;
  summary: {
    centralesCount: number;
    workGroupsCount: number;
    reportsCount: number;
    repairRecordsCount: number;
    hasSettings: boolean;
    hasZones: boolean;
    hasRules: boolean;
    hasParsedIp: boolean;
    printedServicesCount: number;
  };
}

export function parseJSONBackupFile(file: File): Promise<ParsedBackupResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);

        if (!parsed || typeof parsed !== 'object') {
          return reject(new Error('El archivo no contiene un objeto JSON válido.'));
        }

        // Detect backup type
        let detectedType: 'configuration' | 'history' | 'full' = 'full';
        if (parsed.backupType === 'configuration' || (parsed.centrales && !parsed.reports)) {
          detectedType = 'configuration';
        } else if (parsed.backupType === 'history' || (parsed.reports && !parsed.centrales)) {
          detectedType = 'history';
        }

        const normalizedData: SystemDataBackup = {
          backupType: detectedType,
          version: parsed.version || '3.0.0',
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          description: parsed.description,
          centrales: parsed.centrales,
          workGroups: parsed.workGroups,
          reports: parsed.reports,
          repairRecords: parsed.repairRecords,
          customTables: parsed.customTables || parsed.customTablesData,
          repairColumnMapping: parsed.repairColumnMapping,
          reportSettings: parsed.reportSettings,
          ipZones: parsed.ipZones,
          ipCableRules: parsed.ipCableRules,
          wordReportProfiles: parsed.wordReportProfiles,
          ipParsedData: parsed.ipParsedData,
          ipPrintedServices: parsed.ipPrintedServices
        };

        const summary = {
          centralesCount: Array.isArray(normalizedData.centrales) ? normalizedData.centrales.length : 0,
          workGroupsCount: Array.isArray(normalizedData.workGroups) ? normalizedData.workGroups.length : 0,
          reportsCount: Array.isArray(normalizedData.reports) ? normalizedData.reports.length : 0,
          repairRecordsCount: Array.isArray(normalizedData.repairRecords) ? normalizedData.repairRecords.length : 0,
          hasSettings: Boolean(normalizedData.reportSettings),
          hasZones: Boolean(normalizedData.ipZones && normalizedData.ipZones.length > 0),
          hasRules: Boolean(normalizedData.ipCableRules),
          hasParsedIp: Boolean(normalizedData.ipParsedData && normalizedData.ipParsedData.consolidatedRows?.length > 0),
          printedServicesCount: normalizedData.ipPrintedServices ? Object.keys(normalizedData.ipPrintedServices).length : 0
        };

        // Basic sanity check: at least something should exist
        const hasContent =
          summary.centralesCount > 0 ||
          summary.workGroupsCount > 0 ||
          summary.reportsCount > 0 ||
          summary.repairRecordsCount > 0 ||
          summary.hasZones ||
          summary.hasRules ||
          summary.hasParsedIp;

        if (!hasContent) {
          return reject(new Error('El archivo JSON no contiene datos reconocibles de configuración ni de historial.'));
        }

        resolve({
          backupType: detectedType,
          data: normalizedData,
          summary
        });
      } catch (err: any) {
        reject(new Error(`Error al decodificar el archivo JSON: ${err.message || 'Formato no válido'}`));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo desde el dispositivo.'));
    reader.readAsText(file);
  });
}

export async function exportElementToPDF(
  elementId: string,
  title: string,
  fileName: string = 'informe_estadistico_telecom.pdf'
) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found for PDF export.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, getSafeHtml2CanvasOptions({
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    }));

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Header banner
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pdfWidth, 18, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('SISTEMA ESTADÍSTICO DE OPERACIONES DE TELECOMUNICACIONES', 10, 11);
    pdf.setFontSize(8);
    pdf.text(`Fecha de exportación: ${formatDateLong(getTodayStr())}`, pdfWidth - 75, 11);

    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 24;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 30);

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName);
  } catch (err) {
    console.error('Error generating PDF:', err);
    alert('No se pudo generar el documento PDF. Intente nuevamente.');
  }
}
