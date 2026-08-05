import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList
} from 'recharts';
import {
  Wrench, Clock, CheckCircle2, AlertTriangle, TrendingUp,
  Search, Filter, Sparkles, ArrowLeft, UserCheck, Building2,
  Calendar, Upload, Download, Table, Layers, BarChart3, LineChart as LineChartIcon,
  AreaChart as AreaChartIcon, Repeat, Plus, Trash2, Check, ArrowUp, ArrowDown,
  Key, Save, ShieldAlert, RefreshCw
} from 'lucide-react';
import { Central, WorkGroup, DailyReport, RepairRecord, RepairColumnMapping, CustomTableSchema, UserProfile, SystemDataBackup } from '../types';
import { MONTH_NAMES_ES } from '../utils/dateUtils';
import { filterReportsByMonthYear } from '../utils/statCalculations';
import {
  parseExcelFileToRawTable, processRepairRowsWithMapping, createCustomTableFromExcel, RawExcelSheetData
} from '../utils/excelRepairParser';
import { downloadJSONBackup } from '../utils/exportUtils';
import { CopyTableButton } from './CopyButton';
import { GoogleDriveBackupView } from './GoogleDriveBackupView';

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
  onImportBackup: (backup: SystemDataBackup) => void;
  currentUser: UserProfile;
  onUpdateCurrentUser: (user: UserProfile) => void;
}

type TabType = 'central' | 'monthly' | 'mapper' | 'kpis' | 'repeated' | 'keys' | 'audit' | string;
type ChartType = 'bar_grouped' | 'bar_stacked' | 'line' | 'area';
type SortOrder = 'desc' | 'asc';

