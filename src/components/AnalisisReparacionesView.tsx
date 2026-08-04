import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  Wrench, Clock, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  Search, Filter, Sparkles, ArrowLeft, UserCheck, Building2, FileText,
  Calendar, Upload, Download, Table, Layers, BarChart3, LineChart as LineChartIcon,
  AreaChart as AreaChartIcon, PieChart as PieChartIcon, GitCompare, RefreshCw,
  Repeat, Plus, Edit2, Trash2, Check, ArrowRight, HardDrive, FileSpreadsheet,
  Settings, HelpCircle, Copy
} from 'lucide-react';
import { Central, WorkGroup, DailyReport, RepairRecord, RepairColumnMapping, CustomTableSchema } from '../types';
import {
  MONTH_NAMES_ES, getTodayStr, formatDateShort, formatDateLong,
  getAvailableMonths
} from '../utils/dateUtils';
import { filterReportsByMonthYear } from '../utils/statCalculations';
import {
  parseExcelFileToRawTable, processRepairRowsWithMapping, createCustomTableFromExcel, RawExcelSheetData
} from '../utils/excelRepairParser';
import { CopyTableButton, CopyImageButton } from './CopyButton';

interface AnalisisReparacionesViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords: RepairRecord[];
  onUpdateRepairRecords: (records: RepairRecord[]) => void;
  customTables: CustomTableSchema[];
  onUpdateCustomTables: (tables: CustomTableSchema[]) => void;
  columnMapping: RepairColumnMapping;
  onUpdateColumnMapping: (mapping: RepairColumnMapping) => void;
  onBackToHub: () => void;
}

