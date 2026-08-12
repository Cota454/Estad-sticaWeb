import React, { useState, useMemo, useEffect } from 'react';
import {
  Network,
  Upload,
  FileSpreadsheet,
  Table,
  MapPin,
  Sliders,
  Cloud,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Building2,
  Users,
  Cable,
  Layers,
  Trash2,
  Calendar,
  SlidersHorizontal,
  Info,
  ListFilter,
  X
} from 'lucide-react';

import {
  Central,
  WorkGroup,
  DailyReport,
  RepairRecord,
  CustomTableSchema,
  RepairColumnMapping,
  UserProfile,
  SystemDataBackup
} from '../types';

import {
  ZoneConfig,
  CableClassificationRules,
  IpCableExcelParseResult,
  IpCableRow,
  NetworkTypeCategory
} from '../types/ipCablesTypes';

import {
  loadZones,
  saveZones,
  loadCableRules,
  saveCableRules,
  loadParsedIpData,
  saveParsedIpData,
  clearParsedIpData
} from '../utils/ipCablesStorage';

import {
  parseIpCablesExcelFile,
  generateSampleIpCablesData,
  classifyNetworkType
} from '../utils/ipCablesExcelParser';

import { ZoneManagementModal } from './ZoneManagementModal';
import { CableClassificationView } from './CableClassificationView';
import { GoogleDriveBackupView } from './GoogleDriveBackupView';
import { PrintReportsView } from './PrintReportsView';
import { CopyTableButton } from './CopyButton';

interface AnalisisIpViewProps {

  onBackToHub: () => void;
  centrales?: Central[];
  workGroups?: WorkGroup[];
  reports?: DailyReport[];
  repairRecords?: RepairRecord[];
  customTables?: CustomTableSchema[];
  repairColumnMapping?: RepairColumnMapping;
  onImportBackup?: (backup: SystemDataBackup) => void;
  currentUser?: UserProfile;
  onUpdateCurrentUser?: (user: UserProfile) => void;
}