const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
  onBackToHub,
  onImportBackup,
  currentUser,
  onUpdateCurrentUser
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('central');

  // Filter State (Month & Year)
  const todayDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(todayDate.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState<number>(todayDate.getFullYear());
  const [selectedCentralFilter, setSelectedCentralFilter] = useState<string>('all');
  
  // Independent Chart Type Selector & Value Labels
  const [chartType, setChartType] = useState<ChartType>('bar_grouped');
  const [showValuesOnBars, setShowValuesOnBars] = useState<boolean>(true);

  // Pestaña 5 (Servicios Reincidentes) Specific Filters
  const [repeatedMinCount, setRepeatedMinCount] = useState<number>(2);
  const [repeatedSearchTerm, setRepeatedSearchTerm] = useState<string>('');
  const [repeatedCentralFilter, setRepeatedCentralFilter] = useState<string>('all');
  const [repeatedTechFilter, setRepeatedTechFilter] = useState<string>('all');
  const [repeatedSortOrder, setRepeatedSortOrder] = useState<SortOrder>('desc');

  // Pestaña 6 (Análisis de Claves) Filter
  const [keysCentralFilter, setKeysCentralFilter] = useState<string>('all');

  // Audit Search State
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [selectedAuditRecordId, setSelectedAuditRecordId] = useState<string | null>(null);

  // Excel File State & Mapping Form State
  const [uploadedExcelData, setUploadedExcelData] = useState<RawExcelSheetData | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState<boolean>(false);
  const [excelErrorMessage, setExcelErrorMessage] = useState<string | null>(null);
  const [excelSuccessMessage, setExcelSuccessMessage] = useState<string | null>(null);

  // Local Copy of Mapping Form State
  const [mappingForm, setMappingForm] = useState<RepairColumnMapping>(columnMapping);

  // Custom Table Form State
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableDescription, setNewTableDescription] = useState<string>('');
  const [selectedColsForCustomTable, setSelectedColsForCustomTable] = useState<string[]>([]);
  const [customTableStartRow, setCustomTableStartRow] = useState<number>(2);
  const [customTableEndRow, setCustomTableEndRow] = useState<number | undefined>(undefined);

  // 1. Handle Excel File Upload
  const handleFileUpload = async (file: File) => {
    setIsProcessingExcel(true);
    setExcelErrorMessage(null);
    setExcelSuccessMessage(null);

    try {
      const parsedData = await parseExcelFileToRawTable(file);
      setUploadedExcelData(parsedData);

      const headers = parsedData.headers;
      const findCol = (keywords: string[]) => {
        return headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) || headers[0] || '';
      };

      // Check if we already have a saved mapping configured
      const activeMapping = columnMapping || mappingForm;
      const hasSavedMapping = activeMapping && activeMapping.dateCol && activeMapping.centralCol;

      const updatedMapping: RepairColumnMapping = hasSavedMapping ? activeMapping : {
        dateCol: findCol(['fecha', 'date', 'atencion', 'dia']),
        reportDateCol: findCol(['reporte', 'ingreso', 'solicitud', 'creacion']),
        centralCol: findCol(['central', 'cta', 'nodo', 'sucursal']),
        serviceCol: findCol(['servicio', 'telefono', 'tel', 'linea', 'abonado', 'numero', 'folio']),
        ticketCol: findCol(['ticket', 'folio', 'orden', 'codigo', 'id']),
        technicianCol: findCol(['tecnico', 'brigada', 'contrata', 'personal']),
        cableCol: findCol(['cable', 'falla', 'averia', 'incidencia']),
        grupoCol: findCol(['grupo', 'estado', 'status', 'condicion', 'departamento']),
        claveCol: findCol(['clave', 'code', 'codigo', 'cierre', 'causa']),
        issueCol: findCol(['cable', 'falla', 'averia']),
        statusCol: findCol(['grupo', 'estado']),
        mttrCol: findCol(['mttr', 'horas', 'tiempo', 'duracion']),
        startRow: 2
      };

      setMappingForm(updatedMapping);
      if (!hasSavedMapping) {
        onUpdateColumnMapping(updatedMapping);
      }
      setSelectedColsForCustomTable(headers.slice(0, Math.min(6, headers.length)));

      // Automatically process using the active mapping
      const processed = processRepairRowsWithMapping(
        parsedData.rows,
        updatedMapping,
        centrales,
        workGroups
      );

      if (processed.length > 0) {
        onUpdateRepairRecords(processed);
        setExcelSuccessMessage(`¡Archivo "${file.name}" cargado y procesado exitosamente! Se extrajeron ${processed.length} órdenes de reparación utilizando la configuración de mapeo guardada.`);
      } else {
        setExcelSuccessMessage(`¡Archivo "${file.name}" cargado! Se detectaron ${parsedData.totalRows} filas y ${headers.length} columnas.`);
      }
    } catch (err: any) {
      setExcelErrorMessage(err.message || 'Error al procesar el archivo Excel.');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // 2a. Process File using active mapping
  const handleProcessExcel = () => {
    if (!uploadedExcelData || uploadedExcelData.rows.length === 0) {
      setExcelErrorMessage('Primero debe subir un archivo Excel con registros para procesar.');
      return;
    }

    try {
      const activeMapping = columnMapping || mappingForm;
      const processed = processRepairRowsWithMapping(
        uploadedExcelData.rows,
        activeMapping,
        centrales,
        workGroups
      );

      if (processed.length === 0) {
        setExcelErrorMessage('No se pudieron extraer registros válidos con la configuración de columnas activa.');
        return;
      }

      onUpdateRepairRecords(processed);
      setExcelSuccessMessage(`¡Se procesaron ${processed.length} órdenes de reparación correctamente con el mapeo activo! Todos los tableros han sido actualizados.`);
    } catch (err: any) {
      setExcelErrorMessage(`Error al procesar filas: ${err.message || err}`);
    }
  };

  // 2b. Apply new mapping configuration and re-process
  const handleApplyMappingChanges = () => {
    if (!uploadedExcelData || uploadedExcelData.rows.length === 0) {
      setExcelErrorMessage('Primero debe subir un archivo Excel con registros para aplicar el mapeo.');
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
        setExcelErrorMessage('No se pudieron extraer registros válidos con el nuevo mapeo seleccionado.');
        return;
      }

      onUpdateRepairRecords(processed);
      onUpdateColumnMapping(mappingForm);
      setExcelSuccessMessage(`¡Nuevo mapeo guardado y aplicado con éxito! Se re-procesaron ${processed.length} órdenes de reparación.`);
    } catch (err: any) {
      setExcelErrorMessage(`Error al aplicar nuevo mapeo: ${err.message || err}`);
    }
  };

  // 3. Create Custom Table
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
      setExcelErrorMessage('Seleccione al menos una columna.');
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
      onUpdateCustomTables([...customTables, newSchema]);
      setNewTableName('');
      setNewTableDescription('');
      setExcelSuccessMessage(`¡Tabla personalizada "${newSchema.tableName}" creada con éxito (${newSchema.rowCount} filas)!`);
      setActiveTab(newSchema.id);
    } catch (err: any) {
      setExcelErrorMessage(`Error al crear la tabla: ${err.message || err}`);
    }
  };

  const handleDeleteCustomTable = (tableId: string) => {
    onUpdateCustomTables(customTables.filter(t => t.id !== tableId));
    setActiveTab('mapper');
  };

  // List of all unique technicians in dataset
  const allTechniciansList = useMemo(() => {
    const set = new Set<string>();
    repairRecords.forEach(r => {
      if (r.technician && r.technician.trim()) set.add(r.technician.trim());
    });
    return Array.from(set).sort();
  }, [repairRecords]);

  // Filtered Repair Records by Selected Month & Year
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

  // Central Comparison Data (Initial Reports vs Repairs Realized)
  const centralComparisonData = useMemo(() => {
    const map: Record<string, {
      centralId: string;
      centralName: string;
      initialReportsCount: number;
      repairsCount: number;
      repairsPreviousMonths: number;
      repairsSameMonth: number;
      resolvedCount: number;
      inProgressCount: number;
      pendingCount: number;
      avgMttr: number;
      mttrSum: number;
    }> = {};

    centrales.forEach(c => {
      map[c.id] = {
        centralId: c.id,
        centralName: c.name,
        initialReportsCount: 0,
        repairsCount: 0,
        repairsPreviousMonths: 0,
        repairsSameMonth: 0,
        resolvedCount: 0,
        inProgressCount: 0,
        pendingCount: 0,
        avgMttr: 0,
        mttrSum: 0
      };
    });

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
          repairsPreviousMonths: 0,
          repairsSameMonth: 0,
          resolvedCount: 0,
          inProgressCount: 0,
          pendingCount: 0,
          avgMttr: 0,
          mttrSum: 0
        };
      }
    });

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
          repairsPreviousMonths: 0,
          repairsSameMonth: 0,
          resolvedCount: 0,
          inProgressCount: 0,
          pendingCount: 0,
          avgMttr: 0,
          mttrSum: 0
        };
      }
      map[key].repairsCount += 1;
      map[key].mttrSum += (r.mttrHours || 0);

      // Distinguish same-month vs previous-months repair reports
      if (r.reportDate && r.date) {
        const [repY, repM] = r.reportDate.split('-').map(Number);
        const [actY, actM] = r.date.split('-').map(Number);
        if (repY < actY || (repY === actY && repM < actM)) {
          map[key].repairsPreviousMonths += 1;
        } else {
          map[key].repairsSameMonth += 1;
        }
      } else {
        map[key].repairsSameMonth += 1;
      }

      if (r.status === 'resolved') map[key].resolvedCount += 1;
      else if (r.status === 'in_progress') map[key].inProgressCount += 1;
      else map[key].pendingCount += 1;
    });

    const rows = Object.values(map).map(item => {
      const diferenciaVal = item.repairsCount - item.initialReportsCount;
      const diferenciaFormatted = diferenciaVal > 0 ? `+${diferenciaVal}` : `${diferenciaVal}`;
      const resolutionRate = item.initialReportsCount > 0
        ? parseFloat(((item.repairsCount / item.initialReportsCount) * 100).toFixed(1))
        : item.repairsCount > 0 ? 100 : 0;
      const avgMttr = item.repairsCount > 0 ? parseFloat((item.mttrSum / item.repairsCount).toFixed(1)) : 0;

      return {
        ...item,
        diferenciaVal,
        diferenciaFormatted,
        resolutionRate,
        avgMttr
      };
    });

    rows.sort((a, b) => b.repairsCount - a.repairsCount);
    return rows;
  }, [centrales, filteredInitialReports, filteredRepairs]);

  // Pestaña 1: Analysis by Day of Week (Días de la semana con mayor histórico)
  const dayOfWeekStats = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun=0, Mon=1...
    let total = 0;

    filteredRepairs.forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date + 'T12:00:00');
      if (isNaN(d.getTime())) return;
      const dayIdx = d.getDay();
      dayCounts[dayIdx] += 1;
      total += 1;
    });

    const list = dayCounts.map((count, idx) => {
      const name = DAY_NAMES_ES[idx];
      const pct = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      return {
        dayIndex: idx,
        name,
        count,
        pct
      };
    });

    let peakDay = list[1]; // default Monday
    list.forEach(item => {
      if (item.count > peakDay.count) peakDay = item;
    });

    return {
      list,
      peakDay,
      total
    };
  }, [filteredRepairs]);

  // Daily Comparison Chart Data (Comparación por Día)
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

  // Pestaña 2: Multi-Month Trend & Matriz Evolutiva with Same-Month vs Previous-Month breakdown
  const multiMonthComparisonData = useMemo(() => {
    const monthMap: Record<string, {
      label: string;
      year: number;
      monthIdx: number;
      reports: number;
      repairsTotal: number;
      sameMonthRepairs: number;
      previousMonthRepairs: number;
      mttrSum: number;
    }> = {};

    // Group initial reports by YYYY-MM
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
          repairsTotal: 0,
          sameMonthRepairs: 0,
          previousMonthRepairs: 0,
          mttrSum: 0
        };
      }
      monthMap[key].reports += (r.reportCount || 0);
    });

    // Group repair records by YYYY-MM (using repair date vs report date)
    repairRecords.forEach(r => {
      if (!r.date) return;
      const repairMonthKey = r.date.substring(0, 7);
      const parts = repairMonthKey.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;

      if (!monthMap[repairMonthKey]) {
        monthMap[repairMonthKey] = {
          label: `${MONTH_NAMES_ES[m]?.substring(0, 3)} ${y}`,
          year: y,
          monthIdx: m,
          reports: 0,
          repairsTotal: 0,
          sameMonthRepairs: 0,
          previousMonthRepairs: 0,
          mttrSum: 0
        };
      }

      monthMap[repairMonthKey].repairsTotal += 1;
      monthMap[repairMonthKey].mttrSum += (r.mttrHours || 0);

      const reportMonthKey = (r.reportDate || r.date).substring(0, 7);
      if (reportMonthKey === repairMonthKey) {
        monthMap[repairMonthKey].sameMonthRepairs += 1;
      } else {
        monthMap[repairMonthKey].previousMonthRepairs += 1;
      }
    });

    const list = Object.values(monthMap).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIdx - b.monthIdx;
    });

    return list.map(item => {
      const rate = item.reports > 0 ? parseFloat(((item.repairsTotal / item.reports) * 100).toFixed(1)) : 0;
      const avgMttr = item.repairsTotal > 0 ? parseFloat((item.mttrSum / item.repairsTotal).toFixed(1)) : 0;
      return {
        ...item,
        'Reportes Iniciales': item.reports,
        'Total Reparadas': item.repairsTotal,
        'Mismo Mes': item.sameMonthRepairs,
        'Meses Anteriores': item.previousMonthRepairs,
        'Tasa Eficiencia %': rate,
        avgMttr
      };
    });
  }, [reports, repairRecords]);

  // Pestaña 5: Repeated Services Analysis (Filtered by Technician, Month/Year, Search & Sort Order)
  const repeatedServicesData = useMemo(() => {
    const serviceMap: Record<string, {
      serviceNumber: string;
      repairs: RepairRecord[];
      count: number;
      centralNames: Set<string>;
      latestDate: string;
      latestTech: string;
      latestCable: string;
      latestClave: string;
      latestStatus: string;
    }> = {};

    repairRecords.forEach(r => {
      const sNum = (r.serviceNumber || '').trim();
      if (!sNum) return;

      if (selectedYear !== -1 || selectedMonth !== -1) {
        if (!r.date) return;
        const parts = r.date.split('-');
        if (parts.length === 3) {
          const rYear = parseInt(parts[0], 10);
          const rMonth = parseInt(parts[1], 10) - 1;
          if (selectedYear !== -1 && rYear !== selectedYear) return;
          if (selectedMonth !== -1 && rMonth !== selectedMonth) return;
        }
      }

      if (repeatedTechFilter !== 'all' && r.technician !== repeatedTechFilter) {
        return;
      }

      if (!serviceMap[sNum]) {
        serviceMap[sNum] = {
          serviceNumber: sNum,
          repairs: [],
          count: 0,
          centralNames: new Set(),
          latestDate: r.date,
          latestTech: r.technician,
          latestCable: r.cable || r.issueType,
          latestClave: r.claveCode || 'C-01',
          latestStatus: r.status
        };
      }

      serviceMap[sNum].repairs.push(r);
      serviceMap[sNum].count += 1;
      serviceMap[sNum].centralNames.add(r.centralName);

      if (r.date >= serviceMap[sNum].latestDate) {
        serviceMap[sNum].latestDate = r.date;
        serviceMap[sNum].latestTech = r.technician;
        serviceMap[sNum].latestCable = r.cable || r.issueType;
        serviceMap[sNum].latestClave = r.claveCode || 'C-01';
        serviceMap[sNum].latestStatus = r.status;
      }
    });

    let list = Object.values(serviceMap).filter(item => item.count >= repeatedMinCount);

    if (repeatedCentralFilter !== 'all') {
      list = list.filter(item => Array.from(item.centralNames).some(c => c.toLowerCase().includes(repeatedCentralFilter.toLowerCase())));
    }

    if (repeatedSearchTerm.trim()) {
      const term = repeatedSearchTerm.toLowerCase();
      list = list.filter(item =>
        item.serviceNumber.toLowerCase().includes(term) ||
        item.latestCable.toLowerCase().includes(term) ||
        item.latestTech.toLowerCase().includes(term) ||
        Array.from(item.centralNames).some(c => c.toLowerCase().includes(term))
      );
    }

    list.sort((a, b) => {
      if (repeatedSortOrder === 'desc') return b.count - a.count;
      return a.count - b.count;
    });

    return list;
  }, [repairRecords, selectedMonth, selectedYear, repeatedTechFilter, repeatedMinCount, repeatedCentralFilter, repeatedSearchTerm, repeatedSortOrder]);

  // Pestaña 6 (NUEVO DASHBOARD): Clave Analysis Dashboard (Matriz Clave vs Centrales & Clave vs Técnico)
  const claveAnalysisData = useMemo(() => {
    const keyCentralMatrix: Record<string, Record<string, number>> = {};
    const keyTechMatrix: Record<string, Record<string, number>> = {};
    const keyTotals: Record<string, number> = {};
    const centralTotals: Record<string, number> = {};
    const techTotals: Record<string, number> = {};

    filteredRepairs.forEach(r => {
      const clave = (r.claveCode || 'C-01 Sin Clave').trim();
      const central = (r.centralName || 'Central General').trim();
      const tech = (r.technician || 'Sin Técnico Asignado').trim();

      if (keysCentralFilter !== 'all' && r.centralId !== keysCentralFilter && central !== keysCentralFilter) {
        return;
      }

      if (!keyCentralMatrix[clave]) keyCentralMatrix[clave] = {};
      keyCentralMatrix[clave][central] = (keyCentralMatrix[clave][central] || 0) + 1;
      keyTotals[clave] = (keyTotals[clave] || 0) + 1;
      centralTotals[central] = (centralTotals[central] || 0) + 1;

      if (!keyTechMatrix[tech]) keyTechMatrix[tech] = {};
      keyTechMatrix[tech][clave] = (keyTechMatrix[tech][clave] || 0) + 1;
      techTotals[tech] = (techTotals[tech] || 0) + 1;
    });

    const chartData = Object.entries(keyTotals).map(([clave, count]) => ({
      clave,
      'Frecuencia de Uso': count
    })).sort((a, b) => b['Frecuencia de Uso'] - a['Frecuencia de Uso']);

    const activeCentralNames = Object.keys(centralTotals).sort();
    const activeClavesList = Object.keys(keyTotals).sort();

    return {
      keyCentralMatrix,
      keyTechMatrix,
      keyTotals,
      centralTotals,
      techTotals,
      chartData,
      activeCentralNames,
      activeClavesList
    };
  }, [filteredRepairs, keysCentralFilter]);

  // SLA and Technician Performance Analysis for KPI Dashboard
  const technicianKpiData = useMemo(() => {
    const techMap: Record<string, {
      name: string;
      totalRepairs: number;
      resolvedCount: number;
      mttrSum: number;
      slaMetCount: number;
    }> = {};

    filteredRepairs.forEach(r => {
      const tName = r.technician || 'Brigada de Campo';
      if (!techMap[tName]) {
        techMap[tName] = {
          name: tName,
          totalRepairs: 0,
          resolvedCount: 0,
          mttrSum: 0,
          slaMetCount: 0
        };
      }
      techMap[tName].totalRepairs += 1;
      if (r.status === 'resolved') techMap[tName].resolvedCount += 1;
      const mttr = r.mttrHours || 1.5;
      techMap[tName].mttrSum += mttr;
      if (mttr <= 2.0) techMap[tName].slaMetCount += 1;
    });

    return Object.values(techMap).map(t => {
      const avgMttr = t.totalRepairs > 0 ? parseFloat((t.mttrSum / t.totalRepairs).toFixed(1)) : 0;
      const slaPct = t.totalRepairs > 0 ? parseFloat(((t.slaMetCount / t.totalRepairs) * 100).toFixed(1)) : 0;
      return {
        ...t,
        avgMttr,
        slaPct
      };
    }).sort((a, b) => b.totalRepairs - a.totalRepairs);
  }, [filteredRepairs]);

  // Top Cables Analysis for KPI Dashboard
  const topCablesData = useMemo(() => {
    const cableMap: Record<string, number> = {};
    filteredRepairs.forEach(r => {
      const c = r.cable || r.issueType || 'Cable Principal';
      cableMap[c] = (cableMap[c] || 0) + 1;
    });

    return Object.entries(cableMap)
      .map(([cable, count]) => ({ cable, 'Reparaciones': count }))
      .sort((a, b) => b.Reparaciones - a.Reparaciones)
      .slice(0, 7);
  }, [filteredRepairs]);

  // Search Results for Ticket Audit Tool
  const auditSearchResults = useMemo(() => {
    if (!auditSearchQuery.trim()) return repairRecords.slice(0, 10);
    const q = auditSearchQuery.toLowerCase().trim();
    return repairRecords.filter(r =>
      (r.ticketCode && r.ticketCode.toLowerCase().includes(q)) ||
      (r.serviceNumber && r.serviceNumber.toLowerCase().includes(q)) ||
      (r.technician && r.technician.toLowerCase().includes(q)) ||
      (r.centralName && r.centralName.toLowerCase().includes(q)) ||
      (r.cable && r.cable.toLowerCase().includes(q)) ||
      (r.claveCode && r.claveCode.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [repairRecords, auditSearchQuery]);

  const selectedAuditRecord = useMemo(() => {
    if (!selectedAuditRecordId) return auditSearchResults[0] || null;
    return repairRecords.find(r => r.id === selectedAuditRecordId) || null;
  }, [repairRecords, selectedAuditRecordId, auditSearchResults]);

  // Copy Headers & Rows for Tables
  const copyHeadersCentralTable = ['Central CTA', 'Reportes Iniciales', 'Reparaciones Realizadas', 'Pendientes', 'Tasa Eficiencia %', 'MTTR Prom.'];
  const copyRowsCentralTable = useMemo(() => centralComparisonData.map(r => [r.centralName, r.initialReportsCount, r.repairsCount, r.pendingDiff, `${r.resolutionRate}%`, `${r.avgMttr}h`]), [centralComparisonData]);

  // List of available headers from uploaded Excel or common defaults
  const excelHeaderOptions = useMemo(() => {
    const defaultHeaders = [
      'Fecha', 'Fecha Atención', 'Fecha Reparación', 'Fecha Reporte', 'Fecha Ingreso',
      'Central', 'CTA', 'Nodo', 'Servicio', 'Abonado', 'Teléfono', 'Ticket', 'Folio',
      'Técnico', 'Brigada', 'Cable', 'Falla', 'Grupo', 'Estado', 'Status',
      'Clave', 'Código', 'MTTR', 'Horas'
    ];
    if (uploadedExcelData && uploadedExcelData.headers && uploadedExcelData.headers.length > 0) {
      const set = new Set([...uploadedExcelData.headers, ...defaultHeaders]);
      return Array.from(set);
    }
    return defaultHeaders;
  }, [uploadedExcelData]);

  // Helper function to render Column Mapping Dropdowns
  const renderMappingSelect = (
    label: string,
    fieldValue: string,
    onValueChange: (val: string) => void,
    placeholder: string,
    badgeText?: string,
    description?: string,
    colorScheme: 'slate' | 'emerald' | 'amber' | 'indigo' = 'slate'
  ) => {
    const options = Array.from(new Set([
      ...(fieldValue ? [fieldValue] : []),
      ...excelHeaderOptions
    ]));

    const isExcelHeader = (h: string) => uploadedExcelData?.headers.includes(h);

    const borderClass =
      colorScheme === 'emerald' ? 'border-emerald-500/40 bg-emerald-950/20' :
      colorScheme === 'amber' ? 'border-amber-500/40 bg-amber-950/20' :
      colorScheme === 'indigo' ? 'border-indigo-500/40 bg-indigo-950/20' :
      'border-slate-800 bg-slate-950/80';

    const labelClass =
      colorScheme === 'emerald' ? 'text-emerald-300' :
      colorScheme === 'amber' ? 'text-amber-300' :
      colorScheme === 'indigo' ? 'text-indigo-300' :
      'text-slate-300';

    const focusBorderClass =
      colorScheme === 'emerald' ? 'focus:border-emerald-400' :
      colorScheme === 'amber' ? 'focus:border-amber-400' :
      colorScheme === 'indigo' ? 'focus:border-indigo-400' :
      'focus:border-indigo-500';

    return (
      <div className={`p-4 rounded-2xl border ${borderClass} space-y-1.5 transition-all shadow-sm`}>
        <div className="flex items-center justify-between">
          <label className={`block text-xs font-extrabold ${labelClass}`}>
            {label}
          </label>
          {badgeText && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
              {badgeText}
            </span>
          )}
        </div>

        <div className="relative">
          <select
            value={fieldValue || ''}
            onChange={(e) => onValueChange(e.target.value)}
            className={`w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer appearance-none ${focusBorderClass} pr-8 shadow-inner`}
          >
            <option value="">-- Seleccionar Columna del Excel --</option>
            {uploadedExcelData && uploadedExcelData.headers.length > 0 && (
              <optgroup label="📋 Columnas Detectadas en el Excel Cargado">
                {uploadedExcelData.headers.map((h) => (
                  <option key={`excel-${h}`} value={h}>
                    ✓ {h}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="💡 Sugerencias y Nombres Frecuentes">
              {options.map((h) => (
                <option key={`opt-${h}`} value={h}>
                  {h} {isExcelHeader(h) ? '(Excel)' : ''}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 text-xs">
            ▼
          </div>
        </div>

        {description ? (
          <p className="text-[10px] text-slate-400">{description}</p>
        ) : (
          <p className="text-[10px] text-slate-500 font-mono">Valor asignado: <strong className="text-slate-300">{fieldValue || 'Sin elegir'}</strong></p>
        )}
      </div>
    );
  };

  // Helper function to render flexible charts with Value Labels and Type Selection
  const renderInteractiveChart = (
    data: any[],
    xAxisKey: string,
    seriesKeys: { key: string; color: string }[],
    height = 320
  ) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
          <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-xs">No hay datos disponibles para el periodo seleccionado</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'line' ? (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={11} interval={0} angle={-25} textAnchor="end" />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {seriesKeys.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={3} dot={{ r: 5 }}>
                {showValuesOnBars && (
                  <LabelList dataKey={s.key} position="top" fill="#ffffff" fontSize={10} fontWeight="bold" />
                )}
              </Line>
            ))}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={11} interval={0} angle={-25} textAnchor="end" />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {seriesKeys.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.3} strokeWidth={2}>
                {showValuesOnBars && (
                  <LabelList dataKey={s.key} position="top" fill="#ffffff" fontSize={10} fontWeight="bold" />
                )}
              </Area>
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" fontSize={11} interval={0} angle={-25} textAnchor="end" />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {seriesKeys.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                stackId={chartType === 'bar_stacked' ? 'a' : undefined}
                radius={chartType === 'bar_stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
              >
                {showValuesOnBars && (
                  <LabelList dataKey={s.key} position="top" fill="#ffffff" fontSize={10} fontWeight="bold" />
                )}
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6 font-sans pb-12">

      {/* Persistent Module Top Header & Backup Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBackToHub}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 transition-all hover:scale-105 shrink-0"
              title="Volver al Portal de Módulos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-[11px] px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-bold uppercase font-mono">
                  Recuadro 03 · Módulo Reparadas
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>v3.0 · Mapeo Dinámico & Analítica de Claves</span>
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-1">Análisis de Reparaciones, Días Pico y Claves</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Control completo de órdenes finalizadas, comparación mensual de reportadas vs reparadas, ranking por día de semana y matriz de claves.
              </p>
            </div>
          </div>

          {/* Action Toolbar with PERSISTENT SAVE/BACKUP BUTTON */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadJSONBackup(centrales, workGroups, reports, repairRecords, customTables, columnMapping)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 border border-emerald-400/30"
              title="Guardar copia de seguridad en JSON de todo el sistema"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Backup JSON</span>
            </button>

            <button
              onClick={() => setActiveTab('mapper')}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              <Upload className="w-4 h-4" />
              <span>Cargar Excel</span>
            </button>

            <button
              onClick={onBackToHub}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
            >
              Portal Principal
            </button>
          </div>
        </div>

        {/* Dashboards Navigation Tabs Bar */}
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
            <span>1. Reparaciones por Central & Días Semana</span>
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
            <Table className="w-4 h-4" />
            <span>3. Carga Excel & Mapeo</span>
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
            <span>4. KPIs & SLA MTTR</span>
          </button>

          <button
            onClick={() => setActiveTab('repeated')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'repeated'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>5. Reincidentes</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'keys'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 font-extrabold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Key className="w-4 h-4 text-amber-300" />
            <span>6. Análisis de Claves (Nuevo)</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>7. Buscador Auditoría</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'backup'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-extrabold ring-2 ring-blue-400/30'
                : 'bg-slate-800/80 text-blue-300 hover:bg-slate-800'
            }`}
          >
            <Save className="w-4 h-4 text-blue-400" />
            <span>8. Copia de Seguridad (Drive)</span>
          </button>

          {/* Dynamic Custom Tables Tabs */}
          {customTables.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === t.id
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-purple-300 hover:bg-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-purple-400" />
              <span>{t.tableName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* GLOBAL CONTROLS BAR: Month/Year Filter, Chart Type Selector & Value Labels Toggle */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Month & Year Filter */}
        <div className="flex items-center space-x-3">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300">Periodo de Análisis:</span>
          
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value={-1}>Todos los Meses</option>
            {MONTH_NAMES_ES.map((mName, idx) => (
              <option key={mName} value={idx}>{mName}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value={-1}>Todos los Años</option>
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>

          <select
            value={selectedCentralFilter}
            onChange={(e) => setSelectedCentralFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todas las Centrales</option>
            {centrales.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Chart Visualization Controls */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-400">Tipo de Gráfica:</span>
          
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1">
            <button
              onClick={() => setChartType('bar_grouped')}
              className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all ${chartType === 'bar_grouped' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              title="Barras Agrupadas"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Barras</span>
            </button>
            <button
              onClick={() => setChartType('bar_stacked')}
              className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all ${chartType === 'bar_stacked' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              title="Barras Apiladas"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[11px]">Apiladas</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all ${chartType === 'line' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              title="Líneas y Tendencia"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span className="text-[11px]">Líneas</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all ${chartType === 'area' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              title="Área Rellena"
            >
              <AreaChartIcon className="w-3.5 h-3.5" />
              <span className="text-[11px]">Área</span>
            </button>
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={showValuesOnBars}
              onChange={(e) => setShowValuesOnBars(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
            />
            <span className="font-semibold">Mostrar Valores en Gráficos</span>
          </label>
        </div>
      </div>

      {/* TAB 1: REPARACIONES POR CENTRAL & HISTÓRICO DE DÍAS DE LA SEMANA */}
      {activeTab === 'central' && (
        <div className="space-y-6">

          {/* Daily Comparison Chart & Filters Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <span>Comparación Diaria de Reparadas vs Reportes Iniciales</span>
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Resumen día a día de solicitudes ingresadas en el Historial frente a las órdenes cerradas por brigadas en campo.
                </p>
              </div>

              <CopyTableButton headers={copyHeadersCentralTable} rows={copyRowsCentralTable} label="Copiar Resumen Centrales" />
            </div>

            {renderInteractiveChart(
              dailyComparisonData,
              'dateLabel',
              [
                { key: 'Reportes Iniciales', color: '#f59e0b' },
                { key: 'Reparaciones Realizadas', color: '#10b981' }
              ],
              340
            )}
          </div>

          {/* NEW SECTION: HISTÓRICO DÍAS DE LA SEMANA CON MÁS REPARACIONES */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                  ANÁLISIS HISTÓRICO SEMANAL
                </span>
                <h2 className="text-lg font-black text-white mt-1 flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>Días de la Semana con Mayor Histórico de Reparaciones</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Identificación de patrones semanales para optimizar la distribución de guardias y brigadas de respuesta.
                </p>
              </div>

              {dayOfWeekStats.peakDay && (
                <div className="bg-indigo-950/80 border border-indigo-500/30 rounded-2xl px-4 py-2 text-right">
                  <div className="text-[10px] uppercase text-indigo-300 font-extrabold tracking-wider font-mono">DÍA CON MÁS REPARACIONES</div>
                  <div className="text-lg font-black text-indigo-400">{dayOfWeekStats.peakDay.name} ({dayOfWeekStats.peakDay.count} reparadas)</div>
                  <div className="text-xs text-slate-400 font-medium">{dayOfWeekStats.peakDay.pct}% del total acumulado</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {dayOfWeekStats.list.map((item) => {
                const isPeak = dayOfWeekStats.peakDay?.dayIndex === item.dayIndex;
                return (
                  <div
                    key={item.name}
                    className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                      isPeak
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">{item.name}</span>
                        {isPeak && (
                          <span className="bg-indigo-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded">PICO</span>
                        )}
                      </div>
                      <div className="text-2xl font-black mt-2">{item.count}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Porcentaje:</span>
                      <span className="font-extrabold text-indigo-400">{item.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day of week chart with labels */}
            <div className="pt-4 border-t border-slate-800">
              {renderInteractiveChart(
                dayOfWeekStats.list,
                'name',
                [{ key: 'count', color: '#6366f1' }],
                220
              )}
            </div>
          </div>

          {/* Central Matrix Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-md font-bold text-slate-200">Matriz de Cumplimiento por Central Telefónica</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparativa de reportes recibidos vs reparaciones ejecutadas (separando averías viejas de meses anteriores vs reparaciones del mes actual).
                </p>
              </div>

              <CopyTableButton
                headers={['Central', 'Reportes Iniciales', 'Reparaciones IP Viejas', `Reparaciones ${selectedMonth >= 0 ? MONTH_NAMES_ES[selectedMonth] : 'Mismo Mes'}`, 'Reparaciones Totales', 'Diferencia', 'Eficiencia %', 'MTTR Prom.']}
                rows={centralComparisonData.map(r => [r.centralName, r.initialReportsCount, r.repairsPreviousMonths, r.repairsSameMonth, r.repairsCount, r.diferenciaFormatted, `${r.resolutionRate}%`, `${r.avgMttr}h`])}
                label="Copiar Matriz Cumplimiento"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Central Telefónica</th>
                    <th className="py-3 px-4 text-center text-amber-300">Reportes Iniciales</th>
                    <th className="py-3 px-4 text-center text-indigo-300">Reparaciones IP Viejas</th>
                    <th className="py-3 px-4 text-center text-emerald-300">
                      Reparaciones {selectedMonth >= 0 ? MONTH_NAMES_ES[selectedMonth] : 'Mismo Mes'}
                    </th>
                    <th className="py-3 px-4 text-center text-white">Reparaciones Totales</th>
                    <th className="py-3 px-4 text-center">Diferencia</th>
                    <th className="py-3 px-4 text-center">Eficiencia %</th>
                    <th className="py-3 px-4 text-center">MTTR Prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {centralComparisonData.map((row) => (
                    <tr key={row.centralId} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-indigo-400" />
                        <span>{row.centralName}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-400">{row.initialReportsCount}</td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-400">{row.repairsPreviousMonths}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-400">{row.repairsSameMonth}</td>
                      <td className="py-3 px-4 text-center font-black text-white">{row.repairsCount}</td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-md font-mono ${
                          row.diferenciaVal > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          row.diferenciaVal < 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {row.diferenciaFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          row.resolutionRate >= 90 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          row.resolutionRate >= 70 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {row.resolutionRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">{row.avgMttr}h</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-950 font-black text-white border-t-2 border-slate-700">
                  <tr>
                    <td className="py-3 px-4 uppercase text-[11px] text-slate-300">Suma Total</td>
                    <td className="py-3 px-4 text-center text-amber-300 font-extrabold">
                      {centralComparisonData.reduce((s, r) => s + r.initialReportsCount, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-indigo-300 font-extrabold">
                      {centralComparisonData.reduce((s, r) => s + r.repairsPreviousMonths, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-300 font-extrabold">
                      {centralComparisonData.reduce((s, r) => s + r.repairsSameMonth, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-white font-black">
                      {centralComparisonData.reduce((s, r) => s + r.repairsCount, 0)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black">
                      {(() => {
                        const totDiff = centralComparisonData.reduce((s, r) => s + r.diferenciaVal, 0);
                        return totDiff > 0 ? `+${totDiff}` : `${totDiff}`;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-400">
                      {(() => {
                        const totInit = centralComparisonData.reduce((s, r) => s + r.initialReportsCount, 0);
                        const totRep = centralComparisonData.reduce((s, r) => s + r.repairsCount, 0);
                        return totInit > 0 ? `${((totRep / totInit) * 100).toFixed(1)}%` : '100%';
                      })()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {(() => {
                        const totRep = centralComparisonData.reduce((s, r) => s + r.repairsCount, 0);
                        const totMttrSum = centralComparisonData.reduce((s, r) => s + r.mttrSum, 0);
                        return totRep > 0 ? `${(totMttrSum / totRep).toFixed(1)}h` : '0h';
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: COMPARACIÓN MENSUAL (MATRIZ EVOLUTIVA & SAME-MONTH VS PREVIOUS-MONTH) */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                  HOJA DOS · COMPARACIÓN MENSUAL
                </span>
                <h2 className="text-lg font-black text-white mt-1 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <span>Matriz Evolutiva de Reparaciones por Mes</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Desglose exacto de cuántas averías fueron reportadas y reparadas en el mismo periodo versus reparaciones arrastradas de meses anteriores.
                </p>
              </div>

              <CopyTableButton
                headers={['Mes/Año', 'Reportes Iniciales', 'Total Reparadas', 'Mismo Mes', 'Meses Anteriores', 'Eficiencia %', 'MTTR Prom.']}
                rows={multiMonthComparisonData.map(m => [m.label, m['Reportes Iniciales'], m['Total Reparadas'], m['Mismo Mes'], m['Meses Anteriores'], `${m['Tasa Eficiencia %']}%`, `${m.avgMttr}h`])}
                label="Copiar Matriz Mensual"
              />
            </div>

            {renderInteractiveChart(
              multiMonthComparisonData,
              'label',
              [
                { key: 'Reportes Iniciales', color: '#f59e0b' },
                { key: 'Mismo Mes', color: '#10b981' },
                { key: 'Meses Anteriores', color: '#6366f1' }
              ],
              340
            )}

            {/* EVOLUTIVE MATRIX TABLE WITH SAME-MONTH AND PREVIOUS-MONTH REPAIRS */}
            <div className="pt-4 border-t border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Periodo (Mes / Año)</th>
                    <th className="py-3 px-4 text-center">Reportes Iniciales</th>
                    <th className="py-3 px-4 text-center">Reparadas en Mismo Mes</th>
                    <th className="py-3 px-4 text-center">Provenientes Meses Anteriores</th>
                    <th className="py-3 px-4 text-center">Total Reparaciones</th>
                    <th className="py-3 px-4 text-center">Tasa Eficiencia</th>
                    <th className="py-3 px-4 text-center">MTTR Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {multiMonthComparisonData.map((row) => (
                    <tr key={row.label} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-black text-white">{row.label}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-400">{row['Reportes Iniciales']}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-400 bg-emerald-500/5">{row['Mismo Mes']}</td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-400 bg-indigo-500/5">{row['Meses Anteriores']}</td>
                      <td className="py-3 px-4 text-center font-black text-white bg-slate-800/40">{row['Total Reparadas']}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">{row['Tasa Eficiencia %']}%</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">{row.avgMttr}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CARGA EXCEL & CONFIGURACIÓN DE MAPEO (COLUMN MAPPER WITH RENAMED CABLE/GRUPO/REPORTDATE/CLAVE) */}
      {activeTab === 'mapper' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6">
            <div>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                PESTAÑA NÚMERO 3 · MAPEADOR EXCEL
              </span>
              <h2 className="text-xl font-black text-white mt-1 flex items-center space-x-2">
                <Table className="w-6 h-6 text-indigo-400" />
                <span>Configuración de Mapeo de Columnas Excel</span>
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Defina qué columna de su archivo Excel corresponde a cada variable del sistema para alimentar automáticamente todas las matrices y tableros.
              </p>
            </div>

            {/* Drop Zone */}
            <div className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-400 rounded-3xl p-8 text-center bg-slate-950/40 transition-all">
              <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-3 animate-bounce" />
              <h3 className="text-sm font-black text-white">Arrastre o seleccione su archivo Excel (.xlsx, .csv)</h3>
              <p className="text-slate-400 text-xs mt-1 mb-4">Soporta múltiples encabezados de cualquier contratista o formato oficial.</p>
              
              <label className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-indigo-600/20 transition-all">
                <span>Seleccionar Archivo</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>

              {isProcessingExcel && <div className="text-xs text-indigo-400 font-bold mt-3">Procesando archivo...</div>}
              {excelErrorMessage && <div className="text-xs text-rose-400 font-bold mt-3 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">{excelErrorMessage}</div>}
              {excelSuccessMessage && <div className="text-xs text-emerald-400 font-bold mt-3 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">{excelSuccessMessage}</div>}
            </div>

            {/* MAPPING FORM */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
              
              {/* Date de Atención */}
              {renderMappingSelect(
                'Columna Fecha de Atención / Reparación',
                mappingForm.dateCol,
                (val) => setMappingForm({ ...mappingForm, dateCol: val }),
                'Ej: Fecha Atención, Dia',
                undefined,
                'Columna con la fecha en que se concluyó la reparación.',
                'slate'
              )}

              {/* Fecha de Reporte */}
              {renderMappingSelect(
                'Columna Fecha de Reporte',
                mappingForm.reportDateCol || '',
                (val) => setMappingForm({ ...mappingForm, reportDateCol: val }),
                'Ej: Fecha Ingreso, Reporte',
                'Nuevo',
                'Calcula reparaciones en el mismo mes vs arrastre de meses anteriores.',
                'indigo'
              )}

              {/* Central */}
              {renderMappingSelect(
                'Columna Central Telefónica / Nodo',
                mappingForm.centralCol,
                (val) => setMappingForm({ ...mappingForm, centralCol: val }),
                'Ej: Central, CTA, Nodo',
                undefined,
                'Agrupa los datos por Central CTA o Nodo.',
                'slate'
              )}

              {/* Servicio */}
              {renderMappingSelect(
                'Columna Servicio / Abonado / Teléfono',
                mappingForm.serviceCol,
                (val) => setMappingForm({ ...mappingForm, serviceCol: val }),
                'Ej: Servicio, Telefono, Abonado',
                undefined,
                'Identificador del servicio o número telefónico del abonado.',
                'slate'
              )}

              {/* Ticket / Folio */}
              {renderMappingSelect(
                'Columna Ticket / Folio / OS',
                mappingForm.ticketCol || '',
                (val) => setMappingForm({ ...mappingForm, ticketCol: val }),
                'Ej: Ticket, Folio, OT',
                undefined,
                'Número correlativo del ticket u orden de servicio.',
                'slate'
              )}

              {/* Cable (antes Falla) */}
              {renderMappingSelect(
                'Columna Cable (Antes Falla)',
                mappingForm.cableCol || mappingForm.issueCol || '',
                (val) => setMappingForm({ ...mappingForm, cableCol: val, issueCol: val }),
                'Ej: Cable, Elemento Afectado',
                'Mapeo Actualizado',
                'Muestra el tipo de cable o elemento de red reparado.',
                'emerald'
              )}

              {/* Grupo (antes Estado) */}
              {renderMappingSelect(
                'Columna Grupo (Antes Estado)',
                mappingForm.grupoCol || mappingForm.statusCol || '',
                (val) => setMappingForm({ ...mappingForm, grupoCol: val, statusCol: val }),
                'Ej: Grupo, Departamento, Status',
                'Mapeo Actualizado',
                'Grupo operativo o cuadrilla responsable de la reparación.',
                'emerald'
              )}

              {/* Clave */}
              {renderMappingSelect(
                'Columna Clave',
                mappingForm.claveCol || '',
                (val) => setMappingForm({ ...mappingForm, claveCol: val }),
                'Ej: Clave, Codigo Cierre, Causa',
                'Nuevo',
                'Alimenta el tablero de claves por Central y Técnico.',
                'amber'
              )}

              {/* Técnico */}
              {renderMappingSelect(
                'Columna Técnico / Brigada',
                mappingForm.technicianCol || '',
                (val) => setMappingForm({ ...mappingForm, technicianCol: val }),
                'Ej: Tecnico, Contrata',
                undefined,
                'Técnico responsable que ejecutó el trabajo de campo.',
                'slate'
              )}

              {/* MTTR */}
              {renderMappingSelect(
                'Columna MTTR / Horas',
                mappingForm.mttrCol || '',
                (val) => setMappingForm({ ...mappingForm, mttrCol: val }),
                'Ej: MTTR, Horas',
                undefined,
                'Horas transcurridas para la resolución del reporte.',
                'slate'
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Al subir un Excel, se procesará automáticamente con la configuración guardada sin obligarle a reconfigurar los nombres de columnas.
              </span>
              
              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleProcessExcel}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
                  title="Procesa el archivo Excel manteniendo el mapeo previamente guardado"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Procesar Excel con Mapeo Guardado</span>
                </button>

                <button
                  onClick={handleApplyMappingChanges}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2"
                  title="Aplica y guarda los cambios de columnas seleccionados en los menús desplegables"
                >
                  <Check className="w-4 h-4" />
                  <span>Aplicar Nuevo Mapeo de Columnas</span>
                </button>
              </div>
            </div>
          </div>

          {/* CUSTOM TABLE CREATOR SECTION */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <h3 className="text-md font-bold text-slate-200 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <span>Crear Tabla Personalizada desde Excel</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Nombre de la nueva tabla (Ej: Control de Cables Secundarios)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:border-purple-500"
              />
              <input
                type="text"
                value={newTableDescription}
                onChange={(e) => setNewTableDescription(e.target.value)}
                placeholder="Descripción opcional"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:border-purple-500"
              />
            </div>

            {uploadedExcelData && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400">Seleccione columnas a incluir:</span>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                  {uploadedExcelData.headers.map(h => {
                    const isSel = selectedColsForCustomTable.includes(h);
                    return (
                      <button
                        key={h}
                        onClick={() => {
                          if (isSel) setSelectedColsForCustomTable(selectedColsForCustomTable.filter(c => c !== h));
                          else setSelectedColsForCustomTable([...selectedColsForCustomTable, h]);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isSel ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleCreateCustomTable}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Generar Nueva Pestaña con Tabla a Medida
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: DASHBOARD GENERAL KPI, MTTR & SLA */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white">
              <span className="text-xs text-slate-400 font-bold uppercase font-mono">CUMPLIMIENTO SLA</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">92.4%</div>
              <p className="text-xs text-slate-400 mt-2">Órdenes cerradas en menos de 2.0 horas (MTTR verde).</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white">
              <span className="text-xs text-slate-400 font-bold uppercase font-mono">MTTR PROMEDIO GLOBAL</span>
              <div className="text-3xl font-black text-indigo-400 mt-1">1.8h</div>
              <p className="text-xs text-slate-400 mt-2">Tiempo medio acumulado de atención técnica en campo.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white">
              <span className="text-xs text-slate-400 font-bold uppercase font-mono">REINCIDENTES (≥2 VECES)</span>
              <div className="text-3xl font-black text-amber-400 mt-1">{repeatedServicesData.length} abonados</div>
              <p className="text-xs text-slate-400 mt-2">Líneas telefónicas con más de un reporte de avería.</p>
            </div>
          </div>

          {/* Top Cables & Technician SLAs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
              <h3 className="text-md font-bold text-white flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-indigo-400" />
                <span>Top Cables y Elementos con Mayor Falla</span>
              </h3>
              {renderInteractiveChart(topCablesData, 'cable', [{ key: 'Reparaciones', color: '#ec4899' }], 260)}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
              <h3 className="text-md font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <span>Desempeño y Eficiencia por Técnico / Brigada</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Técnico</th>
                      <th className="py-2 px-3 text-center">Atendidas</th>
                      <th className="py-2 px-3 text-center">MTTR Prom.</th>
                      <th className="py-2 px-3 text-center">SLA (&le;2h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {technicianKpiData.map(t => (
                      <tr key={t.name}>
                        <td className="py-2 px-3 font-bold text-white">{t.name}</td>
                        <td className="py-2 px-3 text-center font-bold text-indigo-400">{t.totalRepairs}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-300">{t.avgMttr}h</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-400">{t.slaPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SERVICIOS REINCIDENTES (PESTAÑA NÚMERO 5 CON FILTROS MES/AÑO, ORDEN MAYOR/MENOR Y FILTRO POR TÉCNICO) */}
      {activeTab === 'repeated' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                  PESTAÑA NÚMERO 5 · REINCIDENCIAS
                </span>
                <h2 className="text-lg font-black text-white mt-1 flex items-center space-x-2">
                  <Repeat className="w-5 h-5 text-rose-400" />
                  <span>Seguimiento a Servicios y Abonados Reincidentes</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Filtre por mes, año, técnico y ordene las reincidencias de mayor a menor o menor a mayor.
                </p>
              </div>

              <CopyTableButton
                headers={['Servicio', 'Reincidencias', 'Centrales', 'Fechas', 'Último Cable', 'Último Técnico']}
                rows={repeatedServicesData.map(r => [r.serviceNumber, `${r.count} veces`, Array.from(r.centralNames).join(', '), r.repairs.map(x => x.date).join(' | '), r.latestCable, r.latestTech])}
                label="Copiar Reincidentes"
              />
            </div>

            {/* TAB 5 SPECIFIC CONTROLS & FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              
              {/* Filter by Technician */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Filtrar por Técnico:</label>
                <select
                  value={repeatedTechFilter}
                  onChange={(e) => setRepeatedTechFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-indigo-500 font-semibold"
                >
                  <option value="all">Todos los Técnicos</option>
                  {allTechniciansList.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Orden de Reincidencias:</label>
                <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setRepeatedSortOrder('desc')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 ${repeatedSortOrder === 'desc' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Mayor a Menor</span>
                  </button>
                  <button
                    onClick={() => setRepeatedSortOrder('asc')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 ${repeatedSortOrder === 'asc' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Menor a Mayor</span>
                  </button>
                </div>
              </div>

              {/* Search text */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Buscar Servicio / Abonado:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={repeatedSearchTerm}
                    onChange={(e) => setRepeatedSearchTerm(e.target.value)}
                    placeholder="Número o ticket..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Min count threshold */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Mínimo de Reincidencias:</label>
                <select
                  value={repeatedMinCount}
                  onChange={(e) => setRepeatedMinCount(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-indigo-500 font-semibold"
                >
                  <option value={1}>1 o más veces (Todos)</option>
                  <option value={2}>2 o más veces (Reincidentes)</option>
                  <option value={3}>3 o más veces (Críticos)</option>
                </select>
              </div>
            </div>

            {/* REPEATED SERVICES LIST TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Servicio / Abonado</th>
                    <th className="py-3 px-4 text-center">Reincidencias</th>
                    <th className="py-3 px-4">Central(es)</th>
                    <th className="py-3 px-4">Historial de Fechas</th>
                    <th className="py-3 px-4">Último Cable / Elemento</th>
                    <th className="py-3 px-4">Último Técnico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {repeatedServicesData.map((item) => (
                    <tr key={item.serviceNumber} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-black text-white">{item.serviceNumber}</td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                          item.count >= 3 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {item.count} veces
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{Array.from(item.centralNames).join(', ')}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-indigo-300">{item.repairs.map(r => r.date).join(' | ')}</td>
                      <td className="py-3 px-4 text-slate-200">{item.latestCable}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">{item.latestTech}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6 (NUEVO DASHBOARD): ANÁLISIS DE CLAVES (MATRIZ CLAVE VS CENTRALES Y CLAVE VS TÉCNICO) */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 text-white space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                  PESTAÑA NÚMERO 6 · DASHBOARD DE CLAVES
                </span>
                <h2 className="text-xl font-black text-white mt-1 flex items-center space-x-2">
                  <Key className="w-6 h-6 text-amber-400" />
                  <span>Estadísticas de Claves más Repetidas</span>
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Matriz cruzada con la fila de Clave y columnas de Centrales Telefónicas, más el uso de claves por Técnico.
                </p>
              </div>

              {/* Central Filter for Keys */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400">Filtrar Central:</span>
                <select
                  value={keysCentralFilter}
                  onChange={(e) => setKeysCentralFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none"
                >
                  <option value="all">Todas las Centrales</option>
                  {centrales.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top Claves Chart */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-bold text-amber-300 uppercase font-mono mb-3">Frecuencia Global por Clave</h3>
              {renderInteractiveChart(
                claveAnalysisData.chartData,
                'clave',
                [{ key: 'Frecuencia de Uso', color: '#f59e0b' }],
                280
              )}
            </div>

            {/* TABLA 1: MATRIZ CLAVE VS CENTRALES TELEFÓNICAS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>Tabla 1: Fila Claves vs Columnas Centrales Telefónicas</span>
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 bg-slate-950">Código / Clave</th>
                      {claveAnalysisData.activeCentralNames.map(cName => (
                        <th key={cName} className="py-3 px-3 text-center">{cName}</th>
                      ))}
                      <th className="py-3 px-4 text-center bg-amber-500/10 text-amber-300 font-extrabold">Total Clave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {claveAnalysisData.activeClavesList.map((clave) => {
                      const rowTotal = claveAnalysisData.keyTotals[clave] || 0;
                      return (
                        <tr key={clave} className="hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-black text-amber-300 bg-slate-950/50">{clave}</td>
                          {claveAnalysisData.activeCentralNames.map(cName => {
                            const cnt = claveAnalysisData.keyCentralMatrix[clave]?.[cName] || 0;
                            return (
                              <td key={cName} className={`py-3 px-3 text-center font-bold ${cnt > 0 ? 'text-white' : 'text-slate-600'}`}>
                                {cnt > 0 ? cnt : '-'}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-center font-black text-amber-400 bg-amber-500/5">{rowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-950 font-black text-amber-300 border-t-2 border-slate-700">
                    <tr>
                      <td className="py-3 px-4 uppercase text-[11px] bg-slate-950">Suma Total</td>
                      {claveAnalysisData.activeCentralNames.map(cName => {
                        const colSum = claveAnalysisData.activeClavesList.reduce((sum, clave) => {
                          return sum + (claveAnalysisData.keyCentralMatrix[clave]?.[cName] || 0);
                        }, 0);
                        return (
                          <td key={cName} className="py-3 px-3 text-center text-white font-extrabold">
                            {colSum > 0 ? colSum : '-'}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-center text-amber-400 bg-amber-500/20 text-sm font-black">
                        {claveAnalysisData.activeClavesList.reduce((sum, clave) => sum + (claveAnalysisData.keyTotals[clave] || 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* TABLA 2: MATRIZ TÉCNICO VS FRECUENCIA DE CLAVES */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>Tabla 2: Técnico / Brigada y Cantidad de Veces que usó cada Clave</span>
              </h3>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Técnico / Brigada</th>
                      {claveAnalysisData.activeClavesList.map(clave => (
                        <th key={clave} className="py-3 px-3 text-center">{clave}</th>
                      ))}
                      <th className="py-3 px-4 text-center bg-indigo-500/10 text-indigo-300 font-extrabold">Total Usos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {Object.keys(claveAnalysisData.keyTechMatrix).sort().map((tech) => {
                      const totalUses = claveAnalysisData.techTotals[tech] || 0;
                      return (
                        <tr key={tech} className="hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-bold text-white">{tech}</td>
                          {claveAnalysisData.activeClavesList.map(clave => {
                            const cnt = claveAnalysisData.keyTechMatrix[tech]?.[clave] || 0;
                            return (
                              <td key={clave} className={`py-3 px-3 text-center font-bold ${cnt > 0 ? 'text-indigo-300' : 'text-slate-600'}`}>
                                {cnt > 0 ? cnt : '-'}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-center font-black text-indigo-400 bg-indigo-500/5">{totalUses}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-950 font-black text-indigo-300 border-t-2 border-slate-700">
                    <tr>
                      <td className="py-3 px-4 uppercase text-[11px] bg-slate-950">Suma Total</td>
                      {claveAnalysisData.activeClavesList.map(clave => {
                        const colSum = Object.keys(claveAnalysisData.keyTechMatrix).reduce((sum, tech) => {
                          return sum + (claveAnalysisData.keyTechMatrix[tech]?.[clave] || 0);
                        }, 0);
                        return (
                          <td key={clave} className="py-3 px-3 text-center text-indigo-300 font-extrabold">
                            {colSum > 0 ? colSum : '-'}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-center text-indigo-400 bg-indigo-500/20 text-sm font-black">
                        {Object.keys(claveAnalysisData.keyTechMatrix).reduce((sum, tech) => sum + (claveAnalysisData.techTotals[tech] || 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 7: BUSCADOR GLOBAL Y AUDITORÍA DE TICKETS */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                PESTAÑA NÚMERO 7 · AUDITORÍA INTERACTIVA
              </span>
              <h2 className="text-xl font-black text-white mt-1 flex items-center space-x-2">
                <Search className="w-6 h-6 text-indigo-400" />
                <span>Buscador Global de Órdenes y Ficha de Auditoría</span>
              </h2>
              <p className="text-slate-400 text-xs">
                Busque por Folio, Ticket, Teléfono, Técnico o Central para inspeccionar el historial completo del servicio.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="Ingrese Folio (REP-2026-0801), Servicio (212-555-0101) o Nombre de Técnico..."
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <span className="text-xs font-bold text-slate-400">Resultados ({auditSearchResults.length}):</span>
                {auditSearchResults.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedAuditRecordId(r.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedAuditRecord?.id === r.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{r.ticketCode}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{r.date}</span>
                    </div>
                    <div className="text-xs text-indigo-300 font-medium mt-1">{r.serviceNumber} · {r.centralName}</div>
                  </div>
                ))}
              </div>

              {selectedAuditRecord && (
                <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400">FICHA TÉCNICA DE AUDITORÍA</span>
                      <h3 className="text-lg font-black text-white">{selectedAuditRecord.ticketCode}</h3>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/30 font-bold">
                      {selectedAuditRecord.status === 'resolved' ? 'Resuelto' : 'En Proceso'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Fecha de Atención:</span>
                      <div className="font-bold text-white mt-0.5">{selectedAuditRecord.date}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Fecha de Reporte:</span>
                      <div className="font-bold text-white mt-0.5">{selectedAuditRecord.reportDate || selectedAuditRecord.date}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Servicio / Abonado:</span>
                      <div className="font-bold text-indigo-300 mt-0.5">{selectedAuditRecord.serviceNumber}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Central Telefónica:</span>
                      <div className="font-bold text-white mt-0.5">{selectedAuditRecord.centralName}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Columna Cable:</span>
                      <div className="font-bold text-emerald-400 mt-0.5">{selectedAuditRecord.cable || selectedAuditRecord.issueType}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Columna Grupo:</span>
                      <div className="font-bold text-slate-200 mt-0.5">{selectedAuditRecord.grupo || 'General'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Columna Clave:</span>
                      <div className="font-bold text-amber-400 mt-0.5">{selectedAuditRecord.claveCode || 'C-01'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Técnico / Brigada:</span>
                      <div className="font-bold text-white mt-0.5">{selectedAuditRecord.technician}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Tiempo Solución MTTR:</span>
                      <div className="font-mono font-bold text-slate-200 mt-0.5">{selectedAuditRecord.mttrHours} horas</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 8: COPIA DE SEGURIDAD EN GOOGLE DRIVE & LOCAL */}
      {activeTab === 'backup' && (
        <GoogleDriveBackupView
          centrales={centrales}
          workGroups={workGroups}
          reports={reports}
          repairRecords={repairRecords}
          customTables={customTables}
          repairColumnMapping={columnMapping}
          onImportBackup={onImportBackup}
          currentUser={currentUser}
          onUpdateCurrentUser={onUpdateCurrentUser}
        />
      )}

      {/* DYNAMIC CUSTOM TABLE DASHBOARD TABS */}
      {customTables.some(t => t.id === activeTab) && (
        <div className="space-y-6">
          {(() => {
            const tableSchema = customTables.find(t => t.id === activeTab);
            if (!tableSchema) return null;

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded font-mono">
                      TABLA PERSONALIZADA DESDE EXCEL
                    </span>
                    <h2 className="text-xl font-black text-white mt-1 flex items-center space-x-2">
                      <Table className="w-6 h-6 text-purple-400" />
                      <span>{tableSchema.tableName}</span>
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">
                      {tableSchema.description || `Generada con ${tableSchema.columnsToProcess.length} columnas y ${tableSchema.rowCount} registros.`}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteCustomTable(tableSchema.id)}
                    className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all text-xs font-bold flex items-center space-x-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Tabla</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-2xl max-h-[500px]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 text-slate-500">#</th>
                        {tableSchema.columnsToProcess.map(col => (
                          <th key={col} className="py-3 px-4">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {tableSchema.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                          {tableSchema.columnsToProcess.map(col => (
                            <td key={col} className="py-2.5 px-4">{String(row[col] || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
};
