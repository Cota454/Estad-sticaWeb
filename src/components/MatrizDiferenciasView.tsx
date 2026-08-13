import React, { useState, useMemo } from 'react';
import { GitCompare, ArrowDown, ArrowUp, Minus, Info, CheckCircle, AlertCircle, Calendar, CalendarDays, CalendarRange, Filter } from 'lucide-react';
import { Central, WorkGroup, DailyReport, DifferenceRow } from '../types';
import { calculateDifferenceMatrix } from '../utils/statCalculations';
import { getTodayStr, getPastDateStr, formatDateLong, formatDateShort, getAvailableWeeks, getAvailableMonths } from '../utils/dateUtils';
import { CopyTableButton, CopyImageButton } from './CopyButton';

interface MatrizDiferenciasViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
}

export const MatrizDiferenciasView: React.FC<MatrizDiferenciasViewProps> = ({
  centrales,
  workGroups,
  reports
}) => {
  const todayStr = getTodayStr();
  const yesterdayStr = getPastDateStr(1);

  // Mode: 'days' | 'weeks' | 'months'
  const [compareMode, setCompareMode] = useState<'days' | 'weeks' | 'months'>('days');

  // Days Mode State
  const [startDate, setStartDate] = useState<string>(yesterdayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Available unique dates from reports
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(reports.map(r => r.date))).sort();
  }, [reports]);

  // Weeks List & State
  const availableWeeks = useMemo(() => getAvailableWeeks(uniqueDates), [uniqueDates]);
  const [selectedWeek1, setSelectedWeek1] = useState<string>(() => availableWeeks[1]?.key || availableWeeks[0]?.key || '');
  const [selectedWeek2, setSelectedWeek2] = useState<string>(() => availableWeeks[0]?.key || '');

  // Months List & State
  const availableMonths = useMemo(() => getAvailableMonths(uniqueDates), [uniqueDates]);
  const [selectedMonth1, setSelectedMonth1] = useState<string>(() => availableMonths[1]?.key || availableMonths[0]?.key || '');
  const [selectedMonth2, setSelectedMonth2] = useState<string>(() => availableMonths[0]?.key || '');

  // Active boundaries
  const { period1, period2, labelText, period1Label, period2Label } = useMemo(() => {
    if (compareMode === 'days') {
      return {
        period1: { start: startDate, end: startDate },
        period2: { start: endDate, end: endDate },
        labelText: `entre el ${formatDateLong(startDate)} y el ${formatDateLong(endDate)}`,
        period1Label: formatDateShort(startDate),
        period2Label: formatDateShort(endDate)
      };
    } else if (compareMode === 'weeks') {
      const w1 = availableWeeks.find(w => w.key === selectedWeek1) || availableWeeks[1] || availableWeeks[0];
      const w2 = availableWeeks.find(w => w.key === selectedWeek2) || availableWeeks[0];
      return {
        period1: { start: w1?.start || todayStr, end: w1?.end || todayStr },
        period2: { start: w2?.start || todayStr, end: w2?.end || todayStr },
        labelText: `entre ${w1?.label || 'Semana 1'} y ${w2?.label || 'Semana 2'}`,
        period1Label: w1 ? `Sem. ${w1.weekNum} (${formatDateShort(w1.start)})` : 'Semana Base',
        period2Label: w2 ? `Sem. ${w2.weekNum} (${formatDateShort(w2.start)})` : 'Semana Final'
      };
    } else {
      const m1 = availableMonths.find(m => m.key === selectedMonth1) || availableMonths[1] || availableMonths[0];
      const m2 = availableMonths.find(m => m.key === selectedMonth2) || availableMonths[0];
      return {
        period1: { start: m1?.start || todayStr, end: m1?.end || todayStr },
        period2: { start: m2?.start || todayStr, end: m2?.end || todayStr },
        labelText: `entre ${m1?.label || 'Mes 1'} y ${m2?.label || 'Mes 2'}`,
        period1Label: m1?.label || 'Mes Base',
        period2Label: m2?.label || 'Mes Final'
      };
    }
  }, [compareMode, startDate, endDate, selectedWeek1, selectedWeek2, selectedMonth1, selectedMonth2, availableWeeks, availableMonths, todayStr]);

  // Calculate Difference Matrix
  const matrixRows: DifferenceRow[] = useMemo(() => {
    return calculateDifferenceMatrix(
      reports,
      period1.start,
      period1.end,
      period2.start,
      period2.end,
      centrales,
      workGroups
    );
  }, [reports, period1, period2, centrales, workGroups]);

  // Net Network Difference Summary
  const networkSummary = useMemo(() => {
    let totalInitial = 0;
    let totalFinal = 0;
    matrixRows.forEach(r => {
      totalInitial += r.totalInitial;
      totalFinal += r.totalFinal;
    });
    const netDiff = totalFinal - totalInitial;
    return { totalInitial, totalFinal, netDiff };
  }, [matrixRows]);

  // Copy Headers & Rows
  const matrixCopyHeaders = useMemo(() => {
    return [
      'Central Telefónica',
      'Código',
      ...workGroups.map(g => `${g.name} (${g.code})`),
      'SUMA FINAL CENTRAL'
    ];
  }, [workGroups]);

  const matrixCopyRows = useMemo(() => {
    const base = matrixRows.map(r => {
      const cObj = centrales.find(c => c.id === r.centralId);
      const grpVals = workGroups.map(grp => {
        const cell = r.groupDiffs[grp.id] || { valInitial: 0, valFinal: 0, diff: 0 };
        const sign = cell.diff > 0 ? '+' : '';
        return `${cell.valInitial} → ${cell.valFinal} (${sign}${cell.diff})`;
      });
      const totSign = r.totalDiff > 0 ? '+' : '';
      return [
        r.centralName,
        cObj?.code || '',
        ...grpVals,
        `${r.totalInitial} → ${r.totalFinal} (${totSign}${r.totalDiff})`
      ];
    });

    const groupTotals = workGroups.map(grp => {
      let init = 0;
      let fin = 0;
      matrixRows.forEach(r => {
        const cell = r.groupDiffs[grp.id];
        if (cell) {
          init += cell.valInitial;
          fin += cell.valFinal;
        }
      });
      const diff = fin - init;
      const sign = diff > 0 ? '+' : '';
      return `${init} → ${fin} (${sign}${diff})`;
    });

    const netSign = networkSummary.netDiff > 0 ? '+' : '';
    const totalRow = [
      'SUMA TOTAL RED',
      'RED',
      ...groupTotals,
      `${networkSummary.totalInitial} → ${networkSummary.totalFinal} (${netSign}${networkSummary.netDiff})`
    ];

    return [...base, totalRow];
  }, [matrixRows, workGroups, centrales, networkSummary]);

  return (
    <div className="space-y-6">
      
      {/* Comparison Mode Selector & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Filtro de Modo de Comparación:
            </h3>
          </div>

          {/* Segmented Buttons: Días, Semanas, Meses */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setCompareMode('days')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                compareMode === 'days'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Días (Por Fecha)</span>
            </button>

            <button
              onClick={() => setCompareMode('weeks')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                compareMode === 'weeks'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Semanas (Por Semana)</span>
            </button>

            <button
              onClick={() => setCompareMode('months')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                compareMode === 'months'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Meses (Por Mes)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Controls per Compare Mode */}
        {compareMode === 'days' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">1. Fecha Inicial (Base):</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">2. Fecha Final (Comparación):</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setStartDate(yesterdayStr);
                  setEndDate(todayStr);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold transition-colors"
              >
                Ayer vs Hoy
              </button>
              <button
                onClick={() => {
                  setStartDate(getPastDateStr(7));
                  setEndDate(todayStr);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold transition-colors"
              >
                Hace 7 días vs Hoy
              </button>
            </div>
          </div>
        )}

        {compareMode === 'weeks' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">1. Semana Inicial (Base):</span>
                <select
                  value={selectedWeek1}
                  onChange={(e) => setSelectedWeek1(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableWeeks.map(wk => (
                    <option key={wk.key} value={wk.key}>
                      {wk.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">2. Semana Final (Comparación):</span>
                <select
                  value={selectedWeek2}
                  onChange={(e) => setSelectedWeek2(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableWeeks.map(wk => (
                    <option key={wk.key} value={wk.key}>
                      {wk.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {availableWeeks.length >= 2 && (
              <button
                onClick={() => {
                  setSelectedWeek1(availableWeeks[1].key);
                  setSelectedWeek2(availableWeeks[0].key);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold transition-colors self-start md:self-auto"
              >
                Semana Anterior vs Semana Actual
              </button>
            )}
          </div>
        )}

        {compareMode === 'months' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">1. Mes Inicial (Base):</span>
                <select
                  value={selectedMonth1}
                  onChange={(e) => setSelectedMonth1(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableMonths.map(mo => (
                    <option key={mo.key} value={mo.key}>
                      {mo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">2. Mes Final (Comparación):</span>
                <select
                  value={selectedMonth2}
                  onChange={(e) => setSelectedMonth2(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableMonths.map(mo => (
                    <option key={mo.key} value={mo.key}>
                      {mo.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {availableMonths.length >= 2 && (
              <button
                onClick={() => {
                  setSelectedMonth1(availableMonths[1].key);
                  setSelectedMonth2(availableMonths[0].key);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold transition-colors self-start md:self-auto"
              >
                Mes Anterior vs Mes Actual
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Differences Matrix Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" id="diff-matrix-card">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-600" />
              <span>Matriz de Comparación y Diferencias de Averías</span>
            </h2>
            <p className="text-xs text-slate-500">
              Diferencia de averías {labelText}
            </p>
          </div>

          {/* Color Legend & Copy Actions */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" />
              Verde Suave: Negativo (-4) = Averías Resueltas
            </span>
            <span className="bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" />
              Rojo Suave: Positivo (+3) = Incremento de Averías
            </span>
            <span className="bg-slate-100 text-slate-700 border border-slate-300 font-bold px-2 py-1 rounded-lg">
              Blanco: Sin Cambios (0)
            </span>

            <div className="flex items-center space-x-1.5 ml-1">
              <CopyImageButton elementId="diff-matrix-card" label="Copiar Imagen" variant="outline" />
              <CopyTableButton headers={matrixCopyHeaders} rows={matrixCopyRows} title={`Matriz de Diferencias - Comparación ${labelText}`} variant="outline" />
            </div>
          </div>
        </div>

        {/* Network Net Status Banner */}
        <div className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
          networkSummary.netDiff < 0
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : networkSummary.netDiff > 0
            ? 'bg-rose-50 text-rose-900 border-rose-200'
            : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}>
          <div className="flex items-center space-x-2">
            {networkSummary.netDiff < 0 ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : networkSummary.netDiff > 0 ? (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <Info className="w-5 h-5 text-slate-500" />
            )}
            <span>
              Resumen Global de Red: <strong>{networkSummary.totalInitial} reportes</strong> en [{period1Label}] → <strong>{networkSummary.totalFinal} reportes</strong> en [{period2Label}].
            </span>
          </div>

          <div className="text-sm font-black">
            Diferencia Total Red: {networkSummary.netDiff > 0 ? `+${networkSummary.netDiff}` : networkSummary.netDiff} reportes
          </div>
        </div>

        {/* Matrix Table */}
        <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 min-w-[180px] sticky left-0 bg-slate-900 z-10">Central Telefónica</th>
                {workGroups.map(grp => (
                  <th key={grp.id} className="p-3 text-center min-w-[130px]">
                    <div className="font-bold">{grp.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">Diferencia (Inicial → Final)</div>
                  </th>
                ))}
                <th className="p-3 text-center bg-slate-800 min-w-[150px]">
                  <div>SUMA FINAL CENTRAL</div>
                  <div className="text-[10px] text-slate-300 font-normal">Total Net Diferencia</div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {matrixRows.map(row => {
                const centralObj = centrales.find(c => c.id === row.centralId);

                return (
                  <tr key={row.centralId} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Central Name */}
                    <td className="p-3 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-sm">
                      <div>{row.centralName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{centralObj?.code}</div>
                    </td>

                    {/* Group Cells */}
                    {workGroups.map(grp => {
                      const cell = row.groupDiffs[grp.id] || { valInitial: 0, valFinal: 0, diff: 0, status: 'unchanged' };

                      let cellClass = 'bg-white text-slate-700 border-slate-200';
                      if (cell.diff < 0) {
                        cellClass = 'bg-emerald-100 text-emerald-900 font-bold border-emerald-300';
                      } else if (cell.diff > 0) {
                        cellClass = 'bg-rose-100 text-rose-900 font-bold border-rose-300';
                      }

                      return (
                        <td key={grp.id} className="p-2.5 text-center border-r border-slate-100">
                          <div className={`p-2 rounded-xl border transition-all ${cellClass}`}>
                            <div className="text-sm font-extrabold flex items-center justify-center gap-1">
                              {cell.diff < 0 && <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />}
                              {cell.diff > 0 && <ArrowUp className="w-3.5 h-3.5 text-rose-700" />}
                              {cell.diff === 0 && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                              <span>{cell.diff > 0 ? `+${cell.diff}` : cell.diff}</span>
                            </div>
                            <div className="text-[10px] opacity-75 font-medium mt-0.5">
                              ({cell.valInitial} → {cell.valFinal})
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    {/* Row Total Sum for Central */}
                    <td className="p-3 text-center bg-slate-50 font-bold border-r border-slate-200">
                      <div className="text-slate-800 font-semibold text-xs">
                        {row.totalInitial} → {row.totalFinal}
                      </div>
                      <div className={`mt-1 inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg border ${
                        row.totalDiff < 0
                          ? 'bg-emerald-200 text-emerald-950 border-emerald-300'
                          : row.totalDiff > 0
                          ? 'bg-rose-200 text-rose-950 border-rose-300'
                          : 'bg-slate-200 text-slate-300 border-slate-300'
                      }`}>
                        <span>Suma: {row.totalDiff > 0 ? `+${row.totalDiff}` : row.totalDiff}</span>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>

            {/* Total Footer */}
            <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-800">
              <tr>
                <td className="p-3 sticky left-0 bg-slate-900">SUMA TOTAL RED</td>
                {workGroups.map(grp => {
                  let grpInit = 0;
                  let grpFin = 0;
                  matrixRows.forEach(r => {
                    const cd = r.groupDiffs[grp.id];
                    if (cd) {
                      grpInit += cd.valInitial;
                      grpFin += cd.valFinal;
                    }
                  });
                  const grpDiff = grpFin - grpInit;
                  return (
                    <td key={grp.id} className="p-3 text-center border-r border-slate-800">
                      <div className="text-xs">{grpInit} → {grpFin}</div>
                      <div className={`text-xs font-extrabold mt-0.5 ${
                        grpDiff < 0 ? 'text-emerald-400' : grpDiff > 0 ? 'text-rose-400' : 'text-slate-300'
                      }`}>
                        {grpDiff > 0 ? `+${grpDiff}` : grpDiff}
                      </div>
                    </td>
                  );
                })}
                <td className="p-3 text-center bg-slate-800">
                  <div className="text-xs text-slate-300">{networkSummary.totalInitial} → {networkSummary.totalFinal}</div>
                  <div className={`text-sm font-black mt-0.5 ${
                    networkSummary.netDiff < 0 ? 'text-emerald-400' : networkSummary.netDiff > 0 ? 'text-rose-400' : 'text-slate-200'
                  }`}>
                    {networkSummary.netDiff > 0 ? `+${networkSummary.netDiff}` : networkSummary.netDiff}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

    </div>
  );
};
