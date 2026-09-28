import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  CentroTelefonicoConfig,
  IndicadorPlanConfig,
  QualityDailyRecord,
  QualityFileParseSummary,
  QualityIndicatorRow,
  RawQualityExcelRow,
  DEFAULT_CENTROS_TELEFONICOS,
  DEFAULT_PLANES_CALIDAD,
  QualityCustomization,
  DEFAULT_QUALITY_COLUMN_NAMES,
  DEFAULT_QUALITY_FORMULAS
} from '../types/qualityIndicators';
import {
  loadCentrosTelefonicos,
  saveCentrosTelefonicos,
  loadPlanesCalidad,
  savePlanesCalidad,
  loadQualityDailyRecords,
  saveQualityDailyRecord,
  deleteQualityDailyRecord,
  loadQualityCustomization,
  saveQualityCustomization
} from '../utils/qualityIndicatorsStorage';
import {
  calculateQualityIndicators,
  generateSampleQualityDataset,
  parseQualityFile
} from '../utils/qualityIndicatorsParser';
import { CentrosPlanesModal } from './CentrosPlanesModal';
import { saveXlsxWorkbook } from '../utils/fileDownloadHelper';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LineChart,
  Line,
  LabelList,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Legend
} from 'recharts';
import {
  Activity,
  ArrowLeft,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Upload,
  RefreshCw,
  Sliders,
  Download,
  Save,
  Trash2,
  TrendingUp,
  Clock,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  BarChart2,
  PieChart as PieIcon,
  LineChart as LineIcon,
  AreaChart as AreaIcon,
  Layers,
  Filter,
  Eye,
  EyeOff,
  Calculator,
  Building2,
  Target,
  Compass,
  Award,
  ArrowUpDown,
  Zap,
  Search,
  RotateCcw
} from 'lucide-react';

// Chart Colors
const COLOR_COMPLIANT = '#10b981'; // Emerald 500
const COLOR_BREACH = '#f43f5e'; // Rose 500
const COLOR_PLAN_LINE = '#f59e0b'; // Amber 500

interface IndicadoresCalidadViewProps {
  onBackToHub: () => void;
}

