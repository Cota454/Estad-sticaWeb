import React, { useState, useMemo } from 'react';
import { History, Calendar, Search, Filter, Download, Table, Layers, Cpu, Trash2, RotateCcw } from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import { MONTH_NAMES_ES, formatDateShort, getDayOfWeekName } from '../utils/dateUtils';
import { getCentralTotalCapacity } from '../utils/statCalculations';
import { CopyTableButton } from './CopyButton';

interface HistorialViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  onClearAllReports?: () => void;
  onDeleteDateReports?: (dateStr: string) => void;
}

type TableTab = 'matriz' | 'detallado' | 'tecnica';

export const HistorialView: React.FC<HistorialViewProps> = ({
  centrales,
  workGroups,
  reports,
  onClearAllReports,
  onDeleteDateReports
}) => {
  // Current date defaults
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  // Filters state
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth); // 0..11 or -1 for All
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedCentralId, setSelectedCentralId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTableTab, setActiveTableTab] = useState<TableTab>('matriz');
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  // Single date deletion state
  const [showConfirmDeleteDateModal, setShowConfirmDeleteDateModal] = useState<boolean>(false);
  const [selectedDateToDelete, setSelectedDateToDelete] = useState<string>('');

  // Get list of unique registered dates with report counts
  const registeredDates = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach(r => {
      if (r.date) {
        map[r.date] = (map[r.date] || 0) + (r.reportCount || 0);
      }
    });
    return Object.entries(map)
      .map(([date, totalCount]) => ({
        date,
        totalCount,
        dayName: getDayOfWeekName(date),
        displayDate: formatDateShort(date)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [reports]);

  const handleOpenDeleteDateModal = (initialDate?: string) => {
    const defaultDate = initialDate || (registeredDates[0]?.date || '');
    setSelectedDateToDelete(defaultDate);
    setShowConfirmDeleteDateModal(true);
  };

  const handleConfirmDeleteDate = () => {
    if (!selectedDateToDelete) return;
    if (onDeleteDateReports) {
      onDeleteDateReports(selectedDateToDelete);
      setShowConfirmDeleteDateModal(false);
      alert(`Se han eliminado con éxito todos los datos del día ${formatDateShort(selectedDateToDelete)}.`);
    }
  };

  // Available Years calculated dynamically from reports + currentYear
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([currentYear, currentYear - 1]);
    reports.forEach(r => {
      if (r.date) {
        const y = parseInt(r.date.split('-')[0], 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [reports, currentYear]);

  // Filtered reports according to Month, Year, Central, Group, and Search
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (!r.date) return false;
      const parts = r.date.split('-');
      if (parts.length !== 3) return false;

      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed

      // Year filter
      if (selectedYear !== -1 && rYear !== selectedYear) return false;

      // Month filter (-1 means all months)
      if (selectedMonth !== -1 && rMonth !== selectedMonth) return false;

      // Central filter
      if (selectedCentralId !== 'all' && r.centralId !== selectedCentralId) return false;

      // Group filter
      if (selectedGroupId !== 'all' && r.workGroupId !== selectedGroupId) return false;

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const central = centrales.find(c => c.id === r.centralId);
        const group = workGroups.find(g => g.id === r.workGroupId);

        const matchCentral = central?.name.toLowerCase().includes(term) || central?.code.toLowerCase().includes(term);
        const matchGroup = group?.name.toLowerCase().includes(term) || group?.code.toLowerCase().includes(term);
        const matchDate = r.date.includes(term);

        if (!matchCentral && !matchGroup && !matchDate) return false;
      }

      return true;
    });
  }, [reports, selectedMonth, selectedYear, selectedCentralId, selectedGroupId, searchTerm, centrales, workGroups]);

  // Aggregate KPI metrics for filtered view
  const kpis = useMemo(() => {
    const totalReports = filteredReports.reduce((acc, r) => acc + (r.reportCount || 0), 0);

    // Group reports by date to calculate unique active days & peak day
    const reportsByDate: Record<string, number> = {};
    const reportsByCentral: Record<string, number> = {};

    filteredReports.forEach(r => {
      reportsByDate[r.date] = (reportsByDate[r.date] || 0) + (r.reportCount || 0);
      reportsByCentral[r.centralId] = (reportsByCentral[r.centralId] || 0) + (r.reportCount || 0);
    });

    const uniqueDates = Object.keys(reportsByDate);
    const totalDays = uniqueDates.length || 1;
    const avgDaily = totalReports / totalDays;

    let peakDate = '-';
    let peakCount = 0;

    Object.entries(reportsByDate).forEach(([date, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakDate = date;
      }
    });

    let topCentralName = '-';
    let topCentralCount = 0;

    Object.entries(reportsByCentral).forEach(([cId, count]) => {
      if (count > topCentralCount) {
        topCentralCount = count;
        const c = centrales.find(item => item.id === cId);
        topCentralName = c ? `${c.name} (${c.code})` : cId;
      }
    });

    return {
      totalReports,
      totalDays,
      avgDaily: avgDaily.toFixed(1),
      peakDate: peakDate !== '-' ? formatDateShort(peakDate) : '-',
      peakCount,
      topCentralName,
      topCentralCount
    };
  }, [filteredReports, centrales]);

  // Table 1: Matrix calculation (Central x Group) for filtered period
  const matrixData = useMemo(() => {
    const activeCentrales = selectedCentralId === 'all'
      ? centrales
      : centrales.filter(c => c.id === selectedCentralId);

    const activeGroups = selectedGroupId === 'all'
      ? workGroups
      : workGroups.filter(g => g.id === selectedGroupId);

    // Map counts
    const grid: Record<string, Record<string, number>> = {};
    activeCentrales.forEach(c => {
      grid[c.id] = {};
      activeGroups.forEach(g => {
        grid[c.id][g.id] = 0;
      });
    });

    filteredReports.forEach(r => {
      if (grid[r.centralId] && grid[r.centralId][r.workGroupId] !== undefined) {
        grid[r.centralId][r.workGroupId] += r.reportCount || 0;
      }
    });

    return {
      activeCentrales,
      activeGroups,
      grid
    };
  }, [filteredReports, centrales, workGroups, selectedCentralId, selectedGroupId]);

  // Data formatted for Copy Table Button on Matriz
  const matrizCopyHeaders = useMemo(() => [
    'Central Telefónica',
    'Código',
    ...matrixData.activeGroups.map(g => `${g.name} (${g.code})`),
    'TOTAL PERIODO'
  ], [matrixData]);

  const matrizCopyRows = useMemo(() => {
    const base = matrixData.activeCentrales.map(c => {
      let totalC = 0;
      const groupVals = matrixData.activeGroups.map(g => {
        const val = matrixData.grid[c.id]?.[g.id] || 0;
        totalC += val;
        return val;
      });
      return [c.name, c.code, ...groupVals, totalC];
    });

    const groupTotals = matrixData.activeGroups.map(g => matrixData.groupTotals[g.id] || 0);
    const grandTotal = matrixData.grandTotal || 0;
    const totalRow = ['TOTAL GENERAL', 'RED', ...groupTotals, grandTotal];

    return [...base, totalRow];
  }, [matrixData]);

  // Data formatted for Copy Table Button on Detallado
  const detalladoCopyHeaders = ['Fecha', 'Día', 'Central', 'Código Central', 'Grupo de Trabajo', 'Reportes'];
  const detalladoCopyRows = useMemo(() => {
    const base = filteredReports.map(r => {
      const c = centrales.find(item => item.id === r.centralId);
      const g = workGroups.find(item => item.id === r.workGroupId);
      return [
        r.date,
        getDayOfWeekName(r.date),
        c?.name || '',
        c?.code || '',
        g?.name || '',
        r.reportCount
      ];
    });

    const totalReportCount = filteredReports.reduce((acc, r) => acc + (r.reportCount || 0), 0);
    const totalRow = ['TOTAL GENERAL', `${filteredReports.length} Registros`, '-', '-', '-', totalReportCount];

    return [...base, totalRow];
  }, [filteredReports, centrales, workGroups]);

  // Data formatted for Copy Table Button on Técnica
  const tecnicaCopyHeaders = ['Central Telefónica', 'Código', 'Capacidad Instalada Total', 'Reportes en Periodo', '% Afectación de Red', 'Estado Operativo'];
  const tecnicaCopyRows = useMemo(() => {
    const base = centrales.map(c => {
      const totalCap = getCentralTotalCapacity(c);
      const cReports = filteredReports
        .filter(r => r.centralId === c.id)
        .reduce((acc, r) => acc + (r.reportCount || 0), 0);
      const pct = totalCap > 0 ? (cReports / totalCap) * 100 : 0;
      const status = pct > 2 ? 'Atención Requerida' : 'Normal';
      return [c.name, c.code, totalCap, cReports, `${pct.toFixed(2)}%`, status];
    });

    const grandTotalCap = centrales.reduce((acc, c) => acc + getCentralTotalCapacity(c), 0);
    const grandReports = filteredReports.reduce((acc, r) => acc + (r.reportCount || 0), 0);
    const grandPct = grandTotalCap > 0 ? (grandReports / grandTotalCap) * 100 : 0;
    const grandStatus = grandPct > 2 ? 'Atención Requerida' : 'Normal';

    const totalRow = ['TOTAL GENERAL', 'RED', grandTotalCap, grandReports, `${grandPct.toFixed(2)}%`, grandStatus];

    return [...base, totalRow];
  }, [centrales, filteredReports]);

  // Handle Clear All Reports Confirm
  const handleClearHistory = () => {
    if (onClearAllReports) {
      onClearAllReports();
      setShowConfirmClear(false);
      alert('Se ha borrado exitosamente todo el historial de reportes.');
    }
  };

  // Export current filtered view to CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    const monthLabel = selectedMonth === -1 ? 'Todos_los_Meses' : MONTH_NAMES_ES[selectedMonth];
    const yearLabel = selectedYear === -1 ? 'Todos_los_Anos' : selectedYear;

    if (activeTableTab === 'matriz') {
      // Header row
      const headers = ['Central Telefónica', 'Código', ...matrixData.activeGroups.map(g => g.name), 'TOTAL PERIODO'];
      csvContent += headers.join(',') + '\n';

      matrixData.activeCentrales.forEach(c => {
        let totalC = 0;
        const row = [
          `"${c.name}"`,
          `"${c.code}"`,
          ...matrixData.activeGroups.map(g => {
            const val = matrixData.grid[c.id]?.[g.id] || 0;
            totalC += val;
            return val;
          }),
          totalC
        ];
        csvContent += row.join(',') + '\n';
      });
    } else if (activeTableTab === 'detallado') {
      const headers = ['Fecha', 'Día', 'Central', 'Código Central', 'Grupo de Trabajo', 'Reportes'];
      csvContent += headers.join(',') + '\n';

      filteredReports.forEach(r => {
        const c = centrales.find(item => item.id === r.centralId);
        const g = workGroups.find(item => item.id === r.workGroupId);
        const row = [
          r.date,
          getDayOfWeekName(r.date),
          `"${c?.name || ''}"`,
          `"${c?.code || ''}"`,
          `"${g?.name || ''}"`,
          r.reportCount
        ];
        csvContent += row.join(',') + '\n';
      });
    } else {
      // General report list
      const headers = ['Fecha', 'Central ID', 'Grupo ID', 'Cantidad'];
      csvContent += headers.join(',') + '\n';
      filteredReports.forEach(r => {
        csvContent += `${r.date},${r.centralId},${r.workGroupId},${r.reportCount}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historial_telecom_${monthLabel}_${yearLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">

      {/* Main Header Card with Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-200 shadow-xl">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                  Historial Consolidado de Tablas
                </h2>
                <span className="bg-cyan-500/20 text-cyan-300 text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-medium">
                  {reports.length} registros guardados
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Consulte y exporte el historial de reportes registrados por central telefónica, grupos de trabajo y afectación de red.
              </p>
            </div>
          </div>

          {/* Action buttons: Export, Delete Single Date & Clear History */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-cyan-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>

            {onDeleteDateReports && (
              <button
                onClick={() => handleOpenDeleteDateModal()}
                className="inline-flex items-center space-x-1.5 bg-amber-600/30 hover:bg-amber-600/40 text-amber-200 border border-amber-500/50 text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                title="Eliminar los reportes de un día específico sin borrar todo el historial"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>Eliminar Día Específico</span>
              </button>
            )}

            {onClearAllReports && (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="inline-flex items-center space-x-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 hover:text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-rose-700/60"
                title="Eliminar permanentemente todos los registros del historial"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Vaciar Todo</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Month Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mes:</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value={-1}>[Todos los Meses]</option>
              {MONTH_NAMES_ES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Año:</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value={-1}>[Todos los Años]</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Central Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Central:</span>
            </label>
            <select
              value={selectedCentralId}
              onChange={(e) => setSelectedCentralId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">[Todas las Centrales]</option>
              {centrales.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* Group Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Grupo de Trabajo:</span>
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">[Todos los Grupos]</option>
              {workGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
              ))}
            </select>
          </div>

          {/* Text Search */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>Buscar:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Central, grupo o fecha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

        </div>

      </div>

      {/* KPI Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Reportes en Periodo</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-cyan-400">{kpis.totalReports}</span>
            <span className="text-xs text-slate-400">{kpis.totalDays} días activos</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Promedio Diario</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">{kpis.avgDaily}</span>
            <span className="text-xs text-slate-400">reportes/día</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pico Máximo Diario</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-rose-400">{kpis.peakCount}</span>
            <span className="text-xs text-slate-400 truncate max-w-[120px]">{kpis.peakDate}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm border-l-4 border-l-amber-500">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Central de Mayor Incidencia</span>
          <div className="mt-2">
            <div className="text-sm font-bold text-white truncate">{kpis.topCentralName}</div>
            <div className="text-xs text-amber-400 font-mono mt-0.5">{kpis.topCentralCount} reportes registrados</div>
          </div>
        </div>

      </div>

      {/* Sub-Tab Table Selectors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTableTab('matriz')}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTableTab === 'matriz'
                  ? 'bg-slate-900 text-cyan-400 border border-cyan-500/30 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>1. Matriz Consolidada Mensual</span>
            </button>

            <button
              onClick={() => setActiveTableTab('detallado')}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTableTab === 'detallado'
                  ? 'bg-slate-900 text-cyan-400 border border-cyan-500/30 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Registros Diarios Detallados ({filteredReports.length})</span>
            </button>

            <button
              onClick={() => setActiveTableTab('tecnica')}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTableTab === 'tecnica'
                  ? 'bg-slate-900 text-cyan-400 border border-cyan-500/30 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>3. Técnica Instalada & Afectación</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTableTab === 'matriz' && (
              <CopyTableButton
                headers={matrizCopyHeaders}
                rows={matrizCopyRows}
                title={`Matriz Consolidada - ${selectedMonth === -1 ? 'Todos los Meses' : MONTH_NAMES_ES[selectedMonth]} ${selectedYear === -1 ? '' : selectedYear}`}
                variant="outline"
              />
            )}
            {activeTableTab === 'detallado' && (
              <CopyTableButton
                headers={detalladoCopyHeaders}
                rows={detalladoCopyRows}
                title={`Registros Detallados - ${selectedMonth === -1 ? 'Todos los Meses' : MONTH_NAMES_ES[selectedMonth]} ${selectedYear === -1 ? '' : selectedYear}`}
                variant="outline"
              />
            )}
            {activeTableTab === 'tecnica' && (
              <CopyTableButton
                headers={tecnicaCopyHeaders}
                rows={tecnicaCopyRows}
                title={`Técnica Instalada - ${selectedMonth === -1 ? 'Todos los Meses' : MONTH_NAMES_ES[selectedMonth]} ${selectedYear === -1 ? '' : selectedYear}`}
                variant="outline"
              />
            )}
          </div>

        </div>

        {/* TAB 1: MATRIZ CONSOLIDADA MENSUAL */}
        {activeTableTab === 'matriz' && (
          <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3 min-w-[200px] sticky left-0 bg-slate-900 z-10">Central Telefónica</th>
                  {matrixData.activeGroups.map(grp => (
                    <th key={grp.id} className="p-3 text-center min-w-[120px]">
                      <div>{grp.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">({grp.code})</div>
                    </th>
                  ))}
                  <th className="p-3 text-center bg-slate-800 min-w-[130px] font-bold text-cyan-400">TOTAL PERIODO</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {matrixData.activeCentrales.length === 0 ? (
                  <tr>
                    <td colSpan={matrixData.activeGroups.length + 2} className="p-8 text-center text-slate-400">
                      No hay datos registrados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  matrixData.activeCentrales.map(central => {
                    let totalCentral = 0;
                    matrixData.activeGroups.forEach(grp => {
                      totalCentral += matrixData.grid[central.id]?.[grp.id] || 0;
                    });

                    return (
                      <tr key={central.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-sm">
                          <div>{central.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{central.code}</div>
                        </td>

                        {matrixData.activeGroups.map(grp => {
                          const val = matrixData.grid[central.id]?.[grp.id] || 0;
                          return (
                            <td key={grp.id} className="p-3 text-center font-mono text-slate-800 border-r border-slate-100">
                              {val > 0 ? (
                                <span className="font-bold text-slate-900">{val}</span>
                              ) : (
                                <span className="text-slate-300">0</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-3 text-center bg-slate-50 font-extrabold font-mono text-sm text-cyan-700">
                          {totalCentral}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {matrixData.activeCentrales.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-800">
                  <tr>
                    <td className="p-3 sticky left-0 bg-slate-900 z-10">TOTAL GENERAL</td>
                    {matrixData.activeGroups.map(grp => {
                      let colTotal = 0;
                      matrixData.activeCentrales.forEach(c => {
                        colTotal += matrixData.grid[c.id]?.[grp.id] || 0;
                      });
                      return (
                        <td key={grp.id} className="p-3 text-center font-mono text-cyan-300">
                          {colTotal}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-mono text-cyan-400 text-sm bg-slate-800">
                      {kpis.totalReports}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* TAB 2: REGISTROS DIARIOS DETALLADOS */}
        {activeTableTab === 'detallado' && (
          <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Día</th>
                  <th className="p-3">Central Telefónica</th>
                  <th className="p-3">Grupo de Trabajo</th>
                  <th className="p-3 text-center">Cantidad Reportes</th>
                  <th className="p-3 text-center">Estado / Nivel</th>
                  {onDeleteDateReports && <th className="p-3 text-center">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={onDeleteDateReports ? 7 : 6} className="p-8 text-center text-slate-400">
                      No se encontraron registros diarios para el filtro de mes/año seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredReports.slice(0, 300).map((r, idx) => {
                    const c = centrales.find(item => item.id === r.centralId);
                    const g = workGroups.find(item => item.id === r.workGroupId);
                    const dayName = getDayOfWeekName(r.date);

                    let badgeColor = 'bg-slate-100 text-slate-700';
                    let badgeLabel = 'Bajo';

                    if (r.reportCount >= 15) {
                      badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                      badgeLabel = 'Alto Risk';
                    } else if (r.reportCount >= 5) {
                      badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                      badgeLabel = 'Medio';
                    } else if (r.reportCount > 0) {
                      badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                      badgeLabel = 'Normal';
                    }

                    return (
                      <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatDateShort(r.date)}
                        </td>
                        <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                          {dayName}
                        </td>
                        <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                          {c ? `${c.name} (${c.code})` : r.centralId}
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-nowrap">
                          {g ? `${g.name} (${g.code})` : r.workGroupId}
                        </td>
                        <td className="p-3 text-center font-mono font-extrabold text-sm text-slate-900">
                          {r.reportCount}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        {onDeleteDateReports && (
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteDateModal(r.date)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                              title={`Eliminar todos los datos del día ${formatDateShort(r.date)}`}
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                              <span>Borrar Día</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {filteredReports.length > 300 && (
              <div className="p-3 bg-slate-50 text-slate-500 text-[11px] text-center border-t border-slate-200">
                Mostrando los primeros 300 de {filteredReports.length} registros. Utilice la función Exportar CSV para descargar la totalidad.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TÉCNICA INSTALADA & AFECTACIÓN */}
        {activeTableTab === 'tecnica' && (
          <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Central Telefónica</th>
                  <th className="p-3 text-center">Capacidad Instalada Total</th>
                  <th className="p-3 text-center">Reportes en el Periodo</th>
                  <th className="p-3 text-center">% Afectación de Red</th>
                  <th className="p-3 text-center">Estado Operativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centrales.map(c => {
                  // Total installed tech capacity for central
                  const totalCap = getCentralTotalCapacity(c);

                  // Total reports in period for central
                  const cReports = filteredReports
                    .filter(r => r.centralId === c.id)
                    .reduce((acc, r) => acc + (r.reportCount || 0), 0);

                  const pct = totalCap > 0 ? (cReports / totalCap) * 100 : 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        <div>{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{c.code} — {c.location}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {totalCap.toLocaleString()} líneas/puertos
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {cReports}
                      </td>
                      <td className="p-3 text-center font-mono font-extrabold text-slate-900">
                        <div className="flex items-center justify-center space-x-2">
                          <span>{pct.toFixed(2)}%</span>
                          <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full ${pct > 2 ? 'bg-rose-500' : pct > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, pct * 20)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {pct > 2 ? (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                            Atención Requerida
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal: Delete Specific Date Data */}
      {showConfirmDeleteDateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <Trash2 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Eliminar Reportes de un Día Específico
                </h3>
                <p className="text-[11px] text-slate-500">
                  Borre los datos ingresados por error en una fecha concreta sin perder el resto del historial
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Seleccione la fecha a eliminar:
                </label>
                {registeredDates.length > 0 ? (
                  <select
                    value={selectedDateToDelete}
                    onChange={(e) => setSelectedDateToDelete(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {registeredDates.map(item => (
                      <option key={item.date} value={item.date}>
                        {item.displayDate} ({item.dayName}) — {item.totalCount} reportes registrados
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={selectedDateToDelete}
                    onChange={(e) => setSelectedDateToDelete(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                )}
              </div>

              {selectedDateToDelete && (
                <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 text-rose-900 space-y-1">
                  <span className="font-extrabold text-xs block">
                    ⚠️ Advertencia de borrado:
                  </span>
                  <p className="text-xs">
                    Se eliminarán permanentemente todos los reportes del{' '}
                    <strong>{formatDateShort(selectedDateToDelete)}</strong> ({getDayOfWeekName(selectedDateToDelete)}).
                  </p>
                  <p className="text-[11px] text-rose-700 font-medium pt-1">
                    El resto de las fechas y el historial acumulado de otros días no se verán afectados.
                  </p>
                </div>
              )}

            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteDateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDate}
                disabled={!selectedDateToDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar Datos del Día</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Clear History */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Vaciar Todo el Historial de Reportes</h3>
                <p className="text-[11px] text-slate-500">Acción irreversible de borrado de datos</p>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-600 space-y-2">
              <p className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-900 font-medium">
                ⚠️ <strong>Atención:</strong> Esta acción eliminará permanentemente los <strong>{reports.length} reportes guardados</strong> en el historial de la web.
              </p>
              <p>¿Está absolutamente seguro de borrar todos los registros del historial?</p>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sí, Vaciar Todo el Historial</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
