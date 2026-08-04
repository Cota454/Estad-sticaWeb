import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList
} from 'recharts';
import {
  GitCompare, Layers, Calendar, Filter, TrendingUp, TrendingDown,
  BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon,
  PieChart as PieChartIcon, CheckCircle2, AlertTriangle, Building2,
  Users, Sparkles, RefreshCw, ArrowRight, Table, HelpCircle, HardDrive
} from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import {
  getTodayStr, formatDateShort, getAvailableWeeks, getAvailableMonths,
  WeekOption, MonthOption
} from '../utils/dateUtils';
import { filterReportsByDateRange } from '../utils/statCalculations';
import { CopyTableButton, CopyImageButton } from './CopyButton';

interface ComparativaMultiPeriodoViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
}

type PeriodType = 'weeks' | 'months';
type GroupingType = 'workGroup' | 'central'; // Option A (workGroup) vs Option C (central)
type ChartType = 'bar_grouped' | 'bar_stacked' | 'line' | 'area' | 'radar';

const PERIOD_COLORS = [
  '#3b82f6', // Period 1: Blue
  '#10b981', // Period 2: Emerald
  '#f59e0b', // Period 3: Amber
  '#8b5cf6', // Period 4: Purple
  '#ec4899'  // Period 5: Pink
];