export const IndicadoresCalidadView: React.FC<IndicadoresCalidadViewProps> = ({ onBackToHub }) => {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'diario' | 'mensual'>('diario');

  // Centros & Planes configuration
  const [centros, setCentros] = useState<CentroTelefonicoConfig[]>(loadCentrosTelefonicos);
  const [planes, setPlanes] = useState<Record<string, IndicadorPlanConfig>>(loadPlanesCalidad);
  const [customization, setCustomization] = useState<QualityCustomization>(loadQualityCustomization);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<'centros' | 'planes' | 'formulas'>('centros');

  // Daily records history
  const [historyRecords, setHistoryRecords] = useState<QualityDailyRecord[]>(loadQualityDailyRecords);

  // In-Memory Calculation Cache & Version Counter (Invalidated whenever a new Excel file is uploaded)
  const [dataVersion, setDataVersion] = useState<number>(0);
  const calculationCacheRef = useRef<Map<string, { indicatorRows: QualityIndicatorRow[]; totalGeneral: QualityIndicatorRow | undefined }>>(new Map());

  // =========================================================================
  // RECUADRO 1: Filtro de Fecha y Centro Telefónico (Subpestaña 1 - Tabla y 4 Gráficos)
  // =========================================================================
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [draftDate, setDraftDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showDetailedColumns, setShowDetailedColumns] = useState<boolean>(false);

  const [selectedCentroFilter, setSelectedCentroFilter] = useState<string>('TODOS');
  const [draftCentroFilter, setDraftCentroFilter] = useState<string>('TODOS');
  const [isSearchingDaily, setIsSearchingDaily] = useState<boolean>(false);
  const hasPendingDailyChanges = draftCentroFilter !== selectedCentroFilter || draftDate !== selectedDate;

  const handleApplyDailySearch = () => {
    setIsSearchingDaily(true);
    setSelectedCentroFilter(draftCentroFilter);
    setSelectedDate(draftDate);
    setTimeout(() => {
      setIsSearchingDaily(false);
    }, 120);
  };

  const handleResetDailySearch = () => {
    const today = new Date().toISOString().split('T')[0];
    setDraftDate(today);
    setSelectedDate(today);
    setDraftCentroFilter('TODOS');
    setSelectedCentroFilter('TODOS');
  };

  // Toggle to hide unnecessary columns and show ONLY the 4 indicators
  const [onlyShow4Indicators, setOnlyShow4Indicators] = useState<boolean>(false);

  // =========================================================================
  // RECUADRO 2: Radar Multidimensional de Rendimiento (Subpestaña 1)
  // =========================================================================
  const [dailyRadarCentro, setDailyRadarCentro] = useState<string>('TOTAL');
  const [draftRadarCentro, setDraftRadarCentro] = useState<string>('TOTAL');
  const [isSearchingRadar, setIsSearchingRadar] = useState<boolean>(false);
  const hasPendingRadarChanges = draftRadarCentro !== dailyRadarCentro;

  const handleApplyRadarSearch = () => {
    setIsSearchingRadar(true);
    setDailyRadarCentro(draftRadarCentro);
    setTimeout(() => {
      setIsSearchingRadar(false);
    }, 120);
  };

  const handleResetRadarSearch = () => {
    setDraftRadarCentro('TOTAL');
    setDailyRadarCentro('TOTAL');
  };

  // =========================================================================
  // RECUADRO 3: Gráfico 5 de Evolución Histórica Día a Día (Subpestaña 1)
  // =========================================================================
  const [historyChartCentro, setHistoryChartCentro] = useState<string>('TOTAL');
  const [draftHistoryChartCentro, setDraftHistoryChartCentro] = useState<string>('TOTAL');
  const [historyChartIndicator, setHistoryChartIndicator] = useState<'reporte_inicial' | 'rep_3dias' | 'rep_1dia' | 'demora_promedio'>('reporte_inicial');
  const [draftHistoryChartIndicator, setDraftHistoryChartIndicator] = useState<'reporte_inicial' | 'rep_3dias' | 'rep_1dia' | 'demora_promedio'>('reporte_inicial');
  const [isSearchingHistory, setIsSearchingHistory] = useState<boolean>(false);
  const hasPendingHistoryChanges = draftHistoryChartCentro !== historyChartCentro || draftHistoryChartIndicator !== historyChartIndicator;

  const handleApplyHistorySearch = () => {
    setIsSearchingHistory(true);
    setHistoryChartCentro(draftHistoryChartCentro);
    setHistoryChartIndicator(draftHistoryChartIndicator);
    setTimeout(() => {
      setIsSearchingHistory(false);
    }, 120);
  };

  const handleResetHistorySearch = () => {
    setDraftHistoryChartCentro('TOTAL');
    setHistoryChartCentro('TOTAL');
    setDraftHistoryChartIndicator('reporte_inicial');
    setHistoryChartIndicator('reporte_inicial');
  };

  // 3 Excel Raw Data & Summaries
  const [pendientesInicialRows, setPendientesInicialRows] = useState<RawQualityExcelRow[]>([]);
  const [pendientesFinalRows, setPendientesFinalRows] = useState<RawQualityExcelRow[]>([]);
  const [reparadasRows, setReparadasRows] = useState<RawQualityExcelRow[]>([]);

  const [summaryInicial, setSummaryInicial] = useState<QualityFileParseSummary | null>(null);
  const [summaryFinal, setSummaryFinal] = useState<QualityFileParseSummary | null>(null);
  const [summaryReparadas, setSummaryReparadas] = useState<QualityFileParseSummary | null>(null);

  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // =========================================================================
  // RECUADRO 4: Histórico y Gráficas Mensuales (Subpestaña 2)
  // =========================================================================
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  });
  const [draftMonthFilter, setDraftMonthFilter] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7);
  });
  const [selectedMonthlyCentroFilter, setSelectedMonthlyCentroFilter] = useState<string>('TOTAL');
  const [draftMonthlyCentroFilter, setDraftMonthlyCentroFilter] = useState<string>('TOTAL');
  const [isSearchingMonthly, setIsSearchingMonthly] = useState<boolean>(false);
  const hasPendingMonthlyChanges = draftMonthFilter !== selectedMonthFilter || draftMonthlyCentroFilter !== selectedMonthlyCentroFilter;

  const handleApplyMonthlySearch = () => {
    setIsSearchingMonthly(true);
    setSelectedMonthFilter(draftMonthFilter);
    setSelectedMonthlyCentroFilter(draftMonthlyCentroFilter);
    setTimeout(() => {
      setIsSearchingMonthly(false);
    }, 120);
  };

  const handleResetMonthlySearch = () => {
    const cur = new Date().toISOString().substring(0, 7);
    setDraftMonthFilter(cur);
    setSelectedMonthFilter(cur);
    setDraftMonthlyCentroFilter('TOTAL');
    setSelectedMonthlyCentroFilter('TOTAL');
  };

  // Subtab 1 Visual Perspectives & Chart Types
  const [dailyChartType, setDailyChartType] = useState<'bar' | 'area'>('bar');
  const [dailyAdvancedTab, setDailyAdvancedTab] = useState<'radar' | 'composed' | 'distribution'>('radar');
  const [dailyComposedMetric, setDailyComposedMetric] = useState<'rep_3dias' | 'demora_promedio'>('rep_3dias');

  // Subtab 2 Visual Perspectives & Chart Types
  const [monthlyChartType, setMonthlyChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [monthlyAdvancedTab, setMonthlyAdvancedTab] = useState<'ranking' | 'donuts' | 'composed'>('ranking');
  const [monthlyRankingIndicator, setMonthlyRankingIndicator] = useState<'reporte_inicial' | 'rep_3dias' | 'rep_1dia' | 'demora_promedio'>('rep_3dias');
  const [monthlyComposedMetric, setMonthlyComposedMetric] = useState<'rep_3dias' | 'demora_promedio'>('rep_3dias');

  // Calculate indicators for current day using custom formulas & session cache (invalidated on new excel upload)
  const { indicatorRows = [], totalGeneral } = useMemo(() => {
    const cacheKey = `v${dataVersion}_c${centros.length}_pi${pendientesInicialRows.length}_pf${pendientesFinalRows.length}_r${reparadasRows.length}_f${JSON.stringify(customization.formulas)}_p${JSON.stringify(planes)}`;
    if (calculationCacheRef.current.has(cacheKey)) {
      return calculationCacheRef.current.get(cacheKey)!;
    }

    const res = calculateQualityIndicators({
      centros: centros || [],
      planes: planes || DEFAULT_PLANES_CALIDAD,
      pendientesInicialRows: pendientesInicialRows || [],
      pendientesFinalRows: pendientesFinalRows || [],
      reparadasRows: reparadasRows || [],
      formulas: customization.formulas
    });
    const computed = {
      indicatorRows: res.rows || res.indicatorRows || [],
      totalGeneral: res.totalGeneral
    };
    calculationCacheRef.current.set(cacheKey, computed);
    return computed;
  }, [dataVersion, centros, planes, pendientesInicialRows, pendientesFinalRows, reparadasRows, customization.formulas]);

  // Filtered rows for the table and daily charts based on selectedCentroFilter
  const displayedRows = useMemo(() => {
    if (selectedCentroFilter === 'TODOS' || !selectedCentroFilter) {
      return indicatorRows;
    }
    return indicatorRows.filter(r => r.centroId === selectedCentroFilter);
  }, [indicatorRows, selectedCentroFilter]);

  // Active KPI Summary (Shows selected Centro metrics, or Total General if 'TODOS')
  const activeKpiSummary = useMemo(() => {
    if (selectedCentroFilter === 'TODOS' || !selectedCentroFilter) {
      return {
        item: totalGeneral,
        isTotal: true,
        title: 'TOTAL GENERAL (Todos los Centros)'
      };
    }
    const found = indicatorRows.find(r => r.centroId === selectedCentroFilter);
    return {
      item: found || totalGeneral,
      isTotal: false,
      title: found ? found.centroName : 'TOTAL GENERAL'
    };
  }, [selectedCentroFilter, indicatorRows, totalGeneral]);

  // Historical Daily Data for the dedicated chart at the end of Subtab 1
  const historyDailyChartData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Combine history records with current day calculation if available and not yet saved
    const recordMap = new Map<string, QualityDailyRecord>();
    (historyRecords || []).forEach(r => recordMap.set(r.date, r));

    if (indicatorRows.length > 0 && totalGeneral && selectedDate <= todayStr && !recordMap.has(selectedDate)) {
      recordMap.set(selectedDate, {
        id: `current_${selectedDate}`,
        date: selectedDate,
        month: selectedDate.substring(0, 7),
        filesSummary: {},
        rows: indicatorRows,
        totalGeneral: totalGeneral,
        plansSnapshot: planes,
        createdAt: new Date().toISOString()
      });
    }

    const allRecords = Array.from(recordMap.values())
      .filter(r => r.date <= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    return allRecords.map(rec => {
      let targetRow: QualityIndicatorRow | undefined;
      if (historyChartCentro === 'TOTAL') {
        targetRow = rec.totalGeneral;
      } else {
        targetRow = (rec.rows || []).find(r => r.centroId === historyChartCentro);
      }

      if (!targetRow) return null;

      let value = 0;
      let complies = false;
      let targetVal = 0;
      let operator = '<=';
      let unit = '%';

      if (historyChartIndicator === 'reporte_inicial') {
        value = targetRow.reporteInicial;
        complies = targetRow.compliesReporteInicial;
        targetVal = rec.plansSnapshot?.reporte_inicial?.targetValue ?? planes?.reporte_inicial?.targetValue ?? 2.5;
        operator = rec.plansSnapshot?.reporte_inicial?.operator ?? planes?.reporte_inicial?.operator ?? '<=';
        unit = '%';
      } else if (historyChartIndicator === 'rep_3dias') {
        value = targetRow.pctRep3dias;
        complies = targetRow.compliesRep3dias;
        targetVal = rec.plansSnapshot?.rep_3dias?.targetValue ?? planes?.rep_3dias?.targetValue ?? 85;
        operator = rec.plansSnapshot?.rep_3dias?.operator ?? planes?.rep_3dias?.operator ?? '>=';
        unit = '%';
      } else if (historyChartIndicator === 'rep_1dia') {
        value = targetRow.pctRep1dia;
        complies = targetRow.compliesRep1dia;
        targetVal = rec.plansSnapshot?.rep_1dia?.targetValue ?? planes?.rep_1dia?.targetValue ?? 60;
        operator = rec.plansSnapshot?.rep_1dia?.operator ?? planes?.rep_1dia?.operator ?? '>=';
        unit = '%';
      } else {
        value = targetRow.demoraPromedio;
        complies = targetRow.compliesDemoraPromedio;
        targetVal = rec.plansSnapshot?.demora_promedio?.targetValue ?? planes?.demora_promedio?.targetValue ?? 18;
        operator = rec.plansSnapshot?.demora_promedio?.operator ?? planes?.demora_promedio?.operator ?? '<=';
        unit = 'hrs';
      }

      return {
        date: rec.date,
        shortDate: rec.date.length >= 10 ? `${rec.date.substring(8, 10)}/${rec.date.substring(5, 7)}` : rec.date,
        fullDate: rec.date,
        value,
        complies,
        targetVal,
        operator,
        unit,
        centroName: targetRow.centroName || (historyChartCentro === 'TOTAL' ? 'Total General' : historyChartCentro)
      };
    }).filter(Boolean) as {
      date: string;
      shortDate: string;
      fullDate: string;
      value: number;
      complies: boolean;
      targetVal: number;
      operator: string;
      unit: string;
      centroName: string;
    }[];
  }, [historyRecords, indicatorRows, totalGeneral, selectedDate, historyChartCentro, historyChartIndicator, planes]);

  // Current config for the selected indicator in Chart 5
  const currentIndicatorConfig = useMemo(() => {
    switch (historyChartIndicator) {
      case 'reporte_inicial':
        return {
          title: customization.columnNames.reporteInicial || 'Reporte Inicial',
          plan: planes.reporte_inicial,
          unit: '%'
        };
      case 'rep_3dias':
        return {
          title: customization.columnNames.pctRep3dias || '% Reparadas -3 Días',
          plan: planes.rep_3dias,
          unit: '%'
        };
      case 'rep_1dia':
        return {
          title: customization.columnNames.pctRep1dia || '% Reparadas -1 Día',
          plan: planes.rep_1dia,
          unit: '%'
        };
      case 'demora_promedio':
        return {
          title: customization.columnNames.demoraPromedio || 'Demora Promedio',
          plan: planes.demora_promedio,
          unit: 'hrs'
        };
    }
  }, [historyChartIndicator, planes, customization.columnNames]);

  // Load sample dataset on mount if no files loaded
  useEffect(() => {
    if (
      pendientesInicialRows.length === 0 &&
      pendientesFinalRows.length === 0 &&
      reparadasRows.length === 0 &&
      historyRecords.length === 0
    ) {
      handleLoadSampleData();
    }
  }, []);

  // Handler: Parse individual file
  const handleFileUpload = async (file: File, fileType: 'inicial' | 'final' | 'reparadas') => {
    setIsProcessing(fileType);
    setParseError(null);
    try {
      const result = await parseQualityFile(file, fileType);
      if (fileType === 'inicial') {
        setPendientesInicialRows(result.rows);
        setSummaryInicial(result.summary);
      } else if (fileType === 'final') {
        setPendientesFinalRows(result.rows);
        setSummaryFinal(result.summary);
      } else {
        setReparadasRows(result.rows);
        setSummaryReparadas(result.summary);
      }
      // Invalidate and purge session cache on new Excel file upload (Option D)
      calculationCacheRef.current.clear();
      setDataVersion(v => v + 1);
    } catch (err: any) {
      console.error('Error parsing quality file:', err);
      setParseError(`Error en archivo ${file.name}: ${err?.message || 'Formato no válido'}`);
    } finally {
      setIsProcessing(null);
    }
  };

  // Handler: Auto-classify dropped files by filename
  const handleAutoClassifyFiles = async (files: FileList | File[]) => {
    setParseError(null);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();
      if (name.includes('inicial') || (name.includes('pendientes') && !name.includes('final'))) {
        await handleFileUpload(file, 'inicial');
      } else if (name.includes('final')) {
        await handleFileUpload(file, 'final');
      } else if (name.includes('reparada') || name.includes('reparadas') || name.includes('rep')) {
        await handleFileUpload(file, 'reparadas');
      } else {
        // Fallback: prompt or assign to reparadas
        await handleFileUpload(file, 'reparadas');
      }
    }
  };

  // Handler: Load sample data with 7 days history
  const handleLoadSampleData = () => {
    const sampleCentros = centros || DEFAULT_CENTROS_TELEFONICOS;
    const sample = generateSampleQualityDataset(sampleCentros);
    setPendientesInicialRows(sample.pendientesInicialRows || []);
    setPendientesFinalRows(sample.pendientesFinalRows || []);
    setReparadasRows(sample.reparadasRows || []);
    setSummaryInicial(sample.summaryInicial || null);
    setSummaryFinal(sample.summaryFinal || null);
    setSummaryReparadas(sample.summaryReparadas || null);
    setParseError(null);
    // Invalidate and purge session cache
    calculationCacheRef.current.clear();
    setDataVersion(v => v + 1);

    // If history records are empty, seed 7 historical days up to today
    if (historyRecords.length === 0) {
      const today = new Date();
      let updatedHistory: QualityDailyRecord[] = [];
      for (let i = 6; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const monthStr = dateStr.substring(0, 7);
        const dailySample = generateSampleQualityDataset(sampleCentros);
        const calcRes = calculateQualityIndicators({
          centros: sampleCentros,
          planes: planes || DEFAULT_PLANES_CALIDAD,
          pendientesInicialRows: dailySample.pendientesInicialRows,
          pendientesFinalRows: dailySample.pendientesFinalRows,
          reparadasRows: dailySample.reparadasRows,
          formulas: customization.formulas
        });

        const rec: QualityDailyRecord = {
          id: `qrec_${dateStr}_sample`,
          date: dateStr,
          month: monthStr,
          filesSummary: {
            ipInicial: dailySample.summaryInicial,
            ipFinal: dailySample.summaryFinal,
            reparadas: dailySample.summaryReparadas
          },
          rows: calcRes.rows,
          totalGeneral: calcRes.totalGeneral,
          plansSnapshot: planes || DEFAULT_PLANES_CALIDAD,
          notes: 'Muestra histórica de calibración',
          createdAt: new Date().toISOString()
        };
        updatedHistory = saveQualityDailyRecord(rec);
      }
      setHistoryRecords(updatedHistory);
    }
  };

  // Handler: Clear current data
  const handleClearCurrentData = () => {
    setPendientesInicialRows([]);
    setPendientesFinalRows([]);
    setReparadasRows([]);
    setSummaryInicial(null);
    setSummaryFinal(null);
    setSummaryReparadas(null);
  };

  // Handler: Save to Monthly History
  const handleSaveToMonthlyHistory = () => {
    if (indicatorRows.length === 0 || !totalGeneral) {
      alert('No hay cálculos de indicadores para guardar.');
      return;
    }

    const monthStr = selectedDate.substring(0, 7);
    const newRecord: QualityDailyRecord = {
      id: `qrec_${selectedDate}_${Date.now()}`,
      date: selectedDate,
      month: monthStr,
      filesSummary: {
        ipInicial: summaryInicial || undefined,
        ipFinal: summaryFinal || undefined,
        reparadas: summaryReparadas || undefined
      },
      rows: indicatorRows,
      totalGeneral,
      plansSnapshot: planes,
      createdAt: new Date().toISOString()
    };

    const updated = saveQualityDailyRecord(newRecord);
    setHistoryRecords(updated);
    setSaveSuccessMsg(`¡Registro del día ${selectedDate} guardado exitosamente en el histórico mensual!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Handler: Delete history record
  const handleDeleteHistoryRecord = (id: string) => {
    if (!window.confirm('¿Seguro que desea eliminar este registro diario del histórico mensual?')) return;
    const updated = deleteQualityDailyRecord(id);
    setHistoryRecords(updated);
  };

  // Handler: Export current table to Excel
  const handleExportTableToExcel = async () => {
    const rowsToExport = displayedRows;
    if (rowsToExport.length === 0 || !totalGeneral) {
      alert('No hay datos disponibles para exportar.');
      return;
    }

    const cols = customization.columnNames;
    const exportData = rowsToExport.map((r, idx) => {
      if (onlyShow4Indicators) {
        return {
          'N°': idx + 1,
          [cols.centroName]: r.centroName,
          [`${cols.reporteInicial} (%)`]: `${r.reporteInicial}%`,
          'Cumple Reporte Inicial': r.compliesReporteInicial ? 'CUMPLE' : 'INCUMPLE',
          [`${cols.pctRep3dias} (%)`]: `${r.pctRep3dias}%`,
          'Cumple % Rep -3d': r.compliesRep3dias ? 'CUMPLE' : 'INCUMPLE',
          [`${cols.pctRep1dia} (%)`]: `${r.pctRep1dia}%`,
          'Cumple % Rep -1d': r.compliesRep1dia ? 'CUMPLE' : 'INCUMPLE',
          [`${cols.demoraPromedio} (hrs)`]: `${r.demoraPromedio} hrs`,
          'Cumple Demora Promedio': r.compliesDemoraPromedio ? 'CUMPLE' : 'INCUMPLE'
        };
      }
      return {
        'N°': idx + 1,
        [cols.centroName]: r.centroName,
        [cols.ls]: r.ls,
        [cols.ipInicial]: r.ipInicial,
        [cols.ipFinal]: r.ipFinal,
        [cols.totalReparaciones]: r.totalReparaciones,
        [cols.rer]: r.rer,
        [`${cols.reporteInicial} (%)`]: `${r.reporteInicial}%`,
        'Cumple Reporte Inicial': r.compliesReporteInicial ? 'CUMPLE' : 'INCUMPLE',
        'Rep ≤3d': r.rep3dias,
        [`${cols.pctRep3dias} (%)`]: `${r.pctRep3dias}%`,
        'Cumple % Rep -3d': r.compliesRep3dias ? 'CUMPLE' : 'INCUMPLE',
        'Rep ≤1d': r.rep1dia,
        [`${cols.pctRep1dia} (%)`]: `${r.pctRep1dia}%`,
        'Cumple % Rep -1d': r.compliesRep1dia ? 'CUMPLE' : 'INCUMPLE',
        [cols.dtr]: r.dtr,
        [`${cols.demoraPromedio} (hrs)`]: `${r.demoraPromedio} hrs`,
        'Cumple Demora Promedio': r.compliesDemoraPromedio ? 'CUMPLE' : 'INCUMPLE'
      };
    });

    // Add TOTAL GENERAL row if viewing all centers
    if (selectedCentroFilter === 'TODOS') {
      if (onlyShow4Indicators) {
        exportData.push({
          'N°': '',
          [cols.centroName]: 'TOTAL GENERAL',
          [`${cols.reporteInicial} (%)`]: `${totalGeneral.reporteInicial}%`,
          'Cumple Reporte Inicial': totalGeneral.compliesReporteInicial ? 'CUMPLE' : 'INCUMPLE',
          [`${cols.pctRep3dias} (%)`]: `${totalGeneral.pctRep3dias}%`,
          'Cumple % Rep -3d': totalGeneral.compliesRep3dias ? 'CUMPLE' : 'INCUMPLE',
          [`${cols.pctRep1dia} (%)`]: `${totalGeneral.pctRep1dia}%`,
          'Cumple % Rep -1d': totalGeneral.compliesRep1dia ? 'CUMPLE' : 'INCUMPLE',
          [`${cols.demoraPromedio} (hrs)`]: `${totalGeneral.demoraPromedio} hrs`,
          'Cumple Demora Promedio': totalGeneral.compliesDemoraPromedio ? 'CUMPLE' : 'INCUMPLE'
        });
      } else {
        exportData.push({
          'N°': '',
          [cols.centroName]: 'TOTAL GENERAL',
          [cols.ls]: totalGeneral.ls,
          [cols.ipInicial]: totalGeneral.ipInicial,
          [cols.ipFinal]: totalGeneral.ipFinal,
          [cols.totalReparaciones]: totalGeneral.totalReparaciones,
          [cols.rer]: totalGeneral.rer,
          [`${cols.reporteInicial} (%)`]: `${totalGeneral.reporteInicial}%`,
          'Cumple Reporte Inicial': totalGeneral.compliesReporteInicial ? 'CUMPLE' : 'INCUMPLE',
          'Rep ≤3d': totalGeneral.rep3dias,
          [`${cols.pctRep3dias} (%)`]: `${totalGeneral.pctRep3dias}%`,
          'Cumple % Rep -3d': totalGeneral.compliesRep3dias ? 'CUMPLE' : 'INCUMPLE',
          'Rep ≤1d': totalGeneral.rep1dia,
          [`${cols.pctRep1dia} (%)`]: `${totalGeneral.pctRep1dia}%`,
          'Cumple % Rep -1d': totalGeneral.compliesRep1dia ? 'CUMPLE' : 'INCUMPLE',
          [cols.dtr]: totalGeneral.dtr,
          [`${cols.demoraPromedio} (hrs)`]: `${totalGeneral.demoraPromedio} hrs`,
          'Cumple Demora Promedio': totalGeneral.compliesDemoraPromedio ? 'CUMPLE' : 'INCUMPLE'
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

    // Header styling
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: '1E3A8A' } }, // Navy Blue
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Indicadores Calidad');

    const fileName = `Indicadores_Calidad_Telefonia_${selectedDate}.xlsx`;
    await saveXlsxWorkbook(workbook, fileName);
  };

  // Filter history records for Monthly tab
  const monthlyFilteredRecords = useMemo(() => {
    return historyRecords.filter(r => r.month === selectedMonthFilter);
  }, [historyRecords, selectedMonthFilter]);

  // Available months from history records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(selectedMonthFilter);
    set.add(draftMonthFilter);
    historyRecords.forEach(r => set.add(r.month));
    return Array.from(set).sort().reverse();
  }, [historyRecords, selectedMonthFilter, draftMonthFilter]);

  // Available Centros for Monthly tab
  const monthlyAvailableCentros = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    (centros || []).forEach(c => list.push({ id: c.id, name: c.name }));
    (historyRecords || []).forEach(r => {
      (r.rows || []).forEach(row => {
        if (!list.some(c => c.id === row.centroId)) {
          list.push({ id: row.centroId, name: row.centroName || row.centroId });
        }
      });
    });
    return list;
  }, [centros, historyRecords]);

  // Selected Monthly Centro Display Name
  const currentMonthlyCentroName = useMemo(() => {
    if (selectedMonthlyCentroFilter === 'TOTAL') {
      return 'TOTAL GENERAL (Todos los Centros)';
    }
    const found = monthlyAvailableCentros.find(c => c.id === selectedMonthlyCentroFilter);
    return found ? found.name : selectedMonthlyCentroFilter;
  }, [selectedMonthlyCentroFilter, monthlyAvailableCentros]);

  // Monthly aggregated trend data for the 4 charts
  const monthlyTrendData = useMemo(() => {
    // Sort records by date ascending
    const sorted = [...monthlyFilteredRecords].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map(r => {
      let targetRow: QualityIndicatorRow | undefined;
      if (selectedMonthlyCentroFilter === 'TOTAL') {
        targetRow = r.totalGeneral;
      } else {
        targetRow = (r.rows || []).find(row => row.centroId === selectedMonthlyCentroFilter);
      }

      if (!targetRow) return null;

      return {
        date: r.date.substring(5), // MM-DD
        fullDate: r.date,
        centroName: targetRow.centroName || (selectedMonthlyCentroFilter === 'TOTAL' ? 'Total General' : selectedMonthlyCentroFilter),
        ls: targetRow.ls,
        rer: targetRow.rer,
        reporteInicial: targetRow.reporteInicial,
        pctRep3dias: targetRow.pctRep3dias,
        pctRep1dia: targetRow.pctRep1dia,
        demoraPromedio: targetRow.demoraPromedio,
        compliesReporteInicial: targetRow.compliesReporteInicial,
        compliesRep3dias: targetRow.compliesRep3dias,
        compliesRep1dia: targetRow.compliesRep1dia,
        compliesDemoraPromedio: targetRow.compliesDemoraPromedio
      };
    }).filter(Boolean) as {
      date: string;
      fullDate: string;
      centroName: string;
      ls: number;
      rer: number;
      reporteInicial: number;
      pctRep3dias: number;
      pctRep1dia: number;
      demoraPromedio: number;
      compliesReporteInicial: boolean;
      compliesRep3dias: boolean;
      compliesRep1dia: boolean;
      compliesDemoraPromedio: boolean;
    }[];
  }, [monthlyFilteredRecords, selectedMonthlyCentroFilter]);

  // Monthly summary metrics for the selected month and centro
  const monthlySummaryStats = useMemo(() => {
    if (monthlyTrendData.length === 0) return null;
    const count = monthlyTrendData.length;
    const avgRepInicial = +(monthlyTrendData.reduce((acc, curr) => acc + curr.reporteInicial, 0) / count).toFixed(2);
    const avgRep3dias = +(monthlyTrendData.reduce((acc, curr) => acc + curr.pctRep3dias, 0) / count).toFixed(2);
    const avgRep1dia = +(monthlyTrendData.reduce((acc, curr) => acc + curr.pctRep1dia, 0) / count).toFixed(2);
    const avgDemora = +(monthlyTrendData.reduce((acc, curr) => acc + curr.demoraPromedio, 0) / count).toFixed(2);

    return {
      daysCount: count,
      avgRepInicial,
      avgRep3dias,
      avgRep1dia,
      avgDemora
    };
  }, [monthlyTrendData]);

  // Data for Multidimensional Radar in Subtab 1
  const dailyRadarData = useMemo(() => {
    let targetRow: QualityIndicatorRow | undefined;
    if (dailyRadarCentro === 'TOTAL') {
      targetRow = totalGeneral;
    } else {
      targetRow = indicatorRows.find(r => r.centroId === dailyRadarCentro);
    }
    if (!targetRow) return [];

    const tRep = planes?.reporte_inicial?.targetValue ?? 2.5;
    const vRep = targetRow.reporteInicial;
    const scoreRep = vRep <= tRep ? 100 : Math.max(10, Math.round((tRep / (vRep || 0.01)) * 100));

    const tRep3 = planes?.rep_3dias?.targetValue ?? 85;
    const vRep3 = targetRow.pctRep3dias;
    const scoreRep3 = Math.min(100, Math.round((vRep3 / (tRep3 || 1)) * 100));

    const tRep1 = planes?.rep_1dia?.targetValue ?? 60;
    const vRep1 = targetRow.pctRep1dia;
    const scoreRep1 = Math.min(100, Math.round((vRep1 / (tRep1 || 1)) * 100));

    const tDem = planes?.demora_promedio?.targetValue ?? 18;
    const vDem = targetRow.demoraPromedio;
    const scoreDem = vDem <= tDem ? 100 : Math.max(10, Math.round((tDem / (vDem || 0.01)) * 100));

    return [
      {
        indicator: 'Reporte Inicial',
        shortName: 'Rep. Inicial',
        score: scoreRep,
        target: 100,
        actualVal: `${vRep}%`,
        targetVal: `${tRep}%`,
        complies: targetRow.compliesReporteInicial
      },
      {
        indicator: '% Rep -3 Días',
        shortName: 'Rep -3d',
        score: scoreRep3,
        target: 100,
        actualVal: `${vRep3}%`,
        targetVal: `${tRep3}%`,
        complies: targetRow.compliesRep3dias
      },
      {
        indicator: '% Rep -1 Día',
        shortName: 'Rep -1d',
        score: scoreRep1,
        target: 100,
        actualVal: `${vRep1}%`,
        targetVal: `${tRep1}%`,
        complies: targetRow.compliesRep1dia
      },
      {
        indicator: 'Rapidez (Demora)',
        shortName: 'Rapidez Demora',
        score: scoreDem,
        target: 100,
        actualVal: `${vDem}h`,
        targetVal: `${tDem}h`,
        complies: targetRow.compliesDemoraPromedio
      }
    ];
  }, [dailyRadarCentro, totalGeneral, indicatorRows, planes]);

  // Data for Averías Distribution Donut in Subtab 1
  const dailyDistributionRER = useMemo(() => {
    const totalRER = indicatorRows.reduce((acc, r) => acc + r.rer, 0);
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];
    return indicatorRows.map((r, i) => ({
      name: r.centroName,
      value: r.rer,
      ls: r.ls,
      reparadas: r.totalReparaciones,
      percentage: totalRER > 0 ? ((r.rer / totalRER) * 100).toFixed(1) : '0',
      color: COLORS[i % COLORS.length]
    })).sort((a, b) => b.value - a.value);
  }, [indicatorRows]);

  // Overall compliance counts for Subtab 1
  const dailyComplianceDonut = useMemo(() => {
    const total = indicatorRows.length;
    if (total === 0) return [];
    const repInicialOk = indicatorRows.filter(r => r.compliesReporteInicial).length;
    const rep3diasOk = indicatorRows.filter(r => r.compliesRep3dias).length;
    const rep1diaOk = indicatorRows.filter(r => r.compliesRep1dia).length;
    const demoraOk = indicatorRows.filter(r => r.compliesDemoraPromedio).length;
    return [
      { name: '1. Reporte Inicial', ok: repInicialOk, inc: total - repInicialOk, rate: ((repInicialOk / total) * 100).toFixed(0), complies: (repInicialOk / total) >= 0.8 },
      { name: '2. % Rep -3 Días', ok: rep3diasOk, inc: total - rep3diasOk, rate: ((rep3diasOk / total) * 100).toFixed(0), complies: (rep3diasOk / total) >= 0.8 },
      { name: '3. % Rep -1 Día', ok: rep1diaOk, inc: total - rep1diaOk, rate: ((rep1diaOk / total) * 100).toFixed(0), complies: (rep1diaOk / total) >= 0.8 },
      { name: '4. Demora Promedio', ok: demoraOk, inc: total - demoraOk, rate: ((demoraOk / total) * 100).toFixed(0), complies: (demoraOk / total) >= 0.8 },
    ];
  }, [indicatorRows]);

  // Data for Monthly Ranking of Centros in Subtab 2
  const monthlyCentrosRanking = useMemo(() => {
    if (monthlyFilteredRecords.length === 0) return [];

    const centroMap = new Map<string, {
      id: string;
      name: string;
      count: number;
      sumRepInicial: number;
      sumRep3dias: number;
      sumRep1dia: number;
      sumDemora: number;
      sumRer: number;
      sumLs: number;
    }>();

    monthlyFilteredRecords.forEach(rec => {
      (rec.rows || []).forEach(row => {
        if (!centroMap.has(row.centroId)) {
          centroMap.set(row.centroId, {
            id: row.centroId,
            name: row.centroName || row.centroId,
            count: 0,
            sumRepInicial: 0,
            sumRep3dias: 0,
            sumRep1dia: 0,
            sumDemora: 0,
            sumRer: 0,
            sumLs: 0
          });
        }
        const c = centroMap.get(row.centroId)!;
        c.count += 1;
        c.sumRepInicial += row.reporteInicial;
        c.sumRep3dias += row.pctRep3dias;
        c.sumRep1dia += row.pctRep1dia;
        c.sumDemora += row.demoraPromedio;
        c.sumRer += row.rer;
        c.sumLs += row.ls;
      });
    });

    const list = Array.from(centroMap.values())
      .filter(c => c.count > 0)
      .map(c => {
        const avgRepInicial = +(c.sumRepInicial / c.count).toFixed(2);
        const avgRep3dias = +(c.sumRep3dias / c.count).toFixed(2);
        const avgRep1dia = +(c.sumRep1dia / c.count).toFixed(2);
        const avgDemora = +(c.sumDemora / c.count).toFixed(2);

        let value = 0;
        let complies = false;
        let targetVal = 0;
        let unit = '%';

        if (monthlyRankingIndicator === 'reporte_inicial') {
          value = avgRepInicial;
          targetVal = planes?.reporte_inicial?.targetValue ?? 2.5;
          complies = value <= targetVal;
          unit = '%';
        } else if (monthlyRankingIndicator === 'rep_3dias') {
          value = avgRep3dias;
          targetVal = planes?.rep_3dias?.targetValue ?? 85;
          complies = value >= targetVal;
          unit = '%';
        } else if (monthlyRankingIndicator === 'rep_1dia') {
          value = avgRep1dia;
          targetVal = planes?.rep_1dia?.targetValue ?? 60;
          complies = value >= targetVal;
          unit = '%';
        } else {
          value = avgDemora;
          targetVal = planes?.demora_promedio?.targetValue ?? 18;
          complies = value <= targetVal;
          unit = 'hrs';
        }

        return {
          id: c.id,
          name: c.name,
          days: c.count,
          value,
          complies,
          targetVal,
          unit,
          avgRepInicial,
          avgRep3dias,
          avgRep1dia,
          avgDemora
        };
      });

    if (monthlyRankingIndicator === 'reporte_inicial' || monthlyRankingIndicator === 'demora_promedio') {
      list.sort((a, b) => a.value - b.value);
    } else {
      list.sort((a, b) => b.value - a.value);
    }

    return list;
  }, [monthlyFilteredRecords, monthlyRankingIndicator, planes]);

  // Data for Monthly Compliance Donuts in Subtab 2
  const monthlyDonutsData = useMemo(() => {
    if (monthlyTrendData.length === 0) return null;
    const totalDays = monthlyTrendData.length;

    const repInicialOk = monthlyTrendData.filter(d => d.compliesReporteInicial).length;
    const rep3diasOk = monthlyTrendData.filter(d => d.compliesRep3dias).length;
    const rep1diaOk = monthlyTrendData.filter(d => d.compliesRep1dia).length;
    const demoraOk = monthlyTrendData.filter(d => d.compliesDemoraPromedio).length;

    return {
      totalDays,
      reporteInicial: {
        name: 'Reporte Inicial',
        ok: repInicialOk,
        breach: totalDays - repInicialOk,
        rate: Math.round((repInicialOk / totalDays) * 100),
        data: [
          { name: 'Cumple Meta', value: repInicialOk, fill: COLOR_COMPLIANT },
          { name: 'Incumple Meta', value: totalDays - repInicialOk, fill: COLOR_BREACH }
        ]
      },
      rep3dias: {
        name: '% Rep -3 Días',
        ok: rep3diasOk,
        breach: totalDays - rep3diasOk,
        rate: Math.round((rep3diasOk / totalDays) * 100),
        data: [
          { name: 'Cumple Meta', value: rep3diasOk, fill: COLOR_COMPLIANT },
          { name: 'Incumple Meta', value: totalDays - rep3diasOk, fill: COLOR_BREACH }
        ]
      },
      rep1dia: {
        name: '% Rep -1 Día',
        ok: rep1diaOk,
        breach: totalDays - rep1diaOk,
        rate: Math.round((rep1diaOk / totalDays) * 100),
        data: [
          { name: 'Cumple Meta', value: rep1diaOk, fill: COLOR_COMPLIANT },
          { name: 'Incumple Meta', value: totalDays - rep1diaOk, fill: COLOR_BREACH }
        ]
      },
      demora: {
        name: 'Demora Promedio',
        ok: demoraOk,
        breach: totalDays - demoraOk,
        rate: Math.round((demoraOk / totalDays) * 100),
        data: [
          { name: 'Cumple Meta', value: demoraOk, fill: COLOR_COMPLIANT },
          { name: 'Incumple Meta', value: totalDays - demoraOk, fill: COLOR_BREACH }
        ]
      }
    };
  }, [monthlyTrendData]);

  // Data for Monthly Composed (Averías vs Eficiencia) in Subtab 2
  const monthlyComposedData = useMemo(() => {
    return monthlyTrendData.map(d => ({
      date: d.date,
      fullDate: d.fullDate,
      ls: d.ls,
      rer: d.rer,
      rep3dias: d.pctRep3dias,
      demora: d.demoraPromedio,
      reporteInicial: d.reporteInicial
    }));
  }, [monthlyTrendData]);

  // Return JSX
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      
      {/* Top Banner Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToHub}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 border border-slate-700"
              title="Volver al Panel Principal de Módulos"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-bold hidden sm:inline">Panel Principal</span>
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg">
                  <Activity className="w-4 h-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  4. Cálculo de los Indicadores de Calidad (Telefonía Básica)
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Monitoreo operativo de Reporte Inicial, % Reparadas (-3d / -1d) y Demora Promedio vs Plan.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
              title="Cargar conjunto de datos de muestra para verificar cálculos y gráficos"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Cargar Muestra</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setConfigModalTab('centros');
                setIsConfigModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 border border-indigo-400/40 cursor-pointer active:scale-95"
              title="Configurar Técnica Instalada (LS), Centros Telefónicos y Metas del Plan"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Centros y Planes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setConfigModalTab('formulas');
                setIsConfigModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center space-x-1.5 border border-purple-400/40 cursor-pointer active:scale-95"
              title="Personalizar fórmulas de cálculo de indicadores y nombres de columnas"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Fórmulas y Nombres</span>
            </button>
          </div>

        </div>

        {/* Subtabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center space-x-3 pt-2 pb-2.5 overflow-x-auto border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('diario')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'diario'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-300" />
            <span>1. Análisis Diario (Cálculo y Tablas)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('mensual')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'mensual'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-300" />
            <span>2. Acumulado y Gráficos Mensuales ({historyRecords.length} guardados)</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6 flex-1">

        {/* Alert / Success Toast */}
        {saveSuccessMsg && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-lg animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {parseError && (
          <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-lg">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBTAB 1: ANÁLISIS DIARIO                                */}
        {/* ======================================================== */}
        {activeSubTab === 'diario' && (
          <div className="space-y-6">

            {/* 3 Upload Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Box 1: IntPendientes INICIAL.xls */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-500/30">
                      1. PENDIENTES INICIALES
                    </span>
                    {summaryInicial && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Cargado</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                    <span>IntPendientes INICIAL.xls</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Stock inicial de averías pendientes al inicio del ciclo operativo.
                  </p>
                </div>

                {summaryInicial ? (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Teléfonos Numéricos:</span>
                      <strong className="text-amber-400 font-mono">{summaryInicial.numericRowsCount}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Descartados (TxD / Letras):</span>
                      <span className="font-mono">{summaryInicial.nonNumericRowsCount}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Centros detectados:</span>
                      <span className="font-mono">{summaryInicial.centrosFound.length}</span>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 text-center text-xs text-slate-500">
                    Arrastre o seleccione el archivo de pendientes iniciales
                  </div>
                )}

                <label className="cursor-pointer py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm text-center">
                  {isProcessing === 'inicial' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{summaryInicial ? 'Reemplazar Inicial' : 'Subir IntPendientes INICIAL'}</span>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'inicial')}
                    disabled={isProcessing !== null}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Box 2: IntPendientes FINAL.xls */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-500/30">
                      2. PENDIENTES FINALES
                    </span>
                    {summaryFinal && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Cargado</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                    <span>IntPendientes FINAL.xls</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Stock remanente de averías pendientes al cierre del período analizado.
                  </p>
                </div>

                {summaryFinal ? (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Teléfonos Numéricos:</span>
                      <strong className="text-blue-400 font-mono">{summaryFinal.numericRowsCount}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Descartados (TxD / Letras):</span>
                      <span className="font-mono">{summaryFinal.nonNumericRowsCount}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Centros detectados:</span>
                      <span className="font-mono">{summaryFinal.centrosFound.length}</span>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 text-center text-xs text-slate-500">
                    Arrastre o seleccione el archivo de pendientes finales
                  </div>
                )}

                <label className="cursor-pointer py-2.5 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm text-center">
                  {isProcessing === 'final' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{summaryFinal ? 'Reemplazar Final' : 'Subir IntPendientes FINAL'}</span>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'final')}
                    disabled={isProcessing !== null}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Box 3: IntReparadas.xls */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      3. REPARADAS DEL PERÍODO
                    </span>
                    {summaryReparadas && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Cargado</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>IntReparadas.xls</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Averías resueltas/reparadas, demoras en días y horas acumuladas (DTR).
                  </p>
                </div>

                {summaryReparadas ? (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Teléfonos Numéricos:</span>
                      <strong className="text-emerald-400 font-mono">{summaryReparadas.numericRowsCount}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Descartados (TxD / Letras):</span>
                      <span className="font-mono">{summaryReparadas.nonNumericRowsCount}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Centros detectados:</span>
                      <span className="font-mono">{summaryReparadas.centrosFound.length}</span>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 text-center text-xs text-slate-500">
                    Arrastre o seleccione el archivo de reparadas
                  </div>
                )}

                <label className="cursor-pointer py-2.5 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm text-center">
                  {isProcessing === 'reparadas' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{summaryReparadas ? 'Reemplazar Reparadas' : 'Subir IntReparadas'}</span>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'reparadas')}
                    disabled={isProcessing !== null}
                    className="hidden"
                  />
                </label>
              </div>

            </div>

            {/* KPI Summary Cards */}
            {activeKpiSummary.item && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Resumen de Indicadores:
                    </span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {activeKpiSummary.title}
                    </span>
                  </div>
                  {selectedCentroFilter !== 'TODOS' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCentroFilter('TODOS')}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                    >
                      Mostrar Todos los Centros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {/* KPI 1: Reporte Inicial */}
                  <div className={`p-4 rounded-3xl border transition-all ${
                    activeKpiSummary.item.compliesReporteInicial
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/10'
                      : 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/10'
                  } shadow-xl space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-400">
                        {customization.columnNames.reporteInicial || 'Reporte Inicial'}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        activeKpiSummary.item.compliesReporteInicial
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {activeKpiSummary.item.compliesReporteInicial ? 'CUMPLE' : 'INCUMPLE'}
                      </span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-black font-mono text-white">
                        {activeKpiSummary.item.reporteInicial}%
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        Plan: {planes.reporte_inicial.operator} {planes.reporte_inicial.targetValue}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      RER ({activeKpiSummary.item.rer}) / LS ({activeKpiSummary.item.ls.toLocaleString()})
                    </p>
                  </div>

                  {/* KPI 2: % Reparadas -3 Días */}
                  <div className={`p-4 rounded-3xl border transition-all ${
                    activeKpiSummary.item.compliesRep3dias
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/10'
                      : 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/10'
                  } shadow-xl space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-400">
                        {customization.columnNames.pctRep3dias || '% Rep -3 Días'}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        activeKpiSummary.item.compliesRep3dias
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {activeKpiSummary.item.compliesRep3dias ? 'CUMPLE' : 'INCUMPLE'}
                      </span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-black font-mono text-white">
                        {activeKpiSummary.item.pctRep3dias}%
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        Plan: {planes.rep_3dias.operator} {planes.rep_3dias.targetValue}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {activeKpiSummary.item.rep3dias} reparadas en ≤3 días
                    </p>
                  </div>

                  {/* KPI 3: % Reparadas -1 Día */}
                  <div className={`p-4 rounded-3xl border transition-all ${
                    activeKpiSummary.item.compliesRep1dia
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/10'
                      : 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/10'
                  } shadow-xl space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-400">
                        {customization.columnNames.pctRep1dia || '% Rep -1 Día'}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        activeKpiSummary.item.compliesRep1dia
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {activeKpiSummary.item.compliesRep1dia ? 'CUMPLE' : 'INCUMPLE'}
                      </span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-black font-mono text-white">
                        {activeKpiSummary.item.pctRep1dia}%
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        Plan: {planes.rep_1dia.operator} {planes.rep_1dia.targetValue}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {activeKpiSummary.item.rep1dia} reparadas en ≤24 horas
                    </p>
                  </div>

                  {/* KPI 4: Demora Promedio (DTR) */}
                  <div className={`p-4 rounded-3xl border transition-all ${
                    activeKpiSummary.item.compliesDemoraPromedio
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/10'
                      : 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/10'
                  } shadow-xl space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-400">
                        {customization.columnNames.demoraPromedio || 'Demora Promedio'}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        activeKpiSummary.item.compliesDemoraPromedio
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {activeKpiSummary.item.compliesDemoraPromedio ? 'CUMPLE' : 'INCUMPLE'}
                      </span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-black font-mono text-white">
                        {activeKpiSummary.item.demoraPromedio} <span className="text-sm">hrs</span>
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        Plan: {planes.demora_promedio.operator} {planes.demora_promedio.targetValue} hrs
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      DTR ({activeKpiSummary.item.dtr} hrs) / {activeKpiSummary.item.totalReparaciones} Rep.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main Table: Indicadores de Calidad por Centro Telefónico */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span>Tabla de Indicadores de Calidad por Centro Telefónico</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fila: Centro Telefónico • Columnas: Cada Indicador + Meta del Plan • Última Fila: Total General
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2" onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDailySearch(); }}>
                  {/* Date picker for the analysis */}
                  <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-inner">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <input
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
                      title="Fecha del análisis a registrar (Presione Enter o Buscar)"
                    />
                  </div>

                  {/* Filter by Centro Telefónico */}
                  <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-inner">
                    <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Centro:</span>
                    <select
                      value={draftCentroFilter}
                      onChange={(e) => setDraftCentroFilter(e.target.value)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer pr-1"
                      title="Filtrar tabla y gráficos por centro telefónico"
                    >
                      <option value="TODOS" className="bg-slate-900 text-white">Todos los Centros ({centros.length})</option>
                      {centros.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* BOTÓN 🔎 Buscar y ↺ Restablecer para Recuadro 1 */}
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={handleApplyDailySearch}
                      disabled={isSearchingDaily}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md active:scale-95 ${
                        hasPendingDailyChanges
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-500/25 animate-pulse'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                      }`}
                      title="🔎 Buscar y aplicar filtros seleccionados a la tabla y gráficos (Atajo: Presione Enter)"
                    >
                      {isSearchingDaily ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Buscar</span>
                      {hasPendingDailyChanges && (
                        <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded-full uppercase tracking-tighter">
                          Pendiente
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleResetDailySearch}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 cursor-pointer"
                      title="Restablecer a Todos los Centros y Fecha de Hoy"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Button to Hide Unnecessary Columns & ONLY show 4 Indicators */}
                  <button
                    type="button"
                    onClick={() => setOnlyShow4Indicators(!onlyShow4Indicators)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                      onlyShow4Indicators
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30 ring-2 ring-blue-400/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                    }`}
                    title={onlyShow4Indicators ? 'Restaurar todas las columnas técnicas' : 'Ocultar columnas innecesarias y ver únicamente los 4 Indicadores'}
                  >
                    {onlyShow4Indicators ? <Eye className="w-3.5 h-3.5 text-blue-200" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{onlyShow4Indicators ? 'Ver Todas las Columnas' : 'Solo 4 Indicadores'}</span>
                  </button>

                  {/* Toggle Detailed Breakdown Columns (only when not in 4-indicators-only mode) */}
                  {!onlyShow4Indicators && (
                    <button
                      type="button"
                      onClick={() => setShowDetailedColumns(!showDetailedColumns)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        showDetailedColumns
                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Mostrar u ocultar columnas intermedias de balance (IP Inicial, Final, RER, DTR)"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{showDetailedColumns ? 'Ocultar Desglose' : 'Ver Desglose'}</span>
                      {showDetailedColumns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Fórmulas y Nombres Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setConfigModalTab('formulas');
                      setIsConfigModalOpen(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Personalizar fórmulas de cálculo y nombres de columnas"
                  >
                    <Calculator className="w-3.5 h-3.5 text-purple-400" />
                    <span>Fórmulas</span>
                  </button>

                  {/* Export Excel Button */}
                  <button
                    type="button"
                    onClick={handleExportTableToExcel}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 cursor-pointer active:scale-95"
                    title="Descargar tabla de indicadores en Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>

                  {/* Save to Monthly History Button */}
                  <button
                    type="button"
                    onClick={handleSaveToMonthlyHistory}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-900/30 cursor-pointer active:scale-95"
                    title="Guardar este análisis diario en el histórico mensual"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </button>
                </div>
              </div>

              {/* Notice when filters are modified but not yet applied */}
              {hasPendingDailyChanges && (
                <div className="flex items-center space-x-2 text-[11px] text-amber-300 font-bold bg-amber-950/40 border border-amber-500/40 px-3.5 py-1.5 rounded-xl animate-in fade-in duration-150">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Filtros modificados (Centro: <strong>{draftCentroFilter === 'TODOS' ? 'Todos' : centros.find(c => c.id === draftCentroFilter)?.name || draftCentroFilter}</strong>, Fecha: <strong>{draftDate}</strong>) • Presione <strong>"🔎 Buscar"</strong> o la tecla <strong>[Enter]</strong> para actualizar la tabla y los 4 gráficos.</span>
                </div>
              )}

              {/* Table */}
              <div className={`overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800 transition-opacity duration-150 ${isSearchingDaily ? 'opacity-40' : hasPendingDailyChanges ? 'opacity-85' : 'opacity-100'}`}>
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-black text-white">{customization.columnNames.centroName || 'Centro Telefónico'}</th>
                      
                      {!onlyShow4Indicators && (
                        <th className="py-3 px-3 text-center">{customization.columnNames.ls || 'Técnica (LS)'}</th>
                      )}
                      
                      {!onlyShow4Indicators && showDetailedColumns && (
                        <>
                          <th className="py-3 px-2.5 text-center text-amber-300/80">{customization.columnNames.ipInicial || 'IP Inicial'}</th>
                          <th className="py-3 px-2.5 text-center text-blue-300/80">{customization.columnNames.ipFinal || 'IP Final'}</th>
                          <th className="py-3 px-2.5 text-center text-emerald-300/80">{customization.columnNames.totalReparaciones || 'Reparaciones'}</th>
                          <th className="py-3 px-2.5 text-center text-purple-300 font-bold">{customization.columnNames.rer || 'RER'}</th>
                          <th className="py-3 px-2.5 text-center text-slate-400">Rep ≤3d</th>
                          <th className="py-3 px-2.5 text-center text-slate-400">Rep ≤1d</th>
                          <th className="py-3 px-2.5 text-center text-slate-400">{customization.columnNames.dtr || 'DTR (hrs)'}</th>
                        </>
                      )}

                      {/* 1. Reporte Inicial */}
                      <th className="py-3 px-3 text-center bg-slate-900/70 border-l border-slate-800">
                        <div>{customization.columnNames.reporteInicial || 'Reporte Inicial'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Plan: {planes?.reporte_inicial?.operator || '<='} {planes?.reporte_inicial?.targetValue ?? 2.5}%
                        </div>
                      </th>

                      {/* 2. % Reparadas -3 Días */}
                      <th className="py-3 px-3 text-center bg-slate-900/70 border-l border-slate-800">
                        <div>{customization.columnNames.pctRep3dias || '% Rep -3 Días'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Plan: {planes?.rep_3dias?.operator || '>='} {planes?.rep_3dias?.targetValue ?? 85}%
                        </div>
                      </th>

                      {/* 3. % Reparadas -1 Día */}
                      <th className="py-3 px-3 text-center bg-slate-900/70 border-l border-slate-800">
                        <div>{customization.columnNames.pctRep1dia || '% Rep -1 Día'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Plan: {planes?.rep_1dia?.operator || '>='} {planes?.rep_1dia?.targetValue ?? 60}%
                        </div>
                      </th>

                      {/* 4. Demora Promedio */}
                      <th className="py-3 px-3 text-center bg-slate-900/70 border-l border-slate-800">
                        <div>{customization.columnNames.demoraPromedio || 'Demora Promedio'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Plan: {planes?.demora_promedio?.operator || '<='} {planes?.demora_promedio?.targetValue ?? 18} hrs
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/80 font-medium">
                    {(displayedRows || []).map(r => (
                      <tr key={r.centroId} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                          {r.centroName}
                        </td>
                        
                        {!onlyShow4Indicators && (
                          <td className="py-3 px-3 text-center font-mono text-slate-300">
                            {r.ls.toLocaleString()}
                          </td>
                        )}

                        {!onlyShow4Indicators && showDetailedColumns && (
                          <>
                            <td className="py-3 px-2.5 text-center font-mono text-amber-300/90">{r.ipInicial}</td>
                            <td className="py-3 px-2.5 text-center font-mono text-blue-300/90">{r.ipFinal}</td>
                            <td className="py-3 px-2.5 text-center font-mono text-emerald-300/90">{r.totalReparaciones}</td>
                            <td className="py-3 px-2.5 text-center font-mono font-bold text-purple-300">{r.rer}</td>
                            <td className="py-3 px-2.5 text-center font-mono text-slate-300">{r.rep3dias}</td>
                            <td className="py-3 px-2.5 text-center font-mono text-slate-300">{r.rep1dia}</td>
                            <td className="py-3 px-2.5 text-center font-mono text-slate-300">{r.dtr}</td>
                          </>
                        )}

                        {/* Reporte Inicial Cell */}
                        <td className="py-3 px-3 text-center border-l border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-mono font-bold text-white">{r.reporteInicial}%</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              r.compliesReporteInicial
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {r.compliesReporteInicial ? 'OK' : 'INC'}
                            </span>
                          </div>
                        </td>

                        {/* % Rep -3 Días Cell */}
                        <td className="py-3 px-3 text-center border-l border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-mono font-bold text-white">{r.pctRep3dias}%</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              r.compliesRep3dias
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {r.compliesRep3dias ? 'OK' : 'INC'}
                            </span>
                          </div>
                        </td>

                        {/* % Rep -1 Día Cell */}
                        <td className="py-3 px-3 text-center border-l border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-mono font-bold text-white">{r.pctRep1dia}%</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              r.compliesRep1dia
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {r.compliesRep1dia ? 'OK' : 'INC'}
                            </span>
                          </div>
                        </td>

                        {/* Demora Promedio Cell */}
                        <td className="py-3 px-3 text-center border-l border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-mono font-bold text-white">{r.demoraPromedio} hrs</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              r.compliesDemoraPromedio
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {r.compliesDemoraPromedio ? 'OK' : 'INC'}
                            </span>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>

                  {/* TOTAL ROW */}
                  {totalGeneral && (
                    <tfoot className="bg-slate-900 text-white font-black border-t-2 border-slate-700">
                      <tr>
                        <td className="py-3.5 px-4 uppercase text-xs tracking-wider text-amber-400 font-mono">
                          {selectedCentroFilter === 'TODOS' ? 'TOTAL GENERAL' : `TOTAL (${displayedRows[0]?.centroName || 'CENTRO'})`}
                        </td>
                        
                        {!onlyShow4Indicators && (
                          <td className="py-3.5 px-3 text-center font-mono text-emerald-400 text-sm">
                            {selectedCentroFilter === 'TODOS' ? totalGeneral.ls.toLocaleString() : displayedRows[0]?.ls.toLocaleString()}
                          </td>
                        )}

                        {!onlyShow4Indicators && showDetailedColumns && (
                          <>
                            <td className="py-3.5 px-2.5 text-center font-mono text-amber-300 text-xs">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.ipInicial : displayedRows[0]?.ipInicial}
                            </td>
                            <td className="py-3.5 px-2.5 text-center font-mono text-blue-300 text-xs">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.ipFinal : displayedRows[0]?.ipFinal}
                            </td>
                            <td className="py-3.5 px-2.5 text-center font-mono text-emerald-300 text-xs">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.totalReparaciones : displayedRows[0]?.totalReparaciones}
                            </td>
                            <td className="py-3.5 px-2.5 text-center font-mono text-purple-300 text-xs font-black">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.rer : displayedRows[0]?.rer}
                            </td>
                            <td className="py-3.5 px-2.5 text-center font-mono text-slate-200 text-xs">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.rep3dias : displayedRows[0]?.rep3dias}
                            </td>
                            <td className="py-3.5 px-2.5 text-center font-mono text-slate-200 text-xs">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.rep1dia : displayedRows[0]?.rep1dia}
                            </td>
                            <td className="py-3.5 px-2.5 text-center font-mono text-slate-200 text-xs">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.dtr : displayedRows[0]?.dtr}
                            </td>
                          </>
                        )}

                        {/* Total Reporte Inicial */}
                        <td className="py-3.5 px-3 text-center border-l border-slate-700 bg-slate-950">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-sm font-black text-amber-300">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.reporteInicial : displayedRows[0]?.reporteInicial}%
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${
                              (selectedCentroFilter === 'TODOS' ? totalGeneral.compliesReporteInicial : displayedRows[0]?.compliesReporteInicial)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {(selectedCentroFilter === 'TODOS' ? totalGeneral.compliesReporteInicial : displayedRows[0]?.compliesReporteInicial) ? 'CUMPLE' : 'INCUMPLE'}
                            </span>
                          </div>
                        </td>

                        {/* Total % Rep -3 Días */}
                        <td className="py-3.5 px-3 text-center border-l border-slate-700 bg-slate-950">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-sm font-black text-amber-300">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.pctRep3dias : displayedRows[0]?.pctRep3dias}%
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${
                              (selectedCentroFilter === 'TODOS' ? totalGeneral.compliesRep3dias : displayedRows[0]?.compliesRep3dias)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {(selectedCentroFilter === 'TODOS' ? totalGeneral.compliesRep3dias : displayedRows[0]?.compliesRep3dias) ? 'CUMPLE' : 'INCUMPLE'}
                            </span>
                          </div>
                        </td>

                        {/* Total % Rep -1 Día */}
                        <td className="py-3.5 px-3 text-center border-l border-slate-700 bg-slate-950">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-sm font-black text-amber-300">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.pctRep1dia : displayedRows[0]?.pctRep1dia}%
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${
                              (selectedCentroFilter === 'TODOS' ? totalGeneral.compliesRep1dia : displayedRows[0]?.compliesRep1dia)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {(selectedCentroFilter === 'TODOS' ? totalGeneral.compliesRep1dia : displayedRows[0]?.compliesRep1dia) ? 'CUMPLE' : 'INCUMPLE'}
                            </span>
                          </div>
                        </td>

                        {/* Total Demora Promedio */}
                        <td className="py-3.5 px-3 text-center border-l border-slate-700 bg-slate-950">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-sm font-black text-amber-300">
                              {selectedCentroFilter === 'TODOS' ? totalGeneral.demoraPromedio : displayedRows[0]?.demoraPromedio} hrs
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${
                              (selectedCentroFilter === 'TODOS' ? totalGeneral.compliesDemoraPromedio : displayedRows[0]?.compliesDemoraPromedio)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {(selectedCentroFilter === 'TODOS' ? totalGeneral.compliesDemoraPromedio : displayedRows[0]?.compliesDemoraPromedio) ? 'CUMPLE' : 'INCUMPLE'}
                            </span>
                          </div>
                        </td>

                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* 4 Interactive Daily Charts (One for each indicator) */}
            <div className={`space-y-4 transition-opacity duration-150 ${isSearchingDaily ? 'opacity-40' : hasPendingDailyChanges ? 'opacity-85' : 'opacity-100'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-black text-white">
                    Gráficos Comparativos Diarios por Centro vs Meta del Plan
                  </h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Selector de Tipo de Gráfica: Barras vs Área y Curva */}
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setDailyChartType('bar')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        dailyChartType === 'bar'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Barras</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyChartType('area')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        dailyChartType === 'area'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <AreaIcon className="w-3.5 h-3.5" />
                      <span>Área y Curva</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span>Cumple</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      <span>Incumple</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* Chart 1: Reporte Inicial */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                        <span>1. {customization.columnNames.reporteInicial || 'Reporte Inicial'} (%) por Centro</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Meta Plan: {planes.reporte_inicial.operator} {planes.reporte_inicial.targetValue}% (Verde = Cumple, Rojo = Incumple)
                      </p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {dailyChartType === 'bar' ? (
                        <BarChart data={displayedRows} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value}%`, customization.columnNames.reporteInicial || 'Reporte Inicial']}
                          />
                          <ReferenceLine
                            y={planes?.reporte_inicial?.targetValue ?? 2.5}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.reporte_inicial?.targetValue ?? 2.5}%`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Bar dataKey="reporteInicial" radius={[6, 6, 0, 0]}>
                            {(displayedRows || []).map((entry, index) => (
                              <Cell
                                key={`cell-rep-${index}`}
                                fill={entry.compliesReporteInicial ? COLOR_COMPLIANT : COLOR_BREACH}
                              />
                            ))}
                            <LabelList
                              dataKey="reporteInicial"
                              position="top"
                              fill="#f8fafc"
                              fontSize={10}
                              fontWeight="bold"
                              formatter={(value: any) => `${value}%`}
                            />
                          </Bar>
                        </BarChart>
                      ) : (
                        <AreaChart data={displayedRows} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <defs>
                            <linearGradient id="gradDailyRep1" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value}%`, customization.columnNames.reporteInicial || 'Reporte Inicial']}
                          />
                          <ReferenceLine
                            y={planes?.reporte_inicial?.targetValue ?? 2.5}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.reporte_inicial?.targetValue ?? 2.5}%`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="reporteInicial"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#gradDailyRep1)"
                            dot={(props: any) => {
                              const isCompliant = props.payload.compliesReporteInicial;
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={4.5}
                                  fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                  stroke="#0f172a"
                                  strokeWidth={2}
                                />
                              );
                            }}
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: % Reparadas -3 Días */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                        <span>2. {customization.columnNames.pctRep3dias || '% Reparadas -3 Días'} (%) por Centro</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Meta Plan: {planes?.rep_3dias?.operator || '>='} {planes?.rep_3dias?.targetValue ?? 85}% (Verde = Cumple, Rojo = Incumple)
                      </p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {dailyChartType === 'bar' ? (
                        <BarChart data={displayedRows || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value}%`, customization.columnNames.pctRep3dias || '% Rep -3 Días']}
                          />
                          <ReferenceLine
                            y={planes?.rep_3dias?.targetValue ?? 85}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.rep_3dias?.targetValue ?? 85}%`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Bar dataKey="pctRep3dias" radius={[6, 6, 0, 0]}>
                            {(displayedRows || []).map((entry, index) => (
                              <Cell
                                key={`cell-rep3-${index}`}
                                fill={entry.compliesRep3dias ? COLOR_COMPLIANT : COLOR_BREACH}
                              />
                            ))}
                            <LabelList
                              dataKey="pctRep3dias"
                              position="top"
                              fill="#f8fafc"
                              fontSize={10}
                              fontWeight="bold"
                              formatter={(value: any) => `${value}%`}
                            />
                          </Bar>
                        </BarChart>
                      ) : (
                        <AreaChart data={displayedRows || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <defs>
                            <linearGradient id="gradDailyRep3" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value}%`, customization.columnNames.pctRep3dias || '% Rep -3 Días']}
                          />
                          <ReferenceLine
                            y={planes?.rep_3dias?.targetValue ?? 85}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.rep_3dias?.targetValue ?? 85}%`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="pctRep3dias"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#gradDailyRep3)"
                            dot={(props: any) => {
                              const isCompliant = props.payload.compliesRep3dias;
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={4.5}
                                  fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                  stroke="#0f172a"
                                  strokeWidth={2}
                                />
                              );
                            }}
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: % Reparadas -1 Día */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                        <span>3. {customization.columnNames.pctRep1dia || '% Reparadas -1 Día'} (%) por Centro</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Meta Plan: {planes?.rep_1dia?.operator || '>='} {planes?.rep_1dia?.targetValue ?? 60}% (Verde = Cumple, Rojo = Incumple)
                      </p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {dailyChartType === 'bar' ? (
                        <BarChart data={displayedRows || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value}%`, customization.columnNames.pctRep1dia || '% Rep -1 Día']}
                          />
                          <ReferenceLine
                            y={planes?.rep_1dia?.targetValue ?? 60}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.rep_1dia?.targetValue ?? 60}%`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Bar dataKey="pctRep1dia" radius={[6, 6, 0, 0]}>
                            {(displayedRows || []).map((entry, index) => (
                              <Cell
                                key={`cell-rep1-${index}`}
                                fill={entry.compliesRep1dia ? COLOR_COMPLIANT : COLOR_BREACH}
                              />
                            ))}
                            <LabelList
                              dataKey="pctRep1dia"
                              position="top"
                              fill="#f8fafc"
                              fontSize={10}
                              fontWeight="bold"
                              formatter={(value: any) => `${value}%`}
                            />
                          </Bar>
                        </BarChart>
                      ) : (
                        <AreaChart data={displayedRows || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <defs>
                            <linearGradient id="gradDailyRep1dia" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value}%`, customization.columnNames.pctRep1dia || '% Rep -1 Día']}
                          />
                          <ReferenceLine
                            y={planes?.rep_1dia?.targetValue ?? 60}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.rep_1dia?.targetValue ?? 60}%`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="pctRep1dia"
                            stroke="#8b5cf6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#gradDailyRep1dia)"
                            dot={(props: any) => {
                              const isCompliant = props.payload.compliesRep1dia;
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={4.5}
                                  fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                  stroke="#0f172a"
                                  strokeWidth={2}
                                />
                              );
                            }}
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: Demora Promedio (DTR) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                        <span>4. {customization.columnNames.demoraPromedio || 'Demora Promedio'} (hrs) por Centro</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Meta Plan: {planes?.demora_promedio?.operator || '<='} {planes?.demora_promedio?.targetValue ?? 18} hrs (Verde = Cumple, Rojo = Incumple)
                      </p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {dailyChartType === 'bar' ? (
                        <BarChart data={displayedRows || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value} hrs`, customization.columnNames.demoraPromedio || 'Demora Promedio']}
                          />
                          <ReferenceLine
                            y={planes?.demora_promedio?.targetValue ?? 18}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.demora_promedio?.targetValue ?? 18} hrs`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Bar dataKey="demoraPromedio" radius={[6, 6, 0, 0]}>
                            {(displayedRows || []).map((entry, index) => (
                              <Cell
                                key={`cell-dem-${index}`}
                                fill={entry.compliesDemoraPromedio ? COLOR_COMPLIANT : COLOR_BREACH}
                              />
                            ))}
                            <LabelList
                              dataKey="demoraPromedio"
                              position="top"
                              fill="#f8fafc"
                              fontSize={10}
                              fontWeight="bold"
                              formatter={(value: any) => `${value}h`}
                            />
                          </Bar>
                        </BarChart>
                      ) : (
                        <AreaChart data={displayedRows || []} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <defs>
                            <linearGradient id="gradDailyDem" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="centroName"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any) => [`${value} hrs`, customization.columnNames.demoraPromedio || 'Demora Promedio']}
                          />
                          <ReferenceLine
                            y={planes?.demora_promedio?.targetValue ?? 18}
                            stroke={COLOR_PLAN_LINE}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{ value: `Meta: ${planes?.demora_promedio?.targetValue ?? 18} hrs`, fill: COLOR_PLAN_LINE, fontSize: 10, position: 'top' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="demoraPromedio"
                            stroke="#f59e0b"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#gradDailyDem)"
                            dot={(props: any) => {
                              const isCompliant = props.payload.compliesDemoraPromedio;
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={4.5}
                                  fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                  stroke="#0f172a"
                                  strokeWidth={2}
                                />
                              );
                            }}
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>

            {/* ======================================================== */}
            {/* NUEVA SECCIÓN: ANÁLISIS VISUAL MULTIDIMENSIONAL (SUBTAB 1)*/}
            {/* RADAR, CORRELACIÓN OPERATIVA Y DISTRIBUCIÓN DE CARGA     */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg">
                      <Compass className="w-4 h-4" />
                    </span>
                    <h3 className="text-base font-black text-white">
                      Análisis Visual Multidimensional y de Correlación Operativa
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Explore el comportamiento de la red a través de múltiples modelos visuales: radar multidimensional, correlación volumen-calidad y distribución.
                  </p>
                </div>

                {/* Subtab 1 Advanced Perspectives Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDailyAdvancedTab('radar')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dailyAdvancedTab === 'radar'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Radar de Rendimiento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDailyAdvancedTab('composed')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dailyAdvancedTab === 'composed'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Correlación Volumen-Calidad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDailyAdvancedTab('distribution')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dailyAdvancedTab === 'distribution'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <PieIcon className="w-3.5 h-3.5" />
                    <span>Distribución y Balance</span>
                  </button>
                </div>
              </div>

              {/* View 1: Radar Multidimensional */}
              {dailyAdvancedTab === 'radar' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  
                  {/* Left Column: Radar Chart */}
                  <div className={`lg:col-span-7 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center transition-opacity duration-150 ${isSearchingRadar ? 'opacity-40' : hasPendingRadarChanges ? 'opacity-85' : 'opacity-100'}`}>
                    
                    <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800/80 flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <Compass className="w-4 h-4 text-blue-400" />
                        <span>Polígono de Desempeño en los 4 Ejes (Escala % Normalizada al Plan)</span>
                      </span>

                      {/* Centro Filter for Radar with 🔎 Buscar and ↺ Restablecer */}
                      <div className="flex items-center space-x-1.5" onKeyDown={(e) => { if (e.key === 'Enter') handleApplyRadarSearch(); }}>
                        <label className="text-[11px] font-bold text-slate-400">Centro:</label>
                        <select
                          value={draftRadarCentro}
                          onChange={(e) => setDraftRadarCentro(e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                        >
                          <option value="TOTAL">TOTAL GENERAL</option>
                          {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={handleApplyRadarSearch}
                          disabled={isSearchingRadar}
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 ${
                            hasPendingRadarChanges
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-500/25 animate-pulse'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                          }`}
                          title="🔎 Buscar y actualizar radar (Atajo: Presione Enter)"
                        >
                          {isSearchingRadar ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          <span>Buscar</span>
                          {hasPendingRadarChanges && (
                            <span className="px-1 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded-full uppercase">
                              Pendiente
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleResetRadarSearch}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all border border-slate-700 cursor-pointer"
                          title="Restablecer a TOTAL GENERAL"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={dailyRadarData}>
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis
                            dataKey="shortName"
                            stroke="#94a3b8"
                            tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            stroke="#475569"
                            tick={{ fill: '#64748b', fontSize: 9 }}
                          />
                          <Radar
                            name="Meta del Plan (100%)"
                            dataKey="target"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.12}
                            strokeDasharray="4 4"
                          />
                          <Radar
                            name="Desempeño Real"
                            dataKey="score"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.35}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: any, name: any, item: any) => [
                              `${value}% de efectividad (Real: ${item.payload.actualVal} vs Meta: ${item.payload.targetVal})`,
                              name
                            ]}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                  </div>

                  {/* Right Column: Scorecard Details */}
                  <div className="lg:col-span-5 space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      Diagnóstico del Centro Seleccionado ({dailyRadarCentro === 'TOTAL' ? 'Total General' : centros.find(c => c.id === dailyRadarCentro)?.name || dailyRadarCentro})
                    </h4>

                    <div className="space-y-2.5">
                      {dailyRadarData.map(item => (
                        <div key={item.indicator} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs text-white flex items-center space-x-1.5">
                              <span>{item.indicator}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Real: <strong className="text-slate-200">{item.actualVal}</strong> | Meta: <strong className="text-amber-400">{item.targetVal}</strong>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block ${
                              item.complies
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {item.complies ? 'CUMPLE' : 'INCUMPLE'}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {item.score}% efectividad
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                      💡 <strong>Interpretación:</strong> La línea punteada ámbar representa el 100% de la meta planificada. Los vértices verdes que cubran o superen el contorno ámbar señalan cumplimiento operativo de calidad.
                    </p>
                  </div>

                </div>
              )}

              {/* View 2: Correlación Volumen vs Calidad */}
              {dailyAdvancedTab === 'composed' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>Gráfico Mixto: Volumen Operativo (Barras) vs Eficiencia de Calidad (Línea)</span>
                    </span>

                    <div className="flex items-center space-x-2">
                      <label className="text-xs font-bold text-slate-400">Evaluar Línea con:</label>
                      <select
                        value={dailyComposedMetric}
                        onChange={(e) => setDailyComposedMetric(e.target.value as any)}
                        className="bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="rep_3dias">2. % Reparadas -3 Días</option>
                        <option value="demora_promedio">4. Demora Promedio (hrs)</option>
                      </select>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={indicatorRows} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="centroName"
                          stroke="#64748b"
                          fontSize={9}
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#818cf8"
                          fontSize={10}
                          domain={[0, 'auto']}
                          label={{ value: 'Volumen Averías (RER)', angle: -90, position: 'insideLeft', fill: '#818cf8', fontSize: 10 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#10b981"
                          fontSize={10}
                          domain={[0, dailyComposedMetric === 'rep_3dias' ? 100 : 'auto']}
                          label={{ value: dailyComposedMetric === 'rep_3dias' ? '% Rep -3d' : 'Demora (hrs)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar
                          yAxisId="left"
                          dataKey="rer"
                          name="Averías Reparadas Equiv. (RER)"
                          fill="#6366f1"
                          radius={[5, 5, 0, 0]}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={dailyComposedMetric === 'rep_3dias' ? 'pctRep3dias' : 'demoraPromedio'}
                          name={dailyComposedMetric === 'rep_3dias' ? '% Rep -3 Días' : 'Demora Promedio (hrs)'}
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#10b981' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* View 3: Distribución de Averías y Balance de Carga */}
              {dailyAdvancedTab === 'distribution' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  
                  {/* Donut 1: Averías distribution */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-300 w-full pb-2 border-b border-slate-800/80 flex items-center space-x-1.5">
                      <PieIcon className="w-4 h-4 text-emerald-400" />
                      <span>Distribución de Averías (RER) por Centro Telefónico</span>
                    </span>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dailyDistributionRER}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {dailyDistributionRER.map((entry, index) => (
                              <Cell key={`cell-rer-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(val: any, name: any, item: any) => [`${val} averías (${item.payload.percentage}%)`, name]}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Donut 2 / Compliance breakdown summary */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-300 pb-2 border-b border-slate-800/80 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span>Tasa de Centros en Cumplimiento por Indicador ({indicatorRows.length} centros)</span>
                    </span>

                    <div className="space-y-3 pt-1">
                      {dailyComplianceDonut.map(item => (
                        <div key={item.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{item.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.ok} de {indicatorRows.length} centros
                              </span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                item.complies
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {item.rate}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-500"
                              style={{ width: `${item.rate}%` }}
                            ></div>
                            <div
                              className="bg-rose-500 h-full transition-all duration-500"
                              style={{ width: `${100 - +item.rate}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-center space-x-4 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <span className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Centros que Cumplen</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                        <span>Centros que Incumplen</span>
                      </span>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* ======================================================== */}
            {/* GRÁFICO 5: EVOLUCIÓN DIARIA DÍA POR DÍA HASTA HOY       */}
            {/* CON SUS FILTROS PROPIOS: CENTRO TELEFÓNICO E INDICADOR    */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <h3 className="text-base font-black text-white">
                      5. Evolución Diaria del Indicador por Centro (Día por Día hasta la Fecha Actual)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Histórico cronológico día a día para el centro e indicador seleccionados vs meta del plan (Verde = Cumple, Rojo = Incumple).
                  </p>
                </div>

                {/* Dedicated Filters for this chart only with 🔎 Buscar and ↺ Restablecer */}
                <div
                  className="flex flex-wrap items-center gap-2.5"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApplyHistorySearch(); }}
                >
                  
                  {/* Filter 1: Centro Telefónico */}
                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Centro:</label>
                    <select
                      value={draftHistoryChartCentro}
                      onChange={(e) => setDraftHistoryChartCentro(e.target.value)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="TOTAL" className="bg-slate-900 text-white">TOTAL GENERAL</option>
                      {centros.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 2: Indicador */}
                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
                    <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Indicador:</label>
                    <select
                      value={draftHistoryChartIndicator}
                      onChange={(e) => setDraftHistoryChartIndicator(e.target.value as any)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="reporte_inicial" className="bg-slate-900 text-white">1. {customization.columnNames.reporteInicial || 'Reporte Inicial'}</option>
                      <option value="rep_3dias" className="bg-slate-900 text-white">2. {customization.columnNames.pctRep3dias || '% Rep -3 Días'}</option>
                      <option value="rep_1dia" className="bg-slate-900 text-white">3. {customization.columnNames.pctRep1dia || '% Rep -1 Día'}</option>
                      <option value="demora_promedio" className="bg-slate-900 text-white">4. {customization.columnNames.demoraPromedio || 'Demora Promedio'}</option>
                    </select>
                  </div>

                  {/* BOTÓN 🔎 Buscar y ↺ Restablecer para Gráfico 5 */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleApplyHistorySearch}
                      disabled={isSearchingHistory}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 ${
                        hasPendingHistoryChanges
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-500/25 animate-pulse'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                      }`}
                      title="🔎 Buscar y actualizar evolución histórica (Atajo: Presione Enter)"
                    >
                      {isSearchingHistory ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Buscar</span>
                      {hasPendingHistoryChanges && (
                        <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded-full uppercase tracking-wider">
                          Pendiente
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleResetHistorySearch}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 cursor-pointer"
                      title="Restablecer filtros del gráfico 5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>

              {/* Summary KPIs for this specific chart */}
              {historyDailyChartData.length > 0 && (() => {
                const totalDays = historyDailyChartData.length;
                const compliantDays = historyDailyChartData.filter(d => d.complies).length;
                const breachDays = totalDays - compliantDays;
                const complianceRate = totalDays > 0 ? ((compliantDays / totalDays) * 100).toFixed(1) : '0';
                const avgVal = totalDays > 0 ? (historyDailyChartData.reduce((acc, d) => acc + d.value, 0) / totalDays).toFixed(2) : '0';

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Días Analizados</span>
                      <strong className="text-base font-black text-white font-mono">{totalDays}</strong>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-2xl border border-emerald-500/30 text-center">
                      <span className="text-[10px] text-emerald-400 uppercase font-bold block">Días Cumplidos</span>
                      <strong className="text-base font-black text-emerald-400 font-mono">{compliantDays}</strong>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-2xl border border-rose-500/30 text-center">
                      <span className="text-[10px] text-rose-400 uppercase font-bold block">Días Incumplidos</span>
                      <strong className="text-base font-black text-rose-400 font-mono">{breachDays}</strong>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Tasa Cumplimiento</span>
                      <strong className="text-base font-black text-blue-400 font-mono">{complianceRate}%</strong>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Promedio Período</span>
                      <strong className="text-base font-black text-amber-300 font-mono">{avgVal} {currentIndicatorConfig.unit}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Day by Day Bar Chart */}
              {historyDailyChartData.length > 0 ? (
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyDailyChartData} margin={{ top: 20, right: 15, left: -15, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="shortDate"
                        stroke="#64748b"
                        fontSize={10}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={10}
                        domain={[0, currentIndicatorConfig.unit === '%' ? (dataMax: number) => Math.max(100, Math.ceil(dataMax * 1.1)) : 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                        formatter={(val: any, _name: any, item: any) => {
                          const p = item.payload;
                          return [
                            `${val} ${p.unit} (${p.complies ? 'CUMPLE' : 'INCUMPLE'}) [Meta: ${p.operator} ${p.targetVal}${p.unit}]`,
                            `${currentIndicatorConfig.title}`
                          ];
                        }}
                        labelFormatter={(_label: any, items: any[]) => {
                          const full = items?.[0]?.payload?.fullDate;
                          const cName = items?.[0]?.payload?.centroName;
                          return `Fecha: ${full || _label} • Centro: ${cName || ''}`;
                        }}
                      />
                      <ReferenceLine
                        y={historyDailyChartData[0]?.targetVal ?? currentIndicatorConfig.plan?.targetValue ?? 0}
                        stroke={COLOR_PLAN_LINE}
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{
                          value: `Meta: ${historyDailyChartData[0]?.operator || '<='} ${historyDailyChartData[0]?.targetVal ?? currentIndicatorConfig.plan?.targetValue ?? 0}${currentIndicatorConfig.unit}`,
                          fill: COLOR_PLAN_LINE,
                          fontSize: 10,
                          position: 'top'
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {historyDailyChartData.map((entry, index) => (
                          <Cell
                            key={`cell-hist-${index}`}
                            fill={entry.complies ? COLOR_COMPLIANT : COLOR_BREACH}
                          />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="top"
                          fill="#f8fafc"
                          fontSize={10}
                          fontWeight="bold"
                          formatter={(v: any) => `${v}${currentIndicatorConfig.unit === '%' ? '%' : 'h'}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="bg-slate-950 rounded-2xl p-8 text-center text-slate-500 border border-slate-800 text-xs">
                  No hay registros diarios históricos guardados hasta hoy para este centro. Presione "Guardar" en la tabla superior para añadir días al histórico.
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="font-bold text-slate-300">Verde: Cumple el Plan</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                  <span className="font-bold text-slate-300">Rojo: Incumple el Plan</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-5 h-0.5 bg-amber-400 inline-block"></span>
                  <span className="font-bold text-slate-300">Línea Ámbar: Meta del Plan</span>
                </span>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* SUBTAB 2: ACUMULADO Y GRÁFICOS MENSUALES                 */}
        {/* ======================================================== */}
        {activeSubTab === 'mensual' && (
          <div className="space-y-6">
            
            {/* Filter Bar: Month & Centro Telefónico */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Histórico y Comportamiento Mensual de Indicadores
                  </h3>
                  <p className="text-xs text-slate-400">
                    Filtre por mes y por centro telefónico para consultar los días guardados, evolución y gráficas de cumplimiento.
                  </p>
                </div>
              </div>

              <div
                className="flex flex-wrap items-center gap-3"
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyMonthlySearch(); }}
              >
                {/* Filter 1: Mes */}
                <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 shadow-inner">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <label className="text-xs font-bold text-slate-400 whitespace-nowrap">Mes:</label>
                  <select
                    value={draftMonthFilter}
                    onChange={(e) => setDraftMonthFilter(e.target.value)}
                    className="bg-slate-950 text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    {(availableMonths || []).map(m => (
                      <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                    ))}
                  </select>
                </div>

                {/* Filter 2: Centro Telefónico */}
                <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 shadow-inner">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <label className="text-xs font-bold text-slate-400 whitespace-nowrap">Centro:</label>
                  <select
                    value={draftMonthlyCentroFilter}
                    onChange={(e) => setDraftMonthlyCentroFilter(e.target.value)}
                    className="bg-slate-950 text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[210px] truncate"
                  >
                    <option value="TOTAL" className="bg-slate-900 text-white">TOTAL GENERAL</option>
                    {monthlyAvailableCentros.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* BOTÓN 🔎 Buscar y ↺ Restablecer para Subpestaña 2 */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleApplyMonthlySearch}
                    disabled={isSearchingMonthly}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer shadow-lg active:scale-95 ${
                      hasPendingMonthlyChanges
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-500/25 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    }`}
                    title="🔎 Buscar y actualizar datos mensuales y gráficos (Atajo: Presione Enter)"
                  >
                    {isSearchingMonthly ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Search className="w-4 h-4 text-white" />
                    )}
                    <span>Buscar</span>
                    {hasPendingMonthlyChanges && (
                      <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                        Pendiente
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetMonthlySearch}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 cursor-pointer shadow-sm"
                    title="Restablecer filtros al mes actual y TOTAL GENERAL"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>

            {/* 4 Monthly Trend Charts */}
            {monthlyTrendData.length > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      Evolución Diaria del Mes ({selectedMonthFilter}) vs Plan
                    </span>
                    <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-[11px] font-bold">
                      {currentMonthlyCentroName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Selector de Tipo de Gráfica: Líneas vs Áreas vs Barras */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setMonthlyChartType('line')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          monthlyChartType === 'line'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <LineIcon className="w-3.5 h-3.5" />
                        <span>Líneas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonthlyChartType('area')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          monthlyChartType === 'area'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <AreaIcon className="w-3.5 h-3.5" />
                        <span>Áreas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonthlyChartType('bar')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          monthlyChartType === 'bar'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Barras</span>
                      </button>
                    </div>

                    <span className="text-xs text-slate-500">
                      {monthlyTrendData.length} {monthlyTrendData.length === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                </div>

                {/* Monthly Summary Metric Cards for Selected Centro & Month */}
                {monthlySummaryStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Promedio Reporte Inicial
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black font-mono text-white">
                          {monthlySummaryStats.avgRepInicial}%
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          monthlySummaryStats.avgRepInicial <= planes.reporte_inicial.targetValue
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          Meta {planes.reporte_inicial.operator} {planes.reporte_inicial.targetValue}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Promedio % Rep -3 Días
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black font-mono text-white">
                          {monthlySummaryStats.avgRep3dias}%
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          monthlySummaryStats.avgRep3dias >= planes.rep_3dias.targetValue
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          Meta {planes.rep_3dias.operator} {planes.rep_3dias.targetValue}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Promedio % Rep -1 Día
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black font-mono text-white">
                          {monthlySummaryStats.avgRep1dia}%
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          monthlySummaryStats.avgRep1dia >= planes.rep_1dia.targetValue
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          Meta {planes.rep_1dia.operator} {planes.rep_1dia.targetValue}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Promedio Demora Diaria
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black font-mono text-white">
                          {monthlySummaryStats.avgDemora} hrs
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          monthlySummaryStats.avgDemora <= planes.demora_promedio.targetValue
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          Meta {planes.demora_promedio.operator} {planes.demora_promedio.targetValue}h
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* Monthly Chart 1: Reporte Inicial */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-white">1. Reporte Inicial Diario (%)</h4>
                        <p className="text-[11px] text-slate-400">
                          Meta Plan: {planes.reporte_inicial.operator} {planes.reporte_inicial.targetValue}%
                        </p>
                      </div>
                    </div>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {monthlyChartType === 'line' ? (
                          <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, 'Reporte Inicial']}
                            />
                            <ReferenceLine
                              y={planes.reporte_inicial.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.reporte_inicial.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="reporteInicial"
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesReporteInicial;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </LineChart>
                        ) : monthlyChartType === 'area' ? (
                          <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="gradMonthRep1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, 'Reporte Inicial']}
                            />
                            <ReferenceLine
                              y={planes.reporte_inicial.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.reporte_inicial.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="reporteInicial"
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#gradMonthRep1)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesReporteInicial;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, 'Reporte Inicial']}
                            />
                            <ReferenceLine
                              y={planes.reporte_inicial.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.reporte_inicial.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Bar dataKey="reporteInicial" radius={[4, 4, 0, 0]}>
                              {monthlyTrendData.map((entry, idx) => (
                                <Cell
                                  key={`b-m1-${idx}`}
                                  fill={entry.compliesReporteInicial ? COLOR_COMPLIANT : COLOR_BREACH}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly Chart 2: % Rep -3 Días */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-white">2. % Reparadas -3 Días Diario (%)</h4>
                        <p className="text-[11px] text-slate-400">
                          Meta Plan: {planes.rep_3dias.operator} {planes.rep_3dias.targetValue}%
                        </p>
                      </div>
                    </div>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {monthlyChartType === 'line' ? (
                          <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, '% Rep -3 Días']}
                            />
                            <ReferenceLine
                              y={planes.rep_3dias.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.rep_3dias.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="pctRep3dias"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesRep3dias;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </LineChart>
                        ) : monthlyChartType === 'area' ? (
                          <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="gradMonthRep3" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, '% Rep -3 Días']}
                            />
                            <ReferenceLine
                              y={planes.rep_3dias.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.rep_3dias.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="pctRep3dias"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#gradMonthRep3)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesRep3dias;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, '% Rep -3 Días']}
                            />
                            <ReferenceLine
                              y={planes.rep_3dias.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.rep_3dias.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Bar dataKey="pctRep3dias" radius={[4, 4, 0, 0]}>
                              {monthlyTrendData.map((entry, idx) => (
                                <Cell
                                  key={`b-m2-${idx}`}
                                  fill={entry.compliesRep3dias ? COLOR_COMPLIANT : COLOR_BREACH}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly Chart 3: % Rep -1 Día */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-white">3. % Reparadas -1 Día Diario (%)</h4>
                        <p className="text-[11px] text-slate-400">
                          Meta Plan: {planes.rep_1dia.operator} {planes.rep_1dia.targetValue}%
                        </p>
                      </div>
                    </div>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {monthlyChartType === 'line' ? (
                          <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, '% Rep -1 Día']}
                            />
                            <ReferenceLine
                              y={planes.rep_1dia.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.rep_1dia.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="pctRep1dia"
                              stroke="#8b5cf6"
                              strokeWidth={2.5}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesRep1dia;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </LineChart>
                        ) : monthlyChartType === 'area' ? (
                          <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="gradMonthRep1dia" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, '% Rep -1 Día']}
                            />
                            <ReferenceLine
                              y={planes.rep_1dia.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.rep_1dia.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="pctRep1dia"
                              stroke="#8b5cf6"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#gradMonthRep1dia)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesRep1dia;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value}%`, '% Rep -1 Día']}
                            />
                            <ReferenceLine
                              y={planes.rep_1dia.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.rep_1dia.targetValue}%`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Bar dataKey="pctRep1dia" radius={[4, 4, 0, 0]}>
                              {monthlyTrendData.map((entry, idx) => (
                                <Cell
                                  key={`b-m3-${idx}`}
                                  fill={entry.compliesRep1dia ? COLOR_COMPLIANT : COLOR_BREACH}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly Chart 4: Demora Promedio */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-white">4. Demora Promedio Diaria (hrs)</h4>
                        <p className="text-[11px] text-slate-400">
                          Meta Plan: {planes.demora_promedio.operator} {planes.demora_promedio.targetValue} hrs
                        </p>
                      </div>
                    </div>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {monthlyChartType === 'line' ? (
                          <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value} hrs`, 'Demora Promedio']}
                            />
                            <ReferenceLine
                              y={planes.demora_promedio.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.demora_promedio.targetValue} hrs`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="demoraPromedio"
                              stroke="#f59e0b"
                              strokeWidth={2.5}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesDemoraPromedio;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </LineChart>
                        ) : monthlyChartType === 'area' ? (
                          <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="gradMonthDem" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value} hrs`, 'Demora Promedio']}
                            />
                            <ReferenceLine
                              y={planes.demora_promedio.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.demora_promedio.targetValue} hrs`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="demoraPromedio"
                              stroke="#f59e0b"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#gradMonthDem)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isCompliant = payload.compliesDemoraPromedio;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={isCompliant ? COLOR_COMPLIANT : COLOR_BREACH}
                                    stroke="#0f172a"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any) => [`${value} hrs`, 'Demora Promedio']}
                            />
                            <ReferenceLine
                              y={planes.demora_promedio.targetValue}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{ value: `Meta ${planes.demora_promedio.targetValue} hrs`, fill: COLOR_PLAN_LINE, fontSize: 10 }}
                            />
                            <Bar dataKey="demoraPromedio" radius={[4, 4, 0, 0]}>
                              {monthlyTrendData.map((entry, idx) => (
                                <Cell
                                  key={`b-m4-${idx}`}
                                  fill={entry.compliesDemoraPromedio ? COLOR_COMPLIANT : COLOR_BREACH}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                <Info className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="font-extrabold text-white text-base">
                  No hay registros guardados para {currentMonthlyCentroName} en el mes {selectedMonthFilter}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  En la subpestaña <strong>1. Análisis Diario</strong>, calcule los indicadores de una fecha y presione el botón <strong>"Guardar en Mensual"</strong> para alimentarlo.
                </p>
              </div>
            )}

            {/* ======================================================== */}
            {/* NUEVA SECCIÓN: ANÁLISIS VISUAL ESTRATÉGICO MENSUAL      */}
            {/* RANKING DE CENTROS, DONUTS DE CUMPLIMIENTO Y CORRELACIÓN*/}
            {/* ======================================================== */}
            {monthlyFilteredRecords.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg">
                        <Award className="w-4 h-4" />
                      </span>
                      <h3 className="text-base font-black text-white">
                        Perspectivas y Análisis Visual Estratégico del Mes ({selectedMonthFilter})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Visualice el ranking acumulado de centros, la tasa global de éxito de días en donuts y la correlación operativa diaria.
                    </p>
                  </div>

                  {/* Subtab 2 Advanced Perspectives Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setMonthlyAdvancedTab('ranking')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        monthlyAdvancedTab === 'ranking'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Ranking de Centros</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMonthlyAdvancedTab('donuts')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        monthlyAdvancedTab === 'donuts'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <PieIcon className="w-3.5 h-3.5" />
                      <span>Donuts de Cumplimiento</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMonthlyAdvancedTab('composed')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        monthlyAdvancedTab === 'composed'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Correlación Diaria Mixta</span>
                    </button>
                  </div>
                </div>

                {/* Perspective 1: Ranking Comparativo de Centros */}
                {monthlyAdvancedTab === 'ranking' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <Award className="w-4 h-4 text-purple-400" />
                        <span>Promedio Acumulado Mensual por Centro (Ordenado por Desempeño vs Meta)</span>
                      </span>

                      {/* Indicator Selector */}
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-slate-400">Indicador:</label>
                        <select
                          value={monthlyRankingIndicator}
                          onChange={(e) => setMonthlyRankingIndicator(e.target.value as any)}
                          className="bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                        >
                          <option value="rep_3dias">2. {customization.columnNames.pctRep3dias || '% Rep -3 Días'}</option>
                          <option value="rep_1dia">3. {customization.columnNames.pctRep1dia || '% Rep -1 Día'}</option>
                          <option value="reporte_inicial">1. {customization.columnNames.reporteInicial || 'Reporte Inicial'}</option>
                          <option value="demora_promedio">4. {customization.columnNames.demoraPromedio || 'Demora Promedio'}</option>
                        </select>
                      </div>
                    </div>

                    {monthlyCentrosRanking.length > 0 ? (
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyCentrosRanking} margin={{ top: 20, right: 15, left: -10, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis
                              dataKey="name"
                              stroke="#64748b"
                              fontSize={9}
                              angle={-25}
                              textAnchor="end"
                              interval={0}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={10}
                              domain={[0, monthlyCentrosRanking[0]?.unit === '%' ? 100 : 'auto']}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: any, _name: any, item: any) => [
                                `${value}${item.payload.unit} (Promedio de ${item.payload.days} días) [${item.payload.complies ? 'CUMPLE' : 'INCUMPLE'}]`,
                                'Promedio Mensual'
                              ]}
                            />
                            <ReferenceLine
                              y={monthlyCentrosRanking[0]?.targetVal ?? 0}
                              stroke={COLOR_PLAN_LINE}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{
                                value: `Meta: ${monthlyCentrosRanking[0]?.targetVal}${monthlyCentrosRanking[0]?.unit}`,
                                fill: COLOR_PLAN_LINE,
                                fontSize: 10,
                                position: 'top'
                              }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                              {monthlyCentrosRanking.map((entry, index) => (
                                <Cell
                                  key={`cell-rank-${index}`}
                                  fill={entry.complies ? COLOR_COMPLIANT : COLOR_BREACH}
                                />
                              ))}
                              <LabelList
                                dataKey="value"
                                position="top"
                                fill="#f8fafc"
                                fontSize={10}
                                fontWeight="bold"
                                formatter={(val: any) => `${val}${monthlyCentrosRanking[0]?.unit === '%' ? '%' : 'h'}`}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No hay suficientes datos desglosados por centro para calcular el ranking de este mes.
                      </div>
                    )}
                  </div>
                )}

                {/* Perspective 2: Donuts de Cumplimiento Mensual */}
                {monthlyAdvancedTab === 'donuts' && monthlyDonutsData && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <PieIcon className="w-4 h-4 text-emerald-400" />
                        <span>Tasa de Días Cumplidos vs Incumplidos en el Mes ({currentMonthlyCentroName})</span>
                      </span>
                      <span className="text-xs text-slate-400">
                        {monthlyDonutsData.totalDays} {monthlyDonutsData.totalDays === 1 ? 'día registrado' : 'días registrados'} en {selectedMonthFilter}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { key: 'repInicial', item: monthlyDonutsData.reporteInicial, meta: `${planes.reporte_inicial.operator} ${planes.reporte_inicial.targetValue}%` },
                        { key: 'rep3dias', item: monthlyDonutsData.rep3dias, meta: `${planes.rep_3dias.operator} ${planes.rep_3dias.targetValue}%` },
                        { key: 'rep1dia', item: monthlyDonutsData.rep1dia, meta: `${planes.rep_1dia.operator} ${planes.rep_1dia.targetValue}%` },
                        { key: 'demora', item: monthlyDonutsData.demora, meta: `${planes.demora_promedio.operator} ${planes.demora_promedio.targetValue}h` },
                      ].map(d => (
                        <div key={d.key} className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center space-y-2">
                          <div className="text-center">
                            <h5 className="font-extrabold text-xs text-white">{d.item.name}</h5>
                            <span className="text-[10px] text-amber-400 font-bold block">Meta: {d.meta}</span>
                          </div>

                          <div className="h-40 w-full relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={d.item.data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={42}
                                  outerRadius={62}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  {d.item.data.map((entry, i) => (
                                    <Cell key={`cell-d-${i}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                                  formatter={(val: any, name: any) => [`${val} días (${Math.round((val / monthlyDonutsData.totalDays) * 100)}%)`, name]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center percentage label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className={`text-base font-black font-mono ${
                                d.item.rate >= 80 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {d.item.rate}%
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Éxito</span>
                            </div>
                          </div>

                          <div className="w-full flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                            <span className="text-emerald-400 font-bold">✓ {d.item.ok} cumplidos</span>
                            <span className="text-rose-400 font-bold">✕ {d.item.breach} fallidos</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Perspective 3: Correlación Diaria Mixta */}
                {monthlyAdvancedTab === 'composed' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>Evolución Diaria: Volumen de Averías (Barras) vs Eficiencia de Calidad (Línea)</span>
                      </span>

                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-slate-400">Evaluar Línea con:</label>
                        <select
                          value={monthlyComposedMetric}
                          onChange={(e) => setMonthlyComposedMetric(e.target.value as any)}
                          className="bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                        >
                          <option value="rep_3dias">2. % Reparadas -3 Días</option>
                          <option value="demora_promedio">4. Demora Promedio (hrs)</option>
                        </select>
                      </div>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyComposedData} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                          <YAxis
                            yAxisId="left"
                            stroke="#818cf8"
                            fontSize={10}
                            domain={[0, 'auto']}
                            label={{ value: 'Volumen RER', angle: -90, position: 'insideLeft', fill: '#818cf8', fontSize: 10 }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#10b981"
                            fontSize={10}
                            domain={[0, monthlyComposedMetric === 'rep_3dias' ? 100 : 'auto']}
                            label={{ value: monthlyComposedMetric === 'rep_3dias' ? '% Rep -3d' : 'Demora (hrs)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 10 }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar
                            yAxisId="left"
                            dataKey="rer"
                            name="Averías Reparadas Equiv. (RER)"
                            fill="#818cf8"
                            radius={[4, 4, 0, 0]}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey={monthlyComposedMetric === 'rep_3dias' ? 'rep3dias' : 'demora'}
                            name={monthlyComposedMetric === 'rep_3dias' ? '% Reparadas -3 Días' : 'Demora Promedio (hrs)'}
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#10b981' }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* List of Saved Daily Records Table */}
            {monthlyFilteredRecords.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">
                      Registros Diarios Guardados en {selectedMonthFilter}
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Mostrando datos de: <strong className="text-white">{currentMonthlyCentroName}</strong></span>
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                    {monthlyTrendData.length} {monthlyTrendData.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-3 text-center">{customization.columnNames.ls || 'Técnica (LS)'}</th>
                        <th className="py-3 px-3 text-center">{customization.columnNames.rer || 'RER'}</th>
                        <th className="py-3 px-3 text-center">{customization.columnNames.reporteInicial || 'Reporte Inicial'}</th>
                        <th className="py-3 px-3 text-center">{customization.columnNames.pctRep3dias || '% Rep -3 Días'}</th>
                        <th className="py-3 px-3 text-center">{customization.columnNames.pctRep1dia || '% Rep -1 Día'}</th>
                        <th className="py-3 px-3 text-center">{customization.columnNames.demoraPromedio || 'Demora Promedio'}</th>
                        <th className="py-3 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {(monthlyFilteredRecords || []).map(rec => {
                        const targetRow = selectedMonthlyCentroFilter === 'TOTAL'
                          ? rec.totalGeneral
                          : (rec.rows || []).find(r => r.centroId === selectedMonthlyCentroFilter);

                        if (!targetRow) return null;

                        return (
                          <tr key={rec.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                              {rec.date}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {targetRow.ls.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-purple-300 font-bold">
                              {targetRow.rer}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`font-mono font-bold ${
                                targetRow.compliesReporteInicial ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {targetRow.reporteInicial}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`font-mono font-bold ${
                                targetRow.compliesRep3dias ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {targetRow.pctRep3dias}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`font-mono font-bold ${
                                targetRow.compliesRep1dia ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {targetRow.pctRep1dia}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`font-mono font-bold ${
                                targetRow.compliesDemoraPromedio ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {targetRow.demoraPromedio} hrs
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteHistoryRecord(rec.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        )}

      </main>

      {/* Centros, Planes & Formulas Modal */}
      <CentrosPlanesModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        centros={centros}
        planes={planes}
        customization={customization}
        initialTab={configModalTab}
        onSaveCentros={(updated) => {
          setCentros(updated);
          saveCentrosTelefonicos(updated);
        }}
        onSavePlanes={(updated) => {
          setPlanes(updated);
          savePlanesCalidad(updated);
        }}
        onSaveCustomization={(updated) => {
          setCustomization(updated);
          saveQualityCustomization(updated);
        }}
      />

    </div>
  );
};
