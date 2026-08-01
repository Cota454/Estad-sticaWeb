import React, { useState, useMemo } from 'react';
import { Cpu, Edit3, Save, X, Info, Percent, Filter, Building2, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Central, WorkGroup, DailyReport, TechInstalledRow } from '../types';
import { FilterBar } from './FilterBar';
import { calculateTechInstalledMatrix, filterReportsByDateRange, getCentralTotalCapacity } from '../utils/statCalculations';
import { getTodayStr, getPastDateStr } from '../utils/dateUtils';

interface TecnicaInstaladaViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  onUpdateCentrales: (updated: Central[]) => void;
}

export const TecnicaInstaladaView: React.FC<TecnicaInstaladaViewProps> = ({
  centrales,
  workGroups,
  reports,
  onUpdateCentrales
}) => {
  const todayStr = getTodayStr();
  const [startDate, setStartDate] = useState<string>(getPastDateStr(30));
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Edit Capacity Modal / Inline mode state
  const [editingCentral, setEditingCentral] = useState<Central | null>(null);
  const [editTotalTechValue, setEditTotalTechValue] = useState<number>(0);

  // Calculate Tech Installed matrix
  const matrixData: TechInstalledRow[] = useMemo(() => {
    return calculateTechInstalledMatrix(reports, startDate, endDate, centrales, workGroups);
  }, [reports, startDate, endDate, centrales, workGroups]);

  // Filter reports in selected date range (excluding non-working Sundays)
  const filteredReports = useMemo(() => {
    return filterReportsByDateRange(reports, startDate, endDate, true);
  }, [reports, startDate, endDate]);

  // Chart Filters State with Fallback to valid IDs
  const [selectedCentralForChart, setSelectedCentralForChart] = useState<string>('');
  const [selectedGroupForChart, setSelectedGroupForChart] = useState<string>('');

  // Auto-initialize default filter selections when data loads
  React.useEffect(() => {
    if (!selectedCentralForChart && centrales.length > 0) {
      setSelectedCentralForChart(centrales[0].id);
    }
  }, [centrales, selectedCentralForChart]);

  React.useEffect(() => {
    if (!selectedGroupForChart && workGroups.length > 0) {
      setSelectedGroupForChart(workGroups[0].id);
    }
  }, [workGroups, selectedGroupForChart]);

  const effectiveCentralId = useMemo(() => {
    if (selectedCentralForChart && centrales.some(c => c.id === selectedCentralForChart)) {
      return selectedCentralForChart;
    }
    return centrales[0]?.id || '';
  }, [selectedCentralForChart, centrales]);

  const effectiveGroupId = useMemo(() => {
    if (selectedGroupForChart && workGroups.some(g => g.id === selectedGroupForChart)) {
      return selectedGroupForChart;
    }
    return workGroups[0]?.id || '';
  }, [selectedGroupForChart, workGroups]);

  // 1. Chart Data for Selected Central
  const chartDataByCentral = useMemo(() => {
    if (!effectiveCentralId) return [];
    const central = centrales.find(c => c.id === effectiveCentralId);
    if (!central) return [];

    const totalCentralCapacity = getCentralTotalCapacity(central);

    const counts: Record<string, number> = {};
    filteredReports.forEach(r => {
      if (r.centralId === effectiveCentralId) {
        counts[r.workGroupId] = (counts[r.workGroupId] || 0) + r.reportCount;
      }
    });

    return workGroups.map(g => {
      const repCount = counts[g.id] || 0;
      const pct = totalCentralCapacity > 0 ? parseFloat(((repCount / totalCentralCapacity) * 100).toFixed(2)) : 0;
      return {
        name: g.name,
        code: g.code,
        reports: repCount,
        percentage: pct,
        color: g.color || '#3b82f6'
      };
    });
  }, [effectiveCentralId, centrales, workGroups, filteredReports]);

  // 2. Chart Data for Selected WorkGroup
  const chartDataByGroup = useMemo(() => {
    if (!effectiveGroupId) return [];

    const counts: Record<string, number> = {};
    filteredReports.forEach(r => {
      if (r.workGroupId === effectiveGroupId) {
        counts[r.centralId] = (counts[r.centralId] || 0) + r.reportCount;
      }
    });

    return centrales.map(c => {
      const repCount = counts[c.id] || 0;
      const centralCapacity = getCentralTotalCapacity(c);
      const pct = centralCapacity > 0 ? parseFloat(((repCount / centralCapacity) * 100).toFixed(2)) : 0;
      return {
        name: c.name,
        code: c.code,
        reports: repCount,
        percentage: pct
      };
    });
  }, [effectiveGroupId, centrales, filteredReports]);

  // Overall Network Totals
  const networkTotals = useMemo(() => {
    let totalReports = 0;
    let totalCapacity = 0;
    matrixData.forEach(row => {
      totalReports += row.totalReports;
      totalCapacity += row.totalCapacity;
    });
    const percentage = totalCapacity > 0 ? parseFloat(((totalReports / totalCapacity) * 100).toFixed(2)) : 0;
    return { totalReports, totalCapacity, percentage };
  }, [matrixData]);

  const handleOpenEditModal = (central: Central) => {
    setEditingCentral(central);
    setEditTotalTechValue(getCentralTotalCapacity(central));
  };

  const handleSaveTechValues = () => {
    if (!editingCentral) return;
    const updatedCentrales = centrales.map(c => {
      if (c.id === editingCentral.id) {
        return {
          ...c,
          installedTech: { total: editTotalTechValue }
        };
      }
      return c;
    });
    onUpdateCentrales(updatedCentrales);
    setEditingCentral(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Date Range Filter */}
      <FilterBar
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        showMonthYear={false}
        showDateRange={true}
        onResetFilters={() => {
          setStartDate(getPastDateStr(30));
          setEndDate(todayStr);
        }}
      />

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <span>Porcentaje de Averías sobre Técnica Instalada</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cálculo de porcentaje de interrupción de cada grupo respecto al total de Técnica Instalada de la central
            </p>
          </div>

          <div className="bg-blue-50 text-blue-900 text-xs px-3.5 py-1.5 rounded-xl border border-blue-200 font-semibold flex items-center gap-2">
            <Percent className="w-4 h-4 text-blue-600" />
            <span>Ocupación Global de Averías: <strong>{networkTotals.percentage}%</strong> ({networkTotals.totalReports} reportes / {networkTotals.totalCapacity.toLocaleString()} técnica instalada)</span>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-900 text-white font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 min-w-[170px] sticky left-0 bg-slate-900 z-10">Central Telefónica</th>
                <th className="p-3 text-center bg-slate-800 min-w-[130px] border-r border-slate-700">
                  <div className="font-bold text-amber-400">Técnica Instalada</div>
                  <div className="text-[10px] text-slate-300 font-normal">(Total Central)</div>
                </th>
                {workGroups.map(grp => (
                  <th key={grp.id} className="p-3 text-center min-w-[140px]">
                    <div className="font-bold">{grp.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">Rep. / % Interrupción</div>
                  </th>
                ))}
                <th className="p-3 text-center bg-slate-800 min-w-[150px]">
                  <div>TOTAL AVERÍAS</div>
                  <div className="text-[10px] text-slate-300 font-normal">Total % Interrupción</div>
                </th>
                <th className="p-3 text-center min-w-[90px]">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {matrixData.map(row => {
                const centralObj = centrales.find(c => c.id === row.centralId);
                return (
                  <tr key={row.centralId} className="hover:bg-slate-50 transition-colors">
                    
                    <td className="p-3 font-bold text-slate-900 sticky left-0 bg-white shadow-sm z-10 border-r border-slate-100">
                      <div>{row.centralName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{centralObj?.code}</div>
                    </td>

                    {/* Técnica Instalada Single Value Column */}
                    <td className="p-3 text-center bg-amber-50/50 font-bold text-slate-900 border-r border-slate-200">
                      <div className="text-sm font-extrabold text-slate-900">{row.totalCapacity.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500 font-normal">unidades</div>
                    </td>

                    {/* Work Group Columns */}
                    {workGroups.map(grp => {
                      const stat = row.groupStats[grp.id] || { reports: 0, capacity: 0, percentage: 0 };
                      const isHighRatio = stat.percentage > 5;

                      return (
                        <td key={grp.id} className="p-3 text-center border-r border-slate-100">
                          <div className="font-bold text-slate-900 text-xs">
                            {stat.reports} <span className="text-slate-400 font-normal">reportes</span>
                          </div>
                          <div className={`mt-1 inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                            isHighRatio ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-blue-800'
                          }`}>
                            {stat.percentage}%
                          </div>
                        </td>
                      );
                    })}

                    {/* Central Row Total */}
                    <td className="p-3 text-center bg-slate-50 font-bold border-r border-slate-200">
                      <div className="text-slate-900 font-extrabold">{row.totalReports} reportes</div>
                      <div className={`mt-1 inline-block text-xs font-black px-2 py-0.5 rounded ${
                        row.totalPercentage > 3 ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {row.totalPercentage}%
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => centralObj && handleOpenEditModal(centralObj)}
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors font-medium border border-slate-200"
                        title="Editar Técnica Instalada de la Central"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Editar</span>
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>

            {/* Total Footer */}
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="p-3 sticky left-0 bg-slate-100">TOTAL RED TELECOM</td>
                <td className="p-3 text-center bg-amber-100/60 font-extrabold text-slate-900 border-r border-slate-200">
                  {networkTotals.totalCapacity.toLocaleString()}
                </td>
                {workGroups.map(grp => {
                  let grpRep = 0;
                  matrixData.forEach(r => {
                    const st = r.groupStats[grp.id];
                    if (st) {
                      grpRep += st.reports;
                    }
                  });
                  const pct = networkTotals.totalCapacity > 0 ? parseFloat(((grpRep / networkTotals.totalCapacity) * 100).toFixed(2)) : 0;
                  return (
                    <td key={grp.id} className="p-3 text-center border-r border-slate-200">
                      <div>{grpRep} rep.</div>
                      <div className="text-[11px] text-blue-700 font-extrabold mt-0.5">{pct}%</div>
                    </td>
                  );
                })}
                <td className="p-3 text-center bg-slate-200">
                  <div className="text-sm font-black">{networkTotals.totalReports} rep.</div>
                  <div className="text-xs text-blue-900 font-black mt-0.5">{networkTotals.percentage}%</div>
                </td>
                <td className="p-3 text-center">-</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      {/* FILTERED CHARTS GRID FOR TECNICA INSTALADA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CHART 1: Filter by Central Telefónica */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Gráfico por Central Telefónica</h3>
                  <p className="text-xs text-slate-500">Averías por Grupo de Trabajo y % sobre Técnica Instalada</p>
                </div>
              </div>

              {/* Central Selector Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 relative z-30">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
                <select
                  value={effectiveCentralId}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedCentralForChart(e.target.value);
                  }}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 cursor-pointer min-w-[170px]"
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
                <BarChart data={chartDataByCentral} margin={{ top: 25, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} reportes (${item.payload.percentage}% del total de técnica instalada)`,
                      'Reportes Registrados'
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

        {/* CHART 2: Filter by Work Group */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Gráfico por Grupo de Trabajo</h3>
                  <p className="text-xs text-slate-500">Distribución de averías del grupo en cada Central Telefónica</p>
                </div>
              </div>

              {/* Group Selector Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 relative z-30">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
                <select
                  value={effectiveGroupId}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedGroupForChart(e.target.value);
                  }}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200 cursor-pointer min-w-[170px]"
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
                <BarChart data={chartDataByGroup} margin={{ top: 25, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} reportes (${item.payload.percentage}% de técnica instalada)`,
                      'Reportes Registrados'
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

      {/* Edit Technical Capacity Modal */}
      {editingCentral && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Técnica Instalada</h3>
                <p className="text-xs text-slate-500">{editingCentral.name} ({editingCentral.code})</p>
              </div>
              <button
                onClick={() => setEditingCentral(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="text-xs text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-200/70 text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Dato único de Técnica Instalada</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Ingrese el total de Técnica Instalada (puertos/líneas) para esta central. Los porcentajes de interrupción de cada grupo se calcularán automáticamente sobre este total.
                </p>
                <p className="text-[10px] text-amber-700 font-medium italic pt-1">
                  Ejemplo: Si Central Este tiene 1,000 de técnica instalada y Planta Exterior registra 100 reportes, la interrupción equivale al 10%.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Técnica Instalada Total (Líneas / Puertos)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editTotalTechValue}
                  onChange={(e) => setEditTotalTechValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ej. 1000"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingCentral(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTechValues}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