export const ComparativaMultiPeriodoView: React.FC<ComparativaMultiPeriodoViewProps> = ({
  centrales,
  workGroups,
  reports
}) => {
  const todayStr = getTodayStr();

  // 1. Controls State
  const [periodType, setPeriodType] = useState<PeriodType>('weeks');
  const [numPeriods, setNumPeriods] = useState<number>(3); // 2, 3, 4, or 5
  const [groupingType, setGroupingType] = useState<GroupingType>('workGroup'); // Option A (workGroup) or C (central)
  const [chartType, setChartType] = useState<ChartType>('bar_grouped');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all'); // 'all' or specific ID

  // 2. Extract Available Weeks and Months
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(reports.map(r => r.date))).sort();
  }, [reports]);

  const availableWeeks = useMemo(() => getAvailableWeeks(uniqueDates), [uniqueDates]);
  const availableMonths = useMemo(() => getAvailableMonths(uniqueDates), [uniqueDates]);

  // 3. Selected Periods State (Array of keys up to 5)
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>(() => {
    return availableWeeks.slice(0, 5).map(w => w.key);
  });

  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>(() => {
    return availableMonths.slice(0, 5).map(m => m.key);
  });

  // Helper to load most recent N consecutive periods
  const handleLoadRecentPeriods = () => {
    if (periodType === 'weeks') {
      const keys = availableWeeks.slice(0, numPeriods).map(w => w.key);
      setSelectedWeekKeys(keys);
    } else {
      const keys = availableMonths.slice(0, numPeriods).map(m => m.key);
      setSelectedMonthKeys(keys);
    }
  };

  // Helper to update individual period slot
  const handleUpdatePeriodKey = (index: number, newKey: string) => {
    if (periodType === 'weeks') {
      const updated = [...selectedWeekKeys];
      updated[index] = newKey;
      setSelectedWeekKeys(updated);
    } else {
      const updated = [...selectedMonthKeys];
      updated[index] = newKey;
      setSelectedMonthKeys(updated);
    }
  };

  // 4. Resolve Active Period Objects (2 to 5)
  const activePeriods = useMemo(() => {
    const list = [];
    const targetKeys = periodType === 'weeks' ? selectedWeekKeys : selectedMonthKeys;

    for (let i = 0; i < numPeriods; i++) {
      const key = targetKeys[i];
      if (periodType === 'weeks') {
        const found = availableWeeks.find(w => w.key === key) || availableWeeks[i] || availableWeeks[0];
        list.push({
          index: i,
          key: found?.key || `w_${i}`,
          label: found ? `Semana ${found.weekNum} (${formatDateShort(found.start)})` : `Periodo ${i + 1}`,
          shortLabel: found ? `Sem. ${found.weekNum}` : `P${i + 1}`,
          start: found?.start || todayStr,
          end: found?.end || todayStr
        });
      } else {
        const found = availableMonths.find(m => m.key === key) || availableMonths[i] || availableMonths[0];
        list.push({
          index: i,
          key: found?.key || `m_${i}`,
          label: found?.label || `Mes ${i + 1}`,
          shortLabel: found?.label.substring(0, 3) + ' ' + (found?.year || '') || `P${i + 1}`,
          start: found?.start || todayStr,
          end: found?.end || todayStr
        });
      }
    }

    // Sort chronologically (older first, newer last) for progression analysis
    return list.sort((a, b) => a.start.localeCompare(b.start));
  }, [periodType, numPeriods, selectedWeekKeys, selectedMonthKeys, availableWeeks, availableMonths, todayStr]);

  // 5. Aggregate Data per Period and Entity (Option A: WorkGroup, Option C: Central)
  const comparisonData = useMemo(() => {
    // Entities to map
    const entities = groupingType === 'workGroup'
      ? workGroups.map(g => ({ id: g.id, name: g.name, code: g.code }))
      : centrales.map(c => ({ id: c.id, name: c.name, code: c.code }));

    // Filter entity if specific selected
    const filteredEntities = selectedEntityId === 'all'
      ? entities
      : entities.filter(e => e.id === selectedEntityId);

    // Compute stats for each period
    const periodReportsList = activePeriods.map(p => filterReportsByDateRange(reports, p.start, p.end));

    const rows = filteredEntities.map(entity => {
      const periodValues: Record<string, number> = {};
      let sumTotal = 0;

      activePeriods.forEach((p, idx) => {
        const pReports = periodReportsList[idx];
        let val = 0;
        pReports.forEach(r => {
          if (groupingType === 'workGroup' && r.workGroupId === entity.id) {
            val += (r.reportCount || 0);
          } else if (groupingType === 'central' && r.centralId === entity.id) {
            val += (r.reportCount || 0);
          }
        });

        periodValues[p.key] = val;
        sumTotal += val;
      });

      // Difference between first (P1) and last (PN) period
      const firstVal = periodValues[activePeriods[0]?.key] || 0;
      const lastVal = periodValues[activePeriods[activePeriods.length - 1]?.key] || 0;
      const diffP1PN = lastVal - firstVal;
      const pctChange = firstVal > 0
        ? parseFloat((((lastVal - firstVal) / firstVal) * 100).toFixed(1))
        : lastVal > 0 ? 100 : 0;

      return {
        id: entity.id,
        name: entity.name,
        code: entity.code,
        periodValues,
        sumTotal,
        firstVal,
        lastVal,
        diffP1PN,
        pctChange
      };
    });

    // Order descending by total reports
    rows.sort((a, b) => b.sumTotal - a.sumTotal);

    return rows;
  }, [reports, groupingType, workGroups, centrales, selectedEntityId, activePeriods]);

  // Total Summary across all entities
  const totalSummary = useMemo(() => {
    const periodTotals: Record<string, number> = {};
    let grandTotal = 0;

    activePeriods.forEach(p => {
      periodTotals[p.key] = 0;
    });

    comparisonData.forEach(row => {
      grandTotal += row.sumTotal;
      activePeriods.forEach(p => {
        periodTotals[p.key] += (row.periodValues[p.key] || 0);
      });
    });

    const firstPeriodTotal = periodTotals[activePeriods[0]?.key] || 0;
    const lastPeriodTotal = periodTotals[activePeriods[activePeriods.length - 1]?.key] || 0;
    const netDiff = lastPeriodTotal - firstPeriodTotal;
    const netPct = firstPeriodTotal > 0
      ? parseFloat((((lastPeriodTotal - firstPeriodTotal) / firstPeriodTotal) * 100).toFixed(1))
      : 0;

    return {
      periodTotals,
      grandTotal,
      firstPeriodTotal,
      lastPeriodTotal,
      netDiff,
      netPct
    };
  }, [comparisonData, activePeriods]);

  // 6. Format Data for Recharts Visualization
  const chartData = useMemo(() => {
    if (chartType === 'radar') {
      // For Radar chart, each subject is an Entity, and each period is a series
      return comparisonData.map(item => {
        const entry: Record<string, any> = {
          entityName: item.code || item.name.substring(0, 10)
        };
        activePeriods.forEach(p => {
          entry[p.shortLabel] = item.periodValues[p.key] || 0;
        });
        return entry;
      });
    }

    // For Bar / Line / Area charts:
    // Format 1: Entity on X-Axis, each Period as a Bar/Line series
    return comparisonData.map(item => {
      const entry: Record<string, any> = {
        name: item.code ? `${item.code} - ${item.name}` : item.name,
        shortName: item.code || item.name.substring(0, 12),
        Total: item.sumTotal
      };

      activePeriods.forEach(p => {
        entry[p.shortLabel] = item.periodValues[p.key] || 0;
      });

      return entry;
    });
  }, [comparisonData, activePeriods, chartType]);

  // Copy Table Data
  const copyHeaders = useMemo(() => {
    const pHeaders = activePeriods.map(p => p.shortLabel);
    return [
      groupingType === 'workGroup' ? 'Grupo de Trabajo' : 'Central CTA',
      'Código',
      ...pHeaders,
      'TOTAL MULTI-PERIODO',
      'DIFERENCIA Δ (P1→PN)',
      '% CAMBIO'
    ];
  }, [groupingType, activePeriods]);

  const copyRows = useMemo(() => {
    return comparisonData.map(row => {
      const pVals = activePeriods.map(p => row.periodValues[p.key] || 0);
      const sign = row.diffP1PN > 0 ? '+' : '';
      return [
        row.name,
        row.code,
        ...pVals,
        row.sumTotal,
        `${sign}${row.diffP1PN}`,
        `${row.pctChange}%`
      ];
    });
  }, [comparisonData, activePeriods]);

  return (
    <div className="space-y-6 font-sans">

      {/* Top Banner & Control Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>Análisis Comparativo Multi-Periodo (2 a 5 Rangos)</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Evolución Comparativa por {groupingType === 'workGroup' ? 'Grupos de Trabajo' : 'Centrales Telefónicas'}
            </h2>
            <p className="text-slate-400 text-xs">
              Módulo de análisis de datos para evaluar tendencias entre 2 y 5 semanas o meses con múltiples visualizaciones gráficas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadRecentPeriods}
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cargar Últimas {numPeriods} {periodType === 'weeks' ? 'Semanas' : 'Meses'}</span>
            </button>
          </div>
        </div>

        {/* Filters Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. Tipo de Periodo (Semanas vs Meses) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              1. Granularidad
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPeriodType('weeks')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  periodType === 'weeks'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Por Semanas
              </button>
              <button
                onClick={() => setPeriodType('months')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  periodType === 'months'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Por Meses
              </button>
            </div>
          </div>

          {/* 2. Cantidad de Periodos (2, 3, 4, 5) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              2. Cantidad Periodos
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNumPeriods(n)}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${
                    numPeriods === n
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {n} {periodType === 'weeks' ? 'Sem' : 'Mes'}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Agrupamiento: Opción A (Grupos) vs Opción C (Centrales) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              3. Opción de Vista
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setGroupingType('workGroup');
                  setSelectedEntityId('all');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  groupingType === 'workGroup'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>A. Por Grupo</span>
              </button>
              <button
                onClick={() => {
                  setGroupingType('central');
                  setSelectedEntityId('all');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  groupingType === 'central'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>C. Por Central</span>
              </button>
            </div>
          </div>

          {/* 4. Filtro Específico (Entidad) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
              4. Filtrar {groupingType === 'workGroup' ? 'Grupo' : 'Central'}
            </label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="all">
                {groupingType === 'workGroup' ? 'Todos los Grupos Técnicos' : 'Todas las Centrales CTA'}
              </option>
              {groupingType === 'workGroup'
                ? workGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                  ))
                : centrales.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
            </select>
          </div>

        </div>

        {/* Dynamic Period Slot Selectors (2 to 5 Slots) */}
        <div className="pt-2 border-t border-slate-800/80">
          <label className="text-[11px] font-extrabold uppercase text-indigo-400 tracking-wider block mb-2">
            Selección de Rangos Comparativos (Periodos 1 a {numPeriods}):
          </label>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${numPeriods} gap-3`}>
            {Array.from({ length: numPeriods }).map((_, idx) => {
              const currentKey = periodType === 'weeks' ? selectedWeekKeys[idx] : selectedMonthKeys[idx];
              const pColor = PERIOD_COLORS[idx % PERIOD_COLORS.length];

              return (
                <div
                  key={idx}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="flex items-center space-x-1.5" style={{ color: pColor }}>
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: pColor }} />
                      <span>Periodo {idx + 1} {idx === 0 ? '(Base)' : idx === numPeriods - 1 ? '(Reciente)' : ''}</span>
                    </span>
                  </div>

                  {periodType === 'weeks' ? (
                    <select
                      value={currentKey || ''}
                      onChange={(e) => handleUpdatePeriodKey(idx, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {availableWeeks.map(w => (
                        <option key={w.key} value={w.key}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={currentKey || ''}
                      onChange={(e) => handleUpdatePeriodKey(idx, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {availableMonths.map(m => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Folios Multi-Periodo
          </div>
          <div className="text-2xl font-black text-slate-900">
            {totalSummary.grandTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Suma en los {numPeriods} periodos seleccionados
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Promedio por Periodo
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {Math.round(totalSummary.grandTotal / numPeriods).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Averías prom. por {periodType === 'weeks' ? 'semana' : 'mes'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Evolución Δ (P1 → P{numPeriods})
          </div>
          <div className={`text-2xl font-black flex items-center space-x-1 ${
            totalSummary.netDiff > 0 ? 'text-rose-600' : totalSummary.netDiff < 0 ? 'text-emerald-600' : 'text-slate-700'
          }`}>
            {totalSummary.netDiff > 0 ? (
              <TrendingUp className="w-6 h-6 text-rose-600 shrink-0" />
            ) : totalSummary.netDiff < 0 ? (
              <TrendingDown className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : null}
            <span>{totalSummary.netDiff > 0 ? `+${totalSummary.netDiff}` : totalSummary.netDiff}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-500">
            Variación: <span className={totalSummary.netPct > 0 ? 'text-rose-600' : 'text-emerald-600'}>{totalSummary.netPct > 0 ? `+${totalSummary.netPct}%` : `${totalSummary.netPct}%`}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Mayor Recurrencia
          </div>
          <div className="text-lg font-black text-slate-900 truncate">
            {comparisonData[0]?.name || 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 font-bold">
            {comparisonData[0]?.sumTotal || 0} folios acumulados
          </div>
        </div>

      </div>

      {/* Chart Selector & Visualizer Box */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Visualización Gráfica Comparativa</span>
            </h3>
            <p className="text-xs text-slate-500">
              Seleccione el tipo de gráfico para analizar el comportamiento desde distintos ángulos tácticos.
            </p>
          </div>

          {/* Chart Type Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setChartType('bar_grouped')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                chartType === 'bar_grouped'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Barras Agrupadas por Periodo"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Agrupado</span>
            </button>

            <button
              onClick={() => setChartType('bar_stacked')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                chartType === 'bar_stacked'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Barras Apiladas por Acumulación"
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Apilado</span>
            </button>

            <button
              onClick={() => setChartType('line')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Líneas de Tendencia"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>Tendencia</span>
            </button>

            <button
              onClick={() => setChartType('area')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                chartType === 'area'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Área Evolutiva"
            >
              <AreaChartIcon className="w-3.5 h-3.5" />
              <span>Área</span>
            </button>

            <button
              onClick={() => setChartType('radar')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                chartType === 'radar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Gráfico Radar / Perfil de Red"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Radar</span>
            </button>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-96 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            
            {/* 1. Barras Agrupadas */}
            {chartType === 'bar_grouped' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                {activePeriods.map((p, idx) => (
                  <Bar
                    key={p.key}
                    dataKey={p.shortLabel}
                    name={p.label}
                    fill={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    radius={[6, 6, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : null}

            {/* 2. Barras Apiladas */}
            {chartType === 'bar_stacked' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                {activePeriods.map((p, idx) => (
                  <Bar
                    key={p.key}
                    dataKey={p.shortLabel}
                    name={p.label}
                    stackId="a"
                    fill={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    radius={idx === numPeriods - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : null}

            {/* 3. Líneas de Tendencia */}
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                {activePeriods.map((p, idx) => (
                  <Line
                    key={p.key}
                    type="monotone"
                    dataKey={p.shortLabel}
                    name={p.label}
                    stroke={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                ))}
              </LineChart>
            ) : null}

            {/* 4. Área Evolutiva */}
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                {activePeriods.map((p, idx) => (
                  <Area
                    key={p.key}
                    type="monotone"
                    dataKey={p.shortLabel}
                    name={p.label}
                    stackId="1"
                    stroke={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    fill={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            ) : null}

            {/* 5. Radar Chart */}
            {chartType === 'radar' ? (
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="entityName" tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                {activePeriods.map((p, idx) => (
                  <Radar
                    key={p.key}
                    name={p.label}
                    dataKey={p.shortLabel}
                    stroke={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    fill={PERIOD_COLORS[idx % PERIOD_COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))}
              </RadarChart>
            ) : null}

          </ResponsiveContainer>
        </div>

      </div>

      {/* Full Comparative Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <Table className="w-5 h-5 text-indigo-600" />
              <span>Matriz de Datos Comparativa ({numPeriods} Periodos)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Desglose numérico detallado por {groupingType === 'workGroup' ? 'Grupo Técnico' : 'Central Telefónica CTA'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <CopyTableButton headers={copyHeaders} rows={copyRows} />
            <CopyImageButton elementId="multi-period-table-container" label="Copiar Tabla Imagen" />
          </div>
        </div>

        {/* Table Container */}
        <div id="multi-period-table-container" className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{groupingType === 'workGroup' ? 'Grupo de Trabajo' : 'Central CTA'}</th>
                <th className="p-3">Código</th>
                {activePeriods.map((p, idx) => (
                  <th key={p.key} className="p-3 text-center border-l border-slate-800">
                    <span className="block">{p.shortLabel}</span>
                    <span className="text-[9px] text-slate-400 font-sans font-normal">
                      {formatDateShort(p.start)}
                    </span>
                  </th>
                ))}
                <th className="p-3 text-right bg-slate-800 border-l border-slate-700">Total</th>
                <th className="p-3 text-right bg-slate-800 border-l border-slate-700">Δ (P1→PN)</th>
                <th className="p-3 text-right bg-slate-800 border-l border-slate-700">% Cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {comparisonData.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">{row.name}</td>
                  <td className="p-3 font-mono text-slate-500">{row.code}</td>

                  {activePeriods.map((p, pIdx) => {
                    const val = row.periodValues[p.key] || 0;
                    return (
                      <td key={p.key} className="p-3 text-center border-l border-slate-100 font-mono font-bold text-slate-800">
                        {val}
                      </td>
                    );
                  })}

                  <td className="p-3 text-right bg-slate-50 font-mono font-black text-slate-900 border-l border-slate-200">
                    {row.sumTotal}
                  </td>

                  <td className={`p-3 text-right font-mono font-black border-l border-slate-200 ${
                    row.diffP1PN > 0 ? 'text-rose-600 bg-rose-50/50' : row.diffP1PN < 0 ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-600'
                  }`}>
                    {row.diffP1PN > 0 ? `+${row.diffP1PN}` : row.diffP1PN}
                  </td>

                  <td className={`p-3 text-right font-mono font-black border-l border-slate-200 ${
                    row.pctChange > 0 ? 'text-rose-600' : row.pctChange < 0 ? 'text-emerald-600' : 'text-slate-600'
                  }`}>
                    {row.pctChange > 0 ? `+${row.pctChange}%` : `${row.pctChange}%`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="p-3 text-slate-900 uppercase tracking-wider font-mono">
                  TOTALES RED NOC
                </td>
                {activePeriods.map(p => (
                  <td key={p.key} className="p-3 text-center font-mono text-indigo-700 text-sm border-l border-slate-200">
                    {totalSummary.periodTotals[p.key] || 0}
                  </td>
                ))}
                <td className="p-3 text-right font-mono text-slate-900 text-sm border-l border-slate-300 bg-slate-200/80">
                  {totalSummary.grandTotal}
                </td>
                <td className={`p-3 text-right font-mono text-sm border-l border-slate-300 bg-slate-200/80 ${
                  totalSummary.netDiff > 0 ? 'text-rose-600' : totalSummary.netDiff < 0 ? 'text-emerald-600' : 'text-slate-900'
                }`}>
                  {totalSummary.netDiff > 0 ? `+${totalSummary.netDiff}` : totalSummary.netDiff}
                </td>
                <td className={`p-3 text-right font-mono text-sm border-l border-slate-300 bg-slate-200/80 ${
                  totalSummary.netPct > 0 ? 'text-rose-600' : totalSummary.netPct < 0 ? 'text-emerald-600' : 'text-slate-900'
                }`}>
                  {totalSummary.netPct > 0 ? `+${totalSummary.netPct}%` : `${totalSummary.netPct}%`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

    </div>
  );
};
