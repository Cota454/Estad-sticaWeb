import React, { useRef, useState } from 'react';
import { Activity, Download, Upload, FileText, FileSpreadsheet, Trash2, AlertCircle, RotateCcw } from 'lucide-react';
import { downloadJSONBackup, parseJSONBackupFile } from '../utils/exportUtils';
import { Central, WorkGroup, DailyReport } from '../types';
import { getTodayStr, formatDateShort } from '../utils/dateUtils';

interface HeaderProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  onImportBackup: (backup: { centrales: Central[]; workGroups: WorkGroup[]; reports: DailyReport[] }) => void;
  onResetData: () => void;
  onOpenExportModal: (format: 'pdf' | 'word') => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  centrales,
  workGroups,
  reports,
  onImportBackup,
  onResetData,
  onOpenExportModal,
  activeTab
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const backup = await parseJSONBackupFile(file);
      onImportBackup(backup);
      alert(`Copia de seguridad restaurada con éxito: ${backup.centrales.length} centrales, ${backup.workGroups.length} grupos y ${backup.reports.length} reportes.`);
    } catch (err: any) {
      alert(`Error al importar la copia de seguridad: ${err.message}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleFactoryResetConfirm = () => {
    onResetData();
    setShowConfirmReset(false);
    alert('Se han restablecido de fábrica todos los datos de la aplicación.');
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo and App Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-sans">TelecomStat NOC</h1>
                <span className="bg-blue-500/20 text-blue-300 text-xs px-2.5 py-0.5 rounded-full border border-blue-500/30 font-medium">
                  v2.5
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Plataforma Estadística e Informes de las IP CTA SE
              </p>
            </div>
          </div>

          {/* Quick Date Restriction Indicator & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            <div className="hidden xl:flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-300">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Restricción de fecha: <strong>≤ {formatDateShort(getTodayStr())}</strong></span>
            </div>

            {/* Hidden File Input for JSON Backup Import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            {/* Import JSON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors border border-slate-700"
              title="Restaurar copia de seguridad desde un archivo .json"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Importar Backup</span>
            </button>

            {/* Export JSON (copia_de_seguridad.json) */}
            <button
              onClick={() => downloadJSONBackup(centrales, workGroups, reports)}
              className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors border border-slate-700"
              title="Descargar copia de seguridad en formato JSON (copia_de_seguridad.json)"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Backup JSON</span>
            </button>

            {/* Export Word (.docx) */}
            <button
              onClick={() => onOpenExportModal('word')}
              className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold transition-all border border-blue-500/30 shadow-sm"
              title="Generar y exportar informe en formato Word (.docx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Word</span>
            </button>

            {/* Export PDF */}
            <button
              onClick={() => onOpenExportModal('pdf')}
              className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition-all border border-emerald-500/30 shadow-sm"
              title="Generar y exportar informe completo en formato PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>

            {/* Restablecer de Fábrica Button */}
            <button
              onClick={() => setShowConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs bg-rose-900/60 hover:bg-rose-800 text-rose-200 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors border border-rose-700/50"
              title="Restablecer de fábrica toda la web eliminando todos los datos"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Restablecer de Fábrica</span>
            </button>

          </div>

        </div>
      </div>

      {/* Confirmation Modal for Factory Reset */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Restablecer de Fábrica la Web</h3>
                <p className="text-[11px] text-slate-500">Acción irreversible de eliminación de datos</p>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-600 space-y-2">
              <p className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-900 font-medium">
                ⚠️ <strong>Atención:</strong> Esta acción borrará <strong>TOODOS los datos</strong>, reportes diarios, importaciones de Excel y modificaciones registradas, volviendo la aplicación a su estado inicial limpio.
              </p>
              <p>¿Desea continuar y borrar todo?</p>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFactoryResetConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sí, Borrar Todo y Restablecer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
