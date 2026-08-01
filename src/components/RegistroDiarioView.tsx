import React, { useState, useEffect } from 'react';
import { CalendarPlus, Save, CheckCircle2, Calendar, RefreshCw } from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import { getTodayStr, isFutureDate, formatDateLong } from '../utils/dateUtils';

interface RegistroDiarioViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  onSaveDailyGrid: (reportsToSave: DailyReport[], targetDate: string) => void;
}

export const RegistroDiarioView: React.FC<RegistroDiarioViewProps> = ({
  centrales,
  workGroups,
  reports,
  onSaveDailyGrid
}) => {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [gridValues, setGridValues] = useState<Record<string, Record<string, number>>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load existing reports for selected date into gridValues
  useEffect(() => {
    const newGrid: Record<string, Record<string, number>> = {};

    centrales.forEach(c => {
      newGrid[c.id] = {};
      workGroups.forEach(g => {
        newGrid[c.id][g.id] = 0;
      });
    });

    reports.forEach(r => {
      if (r.date === selectedDate) {
        if (!newGrid[r.centralId]) newGrid[r.centralId] = {};
        newGrid[r.centralId][r.workGroupId] = r.reportCount;
      }
    });

    setGridValues(newGrid);
    setSaveMessage(null);
  }, [selectedDate, reports, centrales, workGroups]);

  const handleValueChange = (centralId: string, groupId: string, valueStr: string) => {
    const val = parseInt(valueStr, 10) || 0;
    setGridValues(prev => ({
      ...prev,
      [centralId]: {
        ...(prev[centralId] || {}),
        [groupId]: Math.max(0, val)
      }
    }));
  };

  const handleSaveGrid = () => {
    if (isFutureDate(selectedDate)) {
      alert(`No se permite registrar reportes en fechas futuras (${selectedDate}).`);
      return;
    }

    const reportsToSave: DailyReport[] = [];

    centrales.forEach(central => {
      workGroups.forEach(grp => {
        const count = gridValues[central.id]?.[grp.id] || 0;
        reportsToSave.push({
          id: `rep_${selectedDate}_${central.id}_${grp.id}`,
          date: selectedDate,
          centralId: central.id,
          workGroupId: grp.id,
          reportCount: count,
          updatedAt: new Date().toISOString()
        });
      });
    });

    onSaveDailyGrid(reportsToSave, selectedDate);
    setSaveMessage(`Reportes diarios guardados correctamente para el ${formatDateLong(selectedDate)}.`);
    
    setTimeout(() => {
      setSaveMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-blue-600" />
              <span>Registro Diario de Averías por Central</span>
            </h2>
            <p className="text-xs text-slate-500">
              Ingrese o edite la cantidad de reportes registrados para la fecha seleccionada
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-blue-600" />
            <label className="text-xs font-semibold text-slate-700">Seleccionar Fecha:</label>
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                if (isFutureDate(val)) {
                  alert(`No se permiten fechas futuras. Ajustado a hoy: ${todayStr}`);
                  setSelectedDate(todayStr);
                } else {
                  setSelectedDate(val);
                }
              }}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {saveMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Matrix Input Table */}
        <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-900 text-white font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 min-w-[180px] sticky left-0 bg-slate-900 z-10">Central Telefónica</th>
                {workGroups.map(grp => (
                  <th key={grp.id} className="p-3 text-center min-w-[130px]">
                    <div>{grp.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">({grp.code})</div>
                  </th>
                ))}
                <th className="p-3 text-center bg-slate-800 min-w-[120px]">TOTAL DÍA</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {centrales.map(central => {
                let centralTotal = 0;
                workGroups.forEach(g => {
                  centralTotal += gridValues[central.id]?.[g.id] || 0;
                });

                return (
                  <tr key={central.id} className="hover:bg-slate-50 transition-colors">
                    
                    <td className="p-3 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-sm">
                      <div>{central.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{central.code}</div>
                    </td>

                    {workGroups.map(grp => (
                      <td key={grp.id} className="p-2.5 text-center border-r border-slate-100">
                        <input
                          type="number"
                          min="0"
                          value={gridValues[central.id]?.[grp.id] ?? 0}
                          onChange={(e) => handleValueChange(central.id, grp.id, e.target.value)}
                          className="w-20 text-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </td>
                    ))}

                    <td className="p-3 text-center bg-slate-50 font-extrabold text-sm text-slate-900">
                      {centralTotal}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveGrid}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Reportes de Fecha {selectedDate}</span>
          </button>
        </div>

      </div>

    </div>
  );
};
