import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList
} from 'recharts';
import {
  TrendingUp, TrendingDown, Calendar, Filter, BarChart3, LineChart as LineChartIcon,
  AreaChart as AreaChartIcon, PieChart as PieChartIcon, CheckCircle2, AlertTriangle,
  Building2, Users, Table, RefreshCw, ArrowUpRight, ArrowDownRight, Minus, Sparkles
} from 'lucide-react';
import { Central, WorkGroup, DailyReport, RepairRecord } from '../types';
import {
  getTodayStr, formatDateShort, getAvailableWeeks, getAvailableMonths,
  MONTH_NAMES_ES
} from '../utils/dateUtils';
import { CopyTableButton, CopyImageButton } from './CopyButton';

interface ComparativeTrendsDashboardProps {
  reports: DailyReport[];
  repairRecords: RepairRecord[];
  centrales: Central[];
  workGroups: WorkGroup[];
  isDarkMode?: boolean;
}

type PeriodType = 'days' | 'weeks' | 'months';
type ChartType = 'bar_grouped' | 'bar_stacked' | 'line' | 'area';

export const ComparativeTrendsDashboard: React.FC<ComparativeTrendsDashboardProps> = ({
  reports,
  repairRecords,
  centrales,
  workGroups,
  isDarkMode = true
}) => {
  const todayStr = getTodayStr();

  // 1. Controls
  const [periodType, setPeriodType] = useState<PeriodType>('weeks');
  const [numPeriods, setNumPeriods] = useState<number>(4); // 2, 3, 4, 5, 6
  const [selectedCentralFilter, setSelectedCentralFilter] = useState<string>('all');
  const [selectedWorkGroupFilter, setSelectedWorkGroupFilter] = useState<string>('all');
  const [chartType, setChartType] = useState<ChartType>('bar_grouped');
  const [showValuesOnBars, setShowValuesOnBars] = useState<boolean>(true);

  // Filter out any temporary central created as cnt_temp_
  const validCentrales = useMemo(() => {
    return centrales.filter(c =>
      !c.id.toLowerCase().includes('cnt_temp_') &&
      !c.code.toLowerCase().includes('cnt_temp_') &&
      !c.name.toLowerCase().includes('cnt_temp_')
    );
  }, [centrales]);

  // Extract dates from reports and repairs
  const uniqueDates = useMemo(() => {
    const datesSet = new Set<string>();
    reports.forEach(r => { if (r.date) datesSet.add(r.date); });
    repairRecords.forEach(r => { if (r.date) datesSet.add(r.date); });
    return Array.from(datesSet).sort();
  }, [reports, repairRecords]);

  const availableWeeks = useMemo(() => getAvailableWeeks(uniqueDates), [uniqueDates]);
  const availableMonths = useMemo(() => getAvailableMonths(uniqueDates), [uniqueDates]);

  // Daily options (last 30 days)
  const availableDays = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${da}`;
      list.push({
        key: dateStr,
        start: dateStr,
        end: dateStr,
        label: formatDateShort(dateStr),
        shortLabel: `${da} ${MONTH_NAMES_ES[parseInt(m, 10) - 1]?.substring(0, 3)}`
      });
    }
    return list;
  }, []);

  // Selected period keys
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>(() => availableWeeks.slice(0, 6).map(w => w.key));
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>(() => availableMonths.slice(0, 6).map(m => m.key));
  const [selectedDayKeys, setSelectedDayKeys] = useState<string[]>(() => availableDays.slice(0, 7).map(d => d.key));

  // Helper to load recent N periods
  const handleLoadRecentPeriods = () => {
    if (periodType === 'days') {
      setSelectedDayKeys(availableDays.slice(0, numPeriods).map(d => d.key));
    } else if (periodType === 'weeks') {
      setSelectedWeekKeys(availableWeeks.slice(0, numPeriods).map(w => w.key));
    } else {
      setSelectedMonthKeys(availableMonths.slice(0, numPeriods).map(m => m.key));
    }
  };

  const handleUpdatePeriodKey = (index: number, newKey: string) => {
    if (periodType === 'days') {
      const updated = [...selectedDayKeys];
      updated[index] = newKey;
      setSelectedDayKeys(updated);
    } else if (periodType === 'weeks') {
      const updated = [...selectedWeekKeys];
      updated[index] = newKey;
      setSelectedWeekKeys(updated);
    } else {
      const updated = [...selectedMonthKeys];
      updated[index] = newKey;
      setSelectedMonthKeys(updated);
    }
  };

  // Active periods list sorted chronologically (oldest to newest)
  const activePeriods = useMemo(() => {
    const list = [];
    const targetKeys = periodType === 'days' ? selectedDayKeys : periodType === 'weeks' ? selectedWeekKeys : selectedMonthKeys;

    for (let i = 0; i < numPeriods; i++) {
      const key = targetKeys[i];
      if (periodType === 'days') {
        const found = availableDays.find(d => d.key === key) || availableDays[i] || availableDays[0];
        list.push({
          index: i,
          key: found?.key || `d_${i}`,
          label: found?.label || `Día ${i + 1}`,
          shortLabel: found?.shortLabel || `Día ${i + 1}`,
          start: found?.start || todayStr,
          end: found?.end || todayStr
        });
      } else if (periodType === 'weeks') {
        const found = availableWeeks.find(w => w.key === key) || availableWeeks[i] || availableWeeks[0];
        list.push({
          index: i,
          key: found?.key || `w_${i}`,
          label: found ? `Semana ${found.weekNum} (${formatDateShort(found.start)})` : `Sem. ${i + 1}`,
          shortLabel: found ? `Sem. ${found.weekNum}` : `Sem. ${i + 1}`,
          start: found?.start || todayStr,
          end: found?.end || todayStr
        });
      } else {
        const found = availableMonths.find(m => m.key === key) || availableMonths[i] || availableMonths[0];
        list.push({
          index: i,
          key: found?.key || `m_${i}`,
          label: found?.label || `Mes ${i + 1}`,
          shortLabel: found ? `${MONTH_NAMES_ES[found.monthIdx]?.substring(0, 3)} ${found.year}` : `Mes ${i + 1}`,
          start: found?.start || todayStr,
          end: found?.end || todayStr
        });
      }
    }

    return list.sort((a, b) => a.start.localeCompare(b.start));
  }, [periodType, numPeriods, selectedDayKeys, selectedWeekKeys, selectedMonthKeys, availableDays, availableWeeks, availableMonths, todayStr]);

  // Aggregate Data per Period (Reports vs Repairs)
  const periodComparisonList = useMemo(() => {
    return activePeriods.map((period, idx) => {
      // Filter initial reports for this period range
      const periodReports = reports.filter(r => {
        if (!r.date || r.date < period.start || r.date > period.end) return false;
        if (selectedCentralFilter !== 'all' && r.centralId !== selectedCentralFilter) return false;
        if (selectedWorkGroupFilter !== 'all' && r.workGroupId !== selectedWorkGroupFilter) return false;
        return true;
      });

      // Filter repair records for this period range
      const periodRepairs = repairRecords.filter(r => {
        if (!r.date || r.date < period.start || r.date > period.end) return false;
        if (selectedCentralFilter !== 'all') {
          const matchedCentral = validCentrales.find(c => c.id === selectedCentralFilter);
          if (r.centralId !== selectedCentralFilter && (!matchedCentral || r.centralName !== matchedCentral.name)) {
            return false;
          }
        }
        if (selectedWorkGroupFilter !== 'all') {
          if (r.workGroupId !== selectedWorkGroupFilter) return false;
        }
        return true;
      });

      const totalReports = periodReports.reduce((sum, r) => sum + (r.reportCount || 0), 0);
      const totalRepairs = periodRepairs.length;
      const netBalance = totalRepairs - totalReports;

      const efficiencyPct = totalReports > 0
        ? parseFloat(((totalRepairs / totalReports) * 100).toFixed(1))
        : totalRepairs > 0 ? 100 : 0;

      const mttrSum = periodRepairs.reduce((sum, r) => sum + (r.mttrHours || 0), 0);
      const avgMttr = totalRepairs > 0 ? parseFloat((mttrSum / totalRepairs).toFixed(1)) : 0;

      return {
        period,
        totalReports,
        totalRepairs,
        netBalance,
        efficiencyPct,
        avgMttr
      };
    });
  }, [activePeriods, reports, repairRecords, selectedCentralFilter, selectedWorkGroupFilter, validCentrales]);

  // Calculate trends vs previous period (Advance vs Degrade)
  const periodComparisonWithTrend = useMemo(() => {
    return periodComparisonList.map((item, idx) => {
      if (idx === 0) {
        return {
          ...item,
          prevPeriodLabel: 'N/A (Base)',
          repairsDiff: 0,
          efficiencyDiff: 0,
          status: 'neutral' as 'better' | 'worse' | 'neutral',
          statusText: 'Periodo Base',
          pctChange: 0
        };
      }

      const prev = periodComparisonList[idx - 1];
      const repairsDiff = item.totalRepairs - prev.totalRepairs;
      const efficiencyDiff = parseFloat((item.efficiencyPct - prev.efficiencyPct).toFixed(1));

      const pctChange = prev.totalRepairs > 0
        ? parseFloat((((item.totalRepairs - prev.totalRepairs) / prev.totalRepairs) * 100).toFixed(1))
        : item.totalRepairs > 0 ? 100 : 0;

      // Logic for Evaluation:
      // "Avanzó": If efficiency improved or repairs increased substantially without backlog worsening
      // "Empeoró": If efficiency dropped or repairs fell while reports grew
      let status: 'better' | 'worse' | 'neutral' = 'neutral';
      let statusText = 'Estable ⚪';

      if (efficiencyDiff >= 3 || (repairsDiff > 0 && item.netBalance >= prev.netBalance)) {
        status = 'better';
        statusText = `Avanzó 🟢 (+${efficiencyDiff}%)`;
      } else if (efficiencyDiff <= -3 || (repairsDiff < 0 && item.netBalance < prev.netBalance)) {
        status = 'worse';
        statusText = `Empeoró 🔴 (${efficiencyDiff}%)`;
      } else if (repairsDiff > 0) {
        status = 'better';
        statusText = 'Avanzó 🟢';
      } else if (repairsDiff < 0) {
        status = 'worse';
        statusText = 'Empeoró 🔴';
      }

      return {
        ...item,
        prevPeriodLabel: prev.period.shortLabel,
        repairsDiff,
        efficiencyDiff,
        status,
        statusText,
        pctChange
      };
    });
  }, [periodComparisonList]);

  // Global Totals & Overall Evaluation
  const globalSummary = useMemo(() => {
    const grandReports = periodComparisonWithTrend.reduce((s, i) => s + i.totalReports, 0);
    const grandRepairs = periodComparisonWithTrend.reduce((s, i) => s + i.totalRepairs, 0);
    const grandEfficiency = grandReports > 0 ? parseFloat(((grandRepairs / grandReports) * 100).toFixed(1)) : 100;

    const firstPeriod = periodComparisonWithTrend[0];
    const lastPeriod = periodComparisonWithTrend[periodComparisonWithTrend.length - 1];

    const overallDiff = lastPeriod ? lastPeriod.totalRepairs - (firstPeriod?.totalRepairs || 0) : 0;
    const overallEfficiencyDiff = lastPeriod && firstPeriod ? parseFloat((lastPeriod.efficiencyPct - firstPeriod.efficiencyPct).toFixed(1)) : 0;

    let globalStatus: 'better' | 'worse' | 'neutral' = 'neutral';
    if (overallEfficiencyDiff > 2 || overallDiff > 0) globalStatus = 'better';
    else if (overallEfficiencyDiff < -2 || overallDiff < 0) globalStatus = 'worse';

    return {
      grandReports,
      grandRepairs,
      grandEfficiency,
      overallDiff,
      overallEfficiencyDiff,
      globalStatus
    };
  }, [periodComparisonWithTrend]);

  // Chart Data format
  const chartData = useMemo(() => {
    return periodComparisonWithTrend.map(item => ({
      periodLabel: item.period.shortLabel,
      fullLabel: item.period.label,
      'Reportes Ingresados': item.totalReports,
      'Reparaciones Realizadas': item.totalRepairs,
      'Eficiencia Cierre %': item.efficiencyPct
    }));
  }, [periodComparisonWithTrend]);

  // Copy Table Data
  const copyHeaders = [
    'Periodo',
    'Rango de Fechas',
    'Reportes Iniciales',
    'Reparaciones Realizadas',
    'Diferencia Neta',
    'Eficiencia %',
    'Variación vs Anterior',
    '% Cambio',
    'Diagnóstico Evaluativo'
  ];

  const copyRows = useMemo(() => {
    const base = periodComparisonWithTrend.map(row => [
      row.period.shortLabel,
      `${formatDateShort(row.period.start)} al ${formatDateShort(row.period.end)}`,
      row.totalReports,
      row.totalRepairs,
      row.netBalance > 0 ? `+${row.netBalance}` : `${row.netBalance}`,
      `${row.efficiencyPct}%`,
      row.repairsDiff > 0 ? `+${row.repairsDiff}` : `${row.repairsDiff}`,
      `${row.pctChange}%`,
      row.statusText
    ]);

    const totNet = globalSummary.grandRepairs - globalSummary.grandReports;
    const totNetStr = totNet > 0 ? `+${totNet}` : `${totNet}`;
    const signOverall = globalSummary.overallDiff > 0 ? '+' : '';

    const totalRow = [
      'TOTAL GENERAL',
      'Acumulado Red',
      globalSummary.grandReports,
      globalSummary.grandRepairs,
      totNetStr,
      `${globalSummary.grandEfficiency}%`,
      `${signOverall}${globalSummary.overallDiff}`,
      '-',
      globalSummary.globalStatus === 'better' ? 'Tendencia Positiva 🟢' : (globalSummary.globalStatus === 'worse' ? 'Requiere Atención 🔴' : 'Estable 🟡')
    ];

    return [...base, totalRow];
  }, [periodComparisonWithTrend, globalSummary]);

  return (
    <div className="space-y-6 font-sans">

      {/* Control Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-300 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dashboard Comparativo de Rendimiento Temporal</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Comparativa de Reportes vs Reparaciones (Avanzó / Empeoró)
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Analice el desempeño comparando días, semanas o meses consecutivos para verificar si la red ha avanzado o empeorado en resolución de averías.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLoadRecentPeriods}
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 border border-indigo-400/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cargar Últimos {numPeriods} {periodType === 'days' ? 'Días' : periodType === 'weeks' ? 'Semanas' : 'Meses'}</span>
            </button>
          </div>
        </div>

        {/* Filter Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Granularity Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              1. Granularidad
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPeriodType('days')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  periodType === 'days' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Días
              </button>
              <button
                onClick={() => setPeriodType('weeks')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  periodType === 'weeks' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semanas
              </button>
              <button
                onClick={() => setPeriodType('months')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  periodType === 'months' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Meses
              </button>
            </div>
          </div>

          {/* Period Count */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              2. Cantidad de Periodos
            </label>
            <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setNumPeriods(n)}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${
                    numPeriods === n ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Central Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              3. Central Telefónica
            </label>
            <select
              value={selectedCentralFilter}
              onChange={(e) => setSelectedCentralFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todas las Centrales</option>
              {validCentrales.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* Work Group Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              4. Grupo de Trabajo / Brigada
            </label>
            <select
              value={selectedWorkGroupFilter}
              onChange={(e) => setSelectedWorkGroupFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los Grupos de Trabajo</option>
              {workGroups.map(wg => (
                <option key={wg.id} value={wg.id}>{wg.name} ({wg.code})</option>
              ))}
            </select>
          </div>

        </div>

        {/* Slot Selection */}
        <div className="pt-2 border-t border-slate-800/80">
          <label className="text-[11px] font-extrabold uppercase text-indigo-400 tracking-wider block mb-2">
            Seleccionar Periodos a Comparar (Periodos 1 al {numPeriods}):
          </label>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(numPeriods, 6)} gap-3`}>
            {Array.from({ length: numPeriods }).map((_, idx) => {
              const currentKey = periodType === 'days' ? selectedDayKeys[idx] : periodType === 'weeks' ? selectedWeekKeys[idx] : selectedMonthKeys[idx];

              return (
                <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-indigo-300">
                    <span>P{idx + 1} {idx === 0 ? '(Base)' : idx === numPeriods - 1 ? '(Reciente)' : ''}</span>
                  </div>

                  {periodType === 'days' ? (
                    <select
                      value={currentKey || ''}
                      onChange={(e) => handleUpdatePeriodKey(idx, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {availableDays.map(d => (
                        <option key={d.key} value={d.key}>{d.label}</option>
                      ))}
                    </select>
                  ) : periodType === 'weeks' ? (
                    <select
                      value={currentKey || ''}
                      onChange={(e) => handleUpdatePeriodKey(idx, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {availableWeeks.map(w => (
                        <option key={w.key} value={w.key}>{w.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={currentKey || ''}
                      onChange={(e) => handleUpdatePeriodKey(idx, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {availableMonths.map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-white space-y-1 shadow-md">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Reportes Ingresados
          </div>
          <div className="text-3xl font-black text-amber-400">
            {globalSummary.grandReports.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Suma total en los {numPeriods} periodos
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-white space-y-1 shadow-md">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Reparaciones Realizadas
          </div>
          <div className="text-3xl font-black text-emerald-400">
            {globalSummary.grandRepairs.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Averías resueltas en los periodos
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-white space-y-1 shadow-md">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Tasa Eficiencia Cierre
          </div>
          <div className="text-3xl font-black text-indigo-400">
            {globalSummary.grandEfficiency}%
          </div>
          <div className="text-[11px] text-slate-400">
            Ratio (Reparaciones / Reportes)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-white space-y-1 shadow-md">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Diagnóstico Global P1 → P{numPeriods}
          </div>
          <div className="flex items-center space-x-2 pt-1">
            {globalSummary.globalStatus === 'better' ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold text-sm">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>MEJORÍA 🟢 (+{globalSummary.overallEfficiencyDiff}%)</span>
              </span>
            ) : globalSummary.globalStatus === 'worse' ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-extrabold text-sm">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <span>RETROCESO 🔴 ({globalSummary.overallEfficiencyDiff}%)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-extrabold text-sm">
                <Minus className="w-4 h-4 text-slate-400" />
                <span>ESTABLE ⚪</span>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            Variación de reparadas: <strong className={globalSummary.overallDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{globalSummary.overallDiff >= 0 ? `+${globalSummary.overallDiff}` : globalSummary.overallDiff} folios</strong>
          </div>
        </div>

      </div>

      {/* Chart Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <span>Gráfico Comparativo de Reportes vs Reparaciones</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Representación visual del flujo de entrada de reportes vs capacidad de cierre por periodo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setChartType('bar_grouped')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  chartType === 'bar_grouped' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Agrupado
              </button>
              <button
                onClick={() => setChartType('bar_stacked')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  chartType === 'bar_stacked' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Apilado
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  chartType === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Líneas
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  chartType === 'area' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Área
              </button>
            </div>

            <button
              onClick={() => setShowValuesOnBars(!showValuesOnBars)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                showValuesOnBars
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {showValuesOnBars ? 'Valores: ON' : 'Valores: OFF'}
            </button>
          </div>
        </div>

        {/* Recharts Render */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="Reportes Ingresados" stroke="#f59e0b" strokeWidth={3} dot={{ r: 6 }}>
                  {showValuesOnBars && <LabelList dataKey="Reportes Ingresados" position="top" fill="#f59e0b" fontSize={11} fontWeight="bold" />}
                </Line>
                <Line type="monotone" dataKey="Reparaciones Realizadas" stroke="#10b981" strokeWidth={3} dot={{ r: 6 }}>
                  {showValuesOnBars && <LabelList dataKey="Reparaciones Realizadas" position="top" fill="#10b981" fontSize={11} fontWeight="bold" />}
                </Line>
              </LineChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Reportes Ingresados" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} strokeWidth={2}>
                  {showValuesOnBars && <LabelList dataKey="Reportes Ingresados" position="top" fill="#f59e0b" fontSize={11} fontWeight="bold" />}
                </Area>
                <Area type="monotone" dataKey="Reparaciones Realizadas" stroke="#10b981" fill="#10b981" fillOpacity={0.3} strokeWidth={2}>
                  {showValuesOnBars && <LabelList dataKey="Reparaciones Realizadas" position="top" fill="#10b981" fontSize={11} fontWeight="bold" />}
                </Area>
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar
                  dataKey="Reportes Ingresados"
                  fill="#f59e0b"
                  stackId={chartType === 'bar_stacked' ? 'a' : undefined}
                  radius={chartType === 'bar_stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                >
                  {showValuesOnBars && <LabelList dataKey="Reportes Ingresados" position="top" fill="#f59e0b" fontSize={11} fontWeight="bold" />}
                </Bar>
                <Bar
                  dataKey="Reparaciones Realizadas"
                  fill="#10b981"
                  stackId={chartType === 'bar_stacked' ? 'a' : undefined}
                  radius={chartType === 'bar_stacked' ? [6, 6, 0, 0] : [6, 6, 0, 0]}
                >
                  {showValuesOnBars && <LabelList dataKey="Reparaciones Realizadas" position="top" fill="#10b981" fontSize={11} fontWeight="bold" />}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparative Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white flex items-center space-x-2">
              <Table className="w-5 h-5 text-indigo-400" />
              <span>Matriz Comparativa de Avance / Empeoramiento por Periodo</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluación detallada periodo a periodo con diagnóstico de avance, variación de volumen y eficiencia %.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <CopyTableButton headers={copyHeaders} rows={copyRows} label="Copiar Tabla Comparativa" />
            <CopyImageButton elementId="trend-comparison-table-container" label="Copiar Tabla Imagen" />
          </div>
        </div>

        {/* Table Container */}
        <div id="trend-comparison-table-container" className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Periodo</th>
                <th className="py-3.5 px-4">Rango de Fechas</th>
                <th className="py-3.5 px-4 text-center text-amber-400">Reportes</th>
                <th className="py-3.5 px-4 text-center text-emerald-400">Reparaciones</th>
                <th className="py-3.5 px-4 text-center text-indigo-300">Balance Neto</th>
                <th className="py-3.5 px-4 text-center">Eficiencia %</th>
                <th className="py-3.5 px-4 text-center">Δ vs Anterior</th>
                <th className="py-3.5 px-4 text-center">% Cambio</th>
                <th className="py-3.5 px-4 text-center">Diagnóstico / Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-medium">
              {periodComparisonWithTrend.map((row) => (
                <tr key={row.period.key} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3.5 px-4 font-black text-white">{row.period.shortLabel}</td>
                  <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                    {formatDateShort(row.period.start)} al {formatDateShort(row.period.end)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-amber-400 text-sm">{row.totalReports}</td>
                  <td className="py-3.5 px-4 text-center font-black text-emerald-400 text-sm">{row.totalRepairs}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded-md ${
                      row.netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {row.netBalance > 0 ? `+${row.netBalance}` : row.netBalance}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      row.efficiencyPct >= 90 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      row.efficiencyPct >= 70 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {row.efficiencyPct}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold">
                    {row.repairsDiff > 0 ? (
                      <span className="text-emerald-400 flex items-center justify-center space-x-1">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>+{row.repairsDiff}</span>
                      </span>
                    ) : row.repairsDiff < 0 ? (
                      <span className="text-rose-400 flex items-center justify-center space-x-1">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>{row.repairsDiff}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold">
                    <span className={row.pctChange > 0 ? 'text-emerald-400' : row.pctChange < 0 ? 'text-rose-400' : 'text-slate-400'}>
                      {row.pctChange > 0 ? `+${row.pctChange}%` : `${row.pctChange}%`}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {row.status === 'better' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{row.statusText}</span>
                      </span>
                    ) : row.status === 'worse' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>{row.statusText}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[11px]">
                        <Minus className="w-3.5 h-3.5 text-slate-400" />
                        <span>{row.statusText}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 font-black text-white border-t-2 border-slate-700">
              <tr>
                <td colSpan={2} className="py-3.5 px-4 uppercase text-[11px] text-slate-300 font-mono">TOTALES RED NOC</td>
                <td className="py-3.5 px-4 text-center text-amber-400 font-extrabold text-sm">{globalSummary.grandReports}</td>
                <td className="py-3.5 px-4 text-center text-emerald-400 font-black text-sm">{globalSummary.grandRepairs}</td>
                <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-300">
                  {globalSummary.grandRepairs - globalSummary.grandReports >= 0 ? `+${globalSummary.grandRepairs - globalSummary.grandReports}` : globalSummary.grandRepairs - globalSummary.grandReports}
                </td>
                <td className="py-3.5 px-4 text-center text-emerald-400 font-bold">{globalSummary.grandEfficiency}%</td>
                <td className="py-3.5 px-4 text-center font-mono text-slate-400" colSpan={3}>
                  Comparativa de {numPeriods} periodos ({periodType === 'days' ? 'Días' : periodType === 'weeks' ? 'Semanas' : 'Meses'})
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
};
