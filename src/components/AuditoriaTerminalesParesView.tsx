import React, { useState, useMemo } from 'react';
import {
  ShieldAlert, AlertTriangle, Clock, Calendar, Filter, Search, Download,
  UserX, Wrench, CheckCircle2, RotateCcw, FileSpreadsheet, Layers,
  Eye, ArrowRight, X, ChevronRight, AlertOctagon, UserCheck, Check,
  Radio, Network, SlidersHorizontal, ArrowDown, ArrowUp
} from 'lucide-react';
import { RepairRecord, PairCannibalizationEvent, PairMatchType, PairSuspicionLevel, TechnicianCollateralDamageSummary } from '../types';
import {
  detectPairCannibalizationEvents,
  calculateTechnicianCollateralRanking,
  exportPairCannibalizationExcel,
  PairFilterOptions
} from '../utils/pairCannibalizationHelper';

interface AuditoriaTerminalesParesViewProps {
  repairRecords: RepairRecord[];
  isDarkMode?: boolean;
}

export const AuditoriaTerminalesParesView: React.FC<AuditoriaTerminalesParesViewProps> = ({
  repairRecords,
  isDarkMode = true
}) => {
  // 1. Time Window Presets State
  const [windowPreset, setWindowPreset] = useState<'24h' | '48h' | '7d' | '15d' | '30d' | 'custom'>('48h');
  const [customMaxDays, setCustomMaxDays] = useState<number>(10);
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  // 2. Filter State
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'SAME_TERMINAL' | 'SIBLING_TERMINAL'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | PairSuspicionLevel>('all');
  const [selectedCentralFilter, setSelectedCentralFilter] = useState<string>('all');
  const [selectedCableFilter, setSelectedCableFilter] = useState<string>('all');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [generalSearchTerm, setGeneralSearchTerm] = useState<string>('');

  // 3. Ranking Table Filters (Afectación por Operario)
  const [rankingSortOrder, setRankingSortOrder] = useState<'desc' | 'asc'>('desc');
  const [rankingLimit, setRankingLimit] = useState<'all' | 5 | 10>('all');
  const [rankingSearchTerm, setRankingSearchTerm] = useState<string>('');

  // 4. Modal / Inspect Case State
  const [inspectedEvent, setInspectedEvent] = useState<PairCannibalizationEvent | null>(null);

  // Compute all unique Centrales & Cables for filter dropdowns
  const availableCentrales = useMemo(() => {
    const s = new Set<string>();
    repairRecords.forEach(r => {
      if (r.centralName) s.add(r.centralName.trim());
    });
    return Array.from(s).sort();
  }, [repairRecords]);

  const availableCables = useMemo(() => {
    const s = new Set<string>();
    repairRecords.forEach(r => {
      if (r.cable) s.add(r.cable.trim());
    });
    return Array.from(s).sort();
  }, [repairRecords]);

  // Compute all raw cannibalization events across the entire dataset with active window
  const allEvents = useMemo(() => {
    const opts: PairFilterOptions = {
      windowPreset,
      customDateFrom: windowPreset === 'custom' && customDateFrom ? customDateFrom : undefined,
      customDateTo: windowPreset === 'custom' && customDateTo ? customDateTo : undefined,
      customMaxDays: windowPreset === 'custom' ? customMaxDays : undefined,
      matchTypeFilter: 'all' // Compute all for ranking completeness
    };
    return detectPairCannibalizationEvents(repairRecords, opts);
  }, [repairRecords, windowPreset, customMaxDays, customDateFrom, customDateTo]);

  // Compute Full Technician Ranking from ALL events (regardless of case filters)
  const fullTechnicianRanking = useMemo(() => {
    return calculateTechnicianCollateralRanking(allEvents);
  }, [allEvents]);

  // Filtered Technician Ranking for the ranking table view
  const filteredTechnicianRanking = useMemo(() => {
    let list = [...fullTechnicianRanking];

    // Filter by search name
    if (rankingSearchTerm.trim()) {
      const q = rankingSearchTerm.trim().toLowerCase();
      list = list.filter(t => t.technician.toLowerCase().includes(q));
    }

    // Sort order
    list.sort((a, b) => {
      if (rankingSortOrder === 'desc') {
        return b.totalCollateralCases - a.totalCollateralCases || b.criticalCases - a.criticalCases;
      } else {
        return a.totalCollateralCases - b.totalCollateralCases || a.criticalCases - b.criticalCases;
      }
    });

    // Limit Top
    if (rankingLimit === 5) return list.slice(0, 5);
    if (rankingLimit === 10) return list.slice(0, 10);
    return list;
  }, [fullTechnicianRanking, rankingSortOrder, rankingLimit, rankingSearchTerm]);

  // Filtered Events for the main Inspection Table
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      // Match Type
      if (matchTypeFilter !== 'all' && ev.matchType !== matchTypeFilter) {
        return false;
      }

      // Severity / Suspicion Level
      if (severityFilter !== 'all' && ev.suspicionLevel !== severityFilter) {
        return false;
      }

      // Central
      if (selectedCentralFilter !== 'all' && ev.centralName !== selectedCentralFilter) {
        return false;
      }

      // Cable
      if (selectedCableFilter !== 'all' && ev.cable !== selectedCableFilter) {
        return false;
      }

      // Technician Filter
      if (selectedTechFilter !== 'all' && ev.suspectedTechnician !== selectedTechFilter) {
        return false;
      }

      // General Search Term (matches service 1, service 2, ticket, terminal, cable)
      if (generalSearchTerm.trim()) {
        const q = generalSearchTerm.trim().toLowerCase();
        const matches =
          ev.firstService.toLowerCase().includes(q) ||
          ev.secondService.toLowerCase().includes(q) ||
          ev.firstTicket.toLowerCase().includes(q) ||
          ev.secondTicket.toLowerCase().includes(q) ||
          ev.cable.toLowerCase().includes(q) ||
          ev.firstTerminal.toLowerCase().includes(q) ||
          ev.secondTerminal.toLowerCase().includes(q) ||
          ev.suspectedTechnician.toLowerCase().includes(q) ||
          ev.secondTech.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allEvents, matchTypeFilter, severityFilter, selectedCentralFilter, selectedCableFilter, selectedTechFilter, generalSearchTerm]);

  // KPIs
  const criticalCount = useMemo(() => allEvents.filter(e => e.suspicionLevel === 'CRITICAL').length, [allEvents]);
  const highCount = useMemo(() => allEvents.filter(e => e.suspicionLevel === 'HIGH').length, [allEvents]);
  const sameTerminalCount = useMemo(() => allEvents.filter(e => e.matchType === 'SAME_TERMINAL').length, [allEvents]);
  const siblingCount = useMemo(() => allEvents.filter(e => e.matchType === 'SIBLING_TERMINAL').length, [allEvents]);

  // Reset Filters Function
  const handleResetFilters = () => {
    setWindowPreset('48h');
    setCustomMaxDays(10);
    setCustomDateFrom('');
    setCustomDateTo('');
    setMatchTypeFilter('all');
    setSeverityFilter('all');
    setSelectedCentralFilter('all');
    setSelectedCableFilter('all');
    setSelectedTechFilter('all');
    setGeneralSearchTerm('');
    setRankingSortOrder('desc');
    setRankingLimit('all');
    setRankingSearchTerm('');
  };

  const isAnyFilterActive =
    windowPreset !== '48h' ||
    matchTypeFilter !== 'all' ||
    severityFilter !== 'all' ||
    selectedCentralFilter !== 'all' ||
    selectedCableFilter !== 'all' ||
    selectedTechFilter !== 'all' ||
    generalSearchTerm.trim() !== '' ||
    rankingSortOrder !== 'desc' ||
    rankingLimit !== 'all' ||
    rankingSearchTerm.trim() !== '';

  return (
    <div className="space-y-6">
      {/* 1. Header & Main Controls Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-rose-500/30 flex items-center space-x-1.5 font-mono">
                <Network className="w-3 h-3 text-rose-400" />
                <span>AUDITORÍA OPERATIVA EN PLANTA EXTERIOR</span>
              </span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-amber-500/30 font-mono">
                DETECCIÓN DE CANIBALIZACIÓN DE PARES
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2.5">
              <ShieldAlert className="w-6 h-6 text-rose-500 flex-shrink-0" />
              <span>Auditoría de Terminales e Interrupciones Colaterales</span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-3xl leading-relaxed">
              Detecta el patrón de <strong className="text-rose-300 font-bold">"desvestir a un santo para vestir a otro"</strong>:
              identifica servicios reparados en un cable/terminal donde, en un intervalo cercano de tiempo,
              un servicio vecino del <strong>mismo terminal o terminal hermano (misma letra, ej. B2 con B4)</strong> cae con avería.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportPairCannibalizationExcel(filteredEvents, fullTechnicianRanking)}
              disabled={filteredEvents.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/25 border border-emerald-400/40 flex items-center space-x-2"
              title="Descargar informe completo en Excel con todas las columnas de auditoría"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Exportar Excel Inspección ({filteredEvents.length})</span>
            </button>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-white font-black text-xs px-3.5 py-2.5 rounded-xl border border-rose-500/30 transition-all flex items-center space-x-1.5"
                title="Restablecer todos los filtros a sus valores predeterminados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Casos Críticos (&le;48h)</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-rose-400">{criticalCount}</span>
                <span className="text-[10px] text-rose-300 font-mono">Inmediatos</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Alta Sospecha (&le;7d)</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-amber-400">{highCount}</span>
                <span className="text-[10px] text-amber-300 font-mono">Misma semana</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Mismo Terminal (Exacto)</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-indigo-300">{sameTerminalCount}</span>
                <span className="text-[10px] text-slate-400 font-mono">100% Bornera</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-sky-500/30 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Terminales Hermanos</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-sky-300">{siblingCount}</span>
                <span className="text-[10px] text-sky-300 font-mono">Misma Letra/Caja</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Panel de Filtros: Ventana Temporal y Coincidencia */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Ventana Temporal y Criterio de Proximidad Física
            </h3>
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <span>Mostrando:</span>
            <span className="text-rose-400 font-mono font-bold">{filteredEvents.length}</span>
            <span>de {allEvents.length} eventos detectados</span>
          </div>
        </div>

        {/* Botones Rápidos de Ventana Temporal (24h, 48h, 7d, 15d, Mes, Fecha Manual) */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Intervalo Máximo entre Reparación y Caída del Vecino (&Delta;t):</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: '24h', label: '⚡ 24 Horas (Inmediato)', badge: '&le; 1 día' },
              { id: '48h', label: '🔴 48 Horas (Recomendado)', badge: '&le; 2 días' },
              { id: '7d', label: '📅 Misma Semana', badge: '&le; 7 días' },
              { id: '15d', label: '📆 Quincena', badge: '&le; 15 días' },
              { id: '30d', label: '🗓️ Mes', badge: '&le; 31 días' },
              { id: 'custom', label: '⚙️ Fecha Manual / Libre', badge: 'Personalizado' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setWindowPreset(item.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  windowPreset === item.id
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
                    : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Selector de Fecha Manual si 'custom' está activo */}
          {windowPreset === 'custom' && (
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-rose-500/30 flex flex-wrap items-center gap-4 animate-fadeIn">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white">Rango de Fechas de Reparación:</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-[11px] text-slate-400">Desde:</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={e => setCustomDateFrom(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:border-rose-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-[11px] text-slate-400">Hasta:</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={e => setCustomDateTo(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:border-rose-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-[11px] text-slate-400">Máx. Días entre ambos:</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={customMaxDays}
                  onChange={e => setCustomMaxDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs text-center font-bold font-mono focus:border-rose-500"
                />
                <span className="text-xs text-slate-400">días</span>
              </div>
            </div>
          )}
        </div>

        {/* Filtros de Tipo de Coincidencia, Central, Cable, Operario y Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {/* Tipo de Coincidencia */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Coincidencia de Terminal
            </label>
            <select
              value={matchTypeFilter}
              onChange={e => setMatchTypeFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:border-rose-500"
            >
              <option value="all">Todos los Tipos</option>
              <option value="SAME_TERMINAL">Mismo Terminal Exacto (B2 = B2)</option>
              <option value="SIBLING_TERMINAL">Hermano (Misma Letra: B2 y B4)</option>
            </select>
          </div>

          {/* Severidad */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Nivel de Sospecha
            </label>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:border-rose-500"
            >
              <option value="all">Todas las Alertas</option>
              <option value="CRITICAL">🔴 Crítico (&le;48h)</option>
              <option value="HIGH">🟠 Alto (&le;7 días)</option>
              <option value="MEDIUM">🟡 Medio (Quincena/Mes)</option>
            </select>
          </div>

          {/* Central */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Central CTA
            </label>
            <select
              value={selectedCentralFilter}
              onChange={e => setSelectedCentralFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:border-rose-500"
            >
              <option value="all">Todas las Centrales</option>
              {availableCentrales.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Cable */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Cable
            </label>
            <select
              value={selectedCableFilter}
              onChange={e => setSelectedCableFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:border-rose-500"
            >
              <option value="all">Todos los Cables</option>
              {availableCables.map(cab => (
                <option key={cab} value={cab}>{cab}</option>
              ))}
            </select>
          </div>

          {/* Búsqueda rápida */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Búsqueda Rápida
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Servicio, terminal, operario..."
                value={generalSearchTerm}
                onChange={e => setGeneralSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-2 text-xs focus:border-rose-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tabla de Ranking de Operarios con Mayor "Daño Colateral" */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-white flex items-center space-x-2">
              <UserX className="w-4 h-4 text-rose-400" />
              <span>Ranking de Operarios con Mayor Sospecha de Desconexión Colateral</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Técnicos cuyas reparaciones coinciden con mayor frecuencia con averías posteriores de vecinos en la misma caja.
            </p>
          </div>

          {selectedTechFilter !== 'all' && (
            <div className="flex items-center space-x-2 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-xl">
              <span className="text-xs text-rose-300 font-bold">Filtrando por: {selectedTechFilter}</span>
              <button
                onClick={() => setSelectedTechFilter('all')}
                className="text-white hover:text-rose-200 text-xs font-black underline ml-1"
              >
                (Quitar filtro)
              </button>
            </div>
          )}
        </div>

        {/* Controles de la Tabla Ranking (Orden, Top 5/10, Búsqueda) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Orden:</span>
            <button
              onClick={() => setRankingSortOrder(rankingSortOrder === 'desc' ? 'asc' : 'desc')}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1"
            >
              {rankingSortOrder === 'desc' ? (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>Mayor a Menor</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Menor a Mayor</span>
                </>
              )}
            </button>

            <span className="text-[11px] font-bold text-slate-400 uppercase ml-2">Mostrar:</span>
            {(['all', 5, 10] as const).map(lim => (
              <button
                key={lim}
                onClick={() => setRankingLimit(lim)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  rankingLimit === lim
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {lim === 'all' ? 'Todos' : `Top ${lim}`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
            <input
              type="text"
              placeholder="Buscar operario..."
              value={rankingSearchTerm}
              onChange={e => setRankingSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:border-rose-500"
            />
          </div>
        </div>

        {/* Tabla Ranking */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Operario / Brigada</th>
                <th className="py-2.5 px-3 text-center">Vecinos Afectados</th>
                <th className="py-2.5 px-3 text-center">Críticos (&le;48h)</th>
                <th className="py-2.5 px-3 text-center">Misma Semana (&le;7d)</th>
                <th className="py-2.5 px-3 text-center">Mismo Terminal</th>
                <th className="py-2.5 px-3 text-center">Terminal Hermano</th>
                <th className="py-2.5 px-3">Cables Más Afectados</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60">
              {filteredTechnicianRanking.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    No se encontraron incidencias colaterales para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredTechnicianRanking.map((item, idx) => {
                  const isSelected = selectedTechFilter === item.technician;
                  return (
                    <tr
                      key={item.technician}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-rose-950/40 border-l-4 border-rose-500' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-white flex items-center space-x-2">
                        <span>{item.technician}</span>
                        {item.criticalCases > 0 && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Tiene casos críticos <= 48h" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-rose-400 text-sm">
                        {item.totalCollateralCases}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full font-mono">
                          {item.criticalCases}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full font-mono">
                          {item.highCases}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                        {item.sameTerminalCases}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-sky-300 font-bold">
                        {item.siblingTerminalCases}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-400">
                        {item.mostAffectedCables.map(c => `${c.cable} (${c.count})`).join(', ') || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTechFilter('all');
                            } else {
                              setSelectedTechFilter(item.technician);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {isSelected ? 'Quitar Filtro' : 'Ver sus Casos'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Tabla Principal de Casos e Inspecciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-rose-400" />
              <span>Matriz de Inspección de Servicios Interrumpidos por Cable y Terminal</span>
            </h3>
            <p className="text-xs text-slate-400">
              Contrasta cronológicamente la intervención del 1er servicio reparado frente a la avería subsecuente en el terminal vecino.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            Total Resultados: <strong className="text-rose-400">{filteredEvents.length}</strong>
          </span>
        </div>

        {/* Tabla Principal */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Alerta</th>
                <th className="py-3 px-3">Cable & Dispersión</th>
                <th className="py-3 px-3">Relación Terminal</th>
                <th className="py-3 px-3 bg-slate-900/80">Servicio 1 (Reparado)</th>
                <th className="py-3 px-3 bg-slate-900/80">Fecha 1 & Operario</th>
                <th className="py-3 px-3 bg-rose-950/20">Servicio 2 (Interrumpido)</th>
                <th className="py-3 px-3 bg-rose-950/20">Fecha 2 & Diagnóstico</th>
                <th className="py-3 px-3 text-center">Intervalo (&Delta;t)</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 space-y-2">
                    <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-bold">No se encontraron casos con los filtros aplicados.</p>
                    <p className="text-[11px] text-slate-600">Pruebe ampliando la ventana temporal o limpiando los filtros de búsqueda.</p>
                  </td>
                </tr>
              ) : (
                filteredEvents.map(ev => {
                  const isCritical = ev.suspicionLevel === 'CRITICAL';
                  const isHigh = ev.suspicionLevel === 'HIGH';

                  return (
                    <tr
                      key={ev.id}
                      className={`hover:bg-slate-800/60 transition-colors ${
                        isCritical ? 'bg-rose-950/15' : ''
                      }`}
                    >
                      {/* Alerta Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isCritical ? (
                          <span className="bg-rose-500/20 text-rose-300 font-black text-[10px] px-2.5 py-1 rounded-full border border-rose-500/40 flex items-center space-x-1 w-max">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping mr-1" />
                            CRÍTICO (&le;48h)
                          </span>
                        ) : isHigh ? (
                          <span className="bg-amber-500/20 text-amber-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center space-x-1 w-max">
                            ALTO (&le;7d)
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 font-bold text-[10px] px-2 py-0.5 rounded-full w-max">
                            MEDIO
                          </span>
                        )}
                      </td>

                      {/* Cable & Central */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white text-[12px]">{ev.cable}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ev.centralName}</div>
                      </td>

                      {/* Relación de Terminal */}
                      <td className="py-3 px-3">
                        {ev.matchType === 'SAME_TERMINAL' ? (
                          <div className="space-y-0.5">
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded border border-indigo-500/30 font-mono">
                              Mismo Terminal ({ev.firstTerminal})
                            </span>
                            <div className="text-[10px] text-slate-400">100% Bornera común</div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="bg-sky-500/20 text-sky-300 text-[10px] font-black px-2 py-0.5 rounded border border-sky-500/30 font-mono">
                              Hermano (Caja {ev.blockLetter})
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {ev.firstTerminal} ➔ {ev.secondTerminal}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Servicio 1 (Reparado / Donante) */}
                      <td className="py-3 px-3 bg-slate-900/40">
                        <div className="font-bold font-mono text-white text-[12px]">{ev.firstService}</div>
                        <div className="text-[10px] text-slate-400">
                          Term: <strong className="text-indigo-300">{ev.firstTerminal}</strong>
                          {ev.firstPair ? ` | Par: ${ev.firstPair}` : ''}
                        </div>
                      </td>

                      {/* Fecha 1 & Operario */}
                      <td className="py-3 px-3 bg-slate-900/40">
                        <div className="font-semibold text-rose-300 text-[11px]">{ev.suspectedTechnician}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                          <span>{ev.firstDate}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-amber-400">{ev.firstClave}</span>
                        </div>
                      </td>

                      {/* Servicio 2 (Interrumpido / Vecino) */}
                      <td className="py-3 px-3 bg-rose-950/10">
                        <div className="font-bold font-mono text-white text-[12px]">{ev.secondService}</div>
                        <div className="text-[10px] text-slate-400">
                          Term: <strong className="text-sky-300">{ev.secondTerminal}</strong>
                          {ev.secondPair ? ` | Par: ${ev.secondPair}` : ''}
                        </div>
                      </td>

                      {/* Fecha 2 & Diagnóstico */}
                      <td className="py-3 px-3 bg-rose-950/10">
                        <div className="font-semibold text-slate-200 text-[11px]">{ev.secondTech}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                          <span>{ev.secondDate}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-rose-400">{ev.secondClave}</span>
                        </div>
                      </td>

                      {/* Intervalo Delta t */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono inline-block ${
                          ev.diffDays <= 1
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : ev.diffDays <= 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {ev.diffDays === 0 ? 'Mismo día' : `+${ev.diffDays} d`}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-0.5">{ev.intervalCategory}</div>
                      </td>

                      {/* Botón Inspeccionar */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setInspectedEvent(ev)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1 mx-auto"
                          title="Ver ficha técnica de inspección en campo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspeccionar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Modal / Ficha Técnica de Inspección en Campo */}
      {inspectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-rose-400 font-mono tracking-wider">
                    FICHA DE AUDITORÍA E INSPECCIÓN FÍSICA
                  </span>
                  <h3 className="text-lg font-black text-white">
                    Sospecha de Desconexión / Canibalización de Par
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setInspectedEvent(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
              {/* Resumen de Infraestructura */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block">CABLE</span>
                  <span className="font-black text-white text-sm">{inspectedEvent.cable}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">CENTRAL</span>
                  <span className="font-bold text-slate-200">{inspectedEvent.centralName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">RELACIÓN CAJA</span>
                  <span className="font-bold text-rose-400">
                    {inspectedEvent.matchType === 'SAME_TERMINAL'
                      ? 'Mismo Terminal Exacto'
                      : `Hermano (Bloque ${inspectedEvent.blockLetter})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">TIEMPO ENTRE EVENTOS</span>
                  <span className="font-black text-amber-400 text-sm">
                    {inspectedEvent.diffDays} días ({inspectedEvent.intervalCategory})
                  </span>
                </div>
              </div>

              {/* Comparativa Causal: Servicio 1 vs Servicio 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Servicio 1: El Donante / Reparado */}
                <div className="bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
                      1. Intervención Previa (Donante)
                    </span>
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded">
                      Cierre Exitoso
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Servicio / Abonado:</span>
                      <strong className="text-white font-mono text-sm">{inspectedEvent.firstService}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Terminal / Caja:</span>
                      <strong className="text-indigo-300 font-mono text-sm">{inspectedEvent.firstTerminal}</strong>
                      {inspectedEvent.firstPair && <span className="text-slate-400 ml-2">(Par: {inspectedEvent.firstPair})</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Fecha de Atención:</span>
                      <strong className="text-white font-mono">{inspectedEvent.firstDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Operario / Técnico:</span>
                      <strong className="text-rose-300">{inspectedEvent.suspectedTechnician}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Clave de Cierre:</span>
                      <span className="text-amber-400 font-bold">{inspectedEvent.firstClave}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Ticket / Folio:</span>
                      <span className="text-slate-300 font-mono">{inspectedEvent.firstTicket}</span>
                    </div>
                  </div>
                </div>

                {/* Servicio 2: El Interrumpido / Vecino Afectado */}
                <div className="bg-slate-950/80 border border-rose-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                    <span className="text-xs font-black text-rose-400 uppercase tracking-wider">
                      2. Interrupción Vecino (Afectado)
                    </span>
                    <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded">
                      Caída Posterior
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Servicio Vecino:</span>
                      <strong className="text-white font-mono text-sm">{inspectedEvent.secondService}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Terminal / Caja:</span>
                      <strong className="text-sky-300 font-mono text-sm">{inspectedEvent.secondTerminal}</strong>
                      {inspectedEvent.secondPair && <span className="text-slate-400 ml-2">(Par: {inspectedEvent.secondPair})</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Fecha de Caída / Reparación:</span>
                      <strong className="text-white font-mono">{inspectedEvent.secondDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Técnico que Atendió el Reclamo:</span>
                      <strong className="text-slate-200">{inspectedEvent.secondTech}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Clave Diagnosticada:</span>
                      <span className="text-rose-400 font-bold">{inspectedEvent.secondClave}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Ticket / Folio:</span>
                      <span className="text-slate-300 font-mono">{inspectedEvent.secondTicket}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagnóstico Técnico de Auditoría */}
              <div className="bg-rose-950/30 border border-rose-500/40 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Diagnóstico y Patrón de Sospecha</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {inspectedEvent.description}
                </p>
              </div>

              {/* Checklist de Inspección en Campo */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-indigo-400" />
                  <span>Protocolo de Inspección Física Recomendado</span>
                </h4>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-5">
                  <li>Verificar visualmente en la caja de dispersión {inspectedEvent.firstTerminal} / {inspectedEvent.secondTerminal} si existen cables puenteados o pares cortados.</li>
                  <li>Comprobar continuidad del par primario asignado a la línea {inspectedEvent.firstService} frente al de {inspectedEvent.secondService}.</li>
                  <li>Auditar la matrícula del operario <strong className="text-rose-300 font-bold">{inspectedEvent.suspectedTechnician}</strong> para descartar malas prácticas reiteradas en este sector.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                onClick={() => setInspectedEvent(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
