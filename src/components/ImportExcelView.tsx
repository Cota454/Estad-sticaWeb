import React, { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Layers,
  Settings2,
  RefreshCw,
  PlusCircle,
  ShieldCheck,
  ListFilter,
  FileCheck2,
  ArrowRight,
  Database,
  HelpCircle,
  Check
} from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import {
  ColumnMapping,
  ExcelImportAudit,
  detectColumnIndices,
  processRawMatrixData,
  parseExcelFile,
  parseCsvFile,
  parsePastedTextTo2DArray
} from '../utils/excelFolioParser';
import { parseExcelClipboardData } from '../utils/statCalculations';
import { getTodayStr, isFutureDate, formatDateLong, formatDateShort } from '../utils/dateUtils';
import { CopyTableButton } from './CopyButton';

interface ImportExcelViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  onImportReports: (
    newReports: DailyReport[],
    affectedDates: string[],
    mode: 'replace' | 'append',
    newCentralesToAdd?: Central[],
    newWorkGroupsToAdd?: WorkGroup[]
  ) => void;
}

type InputMethod = 'file' | 'clipboard';
type ImportFormatMode = 'folio_list' | 'matrix';
type SaveStrategy = 'replace' | 'append';
type PreviewTab = 'resumen' | 'folios' | 'alertas';

