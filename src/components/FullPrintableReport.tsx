import React from 'react';
import { Central, WorkGroup, DailyReport, ReportSettings } from '../types';
import { calculateTechInstalledMatrix, calculateDayOfWeekStats, filterReportsByDateRange } from '../utils/statCalculations';
import { DEFAULT_REPORT_SETTINGS } from '../utils/settingsUtils';

interface FullPrintableReportProps {
  id: string;
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  startDate: string;
  endDate: string;
  displayDate: string;
  settings?: ReportSettings;
}

export const FullPrintableReport: React.FC<FullPrintableReportProps> = ({
  id,
  centrales,
  workGroups,
  reports,
  startDate,
  endDate,
  displayDate,
  settings = DEFAULT_REPORT_SETTINGS
}) => {
  const filtered = filterReportsByDateRange(reports, startDate, endDate, true);
  const totalReports = filtered.reduce((acc, r) => acc + (r.reportCount || 0), 0);
  const matrix = calculateTechInstalledMatrix(filtered, startDate, endDate, centrales, workGroups);
  const totalInstalledTech = matrix.reduce((acc, m) => acc + m.totalCapacity, 0);
  const globalPct = totalInstalledTech > 0 ? ((totalReports / totalInstalledTech) * 100).toFixed(2) : '0';
  const dayOfWeekStats = calculateDayOfWeekStats(reports, startDate, endDate);

  // Matrix by Central & Group (report counts)
  const countsByCentralGroup: Record<string, Record<string, number>> = {};
  filtered.forEach(r => {
    if (!countsByCentralGroup[r.centralId]) countsByCentralGroup[r.centralId] = {};
    countsByCentralGroup[r.centralId][r.workGroupId] = (countsByCentralGroup[r.centralId][r.workGroupId] || 0) + r.reportCount;
  });

  return (
    <div id={id} className="w-[800px] bg-white p-8 text-slate-900 font-sans text-xs space-y-6 leading-relaxed">
      
      {/* Report Header */}
      <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            {settings.documentTitle}
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            {settings.documentSubtitle}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            {settings.departmentName}
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          <div><strong>Fecha del Documento:</strong> {displayDate}</div>
          <div><strong>Periodo:</strong> {startDate} al {endDate}</div>
        </div>
      </div>

      {/* 1. Executive Summary */}
      {settings.includeExecutiveSummary && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
            1. Resumen Ejecutivo de la Red Telecom
          </h2>
          <p className="text-slate-700 leading-normal text-justify">
            {settings.customExecutiveSummary}
          </p>
          
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-3 gap-3 my-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Averías</span>
              <span className="text-base font-black text-slate-900">{totalReports}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Técnica Instalada</span>
              <span className="text-base font-black text-slate-900">{totalInstalledTech.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">% Interrupción Global</span>
              <span className="text-base font-black text-blue-700">{globalPct}%</span>
            </div>
          </div>
        </section>
      )}

      {/* 2. Matrix Table */}
      {settings.includeMatrixTable && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
            2. Matriz de Reportes por Central Telefónica y Grupo de Trabajo
          </h2>

          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border border-slate-800 p-1.5 text-left">Central</th>
                {workGroups.map(g => (
                  <th key={g.id} className="border border-slate-800 p-1.5 text-center">{g.code}</th>
                ))}
                <th className="border border-slate-800 p-1.5 text-center bg-slate-800">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {centrales.map(c => {
                let rowTot = 0;
                return (
                  <tr key={c.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="border border-slate-200 p-1.5 font-bold text-slate-900">{c.name}</td>
                    {workGroups.map(g => {
                      const cnt = countsByCentralGroup[c.id]?.[g.id] || 0;
                      rowTot += cnt;
                      return (
                        <td key={g.id} className="border border-slate-200 p-1.5 text-center font-medium">
                          {cnt}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 p-1.5 text-center font-bold bg-slate-100">{rowTot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Detailed Explanation under Table 2 */}
          {settings.matrixExplanation && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
              <strong className="text-slate-900 block mb-1">Explicación e Interpretación de la Matriz:</strong>
              {settings.matrixExplanation}
            </div>
          )}
        </section>
      )}

      {/* 3. Tech Installed & Interruption % */}
      {settings.includeTechInstalledTable && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
            3. Análisis de Técnica Instalada y Porcentaje de Interrupción
          </h2>

          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border border-slate-800 p-1.5 text-left">Central Telefónica</th>
                <th className="border border-slate-800 p-1.5 text-center">Técnica Instalada</th>
                <th className="border border-slate-800 p-1.5 text-center">Reportes Avería</th>
                <th className="border border-slate-800 p-1.5 text-center bg-blue-900">% Interrupción</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(m => (
                <tr key={m.centralId} className="border-b border-slate-200">
                  <td className="border border-slate-200 p-1.5 font-bold text-slate-900">{m.centralName}</td>
                  <td className="border border-slate-200 p-1.5 text-center font-medium">{m.totalCapacity.toLocaleString()}</td>
                  <td className="border border-slate-200 p-1.5 text-center font-medium">{m.totalReports}</td>
                  <td className={`border border-slate-200 p-1.5 text-center font-bold ${
                    m.totalPercentage > 3 ? 'text-rose-700 bg-rose-50' : 'text-blue-800 bg-blue-50'
                  }`}>
                    {m.totalPercentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Detailed Explanation under Table 3 */}
          {settings.techInstalledExplanation && (
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <strong className="text-amber-950 block mb-1">Análisis Técnico de la Técnica Instalada:</strong>
              {settings.techInstalledExplanation}
            </div>
          )}
        </section>
      )}

      {/* 4. Day of Week Pattern */}
      {settings.includeDayOfWeekStats && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
            4. Comportamiento Histórico por Día de la Semana (Lunes a Sábado)
          </h2>

          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border border-slate-800 p-1.5 text-left">Día de la Semana</th>
                <th className="border border-slate-800 p-1.5 text-center">Averías Totales</th>
                <th className="border border-slate-800 p-1.5 text-center">Días Evaluados</th>
                <th className="border border-slate-800 p-1.5 text-center bg-slate-800">Promedio Diario</th>
              </tr>
            </thead>
            <tbody>
              {dayOfWeekStats.map(d => (
                <tr key={d.dayIndex} className="border-b border-slate-200">
                  <td className="border border-slate-200 p-1.5 font-bold text-slate-900">{d.dayName}</td>
                  <td className="border border-slate-200 p-1.5 text-center font-medium">{d.totalReports}</td>
                  <td className="border border-slate-200 p-1.5 text-center font-medium">{d.dayCount}</td>
                  <td className="border border-slate-200 p-1.5 text-center font-bold text-blue-900">{d.averageReports}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Detailed Explanation under Table 4 */}
          {settings.dayOfWeekExplanation && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
              <strong className="text-slate-900 block mb-1">Análisis de Tendencia Semanal:</strong>
              {settings.dayOfWeekExplanation}
            </div>
          )}
        </section>
      )}

      {/* 5. Historical Evolution Explanation */}
      {settings.includeHistoricalEvolution && settings.historicalExplanation && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
            5. Tendencia y Evolución Histórica de la Red
          </h2>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
            <strong className="text-slate-900 block mb-1">Evaluación de Comportamiento Histórico:</strong>
            {settings.historicalExplanation}
          </div>
        </section>
      )}

      {/* 6. Conclusions */}
      {settings.includeConclusions && (
        <section className="space-y-2 pt-2 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            6. Conclusiones y Recomendaciones Operativas
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 text-[11px]">
            {settings.customConclusions.split('\n').filter(Boolean).map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Signatures / Footer */}
      <div className="pt-6 border-t border-slate-300 flex justify-between text-[10px] text-slate-500">
        <div>{settings.departmentName}</div>
        <div>Documento Oficial Generado por Plataforma TelecomStat</div>
      </div>

    </div>
  );
};
