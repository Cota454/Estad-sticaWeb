import React from 'react';
import { Calendar, Filter, RotateCcw, AlertTriangle } from 'lucide-react';
import { MONTH_NAMES_ES, getTodayStr, isFutureDate, clampDateToToday } from '../utils/dateUtils';

interface FilterBarProps {
  month?: number;
  setMonth?: (m: number) => void;
  year?: number;
  setYear?: (y: number) => void;
  startDate?: string;
  setStartDate?: (d: string) => void;
  endDate?: string;
  setEndDate?: (d: string) => void;
  showMonthYear?: boolean;
  showDateRange?: boolean;
  onResetFilters?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  month = new Date().getMonth(),
  setMonth,
  year = new Date().getFullYear(),
  setYear,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  showMonthYear = true,
  showDateRange = false,
  onResetFilters
}) => {
  const todayStr = getTodayStr();
  const currentYear = new Date().getFullYear();
  const yearsOptions = [currentYear - 2, currentYear - 1, currentYear];

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isFutureDate(val)) {
      alert(`No se permiten fechas futuras (${val}). Se ha ajustado a la fecha actual: ${todayStr}`);
      setStartDate?.(todayStr);
    } else {
      setStartDate?.(val);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isFutureDate(val)) {
      alert(`No se permiten fechas futuras (${val}). Se ha ajustado a la fecha actual: ${todayStr}`);
      setEndDate?.(todayStr);
    } else {
      setEndDate?.(val);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 font-semibold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filtros Estadísticos</span>
          </div>

          {/* Month & Year Selectors */}
          {showMonthYear && setMonth && setYear && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <label className="text-slate-500 font-medium">Mes:</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={-1}>Todos los meses</option>
                  {MONTH_NAMES_ES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1">
                <label className="text-slate-500 font-medium">Año:</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={-1}>Todos los años</option>
                  {yearsOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Date Range Pickers */}
          {showDateRange && setStartDate && setEndDate && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <label className="text-slate-500 font-medium">Fecha Inicial:</label>
                <input
                  type="date"
                  max={todayStr}
                  value={startDate || ''}
                  onChange={handleStartDateChange}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <label className="text-slate-500 font-medium">Fecha Final:</label>
                <input
                  type="date"
                  max={todayStr}
                  value={endDate || ''}
                  onChange={handleEndDateChange}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 text-xs">
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors font-medium border border-slate-200"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Limpiar Filtros</span>
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-1 text-slate-400 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Máx: Hoy ({todayStr})</span>
          </div>
        </div>

      </div>
    </div>
  );
};
