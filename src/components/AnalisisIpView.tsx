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
  X,
  Clock,
  RotateCcw,
  Mail,
  EyeOff,
  Phone,
  Zap,
  Binary,
  Wrench,
  Download,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

import { ExecutiveReportModal } from './ExecutiveReportModal';
import { FloatingReportFAB } from './FloatingReportFAB';
import { CablePendingTasksView } from './CablePendingTasksView';

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
  NetworkTypeCategory,
  CablePendingTask
} from '../types/ipCablesTypes';

import {
  loadZones,
  saveZones,
  loadCableRules,
  saveCableRules,
  loadParsedIpData,
  saveParsedIpData,
  clearParsedIpData,
  loadCablePendingTasks
} from '../utils/ipCablesStorage';

import {
  parseIpCablesExcelFile,
  generateSampleIpCablesData,
  classifyNetworkType,
  cleanCableName,
  isCableExactMatch,
  matchCableInItem,
  matchCableInItemExact,
  matchZoneCableRule,
  extractTelefonoFromItem,
  extractAsociadoFromItem,
  extractTerminalFromItem,
  extractDireccionFromItem,
  matchTelefonoTypeFilter,
  optimizeAndSimplifyRows,
  TelefonoTypeFilter
} from '../utils/ipCablesExcelParser';

import { ZoneManagementModal } from './ZoneManagementModal';
import { CableClassificationView } from './CableClassificationView';
import { GoogleDriveBackupView } from './GoogleDriveBackupView';
import { PrintReportsView } from './PrintReportsView';
import { CopyTableButton } from './CopyButton';

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

/**
 * Matches delay in days against selected range filter
 */
export function matchDemoraFilter(days: number, filter: string): boolean {
  if (filter === 'all' || !filter) return true;
  if (filter === '0') return days === 0;
  if (filter === '1') return days === 1;
  if (filter === '2') return days === 2;
  if (filter === '3') return days === 3;
  if (filter === '4-30') return days >= 4 && days <= 30;
  if (filter === '31-60') return days >= 31 && days <= 60;
  if (filter === '61-90') return days >= 61 && days <= 90;
  if (filter === '91-180') return days >= 91 && days <= 180;
  if (filter === '181-365') return days >= 181 && days <= 365;
  if (filter === '>365') return days > 365;
  return true;
}

export interface CableMatrixRowItem {
  id: string; // unique identifier `${central}:::${cableName}`
  central: string;
  cableName: string;
  patterns?: string[];
}

/**
 * Extracts a clean representative cable name for a consolidated service row
 */
