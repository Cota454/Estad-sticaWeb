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
  Mail
} from 'lucide-react';

import { EmailReportModal, SelectedSectionData } from './EmailReportModal';
import { FloatingNavEmailFAB, SectionNavItem } from './FloatingNavEmailFAB';

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
  classifyNetworkType,
  matchCableInItem
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
  const [selectedEmailSectionIds, setSelectedEmailSectionIds] = useState<Set<string>>(new Set(['section-summary', 'section-centrales', 'section-zonas']));
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);

  const toggleEmailSection = (id: string) => {
    setSelectedEmailSectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearAllEmailSections = () => {
    setSelectedEmailSectionIds(new Set());
  };

  const handleSelectAllEmailSections = () => {
    setSelectedEmailSectionIds(new Set(['section-summary', 'section-centrales', 'section-zonas', 'section-cables']));
  };

  const handleSelectSummaryOnlyEmailSections = () => {
    setSelectedEmailSectionIds(new Set(['section-summary']));
  };

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
        const classification = classifyNetworkType(row.cableP || row.cable, row.cableS || '', row.central, newRules);
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

  // Matrix Filter States
  const [matrixDemoraFilter, setMatrixDemoraFilter] = useState<string>('all');
  const [matrixMonthFilter, setMatrixMonthFilter] = useState<string>('all');
  const [matrixYearFilter, setMatrixYearFilter] = useState<string>('all');

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

  // Rows filtered by Demora en Días, Mes, and Año for Tab 1 Matrices
  const matrixFilteredConsolidatedRows = useMemo(() => {
    if (!excelData) return [];

    return excelData.consolidatedRows.filter(item => {
      // 1. Demora Filter
      const days = getDemoraDays(item);
      if (!matchDemoraFilter(days, matrixDemoraFilter)) return false;

      // 2. Month and Year Filter
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
  }, [excelData, matrixDemoraFilter, matrixMonthFilter, matrixYearFilter]);

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
  // Step 2: If item's central is NOT in any zone, analyze by Cable against zone cableNames.
  // Step 3: Returns null if no zone matched (Sin Zonificar).
  const findMatchingZoneForItem = (item: IpCableRow, zoneList: ZoneConfig[]): ZoneConfig | null => {
    const itemCentral = (item.central || '').trim().toUpperCase();

    // STEP 1: Priority by Central Telefónica
    if (itemCentral) {
      const centralParts = itemCentral.split('/').map(p => p.trim()).filter(Boolean);
      for (const z of zoneList) {
        const validCentralNames = (z.centralNames || []).map(cn => cn.trim().toUpperCase()).filter(Boolean);
        if (validCentralNames.length > 0) {
          const matchesCentral = validCentralNames.some(cn => {
            return centralParts.some(part => part === cn || part.includes(cn) || cn.includes(part)) || itemCentral.includes(cn);
          });
          if (matchesCentral) {
            return z; // Automatically assigned to this zone by Central!
          }
        }
      }
    }

    // STEP 2: Priority by Cable (only for services whose Central is not assigned to any zone)
    for (const z of zoneList) {
      const validCableNames = (z.cableNames || []).map(cb => cb.trim().toUpperCase()).filter(Boolean);
      if (validCableNames.length > 0) {
        const matchesCable = validCableNames.some(cb => matchCableInItem(item, cb));
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

    return matrixFilteredConsolidatedRows.filter(item => {
      const itemCentral = (item.central || '').trim().toUpperCase();
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
          const matchedZone = findMatchingZoneForItem(item, zones);
          if (rowName === 'Sin Zonificar') {
            if (matchedZone !== null) return false;
          } else {
            if (!matchedZone || matchedZone.name !== rowName) return false;
          }
        }
      }

      return true;
    });
  }, [selectedCellFilter, excelData, zones, matrixFilteredConsolidatedRows]);

  const displayModalServices = useMemo(() => {
    if (!cellModalSearch.trim()) return cellServicesList;
    const q = cellModalSearch.trim().toLowerCase();
    return cellServicesList.filter(s =>
      s.servicio.toLowerCase().includes(q) ||
      s.central.toLowerCase().includes(q) ||
      s.cable.toLowerCase().includes(q) ||
      (s.cableP && s.cableP.toLowerCase().includes(q)) ||
      (s.cableS && s.cableS.toLowerCase().includes(q)) ||
      (s.parP && s.parP.toLowerCase().includes(q)) ||
      (s.parS && s.parS.toLowerCase().includes(q)) ||
      s.grupo.toLowerCase().includes(q) ||
      (s.networkTypeLabel && s.networkTypeLabel.toLowerCase().includes(q))
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

      // 4. Cable Search (Supports Cable P, Cable S, Par P, Par S)
      if (cableSearchTerm.trim()) {
        const query = cableSearchTerm.trim();
        const matchCable = matchCableInItem(item, query);
        const srvVal = (item.servicio || '').toLowerCase();
        const matchSrv = srvVal.includes(query.toLowerCase());
        if (!matchCable && !matchSrv) {
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
    return matrixZonasData.rows.map(r => {
      const rowTot = matrixZonasData.rowTotals[r] || 0;
      const pct = matrixZonasData.grandTotal > 0 ? (rowTot / matrixZonasData.grandTotal) * 100 : 0;
      return [
        r,
        ...matrixZonasData.columns.map(c => matrixZonasData.cellMap[r]?.[c] || 0),
        `${rowTot} (${pct.toFixed(1)}%)`
      ];
    });
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

  const filteredCableGroups = useMemo(() => {
    return matrixCablesData.rows.map(rowName => {
      const rowTotal = matrixCablesData.rowTotals[rowName] || 0;
      const sampleItem = filteredIpCablesRows.find(item => item.cable && item.cable.includes(rowName));
      return {
        central: sampleItem?.central || 'CENTRAL GENERAL',
        cableName: rowName,
        networkTypeLabel: sampleItem?.networkTypeLabel || 'Flexible',
        itemsCount: rowTotal
      };
    });
  }, [matrixCablesData, filteredIpCablesRows]);

  // Floating FAB navigation items list
  const availableSectionsList: SectionNavItem[] = [
    { id: 'section-summary', title: '1. Resumen General KPI', category: 'summary', order: 1, isSelected: selectedEmailSectionIds.has('section-summary') },
    { id: 'section-centrales', title: '2. Matriz: Centrales vs GRUPO', category: 'matrices', order: 2, isSelected: selectedEmailSectionIds.has('section-centrales') },
    { id: 'section-zonas', title: '3. Matriz: Zonificación vs GRUPO', category: 'matrices', order: 3, isSelected: selectedEmailSectionIds.has('section-zonas') },
    { id: 'section-cables', title: '4. Monitoreo IP Cables', category: 'network', order: 4, isSelected: selectedEmailSectionIds.has('section-cables') },
  ];

  const getEmailSectionData = (id: string): SelectedSectionData => {
    if (id === 'section-summary') {
      return {
        id: 'section-summary',
        title: 'Resumen General KPI y Carga de Archivo',
        category: 'summary',
        order: 1,
        htmlContent: `
          <div class="kpi-grid">
            <div class="kpi-box"><div class="kpi-val">${excelData?.totalRowsRead || 0}</div><div class="kpi-lbl">Filas Leídas</div></div>
            <div class="kpi-box"><div class="kpi-val">${excelData?.uniqueServicesCount || 0}</div><div class="kpi-lbl">Servicios Consolidados</div></div>
            <div class="kpi-box"><div class="kpi-val">${excelData?.uniqueCentrales.length || 0}</div><div class="kpi-lbl">Centrales Únicas</div></div>
            <div class="kpi-box"><div class="kpi-val">${excelData?.uniqueCables.length || 0}</div><div class="kpi-lbl">Cables Identificados</div></div>
          </div>
          <p style="font-size: 12px; color: #475569;">Archivo Excel Origen: <strong>${excelData?.fileName || 'Muestra procesada'}</strong></p>
        `,
        textContent: `Filas Leídas: ${excelData?.totalRowsRead || 0}\nServicios Consolidados: ${excelData?.uniqueServicesCount || 0}\nCentrales Únicas: ${excelData?.uniqueCentrales.length || 0}\nCables Identificados: ${excelData?.uniqueCables.length || 0}\nArchivo: ${excelData?.fileName || 'N/A'}`
      };
    }

    if (id === 'section-centrales') {
      const headers = ['Central Telefónica', ...matrixCentralesData.columns, 'Total General'];
      const rowsHtml = matrixCentralesData.rows.map(r => `
        <tr>
          <td><strong>${r}</strong></td>
          ${matrixCentralesData.columns.map(c => `<td>${matrixCentralesData.cellMap[r]?.[c] || 0}</td>`).join('')}
          <td><strong>${matrixCentralesData.rowTotals[r] || 0}</strong></td>
        </tr>
      `).join('');
      
      return {
        id: 'section-centrales',
        title: 'Matriz: Centrales Telefónicas vs GRUPO',
        category: 'matrices',
        order: 2,
        htmlContent: `
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td><strong>TOTAL GENERAL</strong></td>
                ${matrixCentralesData.columns.map(c => `<td><strong>${matrixCentralesData.colTotals[c] || 0}</strong></td>`).join('')}
                <td><strong>${matrixCentralesData.grandTotal}</strong></td>
              </tr>
            </tfoot>
          </table>
        `,
        textContent: [headers.join('\t'), ...copyCentralesRows.map(row => row.join('\t'))].join('\n')
      };
    }

    if (id === 'section-zonas') {
      const headers = ['Zona Configurada', ...matrixZonasData.columns, 'Total General (%)'];
      const rowsHtml = matrixZonasData.rows.map(r => {
        const tot = matrixZonasData.rowTotals[r] || 0;
        const pct = matrixZonasData.grandTotal > 0 ? ((tot / matrixZonasData.grandTotal) * 100).toFixed(1) : '0.0';
        return `
          <tr>
            <td><strong>${r}</strong></td>
            ${matrixZonasData.columns.map(c => `<td>${matrixZonasData.cellMap[r]?.[c] || 0}</td>`).join('')}
            <td><strong>${tot} (${pct}%)</strong></td>
          </tr>
        `;
      }).join('');

      return {
        id: 'section-zonas',
        title: 'Matriz: Zonificación vs GRUPO',
        category: 'matrices',
        order: 3,
        htmlContent: `
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td><strong>TOTAL GENERAL ZONAS</strong></td>
                ${matrixZonasData.columns.map(c => `<td><strong>${matrixZonasData.colTotals[c] || 0}</strong></td>`).join('')}
                <td><strong>${matrixZonasData.grandTotal} (100%)</strong></td>
              </tr>
            </tfoot>
          </table>
        `,
        textContent: [headers.join('\t'), ...copyZonasRows.map(row => row.join('\t'))].join('\n')
      };
    }

    if (id === 'section-cables') {
      const headers = ['Central', 'Cable', 'Categoría Red', 'Servicios Consolidados'];
      const rowsHtml = filteredCableGroups.slice(0, 30).map(g => `
        <tr>
          <td>${g.central}</td>
          <td><strong>${g.cableName}</strong></td>
          <td>${g.networkTypeLabel}</td>
          <td><strong>${g.itemsCount}</strong></td>
        </tr>
      `).join('');

      return {
        id: 'section-cables',
        title: 'Monitoreo e Inventario de IP Cables',
        category: 'network',
        order: 4,
        htmlContent: `
          <p style="font-size: 12px; color: #475569; margin-bottom: 8px;">Listado de cables con incidencias registradas (${filteredCableGroups.length} cables):</p>
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `,
        textContent: [headers.join('\t'), ...filteredCableGroups.slice(0, 30).map(g => [g.central, g.cableName, g.networkTypeLabel, g.itemsCount].join('\t'))].join('\n')
      };
    }

    return {
      id,
      title: id,
      category: 'summary',
      order: 99,
      htmlContent: '',
      textContent: ''
    };
  };

  const selectedSectionsForEmailModal = useMemo(() => {
    return Array.from(selectedEmailSectionIds).map((id: string) => getEmailSectionData(id));
  }, [selectedEmailSectionIds, excelData, matrixCentralesData, matrixZonasData, filteredCableGroups]);

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
            <button
              onClick={() => toggleEmailSection('section-summary')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer ${
                selectedEmailSectionIds.has('section-summary')
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
              }`}
              title={selectedEmailSectionIds.has('section-summary') ? 'Quitar del reporte por correo' : 'Añadir al reporte por correo'}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{selectedEmailSectionIds.has('section-summary') ? 'En Correo' : '+ Correo'}</span>
            </button>

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
                    {(matrixDemoraFilter !== 'all' || matrixMonthFilter !== 'all' || matrixYearFilter !== 'all') && (
                      <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2.5 py-0.5 rounded-md font-extrabold">
                        {matrixFilteredConsolidatedRows.length} de {excelData?.consolidatedRows.length || 0} Registros
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Filtra simultáneamente las matrices por Demora en Días, Mes y Año.
                  </p>
                </div>
              </div>

              {(matrixDemoraFilter !== 'all' || matrixMonthFilter !== 'all' || matrixYearFilter !== 'all') && (
                <button
                  onClick={() => {
                    setMatrixDemoraFilter('all');
                    setMatrixMonthFilter('all');
                    setMatrixYearFilter('all');
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer w-fit"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer Filtros</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 1. Demora en Días Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Demora en Días</span>
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
                </select>
              </div>

              {/* 2. Month Filter */}
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

              {/* 3. Year Filter */}
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
                <button
                  onClick={() => toggleEmailSection('section-centrales')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer ${
                    selectedEmailSectionIds.has('section-centrales')
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                  }`}
                  title={selectedEmailSectionIds.has('section-centrales') ? 'Quitar del reporte por correo' : 'Añadir al reporte por correo'}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{selectedEmailSectionIds.has('section-centrales') ? 'En Correo' : '+ Correo'}</span>
                </button>
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
                <button
                  onClick={() => toggleEmailSection('section-zonas')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer ${
                    selectedEmailSectionIds.has('section-zonas')
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                  }`}
                  title={selectedEmailSectionIds.has('section-zonas') ? 'Quitar del reporte por correo' : 'Añadir al reporte por correo'}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{selectedEmailSectionIds.has('section-zonas') ? 'En Correo' : '+ Correo'}</span>
                </button>
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
                              ) : (
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
                          ) : (
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
          <div id="section-cables" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
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
                <button
                  onClick={() => toggleEmailSection('section-cables')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer ${
                    selectedEmailSectionIds.has('section-cables')
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                  }`}
                  title={selectedEmailSectionIds.has('section-cables') ? 'Quitar del reporte por correo' : 'Añadir al reporte por correo'}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{selectedEmailSectionIds.has('section-cables') ? 'En Correo' : '+ Correo'}</span>
                </button>
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
                headers={['N°', 'SERVICIO', 'CENTRAL', 'CABLE P', 'PAR P', 'CABLE S', 'PAR S', 'GRUPO', 'TIPO RED', 'DEMORA (DÍAS)', 'FECHA']}
                rows={displayModalServices.map((s, idx) => [
                  (idx + 1).toString(),
                  s.servicio,
                  s.central,
                  s.cableP || '-',
                  s.parP || '-',
                  s.cableS || '-',
                  s.parS || '-',
                  s.grupo,
                  s.networkTypeLabel || '-',
                  `${getDemoraDays(s)} días`,
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
                    <th className="py-3 px-4 text-cyan-400">Cable P / Par P</th>
                    <th className="py-3 px-4 text-indigo-400">Cable S / Par S</th>
                    <th className="py-3 px-4">Grupo de Trabajo</th>
                    <th className="py-3 px-4">Clasificación Red</th>
                    <th className="py-3 px-4 text-center">Demora (Días)</th>
                    <th className="py-3 px-4 text-center">Fecha Reporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {displayModalServices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-bold">
                        No se encontraron servicios consolidados para este filtro.
                      </td>
                    </tr>
                  ) : (
                    displayModalServices.map((item, idx) => (
                      <tr key={`${item.id}_${idx}`} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-amber-300 font-mono">{item.servicio}</td>
                        <td className="py-3 px-4 font-semibold text-white">{item.central}</td>
                        <td className="py-3 px-4 text-cyan-300 font-mono">
                          {item.cableP || '-'}{item.parP ? <span className="text-slate-400 font-sans text-[10px] ml-1">({item.parP})</span> : ''}
                        </td>
                        <td className="py-3 px-4 text-indigo-300 font-mono">
                          {item.cableS || '-'}{item.parS ? <span className="text-slate-400 font-sans text-[10px] ml-1">({item.parS})</span> : ''}
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

      {/* Floating Action Button for Navigation & Email Reporting */}
      <FloatingNavEmailFAB
        sections={availableSectionsList}
        selectedCount={selectedEmailSectionIds.size}
        onToggleSection={toggleEmailSection}
        onClearAll={handleClearAllEmailSections}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
        onSelectAll={handleSelectAllEmailSections}
        onSelectSummaryOnly={handleSelectSummaryOnlyEmailSections}
      />

      {/* Modal for Email Report Preparation */}
      <EmailReportModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        selectedSections={selectedSectionsForEmailModal}
        onRemoveSection={toggleEmailSection}
        onClearAll={handleClearAllEmailSections}
        onSelectAll={handleSelectAllEmailSections}
        onSelectSummaryOnly={handleSelectSummaryOnlyEmailSections}
        totalAvailableCount={availableSectionsList.length}
      />

    </div>
  );
};
