import React, { useState, useEffect } from 'react';
import { Calendar, Filter, RotateCcw, AlertTriangle, Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import { MONTH_NAMES_ES, getTodayStr, isFutureDate } from '../utils/dateUtils';

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

  // Draft Filter States
  const [draftMonth, setDraftMonth] = useState<number>(month);
  const [draftYear, setDraftYear] = useState<number>(year);
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate || '');
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate || '');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Sync draft states when applied props change from outside
  useEffect(() => {
    setDraftMonth(month);
  }, [month]);

  useEffect(() => {
    setDraftYear(year);
  }, [year]);

  useEffect(() => {
    setDraftStartDate(startDate || '');
  }, [startDate]);

  useEffect(() => {
    setDraftEndDate(endDate || '');
  }, [endDate]);

  // Check if draft selections differ from currently applied filters
  const hasPendingChanges = 
    (showMonthYear && (draftMonth !== month || draftYear !== year)) ||
    (showDateRange && (draftStartDate !== (startDate || '') || draftEndDate !== (endDate || '')));

  // Option A & E: Execute search / apply filters with ultra-fast micro-feedback (~120ms)
  const handleApplySearch = () => {
    setIsSearching(true);
    if (showMonthYear) {
      setMonth?.(draftMonth);
      setYear?.(draftYear);
    }
    if (showDateRange) {
      setStartDate?.(draftStartDate);
      setEndDate?.(draftEndDate);
    }
    setTimeout(() => {
      setIsSearching(false);
    }, 120);
  };

  // Option C: Reset filters
  const handleReset = () => {
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();
    setDraftMonth(curMonth);
    setDraftYear(curYear);
    setDraftStartDate('');
    setDraftEndDate('');
    onResetFilters?.();
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isFutureDate(val)) {
      alert(`No se permiten fechas futuras (${val}). Se ha ajustado a la fecha actual: ${todayStr}`);
      setDraftStartDate(todayStr);
    } else {
      setDraftStartDate(val);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isFutureDate(val)) {
      alert(`No se permiten fechas futuras (${val}). Se ha ajustado a la fecha actual: ${todayStr}`);
      setDraftEndDate(todayStr);
    } else {
      setDraftEndDate(val);
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm mb-5 transition-all"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleApplySearch();
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filtros Estadísticos</span>
          </div>

          {/* Month & Year Selectors */}
          {showMonthYear && setMonth && setYear && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-inner">
                <label className="text-slate-500 font-bold">Mes:</label>
                <select
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(parseInt(e.target.value, 10))}
                  className="bg-transparent text-slate-800 font-bold focus:ring-0 focus:outline-none cursor-pointer"
                >
                  <option value={-1}>Todos los meses</option>
                  {MONTH_NAMES_ES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-inner">
                <label className="text-slate-500 font-bold">Año:</label>
                <select
                  value={draftYear}
                  onChange={(e) => setDraftYear(parseInt(e.target.value, 10))}
                  className="bg-transparent text-slate-800 font-bold focus:ring-0 focus:outline-none cursor-pointer"
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
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <label className="text-slate-500 font-bold">Desde:</label>
                <input
                  type="date"
                  max={todayStr}
                  value={draftStartDate}
                  onChange={handleStartDateChange}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <label className="text-slate-500 font-bold">Hasta:</label>
                <input
                  type="date"
                  max={todayStr}
                  value={draftEndDate}
                  onChange={handleEndDateChange}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* BOTÓN 🔎 Buscar y Aplicar Filtros con Micro-Feedback */}
          <button
            type="button"
            onClick={handleApplySearch}
            disabled={isSearching}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md active:scale-95 ${
              hasPendingChanges
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white ring-2 ring-blue-400/60 shadow-blue-500/30 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
            }`}
            title="🔎 Buscar y aplicar filtros a los gráficos y tablas (Atajo: Presione Enter)"
          >
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>Buscar</span>
            {hasPendingChanges && (
              <span className="px-1.5 py-0.5 bg-amber-300 text-slate-900 font-black text-[9px] rounded-full uppercase tracking-wider">
                Pendiente
              </span>
            )}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 text-xs">
          {onResetFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition-all font-bold border border-slate-200 cursor-pointer shadow-sm active:scale-95"
              title="Restablecer filtros"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Restablecer</span>
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-1 text-slate-400 text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Máx: Hoy ({todayStr})</span>
          </div>
        </div>

      </div>

      {/* Pending status banner if draft differs */}
      {hasPendingChanges && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-700 bg-blue-50/70 px-3 py-1.5 rounded-lg font-medium">
          <span>
            Filtros seleccionados pendientes de aplicar. Presione <strong>"🔎 Buscar"</strong> o la tecla <strong>[Enter]</strong> para actualizar los datos.
          </span>
          <span className="font-bold underline cursor-pointer hover:text-blue-900" onClick={handleApplySearch}>
            Aplicar ahora →
          </span>
        </div>
      )}
    </div>
  );
};