export const ImportExcelView: React.FC<ImportExcelViewProps> = ({
  centrales,
  workGroups,
  onImportReports
}) => {
  const todayStr = getTodayStr();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [formatMode, setFormatMode] = useState<ImportFormatMode>('folio_list');
  const [saveStrategy, setSaveStrategy] = useState<SaveStrategy>('replace');
  const [fallbackDate, setFallbackDate] = useState<string>(todayStr);

  // File or Text Raw Data
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [raw2DData, setRaw2DData] = useState<any[][] | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Column Mapping State
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    folioColIndex: 0,
    centralColIndex: 1,
    groupColIndex: 2,
    dateColIndex: 3
  });
  const [isCustomMappingOpen, setIsCustomMappingOpen] = useState<boolean>(false);

  // Remapping unmatched values
  const [customCentralMappings, setCustomCentralMappings] = useState<Record<string, string>>({});
  const [customGroupMappings, setCustomGroupMappings] = useState<Record<string, string>>({});

  // UI state
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>('resumen');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sample Excel Folio Format
  const SAMPLE_FOLIO_EXCEL = `Folio, Central Telefónica, Grupo de Trabajo, Fecha de Reporte
FOL-2026-001, Central Metropolitana, PLEXT, 2026-08-01
FOL-2026-002, Central Metropolitana, CONM, 2026-08-01
FOL-2026-003, Central Norte (Tele), PLEXT, 2026-08-01
FOL-2026-004, Central Este, ENER, 2026-08-01
FOL-2026-005, Central Norte (Tele), TRANS, 2026-08-01
FOL-2026-006, Central Sur, SOP, 2026-08-01
FOL-2026-007, Central Metropolitana, BROAD, 2026-08-01
FOL-2026-008, Central Metropolitana, PLEXT, 2026-08-01`;

  // Sample Matrix Format
  const SAMPLE_MATRIX_EXCEL = `Central, PLEXT, CONM, TRANS, ENER, BROAD, SOP
Central Metropolitana, 8, 3, 2, 1, 5, 2
Central Norte (Tele), 4, 1, 0, 1, 3, 1
Central Este, 2, 2, 1, 0, 2, 0
Central Sur, 5, 4, 2, 1, 4, 1`;

  // Extract Header array
  const headersList = useMemo(() => {
    if (!raw2DData || raw2DData.length === 0) return [];
    return raw2DData[0].map((cell: any) => String(cell || '').trim());
  }, [raw2DData]);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    setStatusMessage(null);
    setSelectedFileName(file.name);

    try {
      let data: any[][] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        data = await parseExcelFile(file);
      } else if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
        data = await parseCsvFile(file);
      } else {
        throw new Error('Formato no soportado. Por favor suba un archivo .xlsx, .xls o .csv');
      }

      if (!data || data.length < 2) {
        throw new Error('El archivo está vacío o no tiene filas de datos.');
      }

      setRaw2DData(data);
      
      // Auto-detect columns from headers
      const detectedHeaders = data[0].map((c: any) => String(c || '').trim());
      const detectedMapping = detectColumnIndices(detectedHeaders);
      setColumnMapping(detectedMapping);

      setStatusMessage({
        type: 'success',
        text: `¡Archivo "${file.name}" cargado exitosamente! Se detectaron ${data.length - 1} filas de datos.`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al procesar el archivo Excel.'
      });
      setRaw2DData(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Handle Text Paste
  const handleTextPasteChange = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setRaw2DData(null);
      return;
    }

    const data = parsePastedTextTo2DArray(text);
    if (data.length >= 2) {
      setRaw2DData(data);
      const detectedHeaders = data[0].map((c: any) => String(c || '').trim());
      const detectedMapping = detectColumnIndices(detectedHeaders);
      setColumnMapping(detectedMapping);
    } else {
      setRaw2DData(null);
    }
  };

  const handleLoadSample = (type: ImportFormatMode) => {
    setFormatMode(type);
    if (type === 'folio_list') {
      setPastedText(SAMPLE_FOLIO_EXCEL);
      handleTextPasteChange(SAMPLE_FOLIO_EXCEL);
    } else {
      setPastedText(SAMPLE_MATRIX_EXCEL);
      handleTextPasteChange(SAMPLE_MATRIX_EXCEL);
    }
    setInputMethod('clipboard');
    setStatusMessage({
      type: 'info',
      text: type === 'folio_list' 
        ? 'Se ha cargado una muestra en formato Lista de Folios (Folio, Central, Grupo, Fecha).'
        : 'Se ha cargado una muestra en formato Matriz (Central x Código de Grupo).'
    });
  };

  // Process Audit Result for Folio List Mode
  const auditResult: ExcelImportAudit | null = useMemo(() => {
    if (formatMode !== 'folio_list' || !raw2DData || raw2DData.length < 2) return null;
    return processRawMatrixData(
      raw2DData,
      columnMapping,
      fallbackDate,
      centrales,
      workGroups,
      customCentralMappings,
      customGroupMappings
    );
  }, [
    formatMode,
    raw2DData,
    columnMapping,
    fallbackDate,
    centrales,
    workGroups,
    customCentralMappings,
    customGroupMappings
  ]);

  // Process Parse Result for Matrix Mode
  const matrixResult = useMemo(() => {
    if (formatMode !== 'matrix' || !pastedText.trim()) return null;
    return parseExcelClipboardData(pastedText, workGroups, centrales);
  }, [formatMode, pastedText, workGroups, centrales]);

  // Handle Auto-Create Missing Centrales and Groups
  const handleAutoCreateMissing = () => {
    if (!auditResult) return;

    let createdCentralesCount = 0;
    let createdGroupsCount = 0;

    const newCMap = { ...customCentralMappings };
    const newGMap = { ...customGroupMappings };

    auditResult.suggestedCentralesToCreate.forEach(sc => {
      newCMap[sc.name] = sc.id;
      createdCentralesCount++;
    });

    auditResult.suggestedGroupsToCreate.forEach(sg => {
      newGMap[sg.name] = sg.id;
      createdGroupsCount++;
    });

    setCustomCentralMappings(newCMap);
    setCustomGroupMappings(newGMap);

    setStatusMessage({
      type: 'success',
      text: `Se han configurado para auto-creación ${createdCentralesCount} centrales y ${createdGroupsCount} grupos faltantes.`
    });
  };

  // Confirm and Execute Import
  const handleConfirmImport = () => {
    if (formatMode === 'folio_list') {
      if (!auditResult || auditResult.aggregatedReports.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No hay datos válidos para importar. Por favor revise el archivo cargado.'
        });
        return;
      }

      const affectedDates = auditResult.uniqueDates;
      const reportsToSave = auditResult.aggregatedReports;

      // Filter out auto-created elements that are actually used
      const centralesToAdd = auditResult.suggestedCentralesToCreate.filter(sc => 
        customCentralMappings[sc.name] === sc.id
      );
      const groupsToAdd = auditResult.suggestedGroupsToCreate.filter(sg => 
        customGroupMappings[sg.name] === sg.id
      );

      onImportReports(
        reportsToSave,
        affectedDates,
        saveStrategy,
        centralesToAdd,
        groupsToAdd
      );

      const strategyLabel = saveStrategy === 'replace' ? 'sobrescribiendo los datos previos' : 'acumulando folios';
      setStatusMessage({
        type: 'success',
        text: `¡Importación completada con éxito! Se procesaron ${auditResult.validFoliosCount} folios, actualizando ${reportsToSave.length} registros en las fechas ${affectedDates.join(', ')} (${strategyLabel}).`
      });

      // Clear input state
      setRaw2DData(null);
      setSelectedFileName('');
      setPastedText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      // Matrix format import
      if (!matrixResult || !matrixResult.success) {
        setStatusMessage({
          type: 'error',
          text: matrixResult?.message || 'Error al procesar la tabla en formato matriz.'
        });
        return;
      }

      if (isFutureDate(fallbackDate)) {
        setStatusMessage({
          type: 'error',
          text: `No se permiten fechas futuras (${fallbackDate}). Por favor seleccione hoy (${todayStr}) o una fecha pasada.`
        });
        return;
      }

      const newReports: DailyReport[] = [];
      matrixResult.rows.forEach(row => {
        let matchedCentral = centrales.find(
          c => c.name.toLowerCase() === row.centralName.toLowerCase() ||
               c.name.toLowerCase().includes(row.centralName.toLowerCase()) ||
               row.centralName.toLowerCase().includes(c.name.toLowerCase())
        );

        const centralId = matchedCentral ? matchedCentral.id : `cnt_custom_${row.centralName.replace(/\s+/g, '_').toLowerCase()}`;

        matrixResult.matchedGroups.forEach(grp => {
          const count = row.groupValues[grp.id] || 0;
          newReports.push({
            id: `rep_${fallbackDate}_${centralId}_${grp.id}`,
            date: fallbackDate,
            centralId,
            workGroupId: grp.id,
            reportCount: count,
            notes: 'Importado desde Excel en formato Matriz',
            updatedAt: new Date().toISOString()
          });
        });
      });

      onImportReports(
        newReports,
        [fallbackDate],
        saveStrategy
      );

      setStatusMessage({
        type: 'success',
        text: `¡Importación completada! Se guardaron ${newReports.length} registros para la fecha ${fallbackDate}.`
      });

      setPastedText('');
      setRaw2DData(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        
        {/* Module Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span>Importar Reportes desde Excel / CSV</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Suba archivos Excel o pegue listados de folios. El sistema agrupa automáticamente los folios por <strong>Fecha, Central Telefónica y Grupo de Trabajo</strong>.
            </p>
          </div>

          {/* Preset Samples */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleLoadSample('folio_list')}
              className="inline-flex items-center space-x-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition-colors border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Ejemplo Lista Folios</span>
            </button>
            <button
              onClick={() => handleLoadSample('matrix')}
              className="inline-flex items-center space-x-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition-colors border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Ejemplo Matriz</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
            statusMessage.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-200' :
            'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Configuration Bar: Format + Save Strategy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          
          {/* Format Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Formato de Datos en Excel:</span>
            </label>
            <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFormatMode('folio_list')}
                className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all ${
                  formatMode === 'folio_list' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Lista de Folios
              </button>
              <button
                type="button"
                onClick={() => setFormatMode('matrix')}
                className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all ${
                  formatMode === 'matrix' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tabla Matriz
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {formatMode === 'folio_list' 
                ? 'Columnas: Folio, Central, Grupo, Fecha (con conteo automático).'
                : 'Filas: Centrales. Columnas: Códigos de Grupo (PLEXT, CONM, etc.).'}
            </p>
          </div>

          {/* Strategy Selector (Reemplazar vs Acumular - Opción 4) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Estrategia al Guardar (Opción 4):</span>
            </label>
            <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSaveStrategy('replace')}
                className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all ${
                  saveStrategy === 'replace' 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Borra los datos de las fechas afectadas y los reemplaza con los nuevos del Excel"
              >
                Reemplazar Datos
              </button>
              <button
                type="button"
                onClick={() => setSaveStrategy('append')}
                className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all ${
                  saveStrategy === 'append' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Suma la cantidad de nuevos folios a los reportes ya existentes"
              >
                Acumular / Anexar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {saveStrategy === 'replace' 
                ? 'Sustituye por completo los reportes de las fechas incluidas en el archivo.'
                : 'Suma la cantidad de nuevos folios a lo guardado previamente.'}
            </p>
          </div>

          {/* Fallback Date Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Fecha por Defecto:</span>
            </label>
            <input
              type="date"
              max={todayStr}
              value={fallbackDate}
              onChange={(e) => {
                const val = e.target.value;
                if (isFutureDate(val)) {
                  alert(`No se permiten fechas futuras. Ajustado a hoy: ${todayStr}`);
                  setFallbackDate(todayStr);
                } else {
                  setFallbackDate(val);
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Se usa si el archivo no especifica la columna de fecha en alguna fila.
            </p>
          </div>

        </div>

        {/* Input Method Switcher (Upload File vs Paste Text) */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 border-b border-slate-200 pb-2">
            <button
              onClick={() => setInputMethod('file')}
              className={`inline-flex items-center space-x-2 text-xs font-bold pb-2 border-b-2 transition-all ${
                inputMethod === 'file'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Subir Archivo Excel / CSV</span>
            </button>
            <button
              onClick={() => setInputMethod('clipboard')}
              className={`inline-flex items-center space-x-2 text-xs font-bold pb-2 border-b-2 transition-all ${
                inputMethod === 'clipboard'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Pegar Copia desde Portapapeles</span>
            </button>
          </div>

          {/* Option A: File Upload Drop Zone */}
          {inputMethod === 'file' && (
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .tsv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                  <UploadCloud className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {selectedFileName ? `Archivo seleccionado: ${selectedFileName}` : 'Arrastre su archivo Excel o haga clic para seleccionar'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Formatos soportados: <strong>.xlsx, .xls, .csv</strong> (Microsoft Excel o Google Sheets)
                  </span>
                </div>
                {isLoadingFile && (
                  <span className="text-xs font-semibold text-emerald-600 animate-pulse pt-2">
                    Cargando y analizando datos del Excel...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Option B: Clipboard Text Area */}
          {inputMethod === 'clipboard' && (
            <div>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => handleTextPasteChange(e.target.value)}
                placeholder={
                  formatMode === 'folio_list'
                    ? `Pegue aquí las celdas copiadas desde Excel...\n\nColumnas: Folio, Central, Grupo, Fecha\nFOL-001\tCentral Metropolitana\tPLEXT\t2026-08-01\nFOL-002\tCentral Norte\tCONM\t2026-08-01`
                    : `Pegue aquí la tabla copiada desde Excel...\n\nCentral, PLEXT, CONM, TRANS, ENER, BROAD, SOP\nCentral Metropolitana, 8, 3, 2, 1, 5, 2`
                }
                className="w-full bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl border border-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-inner"
              />
            </div>
          )}
        </div>

        {/* Interactive Column Mapping Panel (Opción 3) */}
        {formatMode === 'folio_list' && raw2DData && raw2DData.length >= 2 && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Detección y Mapeo Flexible de Columnas (Opción 3)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomMappingOpen(!isCustomMappingOpen)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
              >
                {isCustomMappingOpen ? 'Ocultar Asignación' : 'Ajustar Mapeo de Columnas'}
              </button>
            </div>

            {/* Column badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                Folio: <strong className="text-emerald-700">{headersList[columnMapping.folioColIndex] || `Col ${columnMapping.folioColIndex + 1}`}</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                Central: <strong className="text-blue-700">{headersList[columnMapping.centralColIndex] || `Col ${columnMapping.centralColIndex + 1}`}</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                Grupo: <strong className="text-purple-700">{headersList[columnMapping.groupColIndex] || `Col ${columnMapping.groupColIndex + 1}`}</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                Fecha: <strong className="text-amber-700">{columnMapping.dateColIndex >= 0 ? (headersList[columnMapping.dateColIndex] || `Col ${columnMapping.dateColIndex + 1}`) : `Por defecto (${fallbackDate})`}</strong>
              </span>
            </div>

            {/* Detailed Dropdown Mapping UI */}
            {isCustomMappingOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Columna Folio / ID:</label>
                  <select
                    value={columnMapping.folioColIndex}
                    onChange={(e) => setColumnMapping({ ...columnMapping, folioColIndex: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
                  >
                    {headersList.map((h, idx) => (
                      <option key={idx} value={idx}>Col {idx + 1}: {h || `(Sin nombre)`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Columna Central Telefónica:</label>
                  <select
                    value={columnMapping.centralColIndex}
                    onChange={(e) => setColumnMapping({ ...columnMapping, centralColIndex: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
                  >
                    {headersList.map((h, idx) => (
                      <option key={idx} value={idx}>Col {idx + 1}: {h || `(Sin nombre)`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Columna Grupo de Trabajo:</label>
                  <select
                    value={columnMapping.groupColIndex}
                    onChange={(e) => setColumnMapping({ ...columnMapping, groupColIndex: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
                  >
                    {headersList.map((h, idx) => (
                      <option key={idx} value={idx}>Col {idx + 1}: {h || `(Sin nombre)`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Columna Fecha de Reporte:</label>
                  <select
                    value={columnMapping.dateColIndex}
                    onChange={(e) => setColumnMapping({ ...columnMapping, dateColIndex: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value={-1}>Usar Fecha por Defecto ({fallbackDate})</option>
                    {headersList.map((h, idx) => (
                      <option key={idx} value={idx}>Col {idx + 1}: {h || `(Sin nombre)`}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit & Preview Panel (Opción 1) */}
        {formatMode === 'folio_list' && auditResult && auditResult.validFoliosCount > 0 && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm space-y-4">
            
            {/* KPI Summary Banner */}
            <div className="bg-slate-900 text-white p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-100">
                      Panel de Validación y Pre-Carga (Opción 1)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Revise las métricas y resuelva posibles inconsistencias antes de guardar en el historial.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Confirmar e Importar al Historial</span>
                </button>
              </div>

              {/* 4 Cards Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Folios Procesados</span>
                  <span className="text-xl font-extrabold text-emerald-400">{auditResult.validFoliosCount}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Fechas Detectadas</span>
                  <span className="text-xl font-extrabold text-blue-400">{auditResult.uniqueDates.length}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Registros Agrupados</span>
                  <span className="text-xl font-extrabold text-purple-400">{auditResult.aggregatedReports.length}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Centrales / Grupos Faltantes</span>
                  <span className={`text-xl font-extrabold ${
                    auditResult.unmatchedCentrales.length > 0 || auditResult.unmatchedGroups.length > 0 
                      ? 'text-amber-400' 
                      : 'text-emerald-400'
                  }`}>
                    {auditResult.unmatchedCentrales.length + auditResult.unmatchedGroups.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Inconsistencies & Auto-creation Section */}
            {(auditResult.unmatchedCentrales.length > 0 || auditResult.unmatchedGroups.length > 0 || auditResult.futureDatesDetected.length > 0) && (
              <div className="p-4 mx-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold">
                      Se detectaron inconsistencias en los nombres del Excel:
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoCreateMissing}
                    className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Auto-crear Centrales y Grupos Faltantes</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {auditResult.unmatchedCentrales.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-2">
                      <span className="font-bold text-slate-800 block">
                        Centrales no registradas en el sistema ({auditResult.unmatchedCentrales.length}):
                      </span>
                      <div className="space-y-1.5">
                        {auditResult.unmatchedCentrales.map(rawC => (
                          <div key={rawC} className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 font-mono text-[11px] truncate">{rawC}</span>
                            <select
                              value={customCentralMappings[rawC] || ''}
                              onChange={(e) => setCustomCentralMappings({ ...customCentralMappings, [rawC]: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-[11px] font-bold text-slate-800"
                            >
                              <option value="">(Auto-crear como nueva)</option>
                              {centrales.map(c => (
                                <option key={c.id} value={c.id}>Mapear a: {c.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {auditResult.unmatchedGroups.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-2">
                      <span className="font-bold text-slate-800 block">
                        Grupos no registrados en el sistema ({auditResult.unmatchedGroups.length}):
                      </span>
                      <div className="space-y-1.5">
                        {auditResult.unmatchedGroups.map(rawG => (
                          <div key={rawG} className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 font-mono text-[11px] truncate">{rawG}</span>
                            <select
                              value={customGroupMappings[rawG] || ''}
                              onChange={(e) => setCustomGroupMappings({ ...customGroupMappings, [rawG]: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-[11px] font-bold text-slate-800"
                            >
                              <option value="">(Auto-crear como nuevo)</option>
                              {workGroups.map(g => (
                                <option key={g.id} value={g.id}>Mapear a: {g.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {auditResult.futureDatesDetected.length > 0 && (
                  <div className="text-[11px] text-amber-800 font-medium bg-amber-100/70 p-2 rounded-lg">
                    ℹ️ Se detectaron fechas futuras ({auditResult.futureDatesDetected.join(', ')}). El sistema las ha ajustado automáticamente a la fecha de hoy ({todayStr}).
                  </div>
                )}
              </div>
            )}

            {/* Interactive Preview Tabs */}
            <div className="px-4">
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('resumen')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activePreviewTab === 'resumen' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Resumen Agrupado por Fecha, Central y Grupo ({auditResult.aggregatedReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('folios')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activePreviewTab === 'folios' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Detalle de Folios Individuales ({auditResult.validFoliosCount})
                </button>
              </div>
            </div>

            {/* Tab 1: Aggregated Summary Table */}
            {activePreviewTab === 'resumen' && (
              <div className="p-4 pt-0 overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Fecha de Reporte</th>
                      <th className="p-3">Central Telefónica</th>
                      <th className="p-3">Grupo de Trabajo</th>
                      <th className="p-3 text-center">Folios Contados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditResult.aggregatedReports.map((rep, idx) => {
                      const matchedC = centrales.find(c => c.id === rep.centralId);
                      const matchedG = workGroups.find(g => g.id === rep.workGroupId);
                      const cName = matchedC ? matchedC.name : (auditResult.records.find(r => r.normalizedDate === rep.date)?.rawCentral || rep.centralId);
                      const gName = matchedG ? matchedG.name : (auditResult.records.find(r => r.normalizedDate === rep.date)?.rawGroup || rep.workGroupId);

                      return (
                        <tr key={idx} className="hover:bg-slate-50 font-medium">
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatDateShort(rep.date)}
                          </td>
                          <td className="p-3 font-semibold text-slate-800">
                            {cName}
                          </td>
                          <td className="p-3">
                            <span 
                              className="text-[10px] font-bold px-2 py-0.5 rounded text-white inline-block"
                              style={{ backgroundColor: matchedG?.color || '#64748b' }}
                            >
                              {matchedG?.code || 'GRUPO'} — {gName}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-extrabold text-emerald-700 bg-emerald-50/50">
                            {rep.reportCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Individual Folios Table */}
            {activePreviewTab === 'folios' && (
              <div className="p-4 pt-0 max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-left text-slate-700 border border-slate-200 rounded-xl">
                  <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] sticky top-0 bg-slate-100 z-10">
                    <tr>
                      <th className="p-2.5">N° Fila</th>
                      <th className="p-2.5">Folio / Ticket</th>
                      <th className="p-2.5">Central Registrada</th>
                      <th className="p-2.5">Grupo Mapeado</th>
                      <th className="p-2.5">Fecha Normalizada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditResult.records.slice(0, 300).map((rec, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 font-mono text-[11px]">
                        <td className="p-2.5 text-slate-400">{rec.lineNum}</td>
                        <td className="p-2.5 font-bold text-slate-900">{rec.folio}</td>
                        <td className="p-2.5 text-slate-700">{rec.matchedCentralName}</td>
                        <td className="p-2.5 text-slate-700">{rec.matchedGroupName}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{rec.normalizedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditResult.records.length > 300 && (
                  <div className="p-2 text-center text-xs text-slate-400 italic">
                    Mostrando las primeras 300 filas de {auditResult.records.length} folios procesados.
                  </div>
                )}
              </div>
            )}

            {/* Bottom Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Estrategia actual: <strong>{saveStrategy === 'replace' ? 'Reemplazar datos de las fechas afectadas' : 'Acumular folios'}</strong>
              </span>

              <button
                type="button"
                onClick={handleConfirmImport}
                className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-lg transition-all"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Confirmar e Importar al Historial</span>
              </button>
            </div>

          </div>
        )}

        {/* Matrix Preview for Matrix Mode */}
        {formatMode === 'matrix' && matrixResult && matrixResult.success && matrixResult.rows.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Vista Previa Matriz ({matrixResult.rows.length} centrales)</span>
              </h3>

              <button
                type="button"
                onClick={handleConfirmImport}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Guardar en Histórico ({fallbackDate})</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-900 text-white font-semibold">
                  <tr>
                    <th className="p-3">Central Telefónica</th>
                    {matrixResult.matchedGroups.map(grp => (
                      <th key={grp.id} className="p-3 text-center min-w-[100px]">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white inline-block mb-0.5" style={{ backgroundColor: grp.color }}>
                          {grp.code}
                        </span>
                        <div className="text-[10px] text-slate-300 font-normal truncate max-w-[120px]">{grp.name}</div>
                      </th>
                    ))}
                    <th className="p-3 text-center bg-slate-800 text-cyan-400 font-bold">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixResult.rows.map((row, idx) => {
                    let totalRow = 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{row.centralName}</td>
                        {matrixResult.matchedGroups.map(grp => {
                          const val = row.groupValues[grp.id] || 0;
                          totalRow += val;
                          return (
                            <td key={grp.id} className="p-3 text-center font-mono font-bold text-slate-800">
                              {val}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-mono font-extrabold text-cyan-700 bg-slate-50">
                          {totalRow}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