export const getCableForItem = (item: IpCableRow): string => {
  if (item.cableP && item.cableP.trim()) {
    const cleanP = cleanCableName(item.cableP.split('/')[0]).trim();
    if (cleanP && cleanP !== 'SIN CABLE') return cleanP;
  }
  if (item.cable && item.cable.trim()) {
    const firstPart = item.cable.split(/[\/,;]+/)[0];
    const cleanC = cleanCableName(firstPart).trim();
    if (cleanC && cleanC !== 'SIN CABLE') return cleanC;
  }
  if (item.cableS && item.cableS.trim()) {
    const cleanS = cleanCableName(item.cableS.split('/')[0]).trim();
    if (cleanS && cleanS !== 'SIN CABLE') return cleanS;
  }
  return 'SIN CABLE';
};

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
  const [activeTab, setActiveTab] = useState<'matrices' | 'ip_cables' | 'print_reports' | 'cable_settings' | 'backup' | 'cable_tasks'>('matrices');


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
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Filters for Pestaña 2 (IP Cables)
  const [selectedCentralFilter, setSelectedCentralFilter] = useState<string>('all');
  const [selectedNetworkTypeFilter, setSelectedNetworkTypeFilter] = useState<NetworkTypeCategory>('all');
  const [selectedMonthYearFilter, setSelectedMonthYearFilter] = useState<string>('all'); // e.g. "2026-8"
  const [cableSearchMode, setCableSearchMode] = useState<'cable' | 'servicio'>('cable');
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
        const classification = classifyNetworkType(row.cableP || row.cable, row.cableS || '', row.central, newRules);
        return {
          ...row,
          networkType: classification.networkType,
          networkTypeLabel: classification.networkTypeLabel,
          flexibleRuleId: classification.flexibleRuleId,
          flexibleAssignedName: classification.flexibleAssignedName
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

  // Matrix Filter States
  const [matrixDemoraFilter, setMatrixDemoraFilter] = useState<string>('all');
  const [matrixManualDate, setMatrixManualDate] = useState<string>('');
  const [matrixStartDate, setMatrixStartDate] = useState<string>('');
  const [matrixEndDate, setMatrixEndDate] = useState<string>('');
  const [matrixMonthFilter, setMatrixMonthFilter] = useState<string>('all');
  const [matrixYearFilter, setMatrixYearFilter] = useState<string>('all');
  const [matrixTelefonoFilter, setMatrixTelefonoFilter] = useState<TelefonoTypeFilter>('all');
  const [isOptimized, setIsOptimized] = useState<boolean>(false);
  const [hideZeroValues, setHideZeroValues] = useState<boolean>(false);

  // Handlers for Date Range Filter with strict validation (fecha inicial no puede ser mayor que la final)
  const handleMatrixStartDateChange = (val: string) => {
    setMatrixStartDate(val);
    if (val && matrixEndDate && val > matrixEndDate) {
      // Auto-correct end date so start date is never greater than end date
      setMatrixEndDate(val);
    }
  };

  const handleMatrixEndDateChange = (val: string) => {
    setMatrixEndDate(val);
    if (val && matrixStartDate && val < matrixStartDate) {
      // Auto-correct start date so end date is never less than start date
      setMatrixStartDate(val);
    }
  };

  const handleClearDateRange = () => {
    setMatrixStartDate('');
    setMatrixEndDate('');
  };

  const handleQuickDatePreset = (preset: 'today' | '7days' | 'thisMonth') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (preset === 'today') {
      setMatrixStartDate(todayStr);
      setMatrixEndDate(todayStr);
    } else if (preset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setMatrixStartDate(d7.toISOString().split('T')[0]);
      setMatrixEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setMatrixStartDate(firstDay.toISOString().split('T')[0]);
      setMatrixEndDate(todayStr);
    }
  };

  // Optimization Statistics (Shows how many records are simplified when Optimizar is on)
  const optimizationStats = useMemo(() => {
    if (!excelData) return { totalBase: 0, optimizedCount: 0, difference: 0 };
    const totalBase = excelData.consolidatedRows.length;
    const optimized = optimizeAndSimplifyRows(excelData.consolidatedRows);
    const optimizedCount = optimized.length;
    return {
      totalBase,
      optimizedCount,
      difference: Math.max(0, totalBase - optimizedCount)
    };
  }, [excelData]);

  // Available Years dynamically from dataset
  const availableMatrixYears = useMemo(() => {
    if (!excelData) return [];
    const yrSet = new Set<number>();
    excelData.consolidatedRows.forEach(item => {
      if (item.fechaReporte && item.fechaReporte.length >= 4) {
        const y = parseInt(item.fechaReporte.split('-')[0], 10);
        if (!isNaN(y)) yrSet.add(y);
      }
    });
    return Array.from(yrSet).sort((a, b) => b - a);
  }, [excelData]);

  // Rows filtered by Demora en Días (including manual date), Rango de Fechas, Mes, Año, Tipo de Teléfono, and Optimizar (Simplificación)
  const matrixFilteredConsolidatedRows = useMemo(() => {
    if (!excelData) return [];

    let baseRows = excelData.consolidatedRows;

    // 1. Optimization: Compare Teléfono & Asociado and collapse matching pairs into a single service
    if (isOptimized) {
      baseRows = optimizeAndSimplifyRows(baseRows);
    }

    return baseRows.filter(item => {
      // 2. Telefono Column Type Filter (Todos / Teléfono: solo números / TxD Dato: al menos una letra)
      if (matrixTelefonoFilter !== 'all') {
        if (!matchTelefonoTypeFilter(item, matrixTelefonoFilter)) return false;
      }

      // 3. Demora Filter / Manual Date Filter
      if (matrixDemoraFilter === 'manual_date') {
        if (matrixManualDate.trim()) {
          const itemDate = (item.fechaReporte || '').trim().slice(0, 10);
          if (itemDate !== matrixManualDate.trim()) return false;
        }
      } else {
        const days = getDemoraDays(item);
        if (!matchDemoraFilter(days, matrixDemoraFilter)) return false;
      }

      // 4. Date Range Filter (Fecha Inicial - Fecha Final)
      if (matrixStartDate || matrixEndDate) {
        const itemDate = (item.fechaReporte || '').trim().slice(0, 10);
        if (!itemDate) {
          return false;
        }
        if (matrixStartDate && itemDate < matrixStartDate) {
          return false;
        }
        if (matrixEndDate && itemDate > matrixEndDate) {
          return false;
        }
      }

      // 5. Month and Year Filter
      if (item.fechaReporte && item.fechaReporte.length >= 7) {
        const parts = item.fechaReporte.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);

        if (matrixYearFilter !== 'all' && y !== parseInt(matrixYearFilter, 10)) {
          return false;
        }
        if (matrixMonthFilter !== 'all' && m !== parseInt(matrixMonthFilter, 10)) {
          return false;
        }
      } else {
        if (matrixYearFilter !== 'all' || matrixMonthFilter !== 'all') {
          return false;
        }
      }

      return true;
    });
  }, [excelData, isOptimized, matrixTelefonoFilter, matrixDemoraFilter, matrixManualDate, matrixStartDate, matrixEndDate, matrixMonthFilter, matrixYearFilter]);

  // 1. Matrix 1: Centrales Telefónicas vs GRUPO (Contabiliza SERVICIOS CONSOLIDADOS)
  const matrixCentralesData = useMemo(() => {
    if (!excelData) return { rows: [], columns: [], cellMap: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };

    const rowsList = excelData.uniqueCentrales.length > 0 ? [...excelData.uniqueCentrales] : ['CENTRAL GENERAL'];
    const colsList = excelData.uniqueGroups.length > 0 ? [...excelData.uniqueGroups] : ['GRUPO GENERAL'];

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

    matrixFilteredConsolidatedRows.forEach(item => {
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
  }, [excelData, matrixFilteredConsolidatedRows]);

  // Helper function for exclusive, prioritized zone matching:
  // Step 1: If item's central belongs to a zone's centralNames, assign AUTOMATICALLY to that zone.
  // Step 2: If item's central is NOT in any zone, analyze strictly by Cable against zone cableNames (exact match).
  // Step 3: Returns null if no zone matched (Sin Zonificar).
  const findMatchingZoneForItem = (item: IpCableRow, zoneList: ZoneConfig[]): ZoneConfig | null => {
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
  };

  // 2. Matrix 2: Zonificación vs GRUPO (Contabiliza SERVICIOS CONSOLIDADOS)
  const matrixZonasData = useMemo(() => {
    if (!excelData) return { rows: [], columns: [], cellMap: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };

    const colsList = [...matrixCentralesData.columns];
    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    // Initialize map for configured zones
    zones.forEach(z => {
      cellMap[z.name] = {};
      rowTotals[z.name] = 0;
      colsList.forEach(c => { cellMap[z.name][c] = 0; });
    });

    // Initialize map for "Sin Zonificar"
    const UNZONED_KEY = 'Sin Zonificar';
    cellMap[UNZONED_KEY] = {};
    rowTotals[UNZONED_KEY] = 0;
    colsList.forEach(c => { cellMap[UNZONED_KEY][c] = 0; });

    colsList.forEach(c => { colTotals[c] = 0; });

    matrixFilteredConsolidatedRows.forEach(item => {
      const rawGroups = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim()).filter(Boolean);
      const uniqueGroupsInItem = Array.from(new Set(rawGroups));

      // Find exclusive single matching zone to avoid duplicate counting
      const matchedZone = findMatchingZoneForItem(item, zones);
      const targetZoneKey = matchedZone ? matchedZone.name : UNZONED_KEY;

      uniqueGroupsInItem.forEach((g: string) => {
        if (cellMap[targetZoneKey][g] === undefined) cellMap[targetZoneKey][g] = 0;
        if (colTotals[g] === undefined) colTotals[g] = 0;

        cellMap[targetZoneKey][g] = (cellMap[targetZoneKey][g] || 0) + 1;
        rowTotals[targetZoneKey] = (rowTotals[targetZoneKey] || 0) + 1;
        colTotals[g] = (colTotals[g] || 0) + 1;
        grandTotal += 1;
      });
    });

    const rows = [...zones.map(z => z.name)];
    if ((rowTotals[UNZONED_KEY] || 0) > 0) {
      rows.push(UNZONED_KEY);
    }

    return {
      rows,
      columns: colsList,
      cellMap,
      rowTotals,
      colTotals,
      grandTotal
    };
  }, [excelData, zones, matrixCentralesData.columns, matrixFilteredConsolidatedRows]);

  // --- COMPUTED DATA FOR IP CABLES TAB (PESTAÑA 2) ---

  // Exact Service Match Lookup for "Buscar por Servicio"
  const matchedServiceInfo = useMemo(() => {
    if (!excelData || cableSearchMode !== 'servicio' || !cableSearchTerm.trim()) {
      return null;
    }
    const q = cableSearchTerm.trim().toUpperCase();
    // Coincidencia exacta por número de servicio
    const matchingServices = excelData.consolidatedRows.filter(
      r => (r.servicio || '').trim().toUpperCase() === q
    );

    if (matchingServices.length === 0) {
      return { found: false, query: cableSearchTerm.trim(), cables: [], service: null, count: 0 };
    }

    const cablesSet = new Set<string>();
    matchingServices.forEach(item => {
      if (item.cableP) {
        item.cableP.split('/').forEach(c => {
          const cl = cleanCableName(c).toUpperCase();
          if (cl) cablesSet.add(cl);
        });
      }
      if (item.cableS) {
        item.cableS.split('/').forEach(c => {
          const cl = cleanCableName(c).toUpperCase();
          if (cl) cablesSet.add(cl);
        });
      }
      if (item.cable) {
        item.cable.split('/').forEach(c => {
          const cl = cleanCableName(c).toUpperCase();
          if (cl) cablesSet.add(cl);
        });
      }
    });

    const cablesList = Array.from(cablesSet);

    return {
      found: true,
      query: cableSearchTerm.trim(),
      cables: cablesList,
      service: matchingServices[0],
      matchingServices
    };
  }, [excelData, cableSearchMode, cableSearchTerm]);

  // Filtered rows for Pestaña 2
  const filteredIpCablesRows = useMemo(() => {
    if (!excelData) return [];

    let baseRows = excelData.consolidatedRows;
    if (isOptimized) {
      baseRows = optimizeAndSimplifyRows(baseRows);
    }

    return baseRows.filter(item => {
      // 1. Filter Central
      if (selectedCentralFilter !== 'all') {
        if ((item.central || '').trim().toUpperCase() !== selectedCentralFilter.trim().toUpperCase()) {
          return false;
        }
      }

      // 2. Filter Network Type (Strictly uses Red Flexible rules from Ajustes de Cables)
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
        } else {
          return false;
        }
      }

      // 4. Exact Search Logic (Cable vs Servicio)
      if (cableSearchTerm.trim()) {
        const query = cableSearchTerm.trim().toUpperCase();

        if (cableSearchMode === 'cable') {
          // Búsqueda exacta por cable
          const matchCable = matchCableInItemExact(item, query);
          if (!matchCable) return false;
        } else if (cableSearchMode === 'servicio') {
          // Búsqueda exacta por servicio: muestra todas las incidencias en el mismo cable del servicio buscado
          if (!matchedServiceInfo || !matchedServiceInfo.found || matchedServiceInfo.cables.length === 0) {
            return false;
          }
          const sharesCable = matchedServiceInfo.cables.some(cbl => matchCableInItemExact(item, cbl));
          if (!sharesCable) return false;
        }
      }

      return true;
    });
  }, [excelData, isOptimized, selectedCentralFilter, selectedNetworkTypeFilter, selectedMonthYearFilter, cableSearchTerm, cableSearchMode, matchedServiceInfo]);

  // Cell Click Modal State (Pestañas 1 y 2)
  const [selectedCellFilter, setSelectedCellFilter] = useState<{
    title: string;
    subtitle: string;
    matrixType: 'centrales' | 'zonas' | 'cables';
    rowCentral?: string;
    rowName?: string;
    colName?: string;
  } | null>(null);
  const [cellModalSearch, setCellModalSearch] = useState<string>('');
  const [cableTasks, setCableTasks] = useState<CablePendingTask[]>(loadCablePendingTasks);
  const [cellModalQuickFilter, setCellModalQuickFilter] = useState<'all' | 'with_task' | 'with_afectacion'>('all');

  // Reload tasks and reset quick filter whenever cell drilldown modal opens
  useEffect(() => {
    if (selectedCellFilter) {
      setCableTasks(loadCablePendingTasks());
      setCellModalQuickFilter('all');
      setCellModalSearch('');
    }
  }, [selectedCellFilter]);

  // Helper to cross-reference item with Trabajos Pendientes and raw Excel data
  const getItemTaskInfo = (item: IpCableRow) => {
    const sKey = (item.servicio || '').toString().trim().toUpperCase();
    const sDigits = sKey.replace(/\D/g, '');
    const raw = item.rawRowData || {};
    const asoc = (extractAsociadoFromItem(item) || '').toString().trim().toUpperCase();
    const asocDigits = asoc.replace(/\D/g, '');

    // 1. Direct match by specific service numbers assigned to task
    let matchedTask = cableTasks.find(t => {
      if (!t.serviceNumbers || t.serviceNumbers.length === 0) return false;
      return t.serviceNumbers.some(sn => {
        const snKey = sn.toString().trim().toUpperCase();
        if (snKey === sKey) return true;
        if (asoc && snKey === asoc) return true;
        const snDigits = snKey.replace(/\D/g, '');
        if (snDigits && sDigits && (snDigits === sDigits || snDigits.replace(/^0+/, '') === sDigits.replace(/^0+/, ''))) {
          return true;
        }
        if (snDigits && asocDigits && (snDigits === asocDigits || snDigits.replace(/^0+/, '') === asocDigits.replace(/^0+/, ''))) {
          return true;
        }
        return false;
      });
    });

    // 2. Fallback: Match by cable if task is defined at cable level
    if (!matchedTask) {
      const cablesInItem = [item.cableP, item.cableS, item.cable].filter(Boolean) as string[];
      matchedTask = cableTasks.find(t => {
        if (!t.cable || !t.cable.trim()) return false;
        const tCable = t.cable.trim();
        return cablesInItem.some(c => isCableExactMatch(c, tCable) || matchCableInItemExact(item, tCable));
      });
    }

    const taskName = matchedTask ? matchedTask.taskName : '-';
    let afectacion = '-';

    if (matchedTask && matchedTask.hasAfectacion && matchedTask.afectacionMotivo) {
      const rowDateStr = (item.fechaReporte || '').trim().slice(0, 10);
      const start = matchedTask.afectacionFechaInicio || '';
      const end = matchedTask.afectacionFechaFin || '';
      let inRange = true;
      if (start && end) {
        inRange = Boolean(rowDateStr && rowDateStr >= start && rowDateStr <= end);
      } else if (start) {
        inRange = Boolean(rowDateStr && rowDateStr >= start);
      } else if (end) {
        inRange = Boolean(rowDateStr && rowDateStr <= end);
      }
      if (inRange) {
        afectacion = matchedTask.afectacionMotivo;
      }
    }

    // Fallback to Excel raw column AFECTACIONES if present in rawRowData
    if (afectacion === '-') {
      for (const k of Object.keys(raw)) {
        const norm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        if (norm.includes('afectacion')) {
          const val = String(raw[k]).trim();
          if (val && val !== '-') {
            afectacion = val;
            break;
          }
        }
      }
    }

    const terminal = extractTerminalFromItem(item) || (matchedTask?.terminalDireccion ? matchedTask.terminalDireccion : '-');
    const direccion = extractDireccionFromItem(item) || '-';

    return {
      task: matchedTask,
      taskName,
      afectacion,
      hasTask: Boolean(matchedTask),
      hasAfectacion: afectacion !== '-',
      terminal,
      direccion
    };
  };

  // Filtered services list for Cell Click Modal
  const cellServicesList = useMemo(() => {
    if (!selectedCellFilter || !excelData) return [];

    const { matrixType, rowName, colName } = selectedCellFilter;
    const baseList = matrixType === 'cables' ? filteredIpCablesRows : matrixFilteredConsolidatedRows;

    return baseList.filter(item => {
      const itemCentral = (item.central || '').trim().toUpperCase();
      const rawGroups = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim().toUpperCase()).filter(Boolean);

      // Filter by group if colName is specified
      if (colName) {
        const matchGroup = rawGroups.includes(colName.trim().toUpperCase());
        if (!matchGroup) return false;
      }

      // Filter by row (Central, Zone, or Cable/Assigned Name)
      if (rowName) {
        if (matrixType === 'centrales') {
          const centralParts = itemCentral.split('/').map(p => p.trim()).filter(Boolean);
          const rowNameClean = rowName.trim().toUpperCase();
          const matchCentral = centralParts.includes(rowNameClean) || itemCentral === rowNameClean;
          if (!matchCentral) return false;
        } else if (matrixType === 'zonas') {
          const matchedZone = findMatchingZoneForItem(item, zones);
          if (rowName === 'Sin Zonificar') {
            if (matchedZone !== null) return false;
          } else {
            if (!matchedZone || matchedZone.name !== rowName) return false;
          }
        } else if (matrixType === 'cables') {
          if (selectedCellFilter.rowCentral) {
            const itemCent = (item.central || '').trim().toUpperCase();
            const targetCent = selectedCellFilter.rowCentral.trim().toUpperCase();
            const centralParts = itemCent.split('/').map(p => p.trim()).filter(Boolean);
            const matchCent = centralParts.includes(targetCent) || itemCent === targetCent;
            if (!matchCent) return false;
          }
          if (selectedNetworkTypeFilter === 'flexible') {
            const matchFlex = (item.flexibleAssignedName && item.flexibleAssignedName.toUpperCase() === rowName.toUpperCase()) ||
              (item.networkTypeLabel && item.networkTypeLabel.toUpperCase() === rowName.toUpperCase());
            if (!matchFlex) return false;
          } else {
            if (rowName === 'SIN CABLE') {
              const itemCable = getCableForItem(item);
              if (itemCable !== 'SIN CABLE') return false;
            } else {
              const matchCable = matchCableInItemExact(item, rowName) || getCableForItem(item) === rowName;
              if (!matchCable) return false;
            }
          }
        }
      }

      return true;
    });
  }, [selectedCellFilter, excelData, zones, matrixFilteredConsolidatedRows, filteredIpCablesRows, selectedNetworkTypeFilter]);

  // Counts for quick filter buttons (Mejora 4)
  const { withTaskCount, withAfectacionCount } = useMemo(() => {
    let taskCount = 0;
    let afectCount = 0;
    cellServicesList.forEach(item => {
      const info = getItemTaskInfo(item);
      if (info.hasTask) taskCount++;
      if (info.hasAfectacion) afectCount++;
    });
    return { withTaskCount: taskCount, withAfectacionCount: afectCount };
  }, [cellServicesList, cableTasks]);

  const displayModalServices = useMemo(() => {
    let filtered = cellServicesList;

    // 1. Quick Filter (Mejora 4)
    if (cellModalQuickFilter === 'with_task') {
      filtered = filtered.filter(item => getItemTaskInfo(item).hasTask);
    } else if (cellModalQuickFilter === 'with_afectacion') {
      filtered = filtered.filter(item => getItemTaskInfo(item).hasAfectacion);
    }

    // 2. Search query filter
    if (cellModalSearch.trim()) {
      const q = cellModalSearch.trim().toLowerCase();
      filtered = filtered.filter(s => {
        const info = getItemTaskInfo(s);
        return (
          s.servicio.toLowerCase().includes(q) ||
          s.central.toLowerCase().includes(q) ||
          s.cable.toLowerCase().includes(q) ||
          (s.cableP && s.cableP.toLowerCase().includes(q)) ||
          (s.cableS && s.cableS.toLowerCase().includes(q)) ||
          (s.parP && s.parP.toLowerCase().includes(q)) ||
          (s.parS && s.parS.toLowerCase().includes(q)) ||
          s.grupo.toLowerCase().includes(q) ||
          (s.networkTypeLabel && s.networkTypeLabel.toLowerCase().includes(q)) ||
          (info.terminal && info.terminal.toLowerCase().includes(q)) ||
          (info.direccion && info.direccion.toLowerCase().includes(q)) ||
          (info.taskName && info.taskName.toLowerCase().includes(q)) ||
          (info.afectacion && info.afectacion.toLowerCase().includes(q))
        );
      });
    }

    return filtered;
  }, [cellServicesList, cellModalQuickFilter, cellModalSearch, cableTasks]);

  // Handler to export cell drilldown modal table to styled Excel (.xlsx)
  const handleDownloadCellModalExcel = () => {
    if (!selectedCellFilter || displayModalServices.length === 0) {
      alert('No hay servicios disponibles para exportar con los filtros actuales.');
      return;
    }

    const { matrixType, rowName, colName, rowCentral } = selectedCellFilter;

    const sanitize = (val: string) =>
      val
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_');

    let fileName = '';
    if (rowName && colName) {
      if (matrixType === 'zonas') {
        fileName = `Servicios_Zona_${sanitize(rowName)}_Grupo_${sanitize(colName)}.xlsx`;
      } else if (matrixType === 'centrales') {
        fileName = `Servicios_Central_${sanitize(rowName)}_Grupo_${sanitize(colName)}.xlsx`;
      } else {
        if (rowCentral) {
          fileName = `Servicios_Central_${sanitize(rowCentral)}_Cable_${sanitize(rowName)}_Grupo_${sanitize(colName)}.xlsx`;
        } else {
          fileName = `Servicios_Cable_${sanitize(rowName)}_Grupo_${sanitize(colName)}.xlsx`;
        }
      }
    } else if (rowName) {
      if (matrixType === 'zonas') {
        fileName = `Servicios_Total_Zona_${sanitize(rowName)}.xlsx`;
      } else if (matrixType === 'centrales') {
        fileName = `Servicios_Total_Central_${sanitize(rowName)}.xlsx`;
      } else {
        if (rowCentral) {
          fileName = `Servicios_Total_Central_${sanitize(rowCentral)}_Cable_${sanitize(rowName)}.xlsx`;
        } else {
          fileName = `Servicios_Total_Cable_${sanitize(rowName)}.xlsx`;
        }
      }
    } else if (colName) {
      fileName = `Servicios_Total_Grupo_${sanitize(colName)}.xlsx`;
    } else {
      if (matrixType === 'zonas') {
        fileName = `Servicios_Total_General_Zonas.xlsx`;
      } else if (matrixType === 'centrales') {
        fileName = `Servicios_Total_General_Centrales.xlsx`;
      } else {
        fileName = `Servicios_Total_General_Cables.xlsx`;
      }
    }

    const exportData = displayModalServices.map((item, idx) => {
      const info = getItemTaskInfo(item);
      const asoc = extractAsociadoFromItem(item);
      return {
        'N°': idx + 1,
        'Servicio': item.servicio,
        'Asociado': asoc || '-',
        'Central': item.central,
        'Cable P': item.cableP || '-',
        'Par P': item.parP || '-',
        'Cable S': item.cableS || '-',
        'Par S': item.parS || '-',
        'Terminal': info.terminal || '-',
        'Dirección': info.direccion || '-',
        'Grupo': item.grupo || 'GENERAL',
        'Clasificación Red': item.networkTypeLabel || '-',
        'Demora en Días': getDemoraDays(item),
        'Fecha Reporte': item.fechaReporte || '-',
        'Afectaciones': info.afectacion || '-',
        'Tarea o Trabajo': info.taskName || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Force string formatting for Servicio and Asociado so leading zeros are preserved
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:P1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellServicio = worksheet[XLSX.utils.encode_cell({ r: R, c: 1 })];
      if (cellServicio) {
        cellServicio.t = 's';
        cellServicio.z = '@';
      }
      const cellAsoc = worksheet[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (cellAsoc) {
        cellAsoc.t = 's';
        cellAsoc.z = '@';
      }
    }

    // Set responsive column widths
    worksheet['!cols'] = [
      { wch: 6 },  // N°
      { wch: 15 }, // Servicio
      { wch: 15 }, // Asociado
      { wch: 16 }, // Central
      { wch: 14 }, // Cable P
      { wch: 10 }, // Par P
      { wch: 14 }, // Cable S
      { wch: 10 }, // Par S
      { wch: 18 }, // Terminal
      { wch: 30 }, // Dirección
      { wch: 18 }, // Grupo
      { wch: 18 }, // Clasificación Red
      { wch: 15 }, // Demora en Días
      { wch: 14 }, // Fecha Reporte
      { wch: 22 }, // Afectaciones
      { wch: 36 }  // Tarea o Trabajo
    ];

    // Styled header
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: '1E3A8A' } }, // Deep Navy
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Servicios');
    XLSX.writeFile(workbook, fileName);
  };

  // Matrix Cables vs GRUPO (Handles both Standard Cable Matrix and Strict Red Flexible Assigned Name Matrix)
  // Each service in filteredIpCablesRows is accounted for once, ensuring grandTotal === filteredIpCablesRows.length
  const matrixCablesData = useMemo(() => {
    if (!filteredIpCablesRows.length && selectedNetworkTypeFilter !== 'flexible') {
      return {
        isFlexibleMode: false,
        rows: [] as CableMatrixRowItem[],
        columns: [] as string[],
        cellMap: {} as Record<string, Record<string, number>>,
        rowTotals: {} as Record<string, number>,
        colTotals: {} as Record<string, number>,
        grandTotal: 0,
        assignedRulesInfo: new Map<string, string[]>()
      };
    }

    const groupsSet = new Set<string>();
    if (excelData?.uniqueGroups) {
      excelData.uniqueGroups.forEach(g => groupsSet.add(g));
    }
    filteredIpCablesRows.forEach(item => {
      if (item.grupo) {
        item.grupo.split('/').forEach(g => groupsSet.add(g.trim()));
      }
    });
    const colsList = Array.from(groupsSet).sort();

    // Mode A: Strict Red Flexible Mode (Groups by Central and Assigned Name)
    if (selectedNetworkTypeFilter === 'flexible') {
      const flexRules = cableRules.flexibleRules || [];
      const assignedRulesInfo = new Map<string, string[]>(); // assignedName -> array of patterns

      flexRules.forEach(rule => {
        const name = rule.assignedName || `Red Flexible (${rule.pattern})`;
        const pats = (rule.pattern || '')
          .split(',')
          .map(p => cleanCableName(p).toUpperCase())
          .filter(Boolean);

        if (assignedRulesInfo.has(name)) {
          assignedRulesInfo.get(name)!.push(...pats);
        } else {
          assignedRulesInfo.set(name, pats);
        }
      });

      const rowMap = new Map<string, CableMatrixRowItem>();
      const cellMap: Record<string, Record<string, number>> = {};
      const rowTotals: Record<string, number> = {};
      const colTotals: Record<string, number> = {};
      let grandTotal = 0;

      colsList.forEach(c => { colTotals[c] = 0; });

      filteredIpCablesRows.forEach(item => {
        const central = (item.central || 'CENTRAL GENERAL').trim().toUpperCase();
        let targetAssignedName = item.flexibleAssignedName;

        if (!targetAssignedName) {
          for (const [name, pats] of assignedRulesInfo.entries()) {
            if (pats.some(p => matchCableInItemExact(item, p))) {
              targetAssignedName = name;
              break;
            }
          }
        }

        if (!targetAssignedName) {
          targetAssignedName = item.networkTypeLabel || 'Red Flexible General';
        }

        const rowId = `${central}:::${targetAssignedName}`;
        if (!rowMap.has(rowId)) {
          rowMap.set(rowId, {
            id: rowId,
            central,
            cableName: targetAssignedName,
            patterns: assignedRulesInfo.get(targetAssignedName) || []
          });
          cellMap[rowId] = {};
          rowTotals[rowId] = 0;
          colsList.forEach(c => { cellMap[rowId][c] = 0; });
        }

        const grp = (item.grupo || 'GRUPO GENERAL').split('/')[0].trim();
        if (!colsList.includes(grp)) {
          colsList.push(grp);
          colTotals[grp] = 0;
        }

        cellMap[rowId][grp] = (cellMap[rowId][grp] || 0) + 1;
        rowTotals[rowId] = (rowTotals[rowId] || 0) + 1;
        colTotals[grp] = (colTotals[grp] || 0) + 1;
        grandTotal += 1;
      });

      const rowsList = Array.from(rowMap.values());
      const sortedRowsList = rowsList.sort((a, b) => {
        if (cableSortOrder === 'desc') {
          return (rowTotals[b.id] || 0) - (rowTotals[a.id] || 0) || a.central.localeCompare(b.central) || a.cableName.localeCompare(b.cableName);
        } else if (cableSortOrder === 'asc') {
          return (rowTotals[a.id] || 0) - (rowTotals[b.id] || 0) || a.central.localeCompare(b.central) || a.cableName.localeCompare(b.cableName);
        } else {
          return a.central.localeCompare(b.central) || a.cableName.localeCompare(b.cableName);
        }
      });

      return {
        isFlexibleMode: true,
        rows: sortedRowsList,
        columns: colsList,
        cellMap,
        rowTotals,
        colTotals,
        grandTotal,
        assignedRulesInfo
      };
    }

    // Mode B: Standard Cable Matrix (Groups by Central and Cable)
    const rowMap = new Map<string, CableMatrixRowItem>();
    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    colsList.forEach(c => { colTotals[c] = 0; });

    filteredIpCablesRows.forEach(item => {
      const central = (item.central || 'CENTRAL GENERAL').trim().toUpperCase();
      const cableName = getCableForItem(item);
      const rowId = `${central}:::${cableName}`;

      if (!rowMap.has(rowId)) {
        rowMap.set(rowId, {
          id: rowId,
          central,
          cableName
        });
        cellMap[rowId] = {};
        rowTotals[rowId] = 0;
        colsList.forEach(c => { cellMap[rowId][c] = 0; });
      }

      const grp = (item.grupo || 'GRUPO GENERAL').split('/')[0].trim();
      if (!colsList.includes(grp)) {
        colsList.push(grp);
        colTotals[grp] = 0;
      }

      cellMap[rowId][grp] = (cellMap[rowId][grp] || 0) + 1;
      rowTotals[rowId] = (rowTotals[rowId] || 0) + 1;
      colTotals[grp] = (colTotals[grp] || 0) + 1;
      grandTotal += 1;
    });

    const rowsList = Array.from(rowMap.values());
    const sortedRowsList = rowsList.sort((a, b) => {
      if (cableSortOrder === 'desc') {
        return (rowTotals[b.id] || 0) - (rowTotals[a.id] || 0) || a.central.localeCompare(b.central) || a.cableName.localeCompare(b.cableName);
      } else if (cableSortOrder === 'asc') {
        return (rowTotals[a.id] || 0) - (rowTotals[b.id] || 0) || a.central.localeCompare(b.central) || a.cableName.localeCompare(b.cableName);
      } else {
        return a.central.localeCompare(b.central) || a.cableName.localeCompare(b.cableName);
      }
    });

    return {
      isFlexibleMode: false,
      rows: sortedRowsList,
      columns: colsList,
      cellMap,
      rowTotals,
      colTotals,
      grandTotal,
      assignedRulesInfo: new Map<string, string[]>()
    };
  }, [filteredIpCablesRows, cableSortOrder, selectedNetworkTypeFilter, cableRules.flexibleRules, excelData?.uniqueGroups]);

  // Copy Headers & Rows for Matrix Centrales x Grupos
  const copyCentralesHeaders = useMemo(() => {
    return ['Central Telefónica', ...matrixCentralesData.columns, 'Total General'];
  }, [matrixCentralesData.columns]);

  const copyCentralesRows = useMemo(() => {
    const baseRows = matrixCentralesData.rows.map(r => [
      r,
      ...matrixCentralesData.columns.map(c => matrixCentralesData.cellMap[r]?.[c] || 0),
      matrixCentralesData.rowTotals[r] || 0
    ]);
    const totalRow = [
      'TOTAL GENERAL',
      ...matrixCentralesData.columns.map(c => matrixCentralesData.colTotals[c] || 0),
      matrixCentralesData.grandTotal
    ];
    return [...baseRows, totalRow];
  }, [matrixCentralesData]);

  // Copy Headers & Rows for Matrix Zonas x Grupos
  const copyZonasHeaders = useMemo(() => {
    return ['Zona', ...matrixZonasData.columns, 'Total General'];
  }, [matrixZonasData.columns]);

  const copyZonasRows = useMemo(() => {
    const baseRows = matrixZonasData.rows.map(r => {
      const rowTot = matrixZonasData.rowTotals[r] || 0;
      const pct = matrixZonasData.grandTotal > 0 ? (rowTot / matrixZonasData.grandTotal) * 100 : 0;
      return [
        r,
        ...matrixZonasData.columns.map(c => matrixZonasData.cellMap[r]?.[c] || 0),
        `${rowTot} (${pct.toFixed(1)}%)`
      ];
    });
    const totalRow = [
      'TOTAL GENERAL',
      ...matrixZonasData.columns.map(c => matrixZonasData.colTotals[c] || 0),
      `${matrixZonasData.grandTotal} (100.0%)`
    ];
    return [...baseRows, totalRow];
  }, [matrixZonasData]);

  // Copy Headers & Rows for Matrix Cables x Grupos (Includes Central Telefónica)
  const copyCablesHeaders = useMemo(() => {
    const headerTitle = selectedNetworkTypeFilter === 'flexible' ? 'Nombre Asignado (Red Flexible)' : 'Nombre de Cable';
    return ['Central Telefónica', headerTitle, ...matrixCablesData.columns, 'Total General'];
  }, [matrixCablesData.columns, selectedNetworkTypeFilter]);

  const copyCablesRows = useMemo(() => {
    const baseRows = matrixCablesData.rows.map(r => [
      r.central,
      r.cableName,
      ...matrixCablesData.columns.map(c => matrixCablesData.cellMap[r.id]?.[c] || 0),
      matrixCablesData.rowTotals[r.id] || 0
    ]);
    const totalRowLabel = selectedNetworkTypeFilter === 'flexible' ? 'TOTAL GENERAL RED FLEXIBLE' : 'TOTAL GENERAL CABLES';
    const totalRow = [
      totalRowLabel,
      '',
      ...matrixCablesData.columns.map(c => matrixCablesData.colTotals[c] || 0),
      matrixCablesData.grandTotal
    ];
    return [...baseRows, totalRow];
  }, [matrixCablesData, selectedNetworkTypeFilter]);

  // Handler to export the Tab 2 IP Cables table to styled Excel (.xlsx)
  const handleDownloadCablesMatrixExcel = () => {
    if (!excelData || matrixCablesData.rows.length === 0) {
      alert('No hay datos disponibles en la tabla de IP Cables para exportar.');
      return;
    }

    const sanitize = (val: string) =>
      val
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_');

    let fileName = 'Matriz_IP_Cables.xlsx';
    if (selectedCentralFilter !== 'all') {
      fileName = `Matriz_IP_Cables_Central_${sanitize(selectedCentralFilter)}.xlsx`;
    } else if (selectedNetworkTypeFilter === 'flexible') {
      fileName = 'Matriz_IP_Red_Flexible.xlsx';
    } else if (selectedNetworkTypeFilter !== 'all') {
      fileName = `Matriz_IP_Cables_${sanitize(selectedNetworkTypeFilter)}.xlsx`;
    }

    const cableColTitle = selectedNetworkTypeFilter === 'flexible' ? 'Nombre Asignado (Red Flexible)' : 'Nombre de Cable';

    const exportData = matrixCablesData.rows.map(row => {
      const rowObj: Record<string, any> = {
        'Central Telefónica': row.central,
        [cableColTitle]: row.cableName
      };

      matrixCablesData.columns.forEach(col => {
        rowObj[col] = matrixCablesData.cellMap[row.id]?.[col] || 0;
      });

      rowObj['Total General'] = matrixCablesData.rowTotals[row.id] || 0;
      return rowObj;
    });

    // Summary / Total General Row
    const totalRowObj: Record<string, any> = {
      'Central Telefónica': 'TOTAL GENERAL',
      [cableColTitle]: ''
    };
    matrixCablesData.columns.forEach(col => {
      totalRowObj[col] = matrixCablesData.colTotals[col] || 0;
    });
    totalRowObj['Total General'] = matrixCablesData.grandTotal;
    exportData.push(totalRowObj);

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

    // Header styling
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: '065F46' } }, // Emerald 800
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    // Last row (TOTAL GENERAL) styling
    const lastR = range.e.r;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: lastR, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
          font: { bold: true, color: { rgb: '34D399' }, sz: 11 }, // Emerald 400
          alignment: { horizontal: C <= 1 ? 'left' : 'center', vertical: 'center' }
        };
      }
    }

    // Responsive Column Widths
    const colWidths = [
      { wch: 22 }, // Central Telefónica
      { wch: 26 }, // Nombre de Cable
      ...matrixCablesData.columns.map(c => ({ wch: Math.max(c.length + 4, 12) })),
      { wch: 15 } // Total General
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IP Cables');
    XLSX.writeFile(workbook, fileName);
  };

  const filteredCableGroups = useMemo(() => {
    return matrixCablesData.rows.map(row => {
      const rowTotal = matrixCablesData.rowTotals[row.id] || 0;
      return {
        central: row.central,
        cableName: row.cableName,
        networkTypeLabel: selectedNetworkTypeFilter === 'flexible' ? 'Red Flexible' : 'Cable',
        itemsCount: rowTotal
      };
    });
  }, [matrixCablesData, selectedNetworkTypeFilter]);

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

            <button
              onClick={() => setActiveTab('cable_tasks')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'cable_tasks'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-400/30'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>6. Trabajos Pendientes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Excel File Upload Banner Card */}
      <div id="section-summary" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4">
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

          {/* Filter Bar for Tab 1 Matrices */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center space-x-2">
                    <span>Filtros de Análisis para Matrices</span>
                    {(matrixDemoraFilter !== 'all' || matrixManualDate !== '' || matrixStartDate !== '' || matrixEndDate !== '' || matrixMonthFilter !== 'all' || matrixYearFilter !== 'all' || matrixTelefonoFilter !== 'all' || isOptimized) && (
                      <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2.5 py-0.5 rounded-md font-extrabold">
                        {matrixFilteredConsolidatedRows.length} de {excelData?.consolidatedRows.length || 0} Registros
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Optimice servicios cruzados (Teléfono/Asociado) y filtre por Rango de Fechas, Tipo de Teléfono, Demora, Mes y Año.
                  </p>
                </div>
              </div>

              {(matrixDemoraFilter !== 'all' || matrixManualDate !== '' || matrixStartDate !== '' || matrixEndDate !== '' || matrixMonthFilter !== 'all' || matrixYearFilter !== 'all' || matrixTelefonoFilter !== 'all' || isOptimized) && (
                <button
                  onClick={() => {
                    setMatrixDemoraFilter('all');
                    setMatrixManualDate('');
                    setMatrixStartDate('');
                    setMatrixEndDate('');
                    setMatrixMonthFilter('all');
                    setMatrixYearFilter('all');
                    setMatrixTelefonoFilter('all');
                    setIsOptimized(false);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer w-fit"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer Filtros</span>
                </button>
              )}
            </div>

            {/* Filtro por Rango de Fecha (Fecha Inicial - Fecha Final con validación) */}
            <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
              (matrixStartDate || matrixEndDate)
                ? 'bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-xl border shrink-0 ${
                    (matrixStartDate || matrixEndDate)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-xs text-white">
                        Filtro por Rango de Fecha
                      </span>
                      {(matrixStartDate || matrixEndDate) ? (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-2.5 py-0.5 rounded-md font-mono font-bold flex items-center space-x-1">
                          <span>Rango:</span>
                          <strong>{matrixStartDate || 'Desde el inicio'}</strong>
                          <span>al</span>
                          <strong>{matrixEndDate || 'Hasta hoy'}</strong>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Sin rango activo)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Filtre las matrices dentro de un período. La fecha inicial no puede ser mayor que la final.
                    </p>
                  </div>
                </div>

                {/* Quick Presets & Clear */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleQuickDatePreset('today')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDatePreset('7days')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Últimos 7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDatePreset('thisMonth')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Este Mes
                  </button>
                  {(matrixStartDate || matrixEndDate) && (
                    <button
                      type="button"
                      onClick={handleClearDateRange}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                      title="Limpiar rango de fechas"
                    >
                      <X className="w-3 h-3" />
                      <span>Limpiar Rango</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Date Inputs: Fecha Inicial / Fecha Final */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fecha Inicial (Desde)</span>
                    </span>
                    {matrixStartDate && (
                      <span className="text-emerald-400 font-mono text-[10px] font-bold">
                        {matrixStartDate}
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={matrixStartDate}
                      max={matrixEndDate || undefined}
                      onChange={(e) => handleMatrixStartDateChange(e.target.value)}
                      className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-all ${
                        matrixStartDate
                          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                          : 'border-slate-700 hover:border-slate-600 focus:border-emerald-500'
                      }`}
                    />
                    {matrixStartDate && (
                      <button
                        type="button"
                        onClick={() => handleMatrixStartDateChange('')}
                        className="absolute right-8 p-1 text-slate-400 hover:text-white transition-colors"
                        title="Borrar fecha inicial"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fecha Final (Hasta)</span>
                    </span>
                    {matrixEndDate && (
                      <span className="text-emerald-400 font-mono text-[10px] font-bold">
                        {matrixEndDate}
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={matrixEndDate}
                      min={matrixStartDate || undefined}
                      onChange={(e) => handleMatrixEndDateChange(e.target.value)}
                      className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-all ${
                        matrixEndDate
                          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                          : 'border-slate-700 hover:border-slate-600 focus:border-emerald-500'
                      }`}
                    />
                    {matrixEndDate && (
                      <button
                        type="button"
                        onClick={() => handleMatrixEndDateChange('')}
                        className="absolute right-8 p-1 text-slate-400 hover:text-white transition-colors"
                        title="Borrar fecha final"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recuadro de Optimización (Teléfono vs Asociado) */}
            <div className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              isOptimized
                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700/80'
            }`}>
              <div className="flex items-start md:items-center space-x-3">
                <div className={`p-2.5 rounded-xl border shrink-0 ${
                  isOptimized
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                      <span>Recuadro para Optimizar (Teléfono / Asociado)</span>
                    </span>
                    {isOptimized ? (
                      <span className="bg-amber-500/25 text-amber-300 border border-amber-500/50 text-[10px] px-2.5 py-0.5 rounded-md font-black tracking-wide">
                        {optimizationStats.difference > 0
                          ? `✨ OPTIMIZADO (-${optimizationStats.difference} DUPLICADOS ASOCIADOS)`
                          : '✨ OPTIMIZADO (SIN CRUCES DETECTADOS)'}
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Compara las columnas <strong>Teléfono</strong> y <strong>Asociado</strong> para detectar servicios coincidentes y simplificarlos a un único registro consolidado.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOptimized}
                    onChange={(e) => setIsOptimized(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="ml-2.5 text-xs font-black uppercase text-slate-200">
                    {isOptimized ? 'Optimizado' : 'Normal'}
                  </span>
                </label>
              </div>
            </div>

            {/* Grid of Standard and Type Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
              {/* 1. Filtro Columna Teléfono (Teléfono vs TxD Dato) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Filtro Columna Teléfono</span>
                </label>
                <select
                  value={matrixTelefonoFilter}
                  onChange={(e) => setMatrixTelefonoFilter(e.target.value as TelefonoTypeFilter)}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition-all cursor-pointer ${
                    matrixTelefonoFilter !== 'all'
                      ? 'border-cyan-500 text-cyan-300 font-bold bg-cyan-950/20'
                      : 'border-slate-800 text-white focus:border-cyan-500'
                  }`}
                >
                  <option value="all">Todos los Servicios</option>
                  <option value="telefono">📞 Teléfono (Solo números)</option>
                  <option value="txd_dato">💻 TxD Dato (Con letras)</option>
                </select>
              </div>

              {/* 2. Demora en Días Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Demora en Días / Fecha</span>
                </label>
                <select
                  value={matrixDemoraFilter}
                  onChange={(e) => setMatrixDemoraFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="all">Todas las demoras (sin filtro)</option>
                  <option value="0">0 días</option>
                  <option value="1">1 día</option>
                  <option value="2">2 días</option>
                  <option value="3">3 días</option>
                  <option value="4-30">4 - 30 días</option>
                  <option value="31-60">31 - 60 días</option>
                  <option value="61-90">61 - 90 días</option>
                  <option value="91-180">91 - 180 días</option>
                  <option value="181-365">181 - 365 días</option>
                  <option value=">365">Más de 1 año (&gt; 365 días)</option>
                  <option value="manual_date">📅 Filtrar por Fecha Manual...</option>
                </select>

                {/* Manual Date Input Picker */}
                {matrixDemoraFilter === 'manual_date' && (
                  <div className="pt-1.5 flex items-center space-x-1.5">
                    <input
                      type="date"
                      value={matrixManualDate}
                      onChange={(e) => setMatrixManualDate(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/80 rounded-xl px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {matrixManualDate && (
                      <button
                        type="button"
                        onClick={() => setMatrixManualDate('')}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
                        title="Limpiar fecha manual"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Month Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mes</span>
                </label>
                <select
                  value={matrixMonthFilter}
                  onChange={(e) => setMatrixMonthFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="all">Todos los meses (sin filtro)</option>
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select>
              </div>

              {/* 4. Year Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>Año</span>
                </label>
                <select
                  value={matrixYearFilter}
                  onChange={(e) => setMatrixYearFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="all">Todos los años (sin filtro)</option>
                  {availableMatrixYears.map(yr => (
                    <option key={yr} value={yr.toString()}>{yr}</option>
                  ))}
                </select>
              </div>

              {/* 5. Ocultar Ceros Option */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Visualización</span>
                </label>
                <label className="flex items-center space-x-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium cursor-pointer transition-all h-[38px] select-none">
                  <input
                    type="checkbox"
                    checked={hideZeroValues}
                    onChange={(e) => setHideZeroValues(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer accent-blue-600"
                  />
                  <span className="font-bold text-slate-200">Ocultar ceros (0)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Table 1: Centrales Telefónicas vs GRUPO */}
          <div id="section-centrales" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
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
                <label className="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
                  <input
                    type="checkbox"
                    checked={hideZeroValues}
                    onChange={(e) => setHideZeroValues(e.target.checked)}
                    className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                  />
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ocultar Ceros</span>
                </label>
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
                              ) : hideZeroValues ? null : (
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
                          ) : hideZeroValues ? null : (
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
                          ) : hideZeroValues ? null : (
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
                      ) : hideZeroValues ? null : (
                        <span>0</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Table 2: Zonificación vs GRUPO */}
          <div id="section-zonas" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
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
                <label className="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
                  <input
                    type="checkbox"
                    checked={hideZeroValues}
                    onChange={(e) => setHideZeroValues(e.target.checked)}
                    className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                  />
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ocultar Ceros</span>
                </label>
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
                    const isUnzoned = rowName === 'Sin Zonificar';
                    const percentage = matrixZonasData.grandTotal > 0 ? ((rowTotal / matrixZonasData.grandTotal) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={rowName} className={`transition-colors ${isUnzoned ? 'bg-amber-950/10 hover:bg-amber-950/20' : 'hover:bg-slate-800/50'}`}>
                        {/* Option 1 & 3: Zone Label with Hover Popover Tooltip */}
                        {isUnzoned ? (
                          <td className="py-3.5 px-4 font-bold text-amber-300 relative group">
                            <div className="flex items-center space-x-2 cursor-help">
                              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="underline decoration-amber-500/40 decoration-dashed underline-offset-4">
                                Sin Zonificar / Sin Asignar
                              </span>
                            </div>

                            {/* Hover Tooltip Popover */}
                            <div className="absolute left-4 top-full mt-1 w-72 p-3 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl shadow-2xl z-50 text-xs hidden group-hover:block transition-all space-y-1 pointer-events-none">
                              <div className="flex items-center space-x-1.5 text-amber-300 font-black">
                                <Info className="w-4 h-4 text-amber-400" />
                                <span>Auditoría de Cobertura</span>
                              </div>
                              <p className="text-[11px] text-slate-300 font-normal leading-relaxed">
                                Agrupa {rowTotal} servicios cuyos cables o centrales no coinciden con ninguna de las zonas registradas.
                              </p>
                            </div>
                          </td>
                        ) : (
                          <td className="py-3.5 px-4 font-bold text-white relative group">
                            <div className="flex items-center space-x-2 cursor-help">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: zoneObj?.color || '#3B82F6' }}
                              />
                              <span className="underline decoration-slate-600 decoration-dashed underline-offset-4 hover:text-blue-300 transition-colors">
                                {rowName}
                              </span>
                              <Info className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                            </div>

                            {/* Option 3: Hover Tooltip Popover */}
                            {zoneObj && (
                              <div className="absolute left-4 top-full mt-1 w-80 p-3.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl z-50 text-xs hidden group-hover:block transition-all space-y-2 pointer-events-none">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: zoneObj.color || '#3B82F6' }}
                                    />
                                    <span className="font-extrabold text-white text-sm">{zoneObj.name}</span>
                                  </div>
                                  {zoneObj.contactPerson && (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      Resp: {zoneObj.contactPerson}
                                    </span>
                                  )}
                                </div>

                                <div className="space-y-1.5 font-normal">
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-blue-400 block">
                                      Centrales Asignadas ({zoneObj.centralNames.filter(Boolean).length}):
                                    </span>
                                    <p className="text-slate-300 text-[11px] font-mono break-words">
                                      {zoneObj.centralNames.filter(Boolean).length > 0
                                        ? zoneObj.centralNames.filter(Boolean).join(', ')
                                        : 'Ninguna central configurada'}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                                      Cables Asignados ({zoneObj.cableNames.filter(Boolean).length}):
                                    </span>
                                    <p className="text-slate-300 text-[11px] font-mono break-words max-h-24 overflow-y-auto">
                                      {zoneObj.cableNames.filter(Boolean).length > 0
                                        ? zoneObj.cableNames.filter(Boolean).join(', ')
                                        : 'Ningún cable configurado'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        )}

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
                                  className={`font-black px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 ${
                                    isUnzoned
                                      ? 'text-amber-300 bg-amber-950/60 hover:bg-amber-600 hover:text-white border border-amber-800/40 hover:border-amber-400'
                                      : 'text-emerald-400 bg-emerald-950/60 hover:bg-emerald-600 hover:text-white border border-emerald-800/40 hover:border-emerald-400'
                                  }`}
                                  title="Ver servicios consolidados"
                                >
                                  {val}
                                </button>
                              ) : hideZeroValues ? null : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Option 2: Total General with Percentage (%) */}
                        <td className="py-3.5 px-4 text-center font-mono font-black bg-slate-900/40">
                          {rowTotal > 0 ? (
                            <div className="flex flex-col items-center">
                              <button
                                onClick={() => setSelectedCellFilter({
                                  matrixType: 'zonas',
                                  rowName,
                                  title: isUnzoned ? 'Servicios: Sin Zonificar' : `Servicios: Total ${rowName}`,
                                  subtitle: isUnzoned
                                    ? 'Servicios consolidados que no coinciden con ninguna zona'
                                    : `Todos los servicios consolidados mapeados a ${rowName}`
                                })}
                                className="font-black text-amber-400 hover:text-white hover:underline cursor-pointer transition-all text-xs"
                                title="Ver todos los servicios de esta fila"
                              >
                                {rowTotal}
                              </button>
                              <span className="text-[10px] text-amber-300/80 font-bold font-sans mt-0.5">
                                ({percentage}%)
                              </span>
                            </div>
                          ) : hideZeroValues ? null : (
                            <div className="flex flex-col items-center">
                              <span className="text-slate-600">0</span>
                              <span className="text-[10px] text-slate-600 font-sans mt-0.5">(0.0%)</span>
                            </div>
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
                          ) : hideZeroValues ? null : (
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
                      ) : hideZeroValues ? null : (
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
          <div id="section-cables" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <Cable className="w-5 h-5 text-emerald-400" />
                  <span>
                    {selectedNetworkTypeFilter === 'flexible'
                      ? 'Monitoreo de Red Flexible por Nombre Asignado'
                      : 'Monitoreo e Inventario de IP Cables por Grupo'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedNetworkTypeFilter === 'flexible'
                    ? 'Agrupado estrictamente según los Nombres Asignados y Patrones creados en Ajustes de Cables.'
                    : 'Filtre incidencias por Central, Tipo de Red (Rígida, Flexible, Outdoor), Fecha y Búsqueda Exacta.'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {(selectedCentralFilter !== 'all' || selectedNetworkTypeFilter !== 'all' || selectedMonthYearFilter !== 'all' || cableSearchTerm.trim() !== '') && (
                  <button
                    onClick={() => {
                      setSelectedCentralFilter('all');
                      setSelectedNetworkTypeFilter('all');
                      setSelectedMonthYearFilter('all');
                      setCableSearchTerm('');
                    }}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    title="Restablecer filtros de IP Cables"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer</span>
                  </button>
                )}
                <CopyTableButton headers={copyCablesHeaders} rows={copyCablesRows} label="Copiar Tabla" />
                <button
                  type="button"
                  onClick={handleDownloadCablesMatrixExcel}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 cursor-pointer active:scale-95"
                  title="Descargar tabla completa de IP Cables en formato Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Excel</span>
                </button>
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
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                    2. Tipo de Red
                  </label>
                  {selectedNetworkTypeFilter === 'flexible' && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                      {cableRules.flexibleRules?.length || 0} reglas
                    </span>
                  )}
                </div>
                <select
                  value={selectedNetworkTypeFilter}
                  onChange={(e) => setSelectedNetworkTypeFilter(e.target.value as NetworkTypeCategory)}
                  className={`w-full bg-slate-950 border text-xs rounded-xl p-2.5 font-bold focus:outline-none cursor-pointer ${
                    selectedNetworkTypeFilter === 'flexible'
                      ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                      : 'border-slate-800 text-white focus:border-emerald-500'
                  }`}
                >
                  <option value="all">Todas las Redes</option>
                  <option value="flexible">Red Flexible (Reglas Ajustes de Cables)</option>
                  <option value="rigida">Red Rígida</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="other">Otras Redes</option>
                </select>
              </div>

              {/* 3. Month & Year Filter (FECHA REPORTE) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  3. Mes y Año (FECHA)
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

              {/* 4. Exact Search (Cable vs Servicio) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                    4. Búsqueda Exacta
                  </label>
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCableSearchMode('cable')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all ${
                        cableSearchMode === 'cable'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Cable
                    </button>
                    <button
                      type="button"
                      onClick={() => setCableSearchMode('servicio')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all ${
                        cableSearchMode === 'servicio'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Servicio
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder={
                      cableSearchMode === 'cable'
                        ? 'Cable exacto (ej. CR-101)...'
                        : 'Servicio exacto (ej. SER-10023)...'
                    }
                    value={cableSearchTerm}
                    onChange={(e) => setCableSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  {cableSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setCableSearchTerm('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white p-0.5 rounded"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                  <option value="alpha">Nombre Alfabético (A - Z)</option>
                </select>
              </div>

            </div>

            {/* Service Search Result Banner */}
            {cableSearchMode === 'servicio' && cableSearchTerm.trim() !== '' && (
              <div>
                {matchedServiceInfo && matchedServiceInfo.found ? (
                  <div className="p-3.5 bg-blue-950/40 border border-blue-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-black text-white text-sm flex items-center space-x-2">
                          <span>Servicio Encontrado: {matchedServiceInfo.query}</span>
                          <span className="bg-blue-600/30 text-blue-300 text-[10px] px-2 py-0.5 rounded-md font-mono border border-blue-500/30">
                            {matchedServiceInfo.service?.central || 'CENTRAL'}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs mt-0.5">
                          Cable(s) asociado(s) al servicio: <strong className="text-emerald-400 font-mono font-black">{matchedServiceInfo.cables.join(' / ') || 'SIN CABLE'}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-700 shrink-0">
                      <span className="text-slate-300 font-medium">Incidencias en el mismo cable:</span>
                      <span className="font-mono font-black text-emerald-400 text-base bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-700/50">
                        {matrixCablesData.grandTotal}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex items-center space-x-3 text-xs text-amber-200">
                    <Info className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-300">Servicio no encontrado:</span> No se localizó ningún registro con el número exacto <strong className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded">"{cableSearchTerm.trim()}"</strong> en el archivo cargado.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Matrix Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-400">
                {selectedNetworkTypeFilter === 'flexible' ? (
                  <span>
                    Mostrando <strong className="text-white">{matrixCablesData.rows.length}</strong> registros de Red Flexible por Central.
                  </span>
                ) : (
                  <span>
                    Mostrando <strong className="text-white">{matrixCablesData.rows.length}</strong> cables agrupados por Central Telefónica. Total General: <strong className="text-emerald-400 font-mono text-sm">{matrixCablesData.grandTotal}</strong> servicios.
                  </span>
                )}
              </span>
              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={handleDownloadCablesMatrixExcel}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 cursor-pointer active:scale-95 border border-emerald-400/40"
                  title="Descargar tabla completa de IP Cables en archivo Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Excel</span>
                </button>
                <span className="text-[11px] text-slate-500 italic hidden md:inline">
                  * Haga clic en cualquier celda o total para inspeccionar el detalle de servicios.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-black text-cyan-300">
                      Central Telefónica
                    </th>
                    <th className="py-3.5 px-4 font-black text-white">
                      {selectedNetworkTypeFilter === 'flexible' ? 'Nombre Asignado (Red Flexible)' : 'Nombre de Cable'}
                    </th>
                    {matrixCablesData.columns.map(col => (
                      <th key={col} className="py-3.5 px-4 text-center">{col}</th>
                    ))}
                    <th className="py-3.5 px-4 text-center text-amber-400 font-black">Total General</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {matrixCablesData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={matrixCablesData.columns.length + 3} className="py-8 text-center text-slate-500 italic">
                        {selectedNetworkTypeFilter === 'flexible' && (!cableRules.flexibleRules || cableRules.flexibleRules.length === 0)
                          ? 'No hay reglas de Red Flexible configuradas en la pestaña "4. Ajustes de Cables". Cree una regla para asociar patrones.'
                          : 'No se encontraron registros que coincidan con los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    matrixCablesData.rows.map(row => {
                      const rowTotal = matrixCablesData.rowTotals[row.id] || 0;
                      const patternsList = row.patterns || [];

                      return (
                        <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                          {/* Columna Adicional: Central Telefónica a la que pertenece */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="bg-slate-800/90 text-cyan-300 font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700/80 inline-block shadow-sm">
                              {row.central}
                            </span>
                          </td>
                          {/* Columna: Nombre de Cable */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (rowTotal > 0) {
                                    setSelectedCellFilter({
                                      title: `${row.cableName} (${row.central})`,
                                      subtitle: selectedNetworkTypeFilter === 'flexible' ? 'Red Flexible Asignada (Todos los Grupos)' : 'Cable (Todos los Grupos)',
                                      matrixType: 'cables',
                                      rowCentral: row.central,
                                      rowName: row.cableName
                                    });
                                    setCellModalSearch('');
                                  }
                                }}
                                className="font-mono font-bold text-emerald-300 hover:text-emerald-200 flex items-center space-x-2 text-left cursor-pointer transition-colors"
                              >
                                {selectedNetworkTypeFilter === 'flexible' ? (
                                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Cable className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                )}
                                <span>{row.cableName}</span>
                              </button>

                              {patternsList.length > 0 && (
                                <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1 pl-5">
                                  <span className="text-slate-500">Patrones:</span>
                                  <span className="text-slate-300">{patternsList.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Columnas por Grupo */}
                          {matrixCablesData.columns.map(colName => {
                            const val = matrixCablesData.cellMap[row.id]?.[colName] || 0;
                            return (
                              <td key={colName} className="py-3.5 px-4 text-center font-mono">
                                {val > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCellFilter({
                                        title: `${row.cableName} · ${colName} (${row.central})`,
                                        subtitle: selectedNetworkTypeFilter === 'flexible' ? 'Red Flexible Asignada' : 'Incidencias de Cable',
                                        matrixType: 'cables',
                                        rowCentral: row.central,
                                        rowName: row.cableName,
                                        colName: colName
                                      });
                                      setCellModalSearch('');
                                    }}
                                    className="font-black text-emerald-300 px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/50 hover:border-emerald-500 transition-all cursor-pointer"
                                  >
                                    {val}
                                  </button>
                                ) : hideZeroValues ? null : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                            );
                          })}
                          {/* Total General de la Fila */}
                          <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400 text-sm bg-slate-900/40">
                            {rowTotal > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCellFilter({
                                    title: `${row.cableName} (${row.central})`,
                                    subtitle: selectedNetworkTypeFilter === 'flexible' ? 'Total Red Flexible Asignada' : 'Total Incidencias Cable',
                                    matrixType: 'cables',
                                    rowCentral: row.central,
                                    rowName: row.cableName
                                  });
                                  setCellModalSearch('');
                                }}
                                className="hover:underline cursor-pointer"
                              >
                                {rowTotal}
                              </button>
                            ) : (
                              <span>0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-900 font-black text-white border-t-2 border-slate-700">
                  <tr>
                    <td colSpan={2} className="py-3.5 px-4 uppercase text-[11px] text-slate-300 font-mono">
                      {selectedNetworkTypeFilter === 'flexible' ? 'TOTAL GENERAL RED FLEXIBLE' : 'TOTAL GENERAL CABLES'}
                    </td>
                    {matrixCablesData.columns.map(colName => (
                      <td key={colName} className="py-3.5 px-4 text-center font-mono text-emerald-400 text-sm">
                        {matrixCablesData.colTotals[colName] || 0}
                      </td>
                    ))}
                    <td className="py-3.5 px-4 text-center font-mono text-amber-400 text-base font-black bg-slate-950">
                      <button
                        type="button"
                        onClick={() => {
                          if (matrixCablesData.grandTotal > 0) {
                            setSelectedCellFilter({
                              title: 'Total General IP Cables',
                              subtitle: selectedNetworkTypeFilter === 'flexible' ? 'Todos los registros de Red Flexible' : 'Todos los Cables y Centrales',
                              matrixType: 'cables'
                            });
                            setCellModalSearch('');
                          }
                        }}
                        className="hover:underline cursor-pointer"
                        title="Ver todos los servicios de la tabla"
                      >
                        {matrixCablesData.grandTotal}
                      </button>
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

      {/* PESTAÑA 6: TRABAJOS PENDIENTES */}
      {activeTab === 'cable_tasks' && (
        <CablePendingTasksView
          excelData={excelData}
          centrales={centrales}
          workGroups={workGroups}
          onFileUpload={handleFileUpload}
          isParsing={isParsing}
        />
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-white max-w-7xl w-full space-y-4 shadow-2xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-2xl shrink-0">
                  <ListFilter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">{selectedCellFilter.title}</h3>
                  <p className="text-xs text-slate-400">{selectedCellFilter.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2.5 shrink-0 flex-wrap justify-end">
                {/* Excel Download Button */}
                <button
                  onClick={handleDownloadCellModalExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 border border-emerald-400/40 cursor-pointer active:scale-95"
                  title="Descargar servicios de esta casilla en formato Excel (.xlsx)"
                >
                  <Download className="w-4 h-4 text-emerald-100" />
                  <span>Descargar Excel</span>
                </button>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
                  {displayModalServices.length} de {cellServicesList.length} Servicios
                </span>
                <button
                  onClick={() => setSelectedCellFilter(null)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Filter Buttons (Mejora 4) + Search bar + Copy Button */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              {/* Quick Filter Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCellModalQuickFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cellModalQuickFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({cellServicesList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCellModalQuickFilter('with_task')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    cellModalQuickFilter === 'with_task'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-300" />
                  <span>Con Tarea ({withTaskCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCellModalQuickFilter('with_afectacion')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    cellModalQuickFilter === 'with_afectacion'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-rose-300'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  <span>Con Afectación ({withAfectacionCount})</span>
                </button>
              </div>

              {/* Text Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por servicio, central, cable, terminal, dirección, afectación, tarea..."
                  value={cellModalSearch}
                  onChange={(e) => setCellModalSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Copy Table Button with all columns */}
              <CopyTableButton
                headers={['N°', 'SERVICIO', 'ASOCIADO', 'CENTRAL', 'CABLE P', 'PAR P', 'CABLE S', 'PAR S', 'TERMINAL', 'DIRECCIÓN', 'GRUPO', 'TIPO RED', 'DEMORA (DÍAS)', 'FECHA', 'AFECTACIONES', 'TAREA O TRABAJO']}
                rows={[
                  ...displayModalServices.map((s, idx) => {
                    const info = getItemTaskInfo(s);
                    return [
                      (idx + 1).toString(),
                      s.servicio,
                      extractAsociadoFromItem(s) || '-',
                      s.central,
                      s.cableP || '-',
                      s.parP || '-',
                      s.cableS || '-',
                      s.parS || '-',
                      info.terminal || '-',
                      info.direccion || '-',
                      s.grupo || 'GENERAL',
                      s.networkTypeLabel || '-',
                      `${getDemoraDays(s)} días`,
                      s.fechaReporte || '-',
                      info.afectacion || '-',
                      info.taskName || '-'
                    ];
                  }),
                  ['TOTAL', `${displayModalServices.length} Servicios`, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']
                ]}
                label="Copiar Servicios"
              />
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 min-w-[1100px]">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 text-center text-slate-500 w-12">#</th>
                    <th className="py-3 px-4 text-white font-black">Servicio / abonado</th>
                    <th className="py-3 px-4">Central</th>
                    <th className="py-3 px-4 text-cyan-400">Cable P / Par P</th>
                    <th className="py-3 px-4 text-indigo-400">Cable S / Par S</th>
                    <th className="py-3 px-4 text-slate-300">Terminal</th>
                    <th className="py-3 px-4 text-slate-300">Dirección</th>
                    <th className="py-3 px-4">Grupo de Trabajo</th>
                    <th className="py-3 px-4">Clasificación Red</th>
                    <th className="py-3 px-4 text-center">Demora (Días)</th>
                    <th className="py-3 px-4 text-center">Fecha Reporte</th>
                    <th className="py-3 px-4 text-rose-400">Afectaciones</th>
                    <th className="py-3 px-4 text-amber-400">Tarea o Trabajo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {displayModalServices.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-500 font-bold">
                        No se encontraron servicios consolidados para este filtro.
                      </td>
                    </tr>
                  ) : (
                    displayModalServices.map((item, idx) => {
                      const info = getItemTaskInfo(item);
                      return (
                        <tr key={`${item.id}_${idx}`} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-amber-300 font-mono">
                            <div>{item.servicio}</div>
                            {extractAsociadoFromItem(item) && (
                              <div className="text-[10px] text-cyan-300 font-mono font-normal flex items-center space-x-1 mt-0.5">
                                <span className="text-slate-400">Asoc:</span>
                                <span className="text-cyan-400 font-bold">{extractAsociadoFromItem(item)}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">{item.central}</td>
                          <td className="py-3 px-4 text-cyan-300 font-mono">
                            {item.cableP || '-'}{item.parP ? <span className="text-slate-400 font-sans text-[10px] ml-1">({item.parP})</span> : ''}
                          </td>
                          <td className="py-3 px-4 text-indigo-300 font-mono">
                            {item.cableS || '-'}{item.parS ? <span className="text-slate-400 font-sans text-[10px] ml-1">({item.parS})</span> : ''}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                            {info.terminal !== '-' ? (
                              <span className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                {info.terminal}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300 text-xs max-w-[200px] truncate" title={info.direccion}>
                            {info.direccion}
                          </td>
                          <td className="py-3 px-4 text-indigo-300 font-bold">{item.grupo || 'GENERAL'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              item.networkType === 'rigida'
                                ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                                : item.networkType === 'flexible'
                                ? 'bg-blue-950/60 border-blue-800/60 text-blue-300'
                                : item.networkType === 'outdoor'
                                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}>
                              {item.networkTypeLabel || 'Sin clasificar'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                            {getDemoraDays(item)} d
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 text-[11px] font-mono">
                            {item.fechaReporte || '-'}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {info.hasAfectacion ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-950/70 border border-rose-500/50 text-rose-300 shadow-sm" title={info.afectacion}>
                                <AlertTriangle className="w-3 h-3 mr-1 text-rose-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{info.afectacion}</span>
                              </span>
                            ) : (
                              <span className="text-slate-600 text-center block">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs max-w-[240px]">
                            {info.hasTask ? (
                              <div className="flex items-start space-x-1.5" title={info.taskName}>
                                <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span className="text-amber-200 font-semibold line-clamp-2 leading-tight">
                                  {info.taskName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-center block">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <span>Mostrando {displayModalServices.length} de {cellServicesList.length} registros</span>
              <button
                onClick={() => setSelectedCellFilter(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Action Button for Creating Executive Report */}
      <FloatingReportFAB
        onOpenReportModal={() => setIsReportModalOpen(true)}
        totalRecordsCount={excelData?.consolidatedRows.length || 0}
      />

      {/* Modal for Creating Report (Análisis de las IP + fecha + hora + segundos) */}
      <ExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        excelData={excelData}
        zones={zones}
        isConsolidationActive={isOptimized}
      />

    </div>
  );
};