type TabType = 'central' | 'monthly' | 'mapper' | 'kpis' | 'repeated' | string; // string for custom table IDs
type ChartType = 'bar_grouped' | 'bar_stacked' | 'line' | 'area' | 'radar';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export const AnalisisReparacionesView: React.FC<AnalisisReparacionesViewProps> = ({
  centrales,
  workGroups,
  reports,
  repairRecords,
  onUpdateRepairRecords,
  customTables,
  onUpdateCustomTables,
  columnMapping,
  onUpdateColumnMapping,
  onBackToHub
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('central');

  // Filter State (Month & Year)
  const todayDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(todayDate.getMonth()); // 0-indexed (August = 7)
  const [selectedYear, setSelectedYear] = useState<number>(todayDate.getFullYear()); // 2026
  const [selectedCentralFilter, setSelectedCentralFilter] = useState<string>('all');
  const [chartType, setChartType] = useState<ChartType>('bar_grouped');

  // Excel File State & Mapping State
  const [uploadedExcelData, setUploadedExcelData] = useState<RawExcelSheetData | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState<boolean>(false);
  const [excelErrorMessage, setExcelErrorMessage] = useState<string | null>(null);
  const [excelSuccessMessage, setExcelSuccessMessage] = useState<string | null>(null);

  // Local Copy of Mapping Form State
  const [mappingForm, setMappingForm] = useState<RepairColumnMapping>(columnMapping);

  // New Custom Table Form State
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableDescription, setNewTableDescription] = useState<string>('');
  const [selectedColsForCustomTable, setSelectedColsForCustomTable] = useState<string[]>([]);
  const [customTableStartRow, setCustomTableStartRow] = useState<number>(2);
  const [customTableEndRow, setCustomTableEndRow] = useState<number | undefined>(undefined);

  // Repeated Services Filter State
  const [repeatedMinCount, setRepeatedMinCount] = useState<number>(2);
  const [repeatedSearchTerm, setRepeatedSearchTerm] = useState<string>('');
  const [repeatedCentralFilter, setRepeatedCentralFilter] = useState<string>('all');

  // 1. Handle Excel Upload
  const handleFileUpload = async (file: File) => {
    setIsProcessingExcel(true);
    setExcelErrorMessage(null);
    setExcelSuccessMessage(null);

    try {
      const parsedData = await parseExcelFileToRawTable(file);
      setUploadedExcelData(parsedData);

      // Auto-set default column mapping candidates from headers
      const headers = parsedData.headers;
      const findCol = (keywords: string[]) => {
        return headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) || headers[0] || '';
      };

      const updatedMapping: RepairColumnMapping = {
        dateCol: findCol(['fecha', 'date', 'dia']),
        centralCol: findCol(['central', 'cta', 'nodo', 'sucursal']),
        serviceCol: findCol(['servicio', 'telefono', 'tel', 'linea', 'abonado', 'numero', 'folio']),
        ticketCol: findCol(['ticket', 'folio', 'orden', 'codigo', 'id']),
        technicianCol: findCol(['tecnico', 'brigada', 'contrata', 'personal']),
        issueCol: findCol(['falla', 'averia', 'incidencia', 'problema', 'descripcion']),
        statusCol: findCol(['estado', 'status', 'condicion']),
        mttrCol: findCol(['mttr', 'horas', 'tiempo', 'duracion']),
        startRow: 2
      };

      setMappingForm(updatedMapping);
      onUpdateColumnMapping(updatedMapping);

      // Automatically initialize selected columns for custom table creation
      setSelectedColsForCustomTable(headers.slice(0, Math.min(6, headers.length)));

      setExcelSuccessMessage(`¡Archivo "${file.name}" cargado exitosamente! Se detectaron ${parsedData.totalRows} filas y ${headers.length} columnas.`);
    } catch (err: any) {
      setExcelErrorMessage(err.message || 'Error al procesar el archivo Excel.');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // 2. Process and Save Repair Records from Excel
  const handleProcessAndSaveRepairs = () => {
    if (!uploadedExcelData || uploadedExcelData.rows.length === 0) {
      setExcelErrorMessage('Primero debe subir un archivo Excel con registros para procesar.');
      return;
    }

    try {
      const processed = processRepairRowsWithMapping(
        uploadedExcelData.rows,
        mappingForm,
        centrales,
        workGroups
      );

      if (processed.length === 0) {
        setExcelErrorMessage('No se pudieron extraer registros válidos con la configuración de columnas seleccionada.');
        return;
      }

      // Merge with existing records or replace
      onUpdateRepairRecords(processed);
      onUpdateColumnMapping(mappingForm);

      setExcelSuccessMessage(`¡Se procesaron y guardaron ${processed.length} órdenes de reparación correctamente! Todos los dashboards se han actualizado.`);
    } catch (err: any) {
      setExcelErrorMessage(`Error al procesar filas: ${err.message || err}`);
    }
  };

  // 3. Create New Custom Table
  const handleCreateCustomTable = () => {
    if (!uploadedExcelData || uploadedExcelData.rows.length === 0) {
      setExcelErrorMessage('Cargue un archivo Excel antes de crear una tabla personalizada.');
      return;
    }

    if (!newTableName.trim()) {
      setExcelErrorMessage('Ingrese un nombre para la nueva tabla personalizada.');
      return;
    }

    if (selectedColsForCustomTable.length === 0) {
      setExcelErrorMessage('Seleccione al menos una columna para incluir en la nueva tabla.');
      return;
    }

    try {
      const newSchema = createCustomTableFromExcel(
        newTableName.trim(),
        uploadedExcelData.rows,
        selectedColsForCustomTable,
        customTableStartRow,
        customTableEndRow,
        newTableDescription
      );

      const updatedTables = [...customTables, newSchema];
      onUpdateCustomTables(updatedTables);

      setNewTableName('');
      setNewTableDescription('');
      setExcelSuccessMessage(`¡Tabla personalizada "${newSchema.tableName}" creada con éxito (${newSchema.rowCount} filas)! Puede verla en su pestaña dedicada.`);
      
      // Auto-navigate to new table dashboard tab
      setActiveTab(newSchema.id);
    } catch (err: any) {
      setExcelErrorMessage(`Error al crear la tabla: ${err.message || err}`);
    }
  };

  // 4. Delete Custom Table
  const handleDeleteCustomTable = (tableId: string) => {
    const updated = customTables.filter(t => t.id !== tableId);
    onUpdateCustomTables(updated);
    setActiveTab('mapper');
  };

  // Filtered Repair Records by Month & Year
  const filteredRepairs = useMemo(() => {
    return repairRecords.filter(r => {
      if (!r.date) return false;
      const parts = r.date.split('-');
      if (parts.length !== 3) return false;
      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1;

      if (selectedYear !== -1 && rYear !== selectedYear) return false;
      if (selectedMonth !== -1 && rMonth !== selectedMonth) return false;
      if (selectedCentralFilter !== 'all' && r.centralId !== selectedCentralFilter && r.centralName !== selectedCentralFilter) return false;
      return true;
    });
  }, [repairRecords, selectedMonth, selectedYear, selectedCentralFilter]);

  // Initial Reports from Module 1 for the same Month & Year
  const filteredInitialReports = useMemo(() => {
    return filterReportsByMonthYear(reports, selectedMonth, selectedYear, true);
  }, [reports, selectedMonth, selectedYear]);

  // Aggregated Stats per Central CTA (Reportes Iniciales Módulo 1 vs Reparaciones Realizadas)
  const centralComparisonData = useMemo(() => {
    const map: Record<string, {
      centralId: string;
      centralName: string;
      initialReportsCount: number;
      repairsCount: number;
      resolvedCount: number;
      inProgressCount: number;
      pendingCount: number;
      avgMttr: number;
      mttrSum: number;
    }> = {};

    // Initialize map with all Centrales
    centrales.forEach(c => {
      map[c.id] = {
        centralId: c.id,
        centralName: c.name,
        initialReportsCount: 0,
        repairsCount: 0,
        resolvedCount: 0,
        inProgressCount: 0,
        pendingCount: 0,
        avgMttr: 0,
        mttrSum: 0
      };
    });

    // Accumulate Initial Reports from Module 1
    filteredInitialReports.forEach(r => {
      if (map[r.centralId]) {
        map[r.centralId].initialReportsCount += (r.reportCount || 0);
      } else {
        const found = centrales.find(c => c.id === r.centralId);
        map[r.centralId] = {
          centralId: r.centralId,
          centralName: found ? found.name : r.centralId,
          initialReportsCount: r.reportCount || 0,
          repairsCount: 0,
          resolvedCount: 0,
          inProgressCount: 0,
          pendingCount: 0,
          avgMttr: 0,
          mttrSum: 0
        };
      }
    });

    // Accumulate Repairs
    filteredRepairs.forEach(r => {
      let key = r.centralId;
      if (!key) {
        const found = centrales.find(c => c.name.toLowerCase() === r.centralName.toLowerCase() || c.code.toLowerCase() === r.centralName.toLowerCase());
        key = found ? found.id : r.centralName;
      }

      if (!map[key]) {
        map[key] = {
          centralId: key,
          centralName: r.centralName,
          initialReportsCount: 0,
          repairsCount: 0,
          resolvedCount: 0,
          inProgressCount: 0,
          pendingCount: 0,
          avgMttr: 0,
          mttrSum: 0
        };
      }

      map[key].repairsCount += 1;
      map[key].mttrSum += (r.mttrHours || 0);

      if (r.status === 'resolved') map[key].resolvedCount += 1;
      else if (r.status === 'in_progress') map[key].inProgressCount += 1;
      else map[key].pendingCount += 1;
    });

    const rows = Object.values(map).map(item => {
      const pendingDiff = Math.max(0, item.initialReportsCount - item.repairsCount);
      const resolutionRate = item.initialReportsCount > 0
        ? parseFloat(((item.repairsCount / item.initialReportsCount) * 100).toFixed(1))
        : item.repairsCount > 0 ? 100 : 0;
      const avgMttr = item.repairsCount > 0 ? parseFloat((item.mttrSum / item.repairsCount).toFixed(1)) : 0;

      return {
        ...item,
        pendingDiff,
        resolutionRate,
        avgMttr
      };
    });

    rows.sort((a, b) => b.repairsCount - a.repairsCount);
    return rows;
  }, [centrales, filteredInitialReports, filteredRepairs]);

  // Summary Totals
  const totalSummary = useMemo(() => {
    let sumInitial = 0;
    let sumRepairs = 0;
    let sumResolved = 0;
    let sumInProgress = 0;
    let sumPending = 0;
    let totalMttrSum = 0;

    centralComparisonData.forEach(row => {
      sumInitial += row.initialReportsCount;
      sumRepairs += row.repairsCount;
      sumResolved += row.resolvedCount;
      sumInProgress += row.inProgressCount;
      sumPending += row.pendingCount;
      totalMttrSum += row.mttrSum;
    });

    const totalRate = sumInitial > 0 ? parseFloat(((sumRepairs / sumInitial) * 100).toFixed(1)) : 0;
    const globalAvgMttr = sumRepairs > 0 ? parseFloat((totalMttrSum / sumRepairs).toFixed(1)) : 0;

    return {
      sumInitial,
      sumRepairs,
      sumResolved,
      sumInProgress,
      sumPending,
      totalRate,
      globalAvgMttr
    };
  }, [centralComparisonData]);

  // Breakdown 1: Comparación por Días del Mes (Daily Comparison)
  const dailyComparisonData = useMemo(() => {
    const dateMap: Record<string, { date: string; dayNum: number; reports: number; repairs: number }> = {};

    filteredInitialReports.forEach(r => {
      if (!dateMap[r.date]) {
        const parts = r.date.split('-');
        dateMap[r.date] = { date: r.date, dayNum: parseInt(parts[2], 10), reports: 0, repairs: 0 };
      }
      dateMap[r.date].reports += (r.reportCount || 0);
    });

    filteredRepairs.forEach(r => {
      if (!dateMap[r.date]) {
        const parts = r.date.split('-');
        dateMap[r.date] = { date: r.date, dayNum: parseInt(parts[2] || '1', 10), reports: 0, repairs: 0 };
      }
      dateMap[r.date].repairs += 1;
    });

    const list = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    return list.map(item => ({
      dateLabel: `Día ${item.dayNum}`,
      fullDate: item.date,
      'Reportes Iniciales': item.reports,
      'Reparaciones Realizadas': item.repairs
    }));
  }, [filteredInitialReports, filteredRepairs]);

  // Breakdown 2: Comparación entre Semanas del Mes (Weekly Comparison)
  const weeklyComparisonData = useMemo(() => {
    const weekMap: Record<number, { weekName: string; reports: number; repairs: number }> = {
      1: { weekName: 'Semana 1 (Días 1-7)', reports: 0, repairs: 0 },
      2: { weekName: 'Semana 2 (Días 8-14)', reports: 0, repairs: 0 },
      3: { weekName: 'Semana 3 (Días 15-21)', reports: 0, repairs: 0 },
      4: { weekName: 'Semana 4 (Días 22-28)', reports: 0, repairs: 0 },
      5: { weekName: 'Semana 5 (Días 29+)', reports: 0, repairs: 0 }
    };

    filteredInitialReports.forEach(r => {
      const day = parseInt(r.date.split('-')[2], 10);
      const wIdx = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
      weekMap[wIdx].reports += (r.reportCount || 0);
    });

    filteredRepairs.forEach(r => {
      const day = parseInt(r.date.split('-')[2], 10);
      const wIdx = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
      weekMap[wIdx].repairs += 1;
    });

    return Object.values(weekMap).map(w => ({
      name: w.weekName,
      'Reportes Iniciales': w.reports,
      'Reparaciones Realizadas': w.repairs
    }));
  }, [filteredInitialReports, filteredRepairs]);

  // Dashboard 2: Comparaciones por Meses (Multi-Month Trend)
  const multiMonthComparisonData = useMemo(() => {
    const monthMap: Record<string, { label: string; year: number; monthIdx: number; reports: number; repairs: number }> = {};

    // Group all initial reports by YYYY-MM
    reports.forEach(r => {
      if (!r.date) return;
      const key = r.date.substring(0, 7);
      const parts = key.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;

      if (!monthMap[key]) {
        monthMap[key] = {
          label: `${MONTH_NAMES_ES[m]?.substring(0, 3)} ${y}`,
          year: y,
          monthIdx: m,
          reports: 0,
          repairs: 0
        };
      }
      monthMap[key].reports += (r.reportCount || 0);
    });

    // Group all repairs by YYYY-MM
    repairRecords.forEach(r => {
      if (!r.date) return;
      const key = r.date.substring(0, 7);
      const parts = key.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;

      if (!monthMap[key]) {
        monthMap[key] = {
          label: `${MONTH_NAMES_ES[m]?.substring(0, 3)} ${y}`,
          year: y,
          monthIdx: m,
          reports: 0,
          repairs: 0
        };
      }
      monthMap[key].repairs += 1;
    });

    const list = Object.values(monthMap).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIdx - b.monthIdx;
    });

    return list.map(item => {
      const rate = item.reports > 0 ? parseFloat(((item.repairs / item.reports) * 100).toFixed(1)) : 0;
      return {
        ...item,
        'Reportes Iniciales': item.reports,
        'Reparaciones Realizadas': item.repairs,
        'Tasa Eficiencia %': rate
      };
    });
  }, [reports, repairRecords]);

  // Dashboard 4: General KPI Dashboard (Peak Day & Min Day calculations)
  const kpiMinMaxDaysData = useMemo(() => {
    const dateCounts: Record<string, { date: string; count: number; topCentral: string }> = {};
    const dateCentralCounts: Record<string, Record<string, number>> = {};

    filteredRepairs.forEach(r => {
      const d = r.date;
      if (!dateCounts[d]) {
        dateCounts[d] = { date: d, count: 0, topCentral: '' };
        dateCentralCounts[d] = {};
      }
      dateCounts[d].count += 1;
      const cName = r.centralName || 'General';
      dateCentralCounts[d][cName] = (dateCentralCounts[d][cName] || 0) + 1;
    });

    // Find top central per date
    Object.keys(dateCounts).forEach(d => {
      let topC = '';
      let maxC = 0;
      Object.entries(dateCentralCounts[d]).forEach(([cName, cnt]) => {
        if (cnt > maxC) {
          maxC = cnt;
          topC = cName;
        }
      });
      dateCounts[d].topCentral = topC;
    });

    const datesList = Object.values(dateCounts);

    if (datesList.length === 0) {
      return {
        maxDay: null,
        minDay: null,
        activeDaysCount: 0,
        avgDailyRepairs: 0
      };
    }

    let maxDay = datesList[0];
    let minDay = datesList[0];

    datesList.forEach(item => {
      if (item.count > maxDay.count) maxDay = item;
      if (item.count < minDay.count) minDay = item;
    });

    const avgDailyRepairs = parseFloat((filteredRepairs.length / datesList.length).toFixed(1));

    return {
      maxDay,
      minDay,
      activeDaysCount: datesList.length,
      avgDailyRepairs
    };
  }, [filteredRepairs]);

  // Dashboard 5: Analysis of Repeated Services (Reincidentes >= 2)
  const repeatedServicesData = useMemo(() => {
    const serviceMap: Record<string, {
      serviceNumber: string;
      repairs: RepairRecord[];
      count: number;
      centralNames: Set<string>;
      latestDate: string;
      latestTech: string;
      latestIssue: string;
      latestStatus: string;
    }> = {};

    repairRecords.forEach(r => {
      const sNum = (r.serviceNumber || '').trim();
      if (!sNum) return;

      if (!serviceMap[sNum]) {
        serviceMap[sNum] = {
          serviceNumber: sNum,
          repairs: [],
          count: 0,
          centralNames: new Set(),
          latestDate: r.date,
          latestTech: r.technician,
          latestIssue: r.issueType,
          latestStatus: r.status
        };
      }

      serviceMap[sNum].repairs.push(r);
      serviceMap[sNum].count += 1;
      serviceMap[sNum].centralNames.add(r.centralName);

      if (r.date >= serviceMap[sNum].latestDate) {
        serviceMap[sNum].latestDate = r.date;
        serviceMap[sNum].latestTech = r.technician;
        serviceMap[sNum].latestIssue = r.issueType;
        serviceMap[sNum].latestStatus = r.status;
      }
    });

    // Filter repeated services (count >= repeatedMinCount)
    let list = Object.values(serviceMap).filter(item => item.count >= repeatedMinCount);

    // Filter by Central if selected
    if (repeatedCentralFilter !== 'all') {
      list = list.filter(item => Array.from(item.centralNames).some(c => c.toLowerCase().includes(repeatedCentralFilter.toLowerCase())));
    }

    // Filter by search term
    if (repeatedSearchTerm.trim()) {
      const term = repeatedSearchTerm.toLowerCase();
      list = list.filter(item =>
        item.serviceNumber.toLowerCase().includes(term) ||
        item.latestIssue.toLowerCase().includes(term) ||
        item.latestTech.toLowerCase().includes(term) ||
        Array.from(item.centralNames).some(c => c.toLowerCase().includes(term))
      );
    }

    // Sort descending by repetition count
    list.sort((a, b) => b.count - a.count);

    return list;
  }, [repairRecords, repeatedMinCount, repeatedCentralFilter, repeatedSearchTerm]);

  // Copy Headers for Central Matrix Table
  const copyHeadersCentralTable = [
    'Central CTA',
    'Reportes Iniciales (Módulo 1)',
    'Reparaciones Realizadas',
    'Pendientes Solución',
    'Tasa Eficiencia %',
    'MTTR Prom. (Horas)'
  ];

  const copyRowsCentralTable = useMemo(() => {
    return centralComparisonData.map(row => [
      row.centralName,
      row.initialReportsCount,
      row.repairsCount,
      row.pendingDiff,
      `${row.resolutionRate}%`,
      `${row.avgMttr}h`
    ]);
  }, [centralComparisonData]);

  // Copy Headers for Repeated Services Table
  const copyHeadersRepeatedTable = [
    'Servicio / Abonado / Teléfono',
    'N° Reincidencias',
    'Centrales Afectadas',
    'Fechas de Reparación',
    'Última Falla Registrada',
    'Último Técnico',
    'Estado'
  ];

  const copyRowsRepeatedTable = useMemo(() => {
    return repeatedServicesData.map(item => [
      item.serviceNumber,
      `${item.count} veces`,
      Array.from(item.centralNames).join(', '),
      item.repairs.map(r => r.date).join(' | '),
      item.latestIssue,
      item.latestTech,
      item.latestStatus === 'resolved' ? 'Resuelto' : 'En Proceso'
    ]);
  }, [repeatedServicesData]);

  return (
    <div className="space-y-6 font-sans">

      {/* Top Banner & Module Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBackToHub}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 transition-all hover:scale-105 shrink-0"
              title="Volver al Portal de Módulos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-bold uppercase font-mono">
                  Recuadro 03 · Módulo Reparaciones
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Procesador Excel & Analítica Integrada</span>
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-1">Análisis de Reparaciones y Tiempos de Solución (MTTR)</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Control de órdenes de reparación, comparación contra solicitudes reportadas, mapeador de Excel y detección de reincidencias.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('mapper')}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              <Upload className="w-4 h-4" />
              <span>Subir Excel Reparaciones</span>
            </button>
            <button
              onClick={onBackToHub}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
            >
              ← Volver al Portal
            </button>
          </div>
        </div>

        {/* Dashboards Sub-Navigation Tabs Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('central')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'central'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Reparaciones por Central (vs Reportes)</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'monthly'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>2. Comparación Mensual</span>
          </button>

          <button
            onClick={() => setActiveTab('mapper')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'mapper'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>3. Mapeador Columnas Excel & Tablas</span>
          </button>

          <button
            onClick={() => setActiveTab('kpis')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'kpis'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>4. Dashboard General KPI</span>
          </button>

          <button
            onClick={() => setActiveTab('repeated')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'repeated'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Repeat className="w-4 h-4 text-amber-400" />
            <span>5. Servicios Repetidos (2+ veces)</span>
          </button>

          {/* Dynamic Custom Tables Tabs */}
          {customTables.map(ct => (
            <button
              key={ct.id}
              onClick={() => setActiveTab(ct.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === ct.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800/80 text-emerald-400 hover:bg-slate-800 border border-emerald-500/20'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Tabla: {ct.tableName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Global Month/Year Filter Bar for Analytics Dashboards */}
      {(activeTab === 'central' || activeTab === 'kpis') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-extrabold text-slate-900 uppercase">Filtros Operativos:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Month Dropdown */}
            <div className="flex items-center space-x-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Mes:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value={-1}>Todos los Meses</option>
                {MONTH_NAMES_ES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="flex items-center space-x-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Año:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value={-1}>Todos los Años</option>
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </div>

            {/* Central Dropdown */}
            <div className="flex items-center space-x-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Central:</label>
              <select
                value={selectedCentralFilter}
                onChange={(e) => setSelectedCentralFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todas las Centrales CTA</option>
                {centrales.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: REPARACIONES POR CENTRAL (VS REPORTES INICIALES DEL MÓDULO 1) */}
      {/* ========================================================================= */}
      {activeTab === 'central' && (
        <div className="space-y-6">
          
          {/* Top KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Solicitudes Reportadas (Módulo 1)
              </div>
              <div className="text-2xl font-black text-slate-900">
                {totalSummary.sumInitial.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Incidencias de la 1er recuadro ({selectedMonth !== -1 ? MONTH_NAMES_ES[selectedMonth] : 'Todos'} {selectedYear !== -1 ? selectedYear : ''})
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Reparaciones Ejecutadas
              </div>
              <div className="text-2xl font-black text-indigo-600">
                {totalSummary.sumRepairs.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {totalSummary.sumResolved} resueltas · {totalSummary.sumInProgress} en proceso
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Tasa de Resolución / Eficiencia
              </div>
              <div className={`text-2xl font-black flex items-center space-x-1 ${
                totalSummary.totalRate >= 80 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                <span>{totalSummary.totalRate}%</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Cobertura frente a reportes iniciales
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Tiempo Medio de Solución (MTTR)
              </div>
              <div className="text-2xl font-black text-slate-900">
                {totalSummary.globalAvgMttr} Horas
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Promedio de atención por brigada
              </div>
            </div>

          </div>

          {/* Main Comparison Chart: Reportes Iniciales vs Reparaciones Realizadas */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Comparación de Reportes Iniciales vs Reparaciones por Central</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Evalúa las solicitudes iniciales del Módulo 1 contra las ordenes de reparación ejecutadas en cada central CTA.
                </p>
              </div>

              {/* Chart Type Selector */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setChartType('bar_grouped')}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    chartType === 'bar_grouped' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Agrupado
                </button>
                <button
                  onClick={() => setChartType('bar_stacked')}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    chartType === 'bar_stacked' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Apilado
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    chartType === 'line' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Tendencia
                </button>
                <button
                  onClick={() => setChartType('radar')}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    chartType === 'radar' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Radar
                </button>
              </div>
            </div>

            {/* Chart Container */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar_grouped' ? (
                  <BarChart data={centralComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="centralName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                    <Bar dataKey="initialReportsCount" name="Reportes Iniciales (Solicitudes)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="repairsCount" name="Reparaciones Realizadas" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : chartType === 'bar_stacked' ? (
                  <BarChart data={centralComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="centralName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                    <Bar dataKey="repairsCount" name="Reparaciones Realizadas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendingDiff" name="Pendientes de Reparación" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={centralComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="centralName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="initialReportsCount" name="Reportes Iniciales" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
                    <Line type="monotone" dataKey="repairsCount" name="Reparaciones Realizadas" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                ) : (
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={centralComparisonData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="centralName" tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                    <Radar name="Reportes Iniciales" dataKey="initialReportsCount" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                    <Radar name="Reparaciones Realizadas" dataKey="repairsCount" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                  </RadarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sub-Charts Section: Daily Comparison & Weekly Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Comparación por Días del Mes */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Comparación por Días del Mes</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Comportamiento diario de las solicitudes iniciales frente a reparaciones.
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748b' }} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="Reportes Iniciales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Reparaciones Realizadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparación entre Semanas del Mes */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Comparación entre Semanas del Mes</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Acumulado semanal de atenciones y cobertura técnica.
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Reportes Iniciales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Reparaciones Realizadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Full Comparative Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Table className="w-4 h-4 text-indigo-600" />
                  <span>Matriz de Desglose por Central (Reportes vs Reparaciones)</span>
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <CopyTableButton headers={copyHeadersCentralTable} rows={copyRowsCentralTable} />
                <CopyImageButton elementId="central-repair-table-container" label="Copiar Tabla Imagen" />
              </div>
            </div>

            <div id="central-repair-table-container" className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Central Telefónica CTA</th>
                    <th className="p-3 text-center">Reportes Iniciales (Sol. 1er Recuadro)</th>
                    <th className="p-3 text-center">Reparaciones Ejecutadas</th>
                    <th className="p-3 text-center">Pendientes</th>
                    <th className="p-3 text-right">% Eficiencia</th>
                    <th className="p-3 text-right">MTTR Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {centralComparisonData.map((row, idx) => (
                    <tr key={row.centralId} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{row.centralName}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-600">{row.initialReportsCount}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-600">{row.repairsCount}</td>
                      <td className="p-3 text-center font-mono font-bold text-amber-600">{row.pendingDiff}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">{row.resolutionRate}%</td>
                      <td className="p-3 text-right font-mono text-slate-700">{row.avgMttr}h</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={2} className="p-3 text-slate-900 uppercase tracking-wider font-mono">
                      TOTALES RED NOC
                    </td>
                    <td className="p-3 text-center font-mono text-blue-700 text-sm">{totalSummary.sumInitial}</td>
                    <td className="p-3 text-center font-mono text-emerald-700 text-sm">{totalSummary.sumRepairs}</td>
                    <td className="p-3 text-center font-mono text-amber-700 text-sm">{totalSummary.sumInitial - totalSummary.sumRepairs}</td>
                    <td className="p-3 text-right font-mono text-slate-900 text-sm">{totalSummary.totalRate}%</td>
                    <td className="p-3 text-right font-mono text-slate-900 text-sm">{totalSummary.globalAvgMttr}h</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMPARACIÓN MENSUAL DE LAS REPARADAS */}
      {/* ========================================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="pb-4 border-b border-slate-100 space-y-0.5">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <span>Evolución Comparativa Mensual de Reparaciones</span>
              </h3>
              <p className="text-xs text-slate-500">
                Comparativa histórica mes a mes de las reparaciones realizadas frente a las solicitudes de reporte inicial.
              </p>
            </div>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={multiMonthComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="Reportes Iniciales" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                  <Area type="monotone" dataKey="Reparaciones Realizadas" stroke="#10b981" fill="#10b981" fillOpacity={0.5} strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table Breakdown Month by Month */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Table className="w-4 h-4 text-indigo-600" />
              <span>Matriz Evolutiva Mensual de Solicitudes y Reparaciones</span>
            </h3>

            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Periodo (Mes - Año)</th>
                    <th className="p-3 text-center">Reportes Iniciales (Módulo 1)</th>
                    <th className="p-3 text-center">Reparaciones Ejecutadas</th>
                    <th className="p-3 text-center">Diferencia</th>
                    <th className="p-3 text-right">Tasa Eficiencia %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {multiMonthComparisonData.map((row) => (
                    <tr key={row.label} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{row.label}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-600">{row.reports}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-600">{row.repairs}</td>
                      <td className="p-3 text-center font-mono font-bold text-amber-600">{Math.max(0, row.reports - row.repairs)}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">{row['Tasa Eficiencia %']}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MAPEADOR DE COLUMNAS EXCEL & CREACIÓN DE TABLAS PERSONALIZADAS */}
      {/* ========================================================================= */}
      {activeTab === 'mapper' && (
        <div className="space-y-6">
          
          {/* Notifications */}
          {excelSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{excelSuccessMessage}</span>
            </div>
          )}

          {excelErrorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{excelErrorMessage}</span>
            </div>
          )}

          {/* File Upload Zone */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Subir Archivo Excel de Reparaciones (.xlsx, .xls, .csv)</h3>
                <p className="text-xs text-slate-500">Cargue el archivo con las órdenes de trabajo para asignar columnas y procesar los datos automáticamente.</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-2 pointer-events-none">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {isProcessingExcel ? 'Procesando archivo...' : 'Arrastre su archivo Excel aquí o haga clic para examinar'}
                </div>
                <div className="text-xs text-slate-500">Soporta formatos .xlsx, .xls y .csv con cualquier número de filas y columnas.</div>
              </div>
            </div>

            {uploadedExcelData && (
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between text-xs font-bold text-indigo-900">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span>Archivo Activo: <strong>{uploadedExcelData.fileName}</strong> ({uploadedExcelData.sheetName} · {uploadedExcelData.totalRows} filas · {uploadedExcelData.headers.length} columnas)</span>
                </div>
                <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[10px]">Cargado</span>
              </div>
            )}
          </div>

          {/* Dynamic Column Mapping Controls */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Configuración de Mapeo de Columnas para Reparaciones</h3>
                  <p className="text-xs text-slate-500">Asigne las columnas del Excel cargado a los campos estándar de procesamiento.</p>
                </div>
              </div>

              <button
                onClick={handleProcessAndSaveRepairs}
                disabled={!uploadedExcelData}
                className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md ${
                  uploadedExcelData
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Auto-Procesar y Guardar Reparaciones</span>
              </button>
            </div>

            {uploadedExcelData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Fecha:</label>
                  <select
                    value={mappingForm.dateCol}
                    onChange={(e) => setMappingForm({ ...mappingForm, dateCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Central Telefónica:</label>
                  <select
                    value={mappingForm.centralCol}
                    onChange={(e) => setMappingForm({ ...mappingForm, centralCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Servicio / Abonado / Teléfono:</label>
                  <select
                    value={mappingForm.serviceCol}
                    onChange={(e) => setMappingForm({ ...mappingForm, serviceCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Ticket / Folio:</label>
                  <select
                    value={mappingForm.ticketCol || ''}
                    onChange={(e) => setMappingForm({ ...mappingForm, ticketCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    <option value="">(Opcional - Auto Generar)</option>
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Técnico / Brigada:</label>
                  <select
                    value={mappingForm.technicianCol || ''}
                    onChange={(e) => setMappingForm({ ...mappingForm, technicianCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    <option value="">(Opcional)</option>
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Falla / Mantenimiento:</label>
                  <select
                    value={mappingForm.issueCol || ''}
                    onChange={(e) => setMappingForm({ ...mappingForm, issueCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    <option value="">(Opcional)</option>
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna Estado:</label>
                  <select
                    value={mappingForm.statusCol || ''}
                    onChange={(e) => setMappingForm({ ...mappingForm, statusCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    <option value="">(Opcional - Predeterminado Resuelto)</option>
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Columna MTTR (Horas):</label>
                  <select
                    value={mappingForm.mttrCol || ''}
                    onChange={(e) => setMappingForm({ ...mappingForm, mttrCol: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                  >
                    <option value="">(Opcional - Predeterminado 1.5h)</option>
                    {uploadedExcelData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Rango de Filas (Fila Inicial / Final):</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={1}
                      value={mappingForm.startRow}
                      onChange={(e) => setMappingForm({ ...mappingForm, startRow: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                      placeholder="Fila Inicial (ej. 2)"
                    />
                    <span className="text-slate-400 font-bold text-xs">a</span>
                    <input
                      type="number"
                      min={1}
                      value={mappingForm.endRow || ''}
                      onChange={(e) => setMappingForm({ ...mappingForm, endRow: parseInt(e.target.value, 10) || undefined })}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                      placeholder="Fila Final (Vacío = Todo)"
                    />
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                Cargue un archivo Excel arriba para habilitar la selección interactiva de columnas.
              </div>
            )}
          </div>

          {/* Create Custom Table Section */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Plus className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Crear Nueva Tabla Procesada para Nuevo Dashboard</h3>
                <p className="text-xs text-slate-500">Seleccione columnas y filas del Excel para generar una tabla independiente en una pestaña dedicada.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Nombre de la Nueva Tabla:</label>
                <input
                  type="text"
                  placeholder="ej. Mantenimientos Preventivos FTTH"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Descripción Breve:</label>
                <input
                  type="text"
                  placeholder="ej. Registro especial de atenciones en nodos Norte"
                  value={newTableDescription}
                  onChange={(e) => setNewTableDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-2.5"
                />
              </div>
            </div>

            {uploadedExcelData && (
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold uppercase text-slate-600 block">Seleccione Columnas a Incluir:</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {uploadedExcelData.headers.map(col => {
                    const isSelected = selectedColsForCustomTable.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedColsForCustomTable(selectedColsForCustomTable.filter(c => c !== col));
                          } else {
                            setSelectedColsForCustomTable([...selectedColsForCustomTable, col]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleCreateCustomTable}
              disabled={!uploadedExcelData || !newTableName.trim()}
              className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md ${
                uploadedExcelData && newTableName.trim()
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Guardar Nueva Tabla y Abrir Dashboard</span>
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DASHBOARD GENERAL KPI (MÁXIMOS, MÍNIMOS Y EFICIENCIA) */}
      {/* ========================================================================= */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Día con MÁS Reparaciones */}
            <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white p-6 rounded-3xl shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="bg-white/20 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full border border-white/30">
                  Máximo Pico Diario
                </span>
                <TrendingUp className="w-8 h-8 text-white/80" />
              </div>

              <div>
                <div className="text-3xl font-black">
                  {kpiMinMaxDaysData.maxDay ? `${kpiMinMaxDaysData.maxDay.count} Reparaciones` : 'N/A'}
                </div>
                <div className="text-sm font-bold opacity-90 mt-1">
                  {kpiMinMaxDaysData.maxDay ? formatDateLong(kpiMinMaxDaysData.maxDay.date) : 'Sin datos'}
                </div>
              </div>

              {kpiMinMaxDaysData.maxDay && (
                <div className="text-xs bg-black/20 p-2.5 rounded-xl border border-white/10 font-semibold">
                  Central con mayor concentración: <strong>{kpiMinMaxDaysData.maxDay.topCentral}</strong>
                </div>
              )}
            </div>

            {/* Día con MENOS Reparaciones */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-6 rounded-3xl shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="bg-white/20 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full border border-white/30">
                  Mínimo Registro Diario
                </span>
                <TrendingDown className="w-8 h-8 text-white/80" />
              </div>

              <div>
                <div className="text-3xl font-black">
                  {kpiMinMaxDaysData.minDay ? `${kpiMinMaxDaysData.minDay.count} Reparaciones` : 'N/A'}
                </div>
                <div className="text-sm font-bold opacity-90 mt-1">
                  {kpiMinMaxDaysData.minDay ? formatDateLong(kpiMinMaxDaysData.minDay.date) : 'Sin datos'}
                </div>
              </div>

              {kpiMinMaxDaysData.minDay && (
                <div className="text-xs bg-black/20 p-2.5 rounded-xl border border-white/10 font-semibold">
                  Mínima demanda operativa registrada en red.
                </div>
              )}
            </div>

          </div>

          {/* General Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Promedio Diario de Reparaciones</div>
              <div className="text-2xl font-black text-indigo-600">{kpiMinMaxDaysData.avgDailyRepairs} / día</div>
              <div className="text-[11px] text-slate-500">Calculado sobre {kpiMinMaxDaysData.activeDaysCount} días activos</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Tiempo Medio de Atención (MTTR)</div>
              <div className="text-2xl font-black text-slate-900">{totalSummary.globalAvgMttr} Horas</div>
              <div className="text-[11px] text-slate-500">Promedio general de atención por caso</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Eficiencia General de Cobertura</div>
              <div className="text-2xl font-black text-emerald-600">{totalSummary.totalRate}%</div>
              <div className="text-[11px] text-slate-500">Porcentaje de solicitudes resueltas</div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ANÁLISIS DE SERVICIOS REPETIDOS (REINCIDENTES >= 2) */}
      {/* ========================================================================= */}
      {activeTab === 'repeated' && (
        <div className="space-y-6">
          
          {/* Header Banner */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-3xl p-6 space-y-2">
            <div className="flex items-center space-x-2 text-amber-600 font-extrabold text-xs uppercase tracking-wider">
              <Repeat className="w-4 h-4" />
              <span>Detección de Reincidencia Operativa</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Análisis de Servicios Repetidos (2 o Más Reparaciones)</h2>
            <p className="text-xs text-slate-600">
              Módulo de identificación automática de líneas, abonas y circuitos telefónicos que han presentado averías recurrentes.
            </p>
          </div>

          {/* Filters Bar for Repeated Services */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por teléfono, abonado, técnica, falla..."
                value={repeatedSearchTerm}
                onChange={(e) => setRepeatedSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 w-64"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Mín. Repeticiones:</label>
                <select
                  value={repeatedMinCount}
                  onChange={(e) => setRepeatedMinCount(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5"
                >
                  <option value={2}>2 o más veces</option>
                  <option value={3}>3 o más veces</option>
                  <option value={4}>4 o más veces</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Central:</label>
                <select
                  value={repeatedCentralFilter}
                  onChange={(e) => setRepeatedCentralFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5"
                >
                  <option value="all">Todas las Centrales</option>
                  {centrales.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* KPI Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Servicios Reincidentes</div>
              <div className="text-2xl font-black text-rose-600">{repeatedServicesData.length} Casos</div>
              <div className="text-[11px] text-slate-500">Líneas con {repeatedMinCount}+ reparaciones</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Mayor N° de Reincidencias</div>
              <div className="text-2xl font-black text-slate-900">
                {repeatedServicesData[0] ? `${repeatedServicesData[0].count} veces` : '0'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Servicio: {repeatedServicesData[0]?.serviceNumber || 'Ninguno'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Central Más Afectada</div>
              <div className="text-lg font-black text-slate-900 truncate">
                {repeatedServicesData[0] ? Array.from(repeatedServicesData[0].centralNames)[0] : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500">Acumula mayor recurrencia</div>
            </div>
          </div>

          {/* Detailed Repeated Services Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Table className="w-4 h-4 text-indigo-600" />
                <span>Tabla de Servicios y Abonados Repetidos ({repeatedServicesData.length})</span>
              </h3>

              <div className="flex items-center space-x-2">
                <CopyTableButton headers={copyHeadersRepeatedTable} rows={copyRowsRepeatedTable} />
                <CopyImageButton elementId="repeated-services-table-container" label="Copiar Tabla Imagen" />
              </div>
            </div>

            <div id="repeated-services-table-container" className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Servicio / Abonado</th>
                    <th className="p-3 text-center">N° Reincidencias</th>
                    <th className="p-3">Centrales Afectadas</th>
                    <th className="p-3">Fechas de Reparación</th>
                    <th className="p-3">Última Falla Registrada</th>
                    <th className="p-3">Técnico Asignado</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {repeatedServicesData.map((item, idx) => (
                    <tr key={item.serviceNumber} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{item.serviceNumber}</td>
                      <td className="p-3 text-center">
                        <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full font-black text-[11px] font-mono">
                          {item.count}x veces
                        </span>
                      </td>
                      <td className="p-3 text-slate-800 font-semibold">{Array.from(item.centralNames).join(', ')}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                        {item.repairs.map(r => r.date).join(' · ')}
                      </td>
                      <td className="p-3 text-slate-900 max-w-xs">{item.latestIssue}</td>
                      <td className="p-3 text-slate-700">{item.latestTech}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.latestStatus === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.latestStatus === 'resolved' ? 'Resuelto' : 'En Proceso'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {repeatedServicesData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                        No se encontraron servicios repetidos con los criterios seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6+: DYNAMIC CUSTOM TABLE DASHBOARD */}
      {/* ========================================================================= */}
      {customTables.some(ct => ct.id === activeTab) && (() => {
        const currentTable = customTables.find(ct => ct.id === activeTab)!;
        return (
          <div className="space-y-6">
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase font-mono">
                  Tabla Personalizada
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">{currentTable.tableName}</h2>
                <p className="text-xs text-slate-600">{currentTable.description || 'Dashboard procesado desde Excel.'}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteCustomTable(currentTable.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Tabla</span>
                </button>
              </div>
            </div>

            {/* Custom Table Content */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">#</th>
                      {currentTable.columnsToProcess.map(col => (
                        <th key={col} className="p-3">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {currentTable.data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        {currentTable.columnsToProcess.map(col => (
                          <td key={col} className="p-3 text-slate-800">{String(row[col] || '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