export const AnalisisIpView: React.FC<AnalisisIpViewProps> = ({
  onBackToHub,
  centrales = [],
  workGroups = [],
  reports = [],
  repairRecords = [],
  customTables = [],
  repairColumnMapping,
  onImportBackup,
  currentUser,
  onUpdateCurrentUser
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'matrices' | 'ip_cables' | 'print_reports' | 'cable_settings' | 'backup'>('matrices');


  // Loaded Excel State & Cable Rules & Zones State
  const [cableRules, setCableRules] = useState<CableClassificationRules>(loadCableRules);
  const [zones, setZones] = useState<ZoneConfig[]>(loadZones);
  const [excelData, setExcelData] = useState<IpCableExcelParseResult | null>(() => {
    const saved = loadParsedIpData();
    return saved || generateSampleIpCablesData(loadCableRules());
  });

  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Modals & UI Controls
  const [isZoneModalOpen, setIsZoneModalOpen] = useState<boolean>(false);

  // Filters for Pestaña 2 (IP Cables)
  const [selectedCentralFilter, setSelectedCentralFilter] = useState<string>('all');
  const [selectedNetworkTypeFilter, setSelectedNetworkTypeFilter] = useState<NetworkTypeCategory>('all');
  const [selectedMonthYearFilter, setSelectedMonthYearFilter] = useState<string>('all'); // e.g. "2026-8"
  const [cableSearchTerm, setCableSearchTerm] = useState<string>('');
  const [cableSortOrder, setCableSortOrder] = useState<'desc' | 'asc' | 'alpha'>('desc');

  // Handle Excel Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsParsing(true);
    setParseError(null);

    try {
      const parsed = await parseIpCablesExcelFile(file, cableRules);
      setExcelData(parsed);
      saveParsedIpData(parsed);
    } catch (err: any) {
      console.error('Error al procesar archivo Excel:', err);
      setParseError(err?.message || 'Error al procesar el archivo Excel. Asegúrese de que tenga al menos 4 filas.');
    } finally {
      setIsParsing(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleLoadSampleData = () => {
    const sample = generateSampleIpCablesData(cableRules);
    setExcelData(sample);
    saveParsedIpData(sample);
    setParseError(null);
  };

  const handleClearExcelData = () => {
    clearParsedIpData();
    setExcelData(null);
  };

  // Re-run network type classification if rules change
  const handleRulesUpdated = (newRules: CableClassificationRules) => {
    setCableRules(newRules);
    if (excelData) {
      const updatedRows = excelData.consolidatedRows.map(row => {
        const classification = classifyNetworkType(row.cable, row.central, newRules);
        return {
          ...row,
          networkType: classification.networkType,
          networkTypeLabel: classification.networkTypeLabel
        };
      });

      const updatedData = {
        ...excelData,
        consolidatedRows: updatedRows
      };

      setExcelData(updatedData);
      saveParsedIpData(updatedData);
    }
  };

  // --- COMPUTED DATA FOR MATRICES (PESTAÑA 1) ---

  // 1. Matrix 1: Centrales Telefónicas vs GRUPO (Contabiliza SERVICIOS CONSOLIDADOS)
  const matrixCentralesData = useMemo(() => {
    if (!excelData) return { rows: [], columns: [], cellMap: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };

    const rowsList = excelData.uniqueCentrales.length > 0 ? excelData.uniqueCentrales : ['CENTRAL GENERAL'];
    const colsList = excelData.uniqueGroups.length > 0 ? excelData.uniqueGroups : ['GRUPO GENERAL'];

    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    rowsList.forEach(r => {
      cellMap[r] = {};
      rowTotals[r] = 0;
      colsList.forEach(c => { cellMap[r][c] = 0; });
    });

    colsList.forEach(c => { colTotals[c] = 0; });

    excelData.consolidatedRows.forEach(item => {
      const cnt = item.central || 'CENTRAL GENERAL';
      const grp = item.grupo || 'GRUPO GENERAL';

      // Split if multiple groups merged
      const groupsInItem = grp.split('/').map(g => g.trim());

      groupsInItem.forEach(g => {
        if (!cellMap[cnt]) {
          cellMap[cnt] = {};
          rowTotals[cnt] = 0;
          if (!rowsList.includes(cnt)) rowsList.push(cnt);
        }
        if (!colsList.includes(g)) {
          colsList.push(g);
          colTotals[g] = 0;
        }

        // Each consolidated item counts as 1 service
        cellMap[cnt][g] = (cellMap[cnt][g] || 0) + 1;
        rowTotals[cnt] = (rowTotals[cnt] || 0) + 1;
        colTotals[g] = (colTotals[g] || 0) + 1;
        grandTotal += 1;
      });
    });

    return {
      rows: rowsList.sort(),
      columns: colsList.sort(),
      cellMap,
      rowTotals,
      colTotals,
      grandTotal
    };
  }, [excelData]);

  // 2. Matrix 2: Zonificación vs GRUPO (Contabiliza SERVICIOS CONSOLIDADOS)
  const matrixZonasData = useMemo(() => {
    if (!excelData) return { rows: [], columns: [], cellMap: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };

    const colsList = [...matrixCentralesData.columns];
    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    zones.forEach(z => {
      cellMap[z.name] = {};
      rowTotals[z.name] = 0;
      colsList.forEach(c => { cellMap[z.name][c] = 0; });
    });

    colsList.forEach(c => { colTotals[c] = 0; });

    excelData.consolidatedRows.forEach(item => {
      const itemCentral = (item.central || '').trim().toUpperCase();
      const itemCable = (item.cable || '').trim().toUpperCase();
      const rawGroups = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim()).filter(Boolean);
      const uniqueGroupsInItem = Array.from(new Set(rawGroups));

      zones.forEach(z => {
        // Check if item belongs to Zone by Central or Cable
        const matchesCentral = z.centralNames.some(cn => {
          const trimmed = cn.trim().toUpperCase();
          return trimmed.length > 0 && itemCentral.includes(trimmed);
        });
        const matchesCable = z.cableNames.some(cb => {
          const trimmed = cb.trim().toUpperCase();
          return trimmed.length > 0 && itemCable === trimmed;
        });

        if (matchesCentral || matchesCable) {
          uniqueGroupsInItem.forEach(g => {
            if (cellMap[z.name][g] === undefined) {
              cellMap[z.name][g] = 0;
            }
            if (colTotals[g] === undefined) {
              colTotals[g] = 0;
            }
            // Each consolidated item counts as 1 service
            cellMap[z.name][g] = (cellMap[z.name][g] || 0) + 1;
            rowTotals[z.name] = (rowTotals[z.name] || 0) + 1;
            colTotals[g] = (colTotals[g] || 0) + 1;
            grandTotal += 1;
          });
        }
      });
    });

    return {
      rows: zones.map(z => z.name),
      columns: colsList,
      cellMap,
      rowTotals,
      colTotals,
      grandTotal
    };
  }, [excelData, zones, matrixCentralesData.columns]);

  // Cell Click Modal State (Pestaña 1 Matrices)
  const [selectedCellFilter, setSelectedCellFilter] = useState<{
    title: string;
    subtitle: string;
    matrixType: 'centrales' | 'zonas';
    rowName?: string;
    colName?: string;
  } | null>(null);
  const [cellModalSearch, setCellModalSearch] = useState<string>('');

  // Filtered services list for Cell Click Modal
  const cellServicesList = useMemo(() => {
    if (!selectedCellFilter || !excelData) return [];

    const { matrixType, rowName, colName } = selectedCellFilter;

    return excelData.consolidatedRows.filter(item => {
      const itemCentral = (item.central || '').trim().toUpperCase();
      const itemCable = (item.cable || '').trim().toUpperCase();
      const rawGroups = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim().toUpperCase()).filter(Boolean);

      // Filter by group if colName is specified
      if (colName) {
        const matchGroup = rawGroups.includes(colName.trim().toUpperCase());
        if (!matchGroup) return false;
      }

      // Filter by row (Central or Zone) if rowName is specified
      if (rowName) {
        if (matrixType === 'centrales') {
          const matchCentral = itemCentral.includes(rowName.trim().toUpperCase());
          if (!matchCentral) return false;
        } else if (matrixType === 'zonas') {
          const z = zones.find(zone => zone.name === rowName);
          if (!z) return false;

          const matchesCentral = z.centralNames.some(cn => {
            const trimmed = cn.trim().toUpperCase();
            return trimmed.length > 0 && itemCentral.includes(trimmed);
          });
          const matchesCable = z.cableNames.some(cb => {
            const trimmed = cb.trim().toUpperCase();
            return trimmed.length > 0 && itemCable === trimmed;
          });

          if (!matchesCentral && !matchesCable) return false;
        }
      } else if (matrixType === 'zonas') {
        // If no rowName specified for Zonas (e.g. Column Total or Grand Total for Zonas), check if item belongs to ANY zone
        const matchesAnyZone = zones.some(z => {
          const matchesCentral = z.centralNames.some(cn => {
            const trimmed = cn.trim().toUpperCase();
            return trimmed.length > 0 && itemCentral.includes(trimmed);
          });
          const matchesCable = z.cableNames.some(cb => {
            const trimmed = cb.trim().toUpperCase();
            return trimmed.length > 0 && itemCable === trimmed;
          });
          return matchesCentral || matchesCable;
        });
        if (!matchesAnyZone) return false;
      }

      return true;
    });
  }, [selectedCellFilter, excelData, zones]);

  const displayModalServices = useMemo(() => {
    if (!cellModalSearch.trim()) return cellServicesList;
    const q = cellModalSearch.trim().toLowerCase();
    return cellServicesList.filter(s =>
      s.servicio.toLowerCase().includes(q) ||
      s.central.toLowerCase().includes(q) ||
      s.cable.toLowerCase().includes(q) ||
      s.grupo.toLowerCase().includes(q) ||
      (s.tipoRed && s.tipoRed.toLowerCase().includes(q))
    );
  }, [cellServicesList, cellModalSearch]);

  // --- COMPUTED DATA FOR IP CABLES TAB (PESTAÑA 2) ---
  const filteredIpCablesRows = useMemo(() => {
    if (!excelData) return [];

    return excelData.consolidatedRows.filter(item => {
      // 1. Filter Central
      if (selectedCentralFilter !== 'all') {
        if ((item.central || '').trim().toUpperCase() !== selectedCentralFilter.trim().toUpperCase()) {
          return false;
        }
      }

      // 2. Filter Network Type
      if (selectedNetworkTypeFilter !== 'all') {
        if (item.networkType !== selectedNetworkTypeFilter) {
          return false;
        }
      }

      // 3. Filter Month / Year
      if (selectedMonthYearFilter !== 'all') {
        const [y, m] = selectedMonthYearFilter.split('-').map(n => parseInt(n, 10));
        if (item.fechaReporte && item.fechaReporte.length >= 7) {
          const parts = item.fechaReporte.split('-');
          const rowY = parseInt(parts[0], 10);
          const rowM = parseInt(parts[1], 10);
          if (rowY !== y || rowM !== m) return false;
        }
      }

      // 4. Cable Search
      if (cableSearchTerm.trim()) {
        const query = cableSearchTerm.trim().toLowerCase();
        const cableVal = (item.cable || '').toLowerCase();
        const srvVal = (item.servicio || '').toLowerCase();
        if (!cableVal.includes(query) && !srvVal.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [excelData, selectedCentralFilter, selectedNetworkTypeFilter, selectedMonthYearFilter, cableSearchTerm]);

  // Matrix Cables vs GRUPO (filtered, Contabiliza SERVICIOS CONSOLIDADOS y ordena de Mayor a Menor/Viceversa)
  const matrixCablesData = useMemo(() => {
    if (!filteredIpCablesRows.length) {
      return { rows: [], columns: [], cellMap: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };
    }

    const cablesSet = new Set<string>();
    const groupsSet = new Set<string>();

    filteredIpCablesRows.forEach(item => {
      if (item.cable) {
        item.cable.split('/').forEach(c => cablesSet.add(c.trim()));
      }
      if (item.grupo) {
        item.grupo.split('/').forEach(g => groupsSet.add(g.trim()));
      }
    });

    const rowsList = Array.from(cablesSet);
    const colsList = Array.from(groupsSet).sort();

    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    rowsList.forEach(r => {
      cellMap[r] = {};
      rowTotals[r] = 0;
      colsList.forEach(c => { cellMap[r][c] = 0; });
    });

    colsList.forEach(c => { colTotals[c] = 0; });

    filteredIpCablesRows.forEach(item => {
      const cablesInItem = (item.cable || 'CABLE GENERAL').split('/').map(c => c.trim());
      const groupsInItem = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim());

      cablesInItem.forEach(c => {
        groupsInItem.forEach(g => {
          if (!cellMap[c]) {
            cellMap[c] = {};
            rowTotals[c] = 0;
            if (!rowsList.includes(c)) rowsList.push(c);
          }
          if (!colsList.includes(g)) {
            colsList.push(g);
            colTotals[g] = 0;
          }

          // Each consolidated service counts as 1
          cellMap[c][g] = (cellMap[c][g] || 0) + 1;
          rowTotals[c] = (rowTotals[c] || 0) + 1;
          colTotals[g] = (colTotals[g] || 0) + 1;
          grandTotal += 1;
        });
      });
    });

    // Sort rows according to cableSortOrder
    const sortedRowsList = [...rowsList].sort((a, b) => {
      if (cableSortOrder === 'desc') {
        return (rowTotals[b] || 0) - (rowTotals[a] || 0) || a.localeCompare(b);
      } else if (cableSortOrder === 'asc') {
        return (rowTotals[a] || 0) - (rowTotals[b] || 0) || a.localeCompare(b);
      } else {
        return a.localeCompare(b);
      }
    });

    return {
      rows: sortedRowsList,
      columns: colsList,
      cellMap,
      rowTotals,
      colTotals,
      grandTotal
    };
  }, [filteredIpCablesRows, cableSortOrder]);

  // Copy Headers & Rows for Matrix Centrales x Grupos
  const copyCentralesHeaders = useMemo(() => {
    return ['Central Telefónica', ...matrixCentralesData.columns, 'Total General'];
  }, [matrixCentralesData.columns]);

  const copyCentralesRows = useMemo(() => {
    return matrixCentralesData.rows.map(r => [
      r,
      ...matrixCentralesData.columns.map(c => matrixCentralesData.cellMap[r]?.[c] || 0),
      matrixCentralesData.rowTotals[r] || 0
    ]);
  }, [matrixCentralesData]);

  // Copy Headers & Rows for Matrix Zonas x Grupos
  const copyZonasHeaders = useMemo(() => {
    return ['Zona', ...matrixZonasData.columns, 'Total General'];
  }, [matrixZonasData.columns]);

  const copyZonasRows = useMemo(() => {
    return matrixZonasData.rows.map(r => [
      r,
      ...matrixZonasData.columns.map(c => matrixZonasData.cellMap[r]?.[c] || 0),
      matrixZonasData.rowTotals[r] || 0
    ]);
  }, [matrixZonasData]);

  // Copy Headers & Rows for Matrix Cables x Grupos
  const copyCablesHeaders = useMemo(() => {
    return ['Nombre de Cable', ...matrixCablesData.columns, 'Total General'];
  }, [matrixCablesData.columns]);

  const copyCablesRows = useMemo(() => {
    return matrixCablesData.rows.map(r => [
      r,
      ...matrixCablesData.columns.map(c => matrixCablesData.cellMap[r]?.[c] || 0),
      matrixCablesData.rowTotals[r] || 0
    ]);
  }, [matrixCablesData]);

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-300">

      {/* Top Banner & Module Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBackToHub}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 transition-all hover:scale-105"
              title="Volver al Portal de Módulos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full border border-blue-500/30 font-bold uppercase font-mono">
                  Módulo 02
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Análisis de IP y Cables v2.8</span>
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-1">
                Análisis de IP, Cables y Zonificación
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Consolidación por SERVICIO, matrices Centrales y Zonas vs Grupos, monitoreo por Cables y clasificación de Red Rígida, Flexible y Outdoor.
              </p>
            </div>
          </div>

          {/* Module Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('matrices')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'matrices'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-blue-400" />
              <span>1. Matrices (Centrales / Zonas)</span>
            </button>

            <button
              onClick={() => setActiveTab('ip_cables')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ip_cables'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Cable className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. IP Cables</span>
            </button>

            <button
              onClick={() => setActiveTab('print_reports')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'print_reports'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
              <span>3. Impresión y Reportes</span>
            </button>

            <button
              onClick={() => setActiveTab('cable_settings')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'cable_settings'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>4. Ajustes de Cables</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'backup'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/30'
                  : 'bg-slate-800 text-purple-300 hover:bg-slate-700'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              <span>5. Respaldos Drive</span>
            </button>
          </div>
        </div>
      </div>

      {/* Excel File Upload Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-white">Cargar Archivo Excel de Datos</span>
                {excelData && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    Cargado: {excelData.fileName}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs">
                Regla: <strong>Ignora las primeras 3 filas</strong>. La <strong>4ª fila</strong> contiene los encabezados. Consolida datos repetidos en la columna <strong>SERVICIO</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 border border-emerald-400/30 flex items-center space-x-2">
              {isParsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{isParsing ? 'Procesando Excel...' : 'Subir Excel (.xlsx)'}</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                disabled={isParsing}
                className="hidden"
              />
            </label>

            {!excelData ? (
              <button
                onClick={handleLoadSampleData}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all"
              >
                Cargar Muestra
              </button>
            ) : (
              <button
                onClick={handleClearExcelData}
                className="p-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition-all"
                title="Limpiar datos Excel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {parseError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold flex items-center space-x-2">
            <Info className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {excelData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Filas Leídas:</span>
              <strong className="text-amber-400 font-mono text-sm">{excelData.totalRowsRead}</strong>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Servicios Consolidados:</span>
              <strong className="text-emerald-400 font-mono text-sm">{excelData.uniqueServicesCount}</strong>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Centrales Únicas:</span>
              <strong className="text-blue-400 font-mono text-sm">{excelData.uniqueCentrales.length}</strong>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Cables Identificados:</span>
              <strong className="text-indigo-400 font-mono text-sm">{excelData.uniqueCables.length}</strong>
            </div>
          </div>
        )}
      </div>

      {/* PESTAÑA 1: MATRICES (CENTRALES Y ZONAS VS GRUPOS) */}
      {activeTab === 'matrices' && (
        <div className="space-y-6">

          {/* Table 1: Centrales Telefónicas vs GRUPO */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <span>Matriz de Reportes: Centrales Telefónicas vs GRUPO</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Muestra la cantidad de incidencias consolidadas por Central Telefónica y Grupo de Trabajo.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <CopyTableButton headers={copyCentralesHeaders} rows={copyCentralesRows} label="Copiar Tabla Centrales" />
              </div>
            </div>

            <div className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-black text-white">Central Telefónica</th>
                    {matrixCentralesData.columns.map(col => (
                      <th key={col} className="py-3.5 px-4 text-center">{col}</th>
                    ))}
                    <th className="py-3.5 px-4 text-center text-amber-400 font-black">Total General</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {matrixCentralesData.rows.map(rowName => {
                    const rowTotal = matrixCentralesData.rowTotals[rowName] || 0;
                    return (
                      <tr key={rowName} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center space-x-2">
                          <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{rowName}</span>
                        </td>
                        {matrixCentralesData.columns.map(colName => {
                          const val = matrixCentralesData.cellMap[rowName]?.[colName] || 0;
                          return (
                            <td key={colName} className="py-3.5 px-4 text-center font-mono">
                              {val > 0 ? (
                                <button
                                  onClick={() => setSelectedCellFilter({
                                    matrixType: 'centrales',
                                    rowName,
                                    colName,
                                    title: `Servicios: ${rowName} / ${colName}`,
                                    subtitle: `Lista de servicios consolidados de ${rowName} en ${colName}`
                                  })}
                                  className="font-black text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white border border-slate-700 hover:border-blue-400 transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Ver servicios consolidados"
                                >
                                  {val}
                                </button>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400 text-sm bg-slate-900/40">
                          {rowTotal > 0 ? (
                            <button
                              onClick={() => setSelectedCellFilter({
                                matrixType: 'centrales',
                                rowName,
                                title: `Servicios: Total Central ${rowName}`,
                                subtitle: `Todos los servicios consolidados de ${rowName}`
                              })}
                              className="font-black text-amber-400 hover:text-white hover:underline cursor-pointer transition-all"
                              title="Ver todos los servicios de esta central"
                            >
                              {rowTotal}
                            </button>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 font-black text-white border-t-2 border-slate-700">
                  <tr>
                    <td className="py-3.5 px-4 uppercase text-[11px] text-slate-300 font-mono">TOTAL GENERAL</td>
                    {matrixCentralesData.columns.map(colName => {
                      const colTot = matrixCentralesData.colTotals[colName] || 0;
                      return (
                        <td key={colName} className="py-3.5 px-4 text-center font-mono text-blue-400 text-sm">
                          {colTot > 0 ? (
                            <button
                              onClick={() => setSelectedCellFilter({
                                matrixType: 'centrales',
                                colName,
                                title: `Servicios: Total ${colName}`,
                                subtitle: `Todos los servicios consolidados pertenecientes a ${colName}`
                              })}
                              className="font-black text-blue-400 hover:text-white hover:underline cursor-pointer transition-all"
                              title="Ver todos los servicios de este grupo"
                            >
                              {colTot}
                            </button>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3.5 px-4 text-center font-mono text-amber-400 text-base font-black bg-slate-950">
                      {matrixCentralesData.grandTotal > 0 ? (
                        <button
                          onClick={() => setSelectedCellFilter({
                            matrixType: 'centrales',
                            title: `Servicios: Total General Centrales`,
                            subtitle: `Todos los servicios consolidados del reporte`
                          })}
                          className="font-black text-amber-400 hover:text-white hover:underline cursor-pointer transition-all"
                          title="Ver todos los servicios del reporte"
                        >
                          {matrixCentralesData.grandTotal}
                        </button>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Table 2: Zonificación vs GRUPO */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <span>Matriz de Zonificación vs GRUPO</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Muestra las incidencias consolidadas por Zonas configuradas y Grupo de Trabajo.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsZoneModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-1.5"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Gestor y Dashboard de Zonas</span>
                </button>
                <CopyTableButton headers={copyZonasHeaders} rows={copyZonasRows} label="Copiar Tabla Zonas" />
              </div>
            </div>

            <div className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-black text-white">Zonas Configuradas</th>
                    {matrixZonasData.columns.map(col => (
                      <th key={col} className="py-3.5 px-4 text-center">{col}</th>
                    ))}
                    <th className="py-3.5 px-4 text-center text-amber-400 font-black">Total General</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {matrixZonasData.rows.map(rowName => {
                    const rowTotal = matrixZonasData.rowTotals[rowName] || 0;
                    const zoneObj = zones.find(z => z.name === rowName);
                    return (
                      <tr key={rowName} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center space-x-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: zoneObj?.color || '#3B82F6' }}
                          />
                          <span>{rowName}</span>
                        </td>
                        {matrixZonasData.columns.map(colName => {
                          const val = matrixZonasData.cellMap[rowName]?.[colName] || 0;
                          return (
                            <td key={colName} className="py-3.5 px-4 text-center font-mono">
                              {val > 0 ? (
                                <button
                                  onClick={() => setSelectedCellFilter({
                                    matrixType: 'zonas',
                                    rowName,
                                    colName,
                                    title: `Servicios: ${rowName} / ${colName}`,
                                    subtitle: `Servicios consolidados mapeados a ${rowName} en ${colName}`
                                  })}
                                  className="font-black text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-600 hover:text-white border border-emerald-800/40 hover:border-emerald-400 transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Ver servicios consolidados de esta zona"
                                >
                                  {val}
                                </button>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400 text-sm bg-slate-900/40">
                          {rowTotal > 0 ? (
                            <button
                              onClick={() => setSelectedCellFilter({
                                matrixType: 'zonas',
                                rowName,
                                title: `Servicios: Total ${rowName}`,
                                subtitle: `Todos los servicios consolidados mapeados a ${rowName}`
                              })}
                              className="font-black text-amber-400 hover:text-white hover:underline cursor-pointer transition-all"
                              title="Ver todos los servicios de esta zona"
                            >
                              {rowTotal}
                            </button>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 font-black text-white border-t-2 border-slate-700">
                  <tr>
                    <td className="py-3.5 px-4 uppercase text-[11px] text-slate-300 font-mono">TOTAL GENERAL ZONAS</td>
                    {matrixZonasData.columns.map(colName => {
                      const colTot = matrixZonasData.colTotals[colName] || 0;
                      return (
                        <td key={colName} className="py-3.5 px-4 text-center font-mono text-emerald-400 text-sm">
                          {colTot > 0 ? (
                            <button
                              onClick={() => setSelectedCellFilter({
                                matrixType: 'zonas',
                                colName,
                                title: `Servicios: Total Zonas - ${colName}`,
                                subtitle: `Servicios consolidados en Zonas pertenecientes a ${colName}`
                              })}
                              className="font-black text-emerald-400 hover:text-white hover:underline cursor-pointer transition-all"
                              title="Ver servicios de esta columna en Zonas"
                            >
                              {colTot}
                            </button>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3.5 px-4 text-center font-mono text-amber-400 text-base font-black bg-slate-950">
                      {matrixZonasData.grandTotal > 0 ? (
                        <button
                          onClick={() => setSelectedCellFilter({
                            matrixType: 'zonas',
                            title: `Servicios: Total General Zonas`,
                            subtitle: `Todos los servicios consolidados clasificados en Zonas`
                          })}
                          className="font-black text-amber-400 hover:text-white hover:underline cursor-pointer transition-all"
                          title="Ver todos los servicios clasificados en Zonas"
                        >
                          {matrixZonasData.grandTotal}
                        </button>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA 2: IP CABLES (TABLA POR CABLE CON FILTROS) */}
      {activeTab === 'ip_cables' && (
        <div className="space-y-6">

          {/* Control Bar & Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <Cable className="w-5 h-5 text-emerald-400" />
                  <span>Monitoreo e Inventario de IP Cables por Grupo</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filtre las incidencias por Central, Tipo de Red (Rígida, Flexible, Outdoor) y Fecha de Reporte.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <CopyTableButton headers={copyCablesHeaders} rows={copyCablesRows} label="Copiar Tabla Cables" />
              </div>
            </div>

            {/* Filter Controls Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

              {/* 1. Central Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  1. Central Telefónica
                </label>
                <select
                  value={selectedCentralFilter}
                  onChange={(e) => setSelectedCentralFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Todas las Centrales</option>
                  {excelData?.uniqueCentrales.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* 2. Network Type Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  2. Tipo de Red
                </label>
                <select
                  value={selectedNetworkTypeFilter}
                  onChange={(e) => setSelectedNetworkTypeFilter(e.target.value as NetworkTypeCategory)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Todas las Redes</option>
                  <option value="rigida">Red Rígida</option>
                  <option value="flexible">Red Flexible</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </div>

              {/* 3. Month & Year Filter (FECHA REPORTE) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  3. Mes y Año (FECHA REPORTE)
                </label>
                <select
                  value={selectedMonthYearFilter}
                  onChange={(e) => setSelectedMonthYearFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Todos los Meses / Años</option>
                  {excelData?.uniqueMonthsYears.map(my => (
                    <option key={`${my.year}-${my.month}`} value={`${my.year}-${my.month}`}>
                      {my.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Cable Name Search */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  4. Buscar por Cable / Servicio
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Ej. CR-101 o SER-10023"
                    value={cableSearchTerm}
                    onChange={(e) => setCableSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* 5. Sort Order Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  5. Ordenar Totales
                </label>
                <select
                  value={cableSortOrder}
                  onChange={(e) => setCableSortOrder(e.target.value as 'desc' | 'asc' | 'alpha')}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="desc">De Mayor a Menor (↓)</option>
                  <option value="asc">De Menor a Mayor (↑)</option>
                  <option value="alpha">Nombre de Cable (A - Z)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Matrix Cables vs GRUPO */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">
                Mostrando <strong className="text-white">{matrixCablesData.rows.length}</strong> cables filtrados.
              </span>
            </div>

            <div className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-black text-white">Nombre de Cable</th>
                    {matrixCablesData.columns.map(col => (
                      <th key={col} className="py-3.5 px-4 text-center">{col}</th>
                    ))}
                    <th className="py-3.5 px-4 text-center text-amber-400 font-black">Total General</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {matrixCablesData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={matrixCablesData.columns.length + 2} className="py-8 text-center text-slate-500 italic">
                        No se encontraron cables que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    matrixCablesData.rows.map(cableName => {
                      const rowTotal = matrixCablesData.rowTotals[cableName] || 0;
                      return (
                        <tr key={cableName} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-300 flex items-center space-x-2">
                            <Cable className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{cableName}</span>
                          </td>
                          {matrixCablesData.columns.map(colName => {
                            const val = matrixCablesData.cellMap[cableName]?.[colName] || 0;
                            return (
                              <td key={colName} className="py-3.5 px-4 text-center font-mono">
                                {val > 0 ? (
                                  <span className="font-black text-emerald-300 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/50">
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400 text-sm bg-slate-900/40">
                            {rowTotal}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-900 font-black text-white border-t-2 border-slate-700">
                  <tr>
                    <td className="py-3.5 px-4 uppercase text-[11px] text-slate-300 font-mono">TOTAL CABLES FILTRADOS</td>
                    {matrixCablesData.columns.map(colName => (
                      <td key={colName} className="py-3.5 px-4 text-center font-mono text-emerald-400 text-sm">
                        {matrixCablesData.colTotals[colName] || 0}
                      </td>
                    ))}
                    <td className="py-3.5 px-4 text-center font-mono text-amber-400 text-base font-black bg-slate-950">
                      {matrixCablesData.grandTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA 3: IMPRESIÓN Y REPORTES */}
      {activeTab === 'print_reports' && (
        <PrintReportsView
          excelData={excelData}
          onUpdateExcelData={setExcelData}
        />
      )}

      {/* PESTAÑA 4: AJUSTES DE CABLES */}
      {activeTab === 'cable_settings' && (
        <CableClassificationView
          rules={cableRules}
          onRulesUpdated={handleRulesUpdated}
          availableCables={excelData?.uniqueCables || []}
          availableCentrales={excelData?.uniqueCentrales || []}
        />
      )}

      {/* PESTAÑA 4: COPIA DE SEGURIDAD (DRIVE) */}
      {activeTab === 'backup' && (
        currentUser && onImportBackup ? (
          <GoogleDriveBackupView
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
            repairRecords={repairRecords}
            customTables={customTables}
            repairColumnMapping={repairColumnMapping}
            onImportBackup={onImportBackup}
            currentUser={currentUser}
            onUpdateCurrentUser={onUpdateCurrentUser || (() => {})}
          />
        ) : (
          <div className="bg-slate-900 text-white p-8 rounded-3xl text-center space-y-3">
            <Cloud className="w-10 h-10 text-blue-400 mx-auto" />
            <h3 className="text-lg font-bold">Copia de Seguridad no disponible</h3>
            <p className="text-xs text-slate-400">Por favor, inicie sesión en la plataforma para acceder al gestor de respaldos de Google Drive.</p>
          </div>
        )
      )}

      {/* ZONE MANAGEMENT MODAL */}
      <ZoneManagementModal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        zones={zones}
        availableCentrales={excelData?.uniqueCentrales.length ? excelData.uniqueCentrales : centrales.map(c => c.name)}
        availableCables={excelData?.uniqueCables || []}
        onZonesUpdated={(updated) => setZones(updated)}
      />

      {/* CELL CLICK DRILL-DOWN MODAL */}
      {selectedCellFilter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white max-w-5xl w-full space-y-4 shadow-2xl max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-2xl">
                  <ListFilter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">{selectedCellFilter.title}</h3>
                  <p className="text-xs text-slate-400">{selectedCellFilter.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-xl text-xs font-bold font-mono">
                  {cellServicesList.length} Servicios
                </span>
                <button
                  onClick={() => setSelectedCellFilter(null)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Filter input inside Modal */}
            <div className="flex items-center justify-between gap-3 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por servicio, central, cable, grupo o red..."
                  value={cellModalSearch}
                  onChange={(e) => setCellModalSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
              <CopyTableButton
                headers={['N°', 'SERVICIO', 'CENTRAL', 'CABLE', 'GRUPO', 'TIPO RED', 'FECHA']}
                rows={displayModalServices.map((s, idx) => [
                  (idx + 1).toString(),
                  s.servicio,
                  s.central,
                  s.cable,
                  s.grupo,
                  s.tipoRed || '-',
                  s.fechaReporte || '-'
                ])}
                label="Copiar Servicios"
              />
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto bg-slate-950 rounded-2xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 text-center text-slate-500 w-12">#</th>
                    <th className="py-3 px-4 text-white font-black">Servicio / abonado</th>
                    <th className="py-3 px-4">Central</th>
                    <th className="py-3 px-4">Cable</th>
                    <th className="py-3 px-4">Grupo de Trabajo</th>
                    <th className="py-3 px-4">Clasificación Red</th>
                    <th className="py-3 px-4 text-center">Fecha Reporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {displayModalServices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                        No se encontraron servicios consolidados para este filtro.
                      </td>
                    </tr>
                  ) : (
                    displayModalServices.map((item, idx) => (
                      <tr key={`${item.id}_${idx}`} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-amber-300 font-mono">{item.servicio}</td>
                        <td className="py-3 px-4 font-semibold text-white">{item.central}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{item.cable || '-'}</td>
                        <td className="py-3 px-4 text-indigo-300 font-bold">{item.grupo || 'GENERAL'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.tipoRed === 'Red Rígida'
                              ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                              : item.tipoRed === 'Red Flexible'
                              ? 'bg-blue-950/60 border-blue-800/60 text-blue-300'
                              : item.tipoRed === 'Gabinete Outdoor'
                              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {item.tipoRed || 'Sin clasificar'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 text-[11px] font-mono">
                          {item.fechaReporte || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <span>Mostrando {displayModalServices.length} de {cellServicesList.length} registros</span>
              <button
                onClick={() => setSelectedCellFilter(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
