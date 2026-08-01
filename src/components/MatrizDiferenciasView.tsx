import React, { useState, useMemo } from 'react';
import { GitCompare, ArrowDown, ArrowUp, Minus, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Central, WorkGroup, DailyReport, DifferenceRow } from '../types';
import { FilterBar } from './FilterBar';
import { calculateDifferenceMatrix } from '../utils/statCalculations';
import { getTodayStr, getPastDateStr, formatDateLong } from '../utils/dateUtils';

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

  const [startDate, setStartDate] = useState<string>(yesterdayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Calculate Difference Matrix
  const matrixRows: DifferenceRow[] = useMemo(() => {
    return calculateDifferenceMatrix(reports, startDate, endDate, centrales, workGroups);
  }, [reports, startDate, endDate, centrales, workGroups]);

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

  return (
    <div className="space-y-6">
      
      {/* Date Pickers */}
      <FilterBar
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        showMonthYear={false}
        showDateRange={true}
        onResetFilters={() => {
          setStartDate(yesterdayStr);
          setEndDate(todayStr);
        }}
      />

      {/* Main Differences Matrix Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-600" />
              <span>Matriz de Comparación y Diferencias de Averías</span>
            </h2>
            <p className="text-xs text-slate-500">
              Diferencia de averías entre {formatDateLong(startDate)} y {formatDateLong(endDate)}
            </p>
          </div>

          {/* Color Legend Badge */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" />
              Verde Suave: Negativo (-4) = Averías Resueltas (Trabajando bien)
            </span>
            <span className="bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" />
              Rojo Suave: Positivo (+3) = Incremento de Averías
            </span>
            <span className="bg-slate-100 text-slate-700 border border-slate-300 font-bold px-2 py-1 rounded-lg">
              Blanco: Sin Cambios (0)
            </span>
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
              Resumen Global de Red: {networkSummary.totalInitial} reportes en {formatDateLong(startDate)} → {networkSummary.totalFinal} reportes en {formatDateLong(endDate)}.
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

                      // Cell Background & Text Color Logic per user instructions:
                      // Verde Suave if diff < 0 (-4)
                      // Rojo Suave if diff > 0 (+3)
                      // Blanco if diff === 0
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
                          : 'bg-slate-200 text-slate-800 border-slate-300'
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
