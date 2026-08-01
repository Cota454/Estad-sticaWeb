import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import {
  TrendingUp, TrendingDown, Calendar, Bot, RefreshCw, AlertTriangle, Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import { calculateDayOfWeekStats, filterReportsByDateRange } from '../utils/statCalculations';
import { getWeekDateRanges, formatDateShort } from '../utils/dateUtils';
import { CopyTableButton, CopyImageButton } from './CopyButton';

interface AnalisisSemanalHistoricoProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
}

export const AnalisisSemanalHistorico: React.FC<AnalisisSemanalHistoricoProps> = ({
  centrales,
  workGroups,
  reports
}) => {
  const weekRanges = useMemo(() => getWeekDateRanges(), []);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);

  // Compute Current Week Reports
  const currWeekReportsList = useMemo(() => {
    return filterReportsByDateRange(reports, weekRanges.currentWeekStart, weekRanges.currentWeekEnd);
  }, [reports, weekRanges]);

  const currWeekTotal = useMemo(() => {
    return currWeekReportsList.reduce((acc, r) => acc + (r.reportCount || 0), 0);
  }, [currWeekReportsList]);

  // Compute Previous Week Reports
  const prevWeekReportsList = useMemo(() => {
    return filterReportsByDateRange(reports, weekRanges.prevWeekStart, weekRanges.prevWeekEnd);
  }, [reports, weekRanges]);

  const prevWeekTotal = useMemo(() => {
    return prevWeekReportsList.reduce((acc, r) => acc + (r.reportCount || 0), 0);
  }, [prevWeekReportsList]);

  // % Variation calculation
  const percentVariation = useMemo(() => {
    if (prevWeekTotal === 0) return 0;
    return parseFloat((((currWeekTotal - prevWeekTotal) / prevWeekTotal) * 100).toFixed(1));
  }, [currWeekTotal, prevWeekTotal]);

  // Calculate Day of Week stats for all historical data
  const dayOfWeekStats = useMemo(() => {
    return calculateDayOfWeekStats(reports);
  }, [reports]);

  // Find Peak Day of Week
  const peakDay = useMemo(() => {
    if (dayOfWeekStats.length === 0) return null;
    return [...dayOfWeekStats].sort((a, b) => b.averageReports - a.averageReports)[0];
  }, [dayOfWeekStats]);

  // Top affected group this week
  const topGroupThisWeek = useMemo(() => {
    const counts: Record<string, number> = {};
    currWeekReportsList.forEach(r => {
      counts[r.workGroupId] = (counts[r.workGroupId] || 0) + r.reportCount;
    });
    let topId = '';
    let max = -1;
    Object.entries(counts).forEach(([id, val]) => {
      if (val > max) {
        max = val;
        topId = id;
      }
    });
    return workGroups.find(g => g.id === topId)?.name || 'N/A';
  }, [currWeekReportsList, workGroups]);

  // Top affected central this week
  const topCentralThisWeek = useMemo(() => {
    const counts: Record<string, number> = {};
    currWeekReportsList.forEach(r => {
      counts[r.centralId] = (counts[r.centralId] || 0) + r.reportCount;
    });
    let topId = '';
    let max = -1;
    Object.entries(counts).forEach(([id, val]) => {
      if (val > max) {
        max = val;
        topId = id;
      }
    });
    return centrales.find(c => c.id === topId)?.name || 'N/A';
  }, [currWeekReportsList, centrales]);

  // Day of Week Copy Headers & Rows
  const dayOfWeekCopyHeaders = ['Día de la Semana', 'Total Histórico', 'Días Registrados', 'Promedio Diario'];
  const dayOfWeekCopyRows = useMemo(() => {
    return dayOfWeekStats.map(d => [d.dayName, d.totalReports, d.dayCount, d.averageReports]);
  }, [dayOfWeekStats]);

  // Function to call AI Operations Analyst Endpoint
  const handleGenerateAiAnalysis = async () => {
    setIsLoadingAi(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: `Semana ${formatDateShort(weekRanges.prevWeekStart)} a ${formatDateShort(weekRanges.currentWeekEnd)}`,
          totalReports: currWeekTotal + prevWeekTotal,
          prevWeekReports: prevWeekTotal,
          currWeekReports: currWeekTotal,
          topGroups: [topGroupThisWeek],
          topCentrales: [topCentralThisWeek],
          dayStats: dayOfWeekStats.map(d => ({ día: d.dayName, promedio: d.averageReports, total: d.totalReports }))
        })
      });

      const data = await response.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      } else if (data.summary) {
        setAiAnalysis(data.summary);
      } else {
        // Fallback local heuristic text
        generateLocalHeuristicAnalysis();
      }
    } catch (err) {
      console.error('Error fetching AI analysis:', err);
      generateLocalHeuristicAnalysis();
    } finally {
      setIsLoadingAi(false);
    }
  };

  const generateLocalHeuristicAnalysis = () => {
    const isImprovement = percentVariation < 0;
    const absVar = Math.abs(percentVariation);
    const text = `
### **Dictamen Operativo de Red de Telecomunicaciones**

1. **Evaluación de la Semana Anterior vs Actual**:
   - La semana anterior registra **${prevWeekTotal} averías**, comparada con **${currWeekTotal} averías** en la semana en curso.
   - Comportamiento operacional: ${isImprovement ? `Disminución de incidencias del ${absVar}% (Comportamiento Favorable).` : `Incremento de incidencias del ${absVar}% (Atención requerida).`}

2. **Puntos Críticos de Falla**:
   - El grupo técnico con mayor recurrencia de fallas en la red es **${topGroupThisWeek}**.
   - La unidad operativa con mayor carga de reportes es la **${topCentralThisWeek}**.

3. **Patrón Temporal del Histórico**:
   - Históricamente, el día de la semana con mayor concentración de reportes es el **${peakDay?.dayName || 'Lunes'}** con un promedio de **${peakDay?.averageReports || 0} averías/día**.
   - Se observa una acumulación típica de reportes al reinicio de la semana hábil.

4. **Recomendaciones para el Equipo de Operaciones**:
   - Reforzar las cuadrillas de mantenimiento preventivo en la **${topCentralThisWeek}**.
   - Realizar pruebas de continuidad en los circuitos asignados al grupo **${topGroupThisWeek}**.
   - Programar turnos reforzados los días **${peakDay?.dayName || 'Lunes'}** para reducir el tiempo medio de resolución (MTTR).
    `.trim();
    setAiAnalysis(text);
  };

  return (
    <div className="space-y-6">
      
      {/* Week-over-Week Executive Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Análisis Comparativo Semanal</span>
            </h2>
            <p className="text-xs text-slate-500">
              Evaluación del comportamiento de la semana anterior vs la semana actual
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Actual: {formatDateShort(weekRanges.currentWeekStart)} - {formatDateShort(weekRanges.currentWeekEnd)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          
          {/* Previous Week */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Semana Anterior</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{prevWeekTotal} <span className="text-xs font-medium text-slate-500">averías</span></p>
            <p className="text-[11px] text-slate-400 mt-1">{formatDateShort(weekRanges.prevWeekStart)} - {formatDateShort(weekRanges.prevWeekEnd)}</p>
          </div>

          {/* Current Week */}
          <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-200">
            <span className="text-xs font-semibold text-blue-800 uppercase">Semana Actual</span>
            <p className="text-2xl font-extrabold text-blue-900 mt-1">{currWeekTotal} <span className="text-xs font-medium text-blue-700">averías</span></p>
            <p className="text-[11px] text-blue-600 mt-1">{formatDateShort(weekRanges.currentWeekStart)} - {formatDateShort(weekRanges.currentWeekEnd)}</p>
          </div>

          {/* % Change */}
          <div className={`rounded-xl p-4 border ${percentVariation <= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
            <span className="text-xs font-semibold uppercase opacity-80">Variación Semanal</span>
            <div className="flex items-center space-x-2 mt-1">
              {percentVariation <= 0 ? (
                <TrendingDown className="w-6 h-6 text-emerald-600" />
              ) : (
                <TrendingUp className="w-6 h-6 text-rose-600" />
              )}
              <span className="text-2xl font-extrabold">{percentVariation > 0 ? `+${percentVariation}` : percentVariation}%</span>
            </div>
            <p className="text-[11px] opacity-80 mt-1">
              {percentVariation <= 0 ? 'Reducción de averías en la red' : 'Aumento de incidencias registradas'}
            </p>
          </div>

          {/* Main Focus */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-white">
            <span className="text-xs font-semibold text-blue-400 uppercase">Punto Crítico</span>
            <p className="text-sm font-bold text-white mt-1 truncate" title={topCentralThisWeek}>{topCentralThisWeek}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">Grupo: {topGroupThisWeek}</p>
          </div>

        </div>

      </div>

      {/* Historical Day of Week Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Day of Week Chart & Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" id="day-of-week-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Comportamiento por Día de la Semana</h3>
              <p className="text-xs text-slate-500">Promedio de incidencias de Lunes a Domingo según el historial</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {peakDay && (
                <div className="bg-amber-50 text-amber-800 text-xs px-3 py-1 rounded-full font-semibold border border-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Día Pico: {peakDay.dayName} ({peakDay.averageReports} prom.)</span>
                </div>
              )}

              <CopyImageButton elementId="day-of-week-card" label="Copiar Imagen" variant="outline" />
              <CopyTableButton headers={dayOfWeekCopyHeaders} rows={dayOfWeekCopyRows} title="Comportamiento por Día de la Semana" variant="outline" />
            </div>
          </div>

          {/* Bar Chart of Day-of-Week Averages */}
          <div className="h-64 w-full mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayName" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => [`${value} reportes prom.`, 'Promedio Diario']}
                />
                <Bar dataKey="averageReports" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="averageReports" position="top" style={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} />
                  {dayOfWeekStats.map((entry) => (
                    <Cell
                      key={entry.dayIndex}
                      fill={entry.dayIndex === peakDay?.dayIndex ? '#e11d48' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Día de la Semana</th>
                  <th className="p-3 text-center">Total Histórico</th>
                  <th className="p-3 text-center">Días Registrados</th>
                  <th className="p-3 text-right">Promedio Diario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayOfWeekStats.map((day) => {
                  const isPeak = day.dayIndex === peakDay?.dayIndex;
                  return (
                    <tr key={day.dayIndex} className={`hover:bg-slate-50/80 ${isPeak ? 'bg-rose-50/50 font-semibold text-rose-900' : ''}`}>
                      <td className="p-3 flex items-center gap-2">
                        <span>{day.dayName}</span>
                        {isPeak && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            MÁXIMO
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-medium">{day.totalReports}</td>
                      <td className="p-3 text-center font-medium">{day.dayCount}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{day.averageReports}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* AI Telecommunications Engineering Diagnosis */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Asistente IA de Operaciones</h3>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>

            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Diagnóstico técnico automatizado basado en el historial de fallas, comportamiento semanal y patrones de red.
            </p>

            {aiAnalysis ? (
              <div className="mt-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 text-xs text-slate-200 leading-relaxed max-h-[360px] overflow-y-auto whitespace-pre-line font-sans">
                {aiAnalysis}
              </div>
            ) : (
              <div className="mt-6 p-6 border-2 border-dashed border-slate-800 rounded-xl text-center">
                <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">Presione el botón para generar el informe técnico semanal con IA.</p>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateAiAnalysis}
            disabled={isLoadingAi}
            className="mt-6 w-full inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {isLoadingAi ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Analizando Red de Telecomunicaciones...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generar Informe Técnico Operativo</span>
              </>
            )}
          </button>

        </div>

      </div>

    </div>
  );
};
