import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import {
  ArrowDownCircle, ArrowUpCircle, Layers, Building2, BarChart2, PieChart as PieIcon, LineChart as LineIcon,
  TrendingUp, Calendar, AlertOctagon, CheckCircle2, Sliders, Filter, Cpu
} from 'lucide-react';
import { Central, WorkGroup, DailyReport, ChartType } from '../types';
import { FilterBar } from './FilterBar';
import { filterReportsByMonthYear, calculateMonthMinMaxDays, getCentralTotalCapacity } from '../utils/statCalculations';
import { MONTH_NAMES_ES, formatDateLong, formatDateShort } from '../utils/dateUtils';

interface DashboardGeneralProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
}

export const DashboardGeneral: React.FC<DashboardGeneralProps> = ({
  centrales,
  workGroups,
  reports
}) => {
  const currentDate = new Date();
  const [month, setMonth] = useState<number>(currentDate.getMonth());
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [groupBy, setGroupBy] = useState<'workGroup' | 'central' | 'daily'>('workGroup');

  // Filter reports
  const filteredReports = useMemo(() => {
    return filterReportsByMonthYear(reports, month, year);
  }, [reports, month, year]);

  // Calculate Min / Max day of the month
  const minMaxStats = useMemo(() => {
    return calculateMonthMinMaxDays(reports, month, year);
  }, [reports, month, year]);

  // Group data by WorkGroup
  const dataByWorkGroup = useMemo(() => {
    const map: Record<string, { name: string; reports: number; color: string }> = {};
    workGroups.forEach(g => {
      map[g.id] = { name: g.name, reports: 0, color: g.color };
    });
    filteredReports.forEach(r => {
      if (map[r.workGroupId]) {
        map[r.workGroupId].reports += r.reportCount;
      }
    });
    return Object.values(map);
  }, [workGroups, filteredReports]);

  // Group data by Central
  const dataByCentral = useMemo(() => {
    const map: Record<string, { name: string; reports: number }> = {};
    centrales.forEach(c => {
      map[c.id] = { name: c.name, reports: 0 };
    });
    filteredReports.forEach(r => {
      if (map[r.centralId]) {
        map[r.centralId].reports += r.reportCount;
      }
    });
    return Object.values(map);
  }, [centrales, filteredReports]);

  // Group data by Daily Timeline
  const dataDailyTimeline = useMemo(() => {
    const map: Record<string, { date: string; displayDate: string; [key: string]: any }> = {};
    
    // Sort filtered reports by date
    const sorted = [...filteredReports].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(r => {
      if (!map[r.date]) {
        map[r.date] = {
          date: r.date,
          displayDate: formatDateShort(r.date),
          total: 0
        };
        // Initialize workgroup keys for stacked charts
        workGroups.forEach(g => {
          map[r.date][g.name] = 0;
        });
      }
      map[r.date].total += r.reportCount;
      const grp = workGroups.find(g => g.id === r.workGroupId);
      if (grp) {
        map[r.date][grp.name] = (map[r.date][grp.name] || 0) + r.reportCount;
      }
    });

    return Object.values(map);
  }, [filteredReports, workGroups]);

  // State for Filtered Chart 1 (by Central) and Filtered Chart 2 (by WorkGroup)
  const [selectedCentralId, setSelectedCentralId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const effectiveCentralId = useMemo(() => {
    if (selectedCentralId && centrales.some(c => c.id === selectedCentralId)) {
      return selectedCentralId;
    }
    return centrales[0]?.id || '';
  }, [selectedCentralId, centrales]);

  const effectiveGroupId = useMemo(() => {
    if (selectedGroupId && workGroups.some(g => g.id === selectedGroupId)) {
      return selectedGroupId;
    }
    return workGroups[0]?.id || '';
  }, [selectedGroupId, workGroups]);

  // Calculate Data for Filtered Chart 1: Groups of selected Central
  const centralChartData = useMemo(() => {
    if (!effectiveCentralId) return [];
    const central = centrales.find(c => c.id === effectiveCentralId);
    if (!central) return [];

    const totalCentralCapacity = getCentralTotalCapacity(central);

    const groupCounts: Record<string, number> = {};
    filteredReports.forEach(r => {
      if (r.centralId === effectiveCentralId) {
        groupCounts[r.workGroupId] = (groupCounts[r.workGroupId] || 0) + r.reportCount;
      }
    });

    return workGroups.map(g => {
      const reports = groupCounts[g.id] || 0;
      const pctOfCentral = totalCentralCapacity > 0 ? parseFloat(((reports / totalCentralCapacity) * 100).toFixed(2)) : 0;
      return {
        name: g.name,
        code: g.code,
        reports,
        pctOfCentral,
        color: g.color || '#3b82f6'
      };
    });
  }, [effectiveCentralId, centrales, workGroups, filteredReports]);

  // Calculate Data for Filtered Chart 2: Centrales for selected WorkGroup
  const groupChartData = useMemo(() => {
    if (!effectiveGroupId) return [];

    const centralCounts: Record<string, number> = {};
    filteredReports.forEach(r => {
      if (r.workGroupId === effectiveGroupId) {
        centralCounts[r.centralId] = (centralCounts[r.centralId] || 0) + r.reportCount;
      }
    });

    return centrales.map(c => {
      const reports = centralCounts[c.id] || 0;
      const centralCapacity = getCentralTotalCapacity(c);
      const pctOfCentral = centralCapacity > 0 ? parseFloat(((reports / centralCapacity) * 100).toFixed(2)) : 0;
      return {
        name: c.name,
        code: c.code,
        reports,
        pctOfCentral
      };
    });
  }, [effectiveGroupId, centrales, filteredReports]);

  // Active chart dataset selection
  const chartDataset = groupBy === 'workGroup' ? dataByWorkGroup : (groupBy === 'central' ? dataByCentral : dataDailyTimeline);

  // Colors array for pie/charts
  const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#6366f1', '#ec4899', '#06b6d4', '#f43f5e'];

  return (
    <div className="space-y-6">
      
      {/* Month / Year Filter */}
      <FilterBar
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        showMonthYear={true}
        showDateRange={false}
        onResetFilters={() => {
          setMonth(currentDate.getMonth());
          setYear(currentDate.getFullYear());
        }}
      />

      {/* Highlights Dashboard Cards: Lowest & Highest Report Day of Month */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Month Reports */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total del Período</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{minMaxStats.totalMonthReports}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {month === -1 ? 'Todos los meses' : MONTH_NAMES_ES[month]} {year === -1 ? '' : year} ({minMaxStats.activeDaysCount} días registrados)
            </p>
          </div>
        </div>

        {/* Día con Menor Reporte del Mes */}
        <div className="bg-white rounded-xl p-5 border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-emerald-800 tracking-wider">Día con Menor Reporte</span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {minMaxStats.minDay ? (
              <>
                <div className="flex items-baseline space-x-2">
                  <p className="text-3xl font-extrabold text-emerald-900">{minMaxStats.minDay.count}</p>
                  <span className="text-xs font-semibold text-emerald-700">averías</span>
                </div>
                <p className="text-xs font-semibold text-emerald-800 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{formatDateLong(minMaxStats.minDay.date)}</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-2">Sin registros suficientes en este período</p>
            )}
          </div>
        </div>

        {/* Día con Mayor Reporte del Mes */}
        <div className="bg-white rounded-xl p-5 border border-rose-200 bg-gradient-to-br from-rose-50/40 to-white shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-rose-800 tracking-wider">Día con Mayor Reporte</span>
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {minMaxStats.maxDay ? (
              <>
                <div className="flex items-baseline space-x-2">
                  <p className="text-3xl font-extrabold text-rose-900">{minMaxStats.maxDay.count}</p>
                  <span className="text-xs font-semibold text-rose-700">averías</span>
                </div>
                <p className="text-xs font-semibold text-rose-800 mt-1 flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                  <span>{formatDateLong(minMaxStats.maxDay.date)}</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-2">Sin registros suficientes en este período</p>
            )}
          </div>
        </div>

        {/* Promedio Diario */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Promedio Diario</span>
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {minMaxStats.activeDaysCount > 0
                ? (minMaxStats.totalMonthReports / minMaxStats.activeDaysCount).toFixed(1)
                : '0.0'}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">incidencias / día operativo</p>
          </div>
        </div>

      </div>

      {/* Main Chart Section with Interactive Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        {/* Controls Bar: GroupBy + Chart Type Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          
          {/* Dimension Selector */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Visualización por:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setGroupBy('workGroup')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  groupBy === 'workGroup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grupo de Trabajo
              </button>
              <button
                onClick={() => setGroupBy('central')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  groupBy === 'central' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Central Telefónica
              </button>
              <button
                onClick={() => setGroupBy('daily')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  groupBy === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evolución Diaria
              </button>
            </div>
          </div>

          {/* Chart Type Selector */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Tipo de Gráfico:</span>
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              
              <button
                onClick={() => setChartType('bar')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'bar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gráfico de Barras"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Barras</span>
              </button>

              <button
                onClick={() => setChartType('stackedBar')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'stackedBar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Barras Apiladas por Grupos"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Apilado</span>
              </button>

              <button
                onClick={() => setChartType('line')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'line' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gráfico de Líneas"
              >
                <LineIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Líneas</span>
              </button>

              <button
                onClick={() => setChartType('area')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'area' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gráfico de Área"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Área</span>
              </button>

              <button
                onClick={() => setChartType('pie')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'pie' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gráfico Circular"
              >
                <PieIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Circular</span>
              </button>

              <button
                onClick={() => setChartType('radar')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'radar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gráfico Radar de Distribución"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Radar</span>
              </button>

            </div>
          </div>

        </div>

        {/* Chart Rendering Container */}
        <div className="mt-6 h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {(() => {
              // 1. BAR CHART
              if (chartType === 'bar') {
                return (
                  <BarChart data={chartDataset as any} margin={{ top: 25, right: 30, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey={groupBy === 'daily' ? 'displayDate' : 'name'}
                      angle={-25}
                      textAnchor="end"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Legend />
                    <Bar
                      dataKey={groupBy === 'daily' ? 'total' : 'reports'}
                      name="Cantidad de Reportes"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList dataKey={groupBy === 'daily' ? 'total' : 'reports'} position="top" style={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} />
                    </Bar>
                  </BarChart>
                );
              }

              // 2. STACKED BAR CHART
              if (chartType === 'stackedBar') {
                if (groupBy === 'daily') {
                  return (
                    <BarChart data={dataDailyTimeline} margin={{ top: 25, right: 30, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="displayDate" angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                      <Legend />
                      {workGroups.map((grp, idx) => (
                        <Bar key={grp.id} dataKey={grp.name} stackId="a" fill={grp.color || PIE_COLORS[idx % PIE_COLORS.length]}>
                          <LabelList dataKey={grp.name} position="insideTop" style={{ fontSize: 10, fontWeight: 'bold', fill: '#fff' }} formatter={(val: any) => (val > 0 ? val : '')} />
                        </Bar>
                      ))}
                    </BarChart>
                  );
                } else {
                  return (
                    <BarChart data={chartDataset as any} margin={{ top: 25, right: 30, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                      <Bar dataKey="reports" name="Reportes" fill="#10b981" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="reports" position="top" style={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} />
                      </Bar>
                    </BarChart>
                  );
                }
              }

              // 3. LINE CHART
              if (chartType === 'line') {
                return (
                  <LineChart data={chartDataset as any} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={groupBy === 'daily' ? 'displayDate' : 'name'} angle={-20} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={groupBy === 'daily' ? 'total' : 'reports'}
                      name="Cantidad de Reportes"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#8b5cf6' }}
                    />
                  </LineChart>
                );
              }

              // 4. AREA CHART
              if (chartType === 'area') {
                return (
                  <AreaChart data={chartDataset as any} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                    <defs>
                      <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={groupBy === 'daily' ? 'displayDate' : 'name'} angle={-20} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                    <Area type="monotone" dataKey={groupBy === 'daily' ? 'total' : 'reports'} stroke="#3b82f6" fillOpacity={1} fill="url(#areaColor)" strokeWidth={2.5} />
                  </AreaChart>
                );
              }

              // 5. PIE CHART
              if (chartType === 'pie') {
                return (
                  <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                    <Legend />
                    <Pie
                      data={chartDataset as any}
                      dataKey={groupBy === 'daily' ? 'total' : 'reports'}
                      nameKey={groupBy === 'daily' ? 'displayDate' : 'name'}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      paddingAngle={4}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartDataset.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                );
              }

              // 6. RADAR CHART
              if (chartType === 'radar') {
                return (
                  <RadarChart cx="50%" cy="50%" outerRadius={110} data={chartDataset as any}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey={groupBy === 'daily' ? 'displayDate' : 'name'} tick={{ fontSize: 11, fill: '#475569' }} />
                    <PolarRadiusAxis />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                    <Radar name="Reportes" dataKey={groupBy === 'daily' ? 'total' : 'reports'} stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                  </RadarChart>
                );
              }

              return null;
            })()}
          </ResponsiveContainer>
        </div>

      </div>

      {/* DEDICATED FILTERED CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CHART 1: Filter per Central Telefónica */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">1. Gráfica por Central Telefónica</h3>
                  <p className="text-xs text-slate-500">Muestra los reportes y % de Técnica Instalada por cada grupo</p>
                </div>
              </div>

              {/* Central Selector Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <select
                  value={effectiveCentralId}
                  onChange={(e) => setSelectedCentralId(e.target.value)}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200"
                >
                  {centrales.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={centralChartData} margin={{ top: 25, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} reportes (${item.payload.pctOfCentral}% del total de técnica instalada)`,
                      'Cantidad Registrada'
                    ]}
                  />
                  <Bar dataKey="reports" name="Cantidad de Reportes" fill="#0284c7" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="reports" position="top" style={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CHART 2: Filter per Work Group */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">2. Gráfica por Grupo de Trabajo</h3>
                  <p className="text-xs text-slate-500">Comportamiento del grupo seleccionado en cada Central Telefónica</p>
                </div>
              </div>

              {/* Group Selector Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <select
                  value={effectiveGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200"
                >
                  {workGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupChartData} margin={{ top: 25, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} reportes (${item.payload.pctOfCentral}% de técnica instalada)`,
                      'Cantidad Registrada'
                    ]}
                  />
                  <Bar dataKey="reports" name="Cantidad de Reportes" fill="#10b981" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="reports" position="top" style={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
