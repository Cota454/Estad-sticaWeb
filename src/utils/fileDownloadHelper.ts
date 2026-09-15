import * as XLSX from 'xlsx-js-style';

/**
 * Utility function to generate a standard timestamp string (YYYY-MM-DD_HH-mm-ss)
 */
export function getCurrentDateTimeString(): { dateStr: string; timeStr: string; fullStr: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const dateStr = `${yyyy}-${mm}-${dd}`;
  const timeStr = `${hh}-${min}-${ss}`;
  return {
    dateStr,
    timeStr,
    fullStr: `${dateStr}_${timeStr}`
  };
}

/**
 * Ensures that a filename includes both date and time (YYYY-MM-DD_HH-mm-ss)
 * If the filename already has date and time, it leaves it intact.
 * If it only has date, it appends the time.
 * If it has neither, it appends both date and time.
 */
export function appendDateTimeToFilename(baseName: string, defaultExt: string = 'xlsx'): string {
  // Remove existing extension if present
  let cleanName = baseName.trim().replace(/\.[a-zA-Z0-9]+$/, '');

  const { dateStr, timeStr, fullStr } = getCurrentDateTimeString();

  // Pattern detecting both date and time (e.g., 2026-09-15_09-05 or 2026-09-15_09-05-12 or 20260915_0905)
  const hasDateTimeRegex = /\d{4}[-_]?\d{2}[-_]?\d{2}[-_T]\d{2}[-_:]\d{2}/;
  // Pattern detecting only date at the end (e.g., 2026-09-15)
  const hasOnlyDateRegex = /\d{4}[-_]\d{2}[-_]\d{2}$/;

  let finalBase = cleanName;

  if (hasDateTimeRegex.test(cleanName)) {
    // Already has date and time - keep as is
    finalBase = cleanName;
  } else if (hasOnlyDateRegex.test(cleanName)) {
    // Has date but lacks time - append time
    finalBase = `${cleanName}_${timeStr}`;
  } else {
    // Lacks both - append both date and time
    finalBase = `${cleanName}_${fullStr}`;
  }

  const cleanExt = defaultExt.replace(/^\./, '');
  return `${finalBase}.${cleanExt}`;
}

export interface SaveFileOptions {
  blob: Blob;
  suggestedName: string;
  fileTypeDescription?: string;
  mimeType?: string;
  extension?: string;
}

/**
 * Downloads a file attempting to use the modern File System Access API (showSaveFilePicker)
 * so that the user's browser prompts for the target directory, with the suggested filename pre-filled.
 * If the user cancels the picker, the operation safely aborts.
 * If the picker is not supported or blocked by iframe restrictions, falls back seamlessly to <a> download.
 */
export async function saveFileWithPickerOrFallback(options: SaveFileOptions): Promise<boolean> {
  const {
    blob,
    suggestedName,
    fileTypeDescription = 'Archivo (*.*)',
    mimeType = 'application/octet-stream',
    extension = ''
  } = options;

  const cleanExt = extension ? (extension.startsWith('.') ? extension : `.${extension}`) : '';
  const finalFilename = cleanExt && !suggestedName.toLowerCase().endsWith(cleanExt.toLowerCase())
    ? `${suggestedName}${cleanExt}`
    : suggestedName;

  // 1. Try File System Access API (window.showSaveFilePicker)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const pickerTypes = [
        {
          description: fileTypeDescription,
          accept: {
            [mimeType]: [cleanExt || '.xlsx']
          }
        }
      ];

      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: finalFilename,
        types: pickerTypes
      });

      const writableStream = await fileHandle.createWritable();
      await writableStream.write(blob);
      await writableStream.close();
      return true;
    } catch (err: any) {
      // User explicitly clicked "Cancelar" in the OS save dialog
      if (err?.name === 'AbortError') {
        return false;
      }
      // In sandboxed iframes without permission, showSaveFilePicker throws SecurityError;
      // log and fall through to fallback
      console.warn('showSaveFilePicker error or iframe restriction, using fallback link download:', err);
    }
  }

  // 2. Fallback to standard anchor download
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('Failed to trigger fallback file download:', err);
    return false;
  }
}

/**
 * Saves a styled XLSX workbook using showSaveFilePicker with date and time in filename
 */
export async function saveXlsxWorkbook(
  workbook: XLSX.WorkBook,
  baseFilename: string
): Promise<boolean> {
  const filename = appendDateTimeToFilename(baseFilename, 'xlsx');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  return await saveFileWithPickerOrFallback({
    blob,
    suggestedName: filename,
    fileTypeDescription: 'Libro de Excel (*.xlsx)',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx'
  });
}

/**
 * Saves an HTML-formatted Excel file (.xls) using showSaveFilePicker with date and time in filename
 */
export async function saveExcelHtmlTable(
  htmlContent: string,
  baseFilename: string
): Promise<boolean> {
  const filename = appendDateTimeToFilename(baseFilename, 'xls');
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  });

  return await saveFileWithPickerOrFallback({
    blob,
    suggestedName: filename,
    fileTypeDescription: 'Libro de Excel (*.xls)',
    mimeType: 'application/vnd.ms-excel',
    extension: '.xls'
  });
}

/**
 * Saves a Word document (.doc) using showSaveFilePicker with date and time in filename
 */
export async function saveWordHtmlDoc(
  htmlContent: string,
  baseFilename: string
): Promise<boolean> {
  const filename = appendDateTimeToFilename(baseFilename, 'doc');
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8'
  });

  return await saveFileWithPickerOrFallback({
    blob,
    suggestedName: filename,
    fileTypeDescription: 'Documento de Word (*.doc)',
    mimeType: 'application/msword',
    extension: '.doc'
  });
}
