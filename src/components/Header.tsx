import React, { useRef } from 'react';
import { Activity, Download, Upload, FileText, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { downloadJSONBackup, parseJSONBackupFile } from '../utils/exportUtils';
import { Central, WorkGroup, DailyReport } from '../types';
import { getTodayStr, formatDateShort } from '../utils/dateUtils';

interface HeaderProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  onImportBackup: (backup: { centrales: Central[]; workGroups: WorkGroup[]; reports: DailyReport[] }) => void;
  onOpenExportModal: (format: 'pdf' | 'word') => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  centrales,
  workGroups,
  reports,
  onImportBackup,
  onOpenExportModal,
  activeTab
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

          </div>

        </div>
      </div>
    </header>
  );
};
