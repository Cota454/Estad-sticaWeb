import React, { useState } from 'react';
import { Star, Radio, FileText, X, CheckCircle2, ChevronUp, ChevronDown, Upload, RefreshCw } from 'lucide-react';

export interface FloatingPriorityFABProps {
  priorityCount: number;
  tpoServCount: number;
  priorityFilterActive: boolean;
  tpoServFilterActive: boolean;
  onTogglePriorityFilter: () => void;
  onToggleTpoServFilter: () => void;
  onOpenReportModal?: () => void;
  // Subir Excel Principal
  onUploadMainExcel?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isParsingMain?: boolean;
  mainFileName?: string;
  // Subir Excel(s) Complementarios
  onUploadAuxExcel?: (e: React.ChangeEvent<HTMLInputElement>, mode: 'append' | 'replace') => void;
  isParsingAux?: boolean;
  auxProgressText?: string;
  auxFilesCount?: number;
  onClearAuxExcel?: () => void;
  // Acciones auxiliares de archivo
  onLoadSampleData?: () => void;
  onClearMainExcel?: () => void;
  hasMainExcel?: boolean;
}

export const FloatingPriorityFAB: React.FC<FloatingPriorityFABProps> = ({
  priorityCount,
  tpoServCount,
  priorityFilterActive,
  tpoServFilterActive,
  onTogglePriorityFilter,
  onToggleTpoServFilter,
  onOpenReportModal,
  onUploadMainExcel,
  isParsingMain,
  mainFileName,
  onUploadAuxExcel,
  isParsingAux,
  auxProgressText,
  auxFilesCount,
  onClearAuxExcel,
  onLoadSampleData,
  onClearMainExcel,
  hasMainExcel
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const hasPriorityAlert = priorityCount > 0;
  const anyFilterActive = priorityFilterActive || tpoServFilterActive;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end space-y-2.5 font-sans pointer-events-none">
      {/* Popover Card */}
      {isOpen && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-3xl p-5 shadow-2xl max-w-sm w-80 text-white space-y-4 animate-in slide-in-from-bottom-4 fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-black text-sm text-white flex items-center space-x-1.5">
                <span>Notificaciones y Filtros</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Servicios PRIORIDAD y Tipos de Servicio
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Opción 1: Servicios PRIORIDAD */}
            <div className={`p-3 rounded-2xl border transition-all ${
              priorityFilterActive
                ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-amber-300">Servicios PRIORIDAD</span>
                    <span className="block text-[10px] text-slate-400 font-mono">
                      {priorityCount} reportados en archivo activo
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono ${
                  priorityCount > 0
                    ? 'bg-red-950/80 text-red-300 border border-red-500/50 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {priorityCount}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onTogglePriorityFilter();
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md active:scale-95 ${
                  priorityFilterActive
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                }`}
              >
                {priorityFilterActive ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Filtro Prioridad Activo (Quitar)</span>
                  </>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    <span>Ver Solo Prioritarios ({priorityCount})</span>
                  </>
                )}
              </button>
            </div>

            {/* Opción 2: Filtro Tipo SERV */}
            <div className={`p-3 rounded-2xl border transition-all ${
              tpoServFilterActive
                ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-emerald-300">Filtro Tipo SERV</span>
                    <span className="block text-[10px] text-slate-400 font-mono">
                      {tpoServCount} coincidentes
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black font-mono bg-slate-800 text-emerald-400 border border-emerald-500/30">
                  {tpoServCount}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onToggleTpoServFilter();
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md active:scale-95 ${
                  tpoServFilterActive
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {tpoServFilterActive ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Filtro Tipo SERV Activo (Quitar)</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    <span>Filtrar por Tipo SERV ({tpoServCount})</span>
                  </>
                )}
              </button>
            </div>

            {/* Opción 3: Informe Ejecutivo (si se desea abrir) */}
            {onOpenReportModal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenReportModal();
                }}
                className="w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-slate-700/60"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Crear Informe Ejecutivo</span>
              </button>
            )}

            {/* Acciones Rápidas de Archivo */}
            {(!hasMainExcel && onLoadSampleData || (hasMainExcel && onClearMainExcel) || (auxFilesCount && auxFilesCount > 0 && onClearAuxExcel)) && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                {!hasMainExcel && onLoadSampleData && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onLoadSampleData();
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer"
                  >
                    ⚡ Cargar muestra
                  </button>
                )}
                {hasMainExcel && onClearMainExcel && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onClearMainExcel();
                    }}
                    className="text-rose-400 hover:text-rose-300 font-medium hover:underline cursor-pointer"
                  >
                    🗑️ Limpiar Excel
                  </button>
                )}
                {auxFilesCount && auxFilesCount > 0 && onClearAuxExcel && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onClearAuxExcel();
                    }}
                    className="text-violet-400 hover:text-violet-300 font-medium hover:underline cursor-pointer ml-auto"
                  >
                    Limpiar auxiliares
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Buttons Stack */}
      <div className="flex flex-col items-end space-y-2 pointer-events-auto">

        {/* 1. Botón Flotante Superior: Subir Excel(s) Complementarios */}
        {onUploadAuxExcel && (
          <label
            className="group relative flex items-center space-x-2 px-3.5 py-2.5 rounded-full shadow-2xl transition-all cursor-pointer active:scale-95 border bg-violet-600 hover:bg-violet-500 text-white border-violet-400/40 shadow-violet-950/40 hover:shadow-violet-600/30"
            title="Subir archivo(s) Excel Complementarios para cruce por SERVICIO"
          >
            {isParsingAux ? (
              <RefreshCw className="w-4 h-4 animate-spin text-violet-200" />
            ) : (
              <Upload className="w-4 h-4 text-violet-200" />
            )}
            <span className="font-extrabold text-xs">
              {isParsingAux
                ? (auxProgressText || 'Procesando...')
                : auxFilesCount && auxFilesCount > 0
                ? `Excel Complementarios (${auxFilesCount})`
                : 'Subir Excel Complementarios'}
            </span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              multiple
              onChange={(e) => onUploadAuxExcel(e, 'replace')}
              disabled={isParsingAux}
              className="hidden"
            />
          </label>
        )}

        {/* 2. Botón Flotante Intermedio: Subir Excel Principal */}
        {onUploadMainExcel && (
          <label
            className="group relative flex items-center space-x-2 px-3.5 py-2.5 rounded-full shadow-2xl transition-all cursor-pointer active:scale-95 border bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-950/40 hover:shadow-emerald-600/30"
            title="Subir archivo Excel Principal de reportes (.xlsx, .csv)"
          >
            {isParsingMain ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
            ) : (
              <Upload className="w-4 h-4 text-emerald-200" />
            )}
            <span className="font-extrabold text-xs">
              {isParsingMain
                ? 'Procesando Excel...'
                : mainFileName
                ? `Excel: ${mainFileName.length > 20 ? mainFileName.slice(0, 18) + '...' : mainFileName}`
                : 'Subir Excel Principal'}
            </span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={onUploadMainExcel}
              disabled={isParsingMain}
              className="hidden"
            />
          </label>
        )}

        {/* 3. Main Floating Button (El que ya existe: Servicios PRIORIDAD y Tipo SERV) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`group relative flex items-center space-x-2 px-4 py-3 rounded-full shadow-2xl transition-all cursor-pointer active:scale-95 border ${
            hasPriorityAlert
              ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white border-amber-300/60 ring-2 ring-amber-400/40 shadow-red-900/40 animate-bounce sm:animate-none'
              : anyFilterActive
              ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white border-blue-400/60'
              : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700 hover:border-slate-600'
          }`}
          title="Ver notificaciones de Servicios PRIORIDAD y Tipo SERV"
        >
          {/* Priority Badge */}
          <div className="flex items-center space-x-1.5">
            <Star className={`w-4 h-4 ${hasPriorityAlert ? 'fill-amber-300 text-amber-200 animate-spin-slow' : 'text-amber-400'}`} />
            <span className="font-black text-xs">
              {priorityCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
              Prioridad
            </span>
          </div>

          <div className="h-4 w-px bg-white/30" />

          {/* Tipo SERV Badge */}
          <div className="flex items-center space-x-1.5">
            <Radio className="w-4 h-4 text-emerald-300" />
            <span className="font-black text-xs">
              {tpoServCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
              Tipo SERV
            </span>
          </div>

          {isOpen ? (
            <ChevronDown className="w-4 h-4 ml-1 text-white/80" />
          ) : (
            <ChevronUp className="w-4 h-4 ml-1 text-white/80" />
          )}
        </button>

      </div>
    </div>
  );
};
