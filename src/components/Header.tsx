import React, { useRef } from 'react';
import { Activity, Download, Upload, FileText, FileSpreadsheet, AlertCircle, Cloud, User, LogOut, CheckCircle2, Sun, Moon } from 'lucide-react';
import { downloadJSONBackup, parseJSONBackupFile } from '../utils/exportUtils';
import { Central, WorkGroup, DailyReport, UserProfile, RepairRecord, CustomTableSchema, RepairColumnMapping } from '../types';
import { getTodayStr, formatDateShort } from '../utils/dateUtils';
import { ADMIN_EMAIL } from '../utils/googleDriveService';

interface HeaderProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords?: RepairRecord[];
  customTables?: CustomTableSchema[];
  columnMapping?: RepairColumnMapping;
  onImportBackup: (backup: any) => void;
  onOpenExportModal: (format: 'pdf' | 'word') => void;
  activeTab: string;
  currentUser?: UserProfile;
  onNavigateToDrive?: () => void;
  onLogout?: () => void;
  onBackToHub?: () => void;
  syncStatus?: 'synced' | 'syncing' | 'idle';
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  centrales,
  workGroups,
  reports,
  repairRecords,
  customTables,
  columnMapping,
  onImportBackup,
  onOpenExportModal,
  activeTab,
  currentUser,
  onNavigateToDrive,
  onLogout,
  onBackToHub,
  syncStatus = 'synced',
  isDarkMode = true,
  onToggleTheme
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
                
                {/* Real-time Drive Sync Badge */}
                <div className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700">
                  <span className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
                  <span className={syncStatus === 'syncing' ? 'text-amber-300' : 'text-emerald-300'}>
                    {syncStatus === 'syncing' ? 'Sincronizando Drive...' : 'Drive Sincronizado'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Plataforma Estadística e Informes de las IP CTA SE
              </p>
            </div>
          </div>

          {/* Quick Date Restriction Indicator & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Dark/Light Mode Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-1.5 rounded-lg font-bold transition-all border border-slate-700 shadow-sm"
                title={isDarkMode ? 'Cambiar a Modo Claro (Luz)' : 'Cambiar a Modo Oscuro (Noche)'}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                    <span>Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Modo Oscuro</span>
                  </>
                )}
              </button>
            )}

            {/* Return to Modules Hub Button */}
            {onBackToHub && (
              <button
                onClick={onBackToHub}
                className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-black transition-all border border-indigo-400/40 shadow-md shadow-indigo-600/20"
                title="Volver al Portal Principal de Módulos"
              >
                <span>← Portal Módulos</span>
              </button>
            )}

            <div className="hidden xl:flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-300">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Max Fecha: <strong>≤ {formatDateShort(getTodayStr())}</strong></span>
            </div>

            {/* Hidden File Input for JSON Backup Import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            {/* Google Drive Backup Button */}
            {onNavigateToDrive && (
              <button
                onClick={onNavigateToDrive}
                className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-blue-300 px-3 py-1.5 rounded-lg font-bold transition-colors border border-blue-500/30 shadow-sm"
                title="Ir al gestor de respaldos automáticos en Google Drive"
              >
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span>Google Drive</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </button>
            )}

            {/* Import JSON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors border border-slate-700"
              title="Restaurar copia de seguridad desde un archivo .json"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Importar</span>
            </button>

            {/* Export JSON */}
            <button
              onClick={() => downloadJSONBackup(centrales, workGroups, reports, repairRecords, customTables, columnMapping)}
              className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors border border-slate-700"
              title="Descargar copia de seguridad en formato JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Backup</span>
            </button>

            {/* Export Word (.docx) */}
            <button
              onClick={() => onOpenExportModal('word')}
              className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold transition-all border border-blue-500/30 shadow-sm"
              title="Generar y exportar informe en formato Word (.docx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Word</span>
            </button>

            {/* Export PDF */}
            <button
              onClick={() => onOpenExportModal('pdf')}
              className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition-all border border-emerald-500/30 shadow-sm"
              title="Generar y exportar informe completo en formato PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            {/* User Session Profile & Logout Button */}
            {currentUser && onLogout && (
              <div className="flex items-center space-x-2 border-l border-slate-800 pl-2 ml-1">
                <div className="hidden lg:flex items-center space-x-2 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-[10px] uppercase">
                    {currentUser.email ? currentUser.email[0] : 'A'}
                  </div>
                  <div className="max-w-[130px] truncate">
                    <div className="text-[11px] font-bold text-white truncate">{currentUser.name || 'Administrador'}</div>
                    <div className="text-[9px] text-slate-400 font-mono truncate">{currentUser.email}</div>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-3 py-1.5 rounded-xl font-bold transition-all border border-rose-500/30 shadow-sm"
                  title="Cerrar sesión y volver a la pantalla de bienvenida"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
