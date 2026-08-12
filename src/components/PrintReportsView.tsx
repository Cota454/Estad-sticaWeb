import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import Papa from 'papaparse';
import {
  Printer,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  CheckSquare,
  Square,
  Columns,
  Eye,
  Copy,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Tag,
  FileText,
  Building2,
  Cable,
  Calendar,
  Layers,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

import {
  IpCableExcelParseResult,
  IpCableRow,
  NetworkTypeCategory
} from '../types/ipCablesTypes';

import {
  loadPrintedServices,
  markServicesAsPrinted,
  markServiceAsUnprinted,
  PrintedRecord
} from '../utils/ipCablesStorage';

interface PrintReportsViewProps {
  excelData: IpCableExcelParseResult | null;
  onUpdateExcelData?: (newData: IpCableExcelParseResult) => void;
}

export const PrintReportsView: React.FC<PrintReportsViewProps> = ({
  excelData,
  onUpdateExcelData
}) => {
  // Track Printed Status from LocalStorage
  const [printedMap, setPrintedMap] = useState<Record<string, PrintedRecord>>(loadPrintedServices);

  // Column Selector State
  const initialColumns = useMemo(() => {
    if (!excelData) return ['SERVICIO', 'CENTRAL', 'GRUPO', 'CABLE', 'FECHA REPORTE'];
    return excelData.headers.length > 0
      ? excelData.headers
      : ['SERVICIO', 'CENTRAL', 'GRUPO', 'CABLE', 'FECHA REPORTE'];
  }, [excelData]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(initialColumns);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState<boolean>(false);

  // Filters State
  const [selectedCentral, setSelectedCentral] = useState<string>('all');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('all');
  const [selectedNetworkType, setSelectedNetworkType] = useState<NetworkTypeCategory>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [printStatusFilter, setPrintStatusFilter] = useState<'all' | 'printed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Batch Paste State
  const [batchPasteInput, setBatchPasteInput] = useState<string>('');
  const [batchServicesList, setBatchServicesList] = useState<string[]>([]);
  const [isBatchActive, setIsBatchActive] = useState<boolean>(false);

  // Row Selection State for Printing
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Complementary Excel Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState<string>('');

  // Live Print Preview Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'sheet' | 'ticket'>('sheet');
  const [ticketWidth, setTicketWidth] = useState<'80mm' | '58mm' | 'full'>('80mm');

  // Print Mode triggered for native browser print
  const [activePrintMode, setActivePrintMode] = useState<'none' | 'sheet' | 'ticket'>('none');

  // -------------------------------------------------------------
  // 1. COMPLEMENTARY EXCEL UPLOAD & DATA MERGING
  // -------------------------------------------------------------
  const handleComplementaryExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excelData) return;

    setIsMerging(true);
    setMergeSuccessMsg('');

    try {
      let compHeaders: string[] = [];
      let compRows: Record<string, any>[] = [];

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
        const data = parsed.data as string[][];

        if (data.length >= 4) {
          compHeaders = data[3].map(h => (h || '').toString().trim());
          const rowsRaw = data.slice(4);
          rowsRaw.forEach(rowArr => {
            const rowObj: Record<string, any> = {};
            compHeaders.forEach((h, idx) => {
              if (h) rowObj[h] = (rowArr[idx] || '').toString().trim();
            });
            if (Object.keys(rowObj).length > 0) compRows.push(rowObj);
          });
        } else if (data.length > 0) {
          compHeaders = data[0].map(h => (h || '').toString().trim());
          const rowsRaw = data.slice(1);
          rowsRaw.forEach(rowArr => {
            const rowObj: Record<string, any> = {};
            compHeaders.forEach((h, idx) => {
              if (h) rowObj[h] = (rowArr[idx] || '').toString().trim();
            });
            if (Object.keys(rowObj).length > 0) compRows.push(rowObj);
          });
        }
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        if (jsonData.length >= 4) {
          const headerRow = jsonData[3] || [];
          compHeaders = headerRow.map(h => (h || '').toString().trim());
          const rowsRaw = jsonData.slice(4);
          rowsRaw.forEach(rowArr => {
            const rowObj: Record<string, any> = {};
            compHeaders.forEach((h, idx) => {
              if (h) rowObj[h] = (rowArr[idx] || '').toString().trim();
            });
            if (Object.keys(rowObj).length > 0) compRows.push(rowObj);
          });
        } else if (jsonData.length > 0) {
          const headerRow = jsonData[0] || [];
          compHeaders = headerRow.map(h => (h || '').toString().trim());
          const rowsRaw = jsonData.slice(1);
          rowsRaw.forEach(rowArr => {
            const rowObj: Record<string, any> = {};
            compHeaders.forEach((h, idx) => {
              if (h) rowObj[h] = (rowArr[idx] || '').toString().trim();
            });
            if (Object.keys(rowObj).length > 0) compRows.push(rowObj);
          });
        }
      }

      // Find 'SERVICIO' column key in complementary file
      const compServicioHeader = compHeaders.find(
        h => h.toUpperCase().includes('SERVICIO') || h.toUpperCase().includes('SERVICE') || h.toUpperCase() === 'ID'
      ) || compHeaders[0];

      if (!compServicioHeader) {
        alert('No se pudo identificar la columna SERVICIO en el archivo complementario.');
        return;
      }

      // Merge headers
      const mergedHeadersSet = new Set([...excelData.headers, ...compHeaders]);
      const newHeaders = Array.from(mergedHeadersSet);

      // Create comp index map
      const compMap = new Map<string, Record<string, any>>();
      compRows.forEach(r => {
        const sVal = (r[compServicioHeader] || '').toString().trim().toUpperCase();
        if (sVal) compMap.set(sVal, r);
      });

      let updatedCount = 0;
      const updatedConsolidatedRows = excelData.consolidatedRows.map(row => {
        const sKey = (row.servicio || '').toString().trim().toUpperCase();
        const compObj = compMap.get(sKey);

        if (compObj) {
          updatedCount++;
          const newRaw = { ...row.rawRowData };
          Object.entries(compObj).forEach(([k, v]) => {
            if (v !== undefined && v !== '' && (!newRaw[k] || newRaw[k] === 'N/A' || newRaw[k] === '-')) {
              newRaw[k] = v;
            }
          });
          return {
            ...row,
            rawRowData: newRaw
          };
        }
        return row;
      });

      const updatedParseResult: IpCableExcelParseResult = {
        ...excelData,
        headers: newHeaders,
        consolidatedRows: updatedConsolidatedRows
      };

      if (onUpdateExcelData) {
        onUpdateExcelData(updatedParseResult);
      }

      setSelectedColumns(newHeaders);
      setMergeSuccessMsg(
        `¡Éxito! Se enriquecieron ${updatedCount} servicios y se agregaron ${compHeaders.length} columnas complementarias.`
      );
    } catch (err: any) {
      console.error('Error al subir archivo complementario:', err);
      alert('Error al leer el archivo complementario: ' + err.message);
    } finally {
      setIsMerging(false);
      e.target.value = '';
    }
  };

  // -------------------------------------------------------------
  // 2. BATCH PASTE PROCESSING & MISSING NUMBERS ANALYSIS
  // -------------------------------------------------------------
  const parsedBatchItems = useMemo(() => {
    if (!batchPasteInput.trim()) return [];
    // Split by newlines, tabs, commas, spaces
    return batchPasteInput
      .split(/[\n,;\t]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  }, [batchPasteInput]);

  const batchAnalysis = useMemo(() => {
    if (!excelData || parsedBatchItems.length === 0) {
      return { foundServicios: [], missingServicios: [] };
    }

    const availableMap = new Map<string, IpCableRow>();
    excelData.consolidatedRows.forEach(r => {
      const sKey = (r.servicio || '').toString().trim().toUpperCase();
      if (sKey) availableMap.set(sKey, r);
    });

    const foundSet = new Set<string>();
    const missingSet = new Set<string>();

    parsedBatchItems.forEach(num => {
      if (availableMap.has(num)) {
        foundSet.add(num);
      } else {
        missingSet.add(num);
      }
    });

    return {
      foundServicios: Array.from(foundSet),
      missingServicios: Array.from(missingSet)
    };
  }, [excelData, parsedBatchItems]);

  const handleApplyBatchFilter = () => {
    if (parsedBatchItems.length === 0) return;
    setBatchServicesList(batchAnalysis.foundServicios);
    setIsBatchActive(true);
  };

  const handleClearBatchFilter = () => {
    setBatchPasteInput('');
    setBatchServicesList([]);
    setIsBatchActive(false);
  };

  const copyMissingToClipboard = () => {
    if (batchAnalysis.missingServicios.length === 0) return;
    navigator.clipboard.writeText(batchAnalysis.missingServicios.join('\n'));
    alert(`Se copiaron ${batchAnalysis.missingServicios.length} servicios no encontrados al portapapeles.`);
  };

  // -------------------------------------------------------------
  // 3. FILTERING LOGIC
  // -------------------------------------------------------------
  const filteredRows = useMemo(() => {
    if (!excelData) return [];

    return excelData.consolidatedRows.filter(row => {
      const sKey = (row.servicio || '').toString().trim().toUpperCase();

      // Batch Filter
      if (isBatchActive && batchServicesList.length > 0) {
        if (!batchServicesList.includes(sKey)) return false;
      }

      // Central Filter
      if (selectedCentral !== 'all' && row.central !== selectedCentral) {
        return false;
      }

      // Network Type Filter
      if (selectedNetworkType !== 'all' && row.networkType !== selectedNetworkType) {
        return false;
      }

      // Group Filter
      if (selectedGroup !== 'all' && row.grupo !== selectedGroup) {
        return false;
      }

      // Month/Year Filter
      if (selectedMonthYear !== 'all' && row.fechaReporte) {
        const d = new Date(row.fechaReporte);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
          if (key !== selectedMonthYear) return false;
        }
      }

      // Print Status Filter
      const isPrinted = !!printedMap[sKey];
      if (printStatusFilter === 'printed' && !isPrinted) return false;
      if (printStatusFilter === 'pending' && isPrinted) return false;

      // General Search
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const inService = row.servicio.toLowerCase().includes(term);
        const inCentral = row.central.toLowerCase().includes(term);
        const inCable = row.cable.toLowerCase().includes(term);
        const inGroup = row.grupo.toLowerCase().includes(term);
        const inRaw = Object.values(row.rawRowData || {}).some(v =>
          (v || '').toString().toLowerCase().includes(term)
        );
        if (!inService && !inCentral && !inCable && !inGroup && !inRaw) return false;
      }

      return true;
    });
  }, [
    excelData,
    isBatchActive,
    batchServicesList,
    selectedCentral,
    selectedNetworkType,
    selectedGroup,
    selectedMonthYear,
    printStatusFilter,
    searchTerm,
    printedMap
  ]);

  // Rows selected for batch print operations (if none checked, uses all filtered rows)
  const rowsToPrint = useMemo(() => {
    if (selectedRowIds.size > 0) {
      return filteredRows.filter(r => selectedRowIds.has(r.id));
    }
    return filteredRows;
  }, [filteredRows, selectedRowIds]);

  // Selection handlers
  const handleSelectAllRows = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredRows.map(r => r.id));
      setSelectedRowIds(allIds);
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleRowSelect = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
  };

  // -------------------------------------------------------------
  // 4. PRINTING & MARKING AS PRINTED
  // -------------------------------------------------------------
  const handlePrintAction = (mode: 'sheet' | 'ticket') => {
    if (rowsToPrint.length === 0) {
      alert('No hay servicios seleccionados o visibles para imprimir.');
      return;
    }

    setActivePrintMode(mode);

    // Mark as printed automatically
    const serviciosToMark = rowsToPrint.map(r => r.servicio);
    const updatedRecords = markServicesAsPrinted(serviciosToMark);
    setPrintedMap(updatedRecords);

    // Trigger Browser Native Print
    setTimeout(() => {
      window.print();
      setActivePrintMode('none');
    }, 300);
  };

  const handleSinglePrint = (row: IpCableRow, mode: 'sheet' | 'ticket') => {
    setSelectedRowIds(new Set([row.id]));
    setActivePrintMode(mode);

    const updatedRecords = markServicesAsPrinted([row.servicio]);
    setPrintedMap(updatedRecords);

    setTimeout(() => {
      window.print();
      setActivePrintMode('none');
    }, 300);
  };

  const handleToggleSinglePrinted = (servicio: string) => {
    const sKey = (servicio || '').toString().trim().toUpperCase();
    if (printedMap[sKey]) {
      const updated = markServiceAsUnprinted(sKey);
      setPrintedMap(updated);
    } else {
      const updated = markServicesAsPrinted([sKey]);
      setPrintedMap(updated);
    }
  };

  // Summary Metrics
  const totalCount = excelData?.consolidatedRows.length || 0;
  const printedCount = useMemo(() => {
    if (!excelData) return 0;
    return excelData.consolidatedRows.filter(r => !!printedMap[r.servicio.toUpperCase()]).length;
  }, [excelData, printedMap]);
  const pendingCount = totalCount - printedCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Screen Header - Hidden during Native Print */}
      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold">
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Módulo 2 - Centro de Impresión e Informes por Servicio</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Impresión Manual y Automática por Lote
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Genere fichas en formato <strong>Ticket Térmico</strong> o reportes en <strong>Hoja Tabular A4</strong>. Filtre por batch pegando columnas de Excel, configure campos a imprimir y cargue archivos complementarios para enriquecer la información.
            </p>
          </div>

          {/* Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Subir Excel Complementario</span>
            </button>

            <button
              onClick={() => setIsColumnModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md"
            >
              <Columns className="w-4 h-4 text-indigo-400" />
              <span>Columnas ({selectedColumns.length}/{excelData?.headers.length || 0})</span>
            </button>

            <button
              onClick={() => {
                setPreviewMode('sheet');
                setIsPreviewModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/50 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md"
            >
              <Eye className="w-4 h-4 text-indigo-300" />
              <span>Vista Previa</span>
            </button>

            <button
              onClick={() => handlePrintAction('sheet')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md"
            >
              <FileText className="w-4 h-4" />
              <span>Imprimir Hoja ({rowsToPrint.length})</span>
            </button>

            <button
              onClick={() => handlePrintAction('ticket')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md"
            >
              <Tag className="w-4 h-4" />
              <span>Imprimir Tickets ({rowsToPrint.length})</span>
            </button>
          </div>
        </div>

        {/* Metrics Status Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Servicios</span>
            <span className="text-lg font-black text-white">{totalCount}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-950/60">
            <span className="text-[10px] font-bold text-emerald-400 uppercase block">Impresos</span>
            <span className="text-lg font-black text-emerald-300">{printedCount}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-amber-950/60">
            <span className="text-[10px] font-bold text-amber-400 uppercase block">Pendientes</span>
            <span className="text-lg font-black text-amber-300">{pendingCount}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Seleccionados / Filtro</span>
            <span className="text-lg font-black text-indigo-400">{filteredRows.length} {selectedRowIds.size > 0 && `(${selectedRowIds.size} Marcados)`}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PANEL BATCH PASTE & SEARCH (Hidden during Print) */}
      {/* ------------------------------------------------------------- */}
      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Búsqueda e Impresión Masiva Automática por Lote</h3>
              <span className="text-[11px] text-slate-400">Copie una columna de números/servicios desde Excel y péguela aquí</span>
            </div>
          </div>
          {isBatchActive && (
            <span className="text-xs bg-indigo-900/80 text-indigo-200 border border-indigo-700 px-3 py-1 rounded-full font-bold animate-pulse">
              Filtro por Lote Activo ({batchServicesList.length} coincidencias)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <textarea
              rows={3}
              placeholder="Pegue aquí los números de servicio copiados desde Excel (uno por línea o separados por coma)... Ej: 02123456, 02129999"
              value={batchPasteInput}
              onChange={(e) => setBatchPasteInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400 font-mono">
                {parsedBatchItems.length > 0 && (
                  <span>Valores detectados en texto: <strong>{parsedBatchItems.length}</strong></span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {isBatchActive && (
                  <button
                    onClick={handleClearBatchFilter}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Limpiar Lote
                  </button>
                )}
                <button
                  onClick={handleApplyBatchFilter}
                  disabled={parsedBatchItems.length === 0}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Filtrar Lote ({batchAnalysis.foundServicios.length} Hallados)
                </button>
              </div>
            </div>
          </div>

          {/* Batch Analysis Feedback Box (Mejora 2) */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block border-b border-slate-800/80 pb-1">
                Análisis de Coincidencias en Lote
              </span>
              <div className="space-y-1.5 text-xs font-bold">
                <div className="flex justify-between items-center text-emerald-400 bg-emerald-950/30 p-2 rounded-xl border border-emerald-900/40">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Encontrados:</span>
                  </span>
                  <span>{batchAnalysis.foundServicios.length}</span>
                </div>
                <div className="flex justify-between items-center text-rose-400 bg-rose-950/30 p-2 rounded-xl border border-rose-900/40">
                  <span className="flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No Encontrados:</span>
                  </span>
                  <span>{batchAnalysis.missingServicios.length}</span>
                </div>
              </div>
            </div>

            {batchAnalysis.missingServicios.length > 0 && (
              <button
                onClick={copyMissingToClipboard}
                className="w-full py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[11px] font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all"
              >
                <Copy className="w-3 h-3" />
                <span>Copiar No Encontrados</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FILTER CONTROLS BAR (Hidden during Print) */}
      {/* ------------------------------------------------------------- */}
      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">

          {/* 1. Central */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              1. Central
            </label>
            <select
              value={selectedCentral}
              onChange={(e) => setSelectedCentral(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todas las Centrales</option>
              {excelData?.uniqueCentrales.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 2. Red */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              2. Tipo de Red
            </label>
            <select
              value={selectedNetworkType}
              onChange={(e) => setSelectedNetworkType(e.target.value as NetworkTypeCategory)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todas las Redes</option>
              <option value="rigida">Red Rígida</option>
              <option value="flexible">Red Flexible</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>

          {/* 3. Grupo */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              3. Grupo
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los Grupos</option>
              {excelData?.uniqueGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 4. Mes / Año */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              4. Mes / Año
            </label>
            <select
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los Meses</option>
              {excelData?.uniqueMonthsYears.map(m => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Estado Impresión */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              5. Estado Impresión
            </label>
            <select
              value={printStatusFilter}
              onChange={(e) => setPrintStatusFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los Estados</option>
              <option value="pending">🟡 Solo Pendientes</option>
              <option value="printed">🟢 Solo Impresos</option>
            </select>
          </div>

          {/* 6. General Search Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              6. Buscar Servicio / Texto
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2 pl-8 font-bold focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN TABLE (On-screen & Printable in Sheet mode) */}
      {/* ------------------------------------------------------------- */}
      <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4 ${activePrintMode === 'ticket' ? 'print:hidden' : ''}`}>
        <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="font-extrabold text-sm text-white">
              Servicios Consolidados ({filteredRows.length})
            </h3>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>
              Mostrando <strong>{selectedColumns.length}</strong> de <strong>{excelData?.headers.length || 0}</strong> columnas
            </span>
          </div>
        </div>

        {/* Printable Title Header for Sheet Print */}
        <div className="hidden print:block mb-4 text-center border-b-2 border-black pb-2">
          <h1 className="text-xl font-black uppercase text-black">Reporte Consolidado de Servicios e Incidencias</h1>
          <p className="text-xs text-black font-mono">
            Generado: {new Date().toLocaleString()} | Total Registros: {filteredRows.length}
          </p>
        </div>

        {/* Table Wrapper */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-black">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-300 print:bg-gray-200 print:text-black font-bold uppercase border-b border-slate-800 print:border-black">
              <tr>
                <th className="p-3 print:hidden w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedRowIds.size === filteredRows.length}
                    onChange={handleSelectAllRows}
                    className="rounded border-slate-700 cursor-pointer"
                  />
                </th>

                <th className="p-3 print:hidden w-28 text-center">Estado</th>

                {selectedColumns.map(col => (
                  <th key={col} className="p-3 font-extrabold tracking-wider border-r border-slate-800 print:border-gray-400">
                    {col}
                  </th>
                ))}

                <th className="p-3 print:hidden text-center w-28">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 print:divide-gray-300 text-slate-200 print:text-black font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={selectedColumns.length + 3} className="p-8 text-center text-slate-500">
                    No hay servicios que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const sKey = (row.servicio || '').toString().trim().toUpperCase();
                  const isPrinted = !!printedMap[sKey];
                  const printRecord = printedMap[sKey];
                  const isChecked = selectedRowIds.has(row.id);

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-indigo-950/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 print:hidden text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRowSelect(row.id)}
                          className="rounded border-slate-700 cursor-pointer"
                        />
                      </td>

                      {/* Print Status Badge */}
                      <td className="p-3 print:hidden text-center">
                        {isPrinted ? (
                          <button
                            onClick={() => handleToggleSinglePrinted(row.servicio)}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-all"
                            title={`Impreso ${printRecord.count} vez(ces). Clic para marcar como pendiente`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Impreso ({printRecord.count})</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleSinglePrinted(row.servicio)}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all"
                            title="Pendiente de impresión. Clic para marcar como impreso"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Pendiente</span>
                          </button>
                        )}
                      </td>

                      {/* Selected Dynamic Columns */}
                      {selectedColumns.map(col => {
                        let val = row.rawRowData?.[col];
                        if (val === undefined || val === null || val === '') {
                          if (col.toUpperCase() === 'SERVICIO') val = row.servicio;
                          else if (col.toUpperCase().includes('CENTRAL')) val = row.central;
                          else if (col.toUpperCase().includes('GRUPO')) val = row.grupo;
                          else if (col.toUpperCase().includes('CABLE')) val = row.cable;
                          else if (col.toUpperCase().includes('FECHA')) val = row.fechaReporte;
                          else val = '-';
                        }
                        return (
                          <td key={col} className="p-3 border-r border-slate-800/80 print:border-gray-300 whitespace-nowrap">
                            {val.toString()}
                          </td>
                        );
                      })}

                      {/* Action buttons */}
                      <td className="p-3 print:hidden text-center">
                        <button
                          onClick={() => handleSinglePrint(row, 'ticket')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-bold rounded-lg border border-slate-700 inline-flex items-center space-x-1 transition-all"
                          title="Imprimir ticket individual"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Ticket</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TICKET PRINT CONTAINER (Rendered only during Native Ticket Print) */}
      {/* ------------------------------------------------------------- */}
      {activePrintMode === 'ticket' && (
        <div className="hidden print:block space-y-6">
          {rowsToPrint.map((row, index) => (
            <div
              key={`ticket_print_${row.id}_${index}`}
              className="border-2 border-black p-4 mb-6 rounded-lg text-black font-mono space-y-3 bg-white"
              style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
            >
              {/* Ticket Header */}
              <div className="text-center border-b-2 border-black pb-2 space-y-1">
                <h2 className="text-base font-black uppercase">FICHA DE SERVICIO / ORDEN DE TRABAJO</h2>
                <div className="text-xs font-bold">SERVICIO: {row.servicio}</div>
                <div className="text-[10px] text-gray-700">Impreso: {new Date().toLocaleString()}</div>
              </div>

              {/* Grid of Key-Value Data */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                {selectedColumns.map(col => {
                  let val = row.rawRowData?.[col];
                  if (val === undefined || val === null || val === '') {
                    if (col.toUpperCase() === 'SERVICIO') val = row.servicio;
                    else if (col.toUpperCase().includes('CENTRAL')) val = row.central;
                    else if (col.toUpperCase().includes('GRUPO')) val = row.grupo;
                    else if (col.toUpperCase().includes('CABLE')) val = row.cable;
                    else if (col.toUpperCase().includes('FECHA')) val = row.fechaReporte;
                    else val = 'N/A';
                  }

                  return (
                    <div key={col} className="border-b border-gray-300 pb-1">
                      <span className="font-bold text-[10px] uppercase text-gray-600 block">{col}</span>
                      <span className="font-bold text-xs">{val.toString()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer Stamp Box */}
              <div className="border-t-2 border-dashed border-black pt-4 mt-4 grid grid-cols-2 gap-4 text-center text-[10px]">
                <div className="border-t border-black pt-1">Firma Técnico / Técnico Asignado</div>
                <div className="border-t border-black pt-1">Sello / Conformidad Cliente</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: SELECT COLUMNS MODAL */}
      {/* ------------------------------------------------------------- */}
      {isColumnModalOpen && excelData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white max-w-xl w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Columns className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-base text-white">Seleccionar Columnas a Mostrar e Imprimir</h3>
              </div>
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{selectedColumns.length} de {excelData.headers.length} columnas activas</span>
              <div className="space-x-2">
                <button
                  onClick={() => setSelectedColumns([...excelData.headers])}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold rounded-lg"
                >
                  Marcar Todas
                </button>
                <button
                  onClick={() => setSelectedColumns(['SERVICIO'])}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
              {excelData.headers.map(col => {
                const isSelected = selectedColumns.includes(col);
                return (
                  <label
                    key={col}
                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer flex items-center space-x-2 transition-all ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          if (selectedColumns.length > 1) {
                            setSelectedColumns(selectedColumns.filter(c => c !== col));
                          }
                        } else {
                          setSelectedColumns([...selectedColumns, col]);
                        }
                      }}
                      className="rounded border-slate-700"
                    />
                    <span className="truncate">{col}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                Aplicar Selección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: UPLOAD COMPLEMENTARY EXCEL MODAL */}
      {/* ------------------------------------------------------------- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base text-white">Subir Archivo Excel Complementario</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Cargue un segundo archivo Excel (.xlsx / .csv) que contenga columnas adicionales (direcciones, clientes, observaciones, etc.). El sistema unirá los datos automáticamente buscando la coincidencia por la columna <strong>`SERVICIO`</strong> y completará los campos vacíos.
            </p>

            <div className="p-6 border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl bg-slate-950 text-center space-y-3 cursor-pointer transition-all relative">
              <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-white">Haga clic aquí para seleccionar el Excel complementario</div>
              <div className="text-[10px] text-slate-500">Soporta formatos .XLSX, .XLS y .CSV</div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleComplementaryExcelUpload}
                disabled={isMerging}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {isMerging && (
              <div className="text-xs text-indigo-400 font-bold text-center animate-pulse">
                Procesando y enriqueciendo tabla de servicios...
              </div>
            )}

            {mergeSuccessMsg && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs rounded-xl font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{mergeSuccessMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: LIVE PRINT PREVIEW MODAL (Mejora 1) */}
      {/* ------------------------------------------------------------- */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white max-w-4xl w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-base text-white">Vista Previa en Vivo del Documento</h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewMode('sheet')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'sheet'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Hoja Tabular A4
                </button>
                <button
                  onClick={() => setPreviewMode('ticket')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'ticket'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Tickets Térmicos
                </button>
              </div>

              {previewMode === 'ticket' && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400 font-bold">Ancho Ticket:</span>
                  <select
                    value={ticketWidth}
                    onChange={(e) => setTicketWidth(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-1 font-bold"
                  >
                    <option value="80mm">80 mm (Estándar POS)</option>
                    <option value="58mm">58 mm (Mini Térmica)</option>
                    <option value="full">A4 Ancho Completo</option>
                  </select>
                </div>
              )}
            </div>

            {/* Paper Preview Canvas Container */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 rounded-2xl border border-slate-800 flex justify-center">
              {previewMode === 'sheet' ? (
                /* Sheet Simulator */
                <div className="w-full max-w-2xl bg-white text-black p-6 rounded shadow-2xl font-mono text-xs space-y-4">
                  <div className="text-center border-b-2 border-black pb-2">
                    <h2 className="text-base font-black uppercase">REPORTE CONSOLIDADO DE SERVICIOS</h2>
                    <p className="text-[10px] text-gray-600">Fecha: {new Date().toLocaleString()} | Registros: {rowsToPrint.length}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse border border-gray-400">
                      <thead>
                        <tr className="bg-gray-200 border-b border-gray-400">
                          {selectedColumns.map(c => (
                            <th key={c} className="p-1.5 border-r border-gray-400 font-bold uppercase text-[9px]">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowsToPrint.slice(0, 10).map(row => (
                          <tr key={row.id} className="border-b border-gray-300">
                            {selectedColumns.map(col => (
                              <td key={col} className="p-1.5 border-r border-gray-300 whitespace-nowrap">
                                {(row.rawRowData?.[col] || row.servicio || '-').toString()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rowsToPrint.length > 10 && (
                      <div className="text-[10px] text-gray-500 italic text-center pt-2">
                        ... y {rowsToPrint.length - 10} filas adicionales incluidas en la impresión real.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Tickets Simulator */
                <div className="space-y-4 w-full flex flex-col items-center">
                  {rowsToPrint.slice(0, 3).map((row, idx) => (
                    <div
                      key={`prev_ticket_${row.id}`}
                      className={`bg-white text-black p-4 rounded-lg shadow-xl font-mono text-xs space-y-3 border border-gray-300 ${
                        ticketWidth === '58mm'
                          ? 'w-64'
                          : ticketWidth === '80mm'
                          ? 'w-80'
                          : 'w-full'
                      }`}
                    >
                      <div className="text-center border-b border-black pb-1">
                        <div className="font-black text-xs uppercase">ORDEN TÉCNICA - TICKET #{idx + 1}</div>
                        <div className="font-bold text-sm text-blue-900">SERVICIO: {row.servicio}</div>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        {selectedColumns.map(col => (
                          <div key={col} className="flex justify-between border-b border-gray-200 pb-0.5">
                            <span className="font-bold text-gray-600 uppercase text-[9px]">{col}:</span>
                            <span className="font-bold truncate max-w-[140px]">
                              {(row.rawRowData?.[col] || row.servicio || '-').toString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {rowsToPrint.length > 3 && (
                    <div className="text-xs text-slate-400 font-bold pt-2">
                      + {rowsToPrint.length - 3} tickets adicionales listos para imprimir.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cerrar Vista Previa
              </button>
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  handlePrintAction(previewMode);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Lanzar Impresión ({previewMode === 'sheet' ? 'Hoja A4' : 'Tickets'})</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
