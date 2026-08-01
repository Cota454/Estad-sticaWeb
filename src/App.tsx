/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Central, WorkGroup, DailyReport, UserProfile } from './types';
import {
  loadCentrales, saveCentrales,
  loadWorkGroups, saveWorkGroups,
  loadReports, saveReports,
  resetToDefaultData
} from './data/mockData';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardGeneral } from './components/DashboardGeneral';
import { AnalisisSemanalHistorico } from './components/AnalisisSemanalHistorico';
import { TecnicaInstaladaView } from './components/TecnicaInstaladaView';
import { MatrizDiferenciasView } from './components/MatrizDiferenciasView';
import { ImportExcelView } from './components/ImportExcelView';
import { CentralesGruposView } from './components/CentralesGruposView';
import { RegistroDiarioView } from './components/RegistroDiarioView';
import { HistorialView } from './components/HistorialView';
import { GoogleDriveBackupView } from './components/GoogleDriveBackupView';
import { AjustesView } from './components/AjustesView';
import { ExportReportModal } from './components/ExportReportModal';
import { getTodayStr, getPastDateStr } from './utils/dateUtils';
import { loadReportSettings } from './utils/settingsUtils';
import { ReportSettings } from './types';
import {
  ADMIN_EMAIL,
  getStoredUserProfile,
  saveStoredUserProfile,
  getAutoDriveBackupEnabled,
  uploadBackupToDrive
} from './utils/googleDriveService';
import { WelcomeLandingView } from './components/WelcomeLandingView';
import { LogOut, CloudUpload, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  const [centrales, setCentrales] = useState<Central[]>([]);
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportSettings, setReportSettings] = useState<ReportSettings>(loadReportSettings());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'idle'>('synced');

  // Logout Modal Confirmation State
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);
  const [isSavingBeforeLogout, setIsSavingBeforeLogout] = useState<boolean>(false);

  // User Profile State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return getStoredUserProfile();
  });

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalInitialFormat, setExportModalInitialFormat] = useState<'pdf' | 'word'>('word');

  // Load user data on change of currentUser
  useEffect(() => {
    const userEmail = currentUser?.email;
    const c = loadCentrales(userEmail);
    const wg = loadWorkGroups(userEmail);
    const r = loadReports(userEmail);

    setCentrales(c);
    setWorkGroups(wg);
    setReports(r);
    setIsLoaded(true);
  }, [currentUser?.email]);

  // Handle Login Success from Welcome Landing Screen
  const handleLoginSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    saveStoredUserProfile(profile);

    // Load data for this user
    const c = loadCentrales(profile.email);
    const wg = loadWorkGroups(profile.email);
    const r = loadReports(profile.email);
    setCentrales(c);
    setWorkGroups(wg);
    setReports(r);

    setActiveTab('dashboard');
  };

  // Helper for Auto-Drive-Backup
  const triggerAutoDriveBackup = (updatedCentrales: Central[], updatedWorkGroups: WorkGroup[], updatedReports: DailyReport[]) => {
    if (getAutoDriveBackupEnabled() && currentUser?.isAuthenticated && currentUser.accessToken) {
      setSyncStatus('syncing');
      uploadBackupToDrive(currentUser.accessToken, {
        version: '2.5',
        exportedAt: new Date().toISOString(),
        centrales: updatedCentrales,
        workGroups: updatedWorkGroups,
        reports: updatedReports
      }, 'auto')
        .then(() => setSyncStatus('synced'))
        .catch(err => {
          console.warn('Auto drive backup error:', err);
          setSyncStatus('idle');
        });
    }
  };

  // Update handlers
  const handleUpdateCentrales = (updated: Central[]) => {
    setCentrales(updated);
    saveCentrales(updated, currentUser?.email);
    triggerAutoDriveBackup(updated, workGroups, reports);
  };

  const handleUpdateWorkGroups = (updated: WorkGroup[]) => {
    setWorkGroups(updated);
    saveWorkGroups(updated, currentUser?.email);
    triggerAutoDriveBackup(centrales, updated, reports);
  };

  const handleImportBackup = (backup: { centrales: Central[]; workGroups: WorkGroup[]; reports: DailyReport[] }) => {
    setCentrales(backup.centrales);
    setWorkGroups(backup.workGroups);
    setReports(backup.reports);

    saveCentrales(backup.centrales, currentUser?.email);
    saveWorkGroups(backup.workGroups, currentUser?.email);
    saveReports(backup.reports, currentUser?.email);
    triggerAutoDriveBackup(backup.centrales, backup.workGroups, backup.reports);
  };

  const handleClearAllReports = () => {
    setReports([]);
    saveReports([], currentUser?.email);
    triggerAutoDriveBackup(centrales, workGroups, []);
  };

  const handleDeleteDateReports = (targetDate: string) => {
    const updated = reports.filter(r => r.date !== targetDate);
    setReports(updated);
    saveReports(updated, currentUser?.email);
    triggerAutoDriveBackup(centrales, workGroups, updated);
  };

  const handleLogoutConfirmSave = async () => {
    setIsSavingBeforeLogout(true);
    if (currentUser?.accessToken) {
      try {
        await uploadBackupToDrive(currentUser.accessToken, {
          version: '2.5',
          exportedAt: new Date().toISOString(),
          centrales,
          workGroups,
          reports
        }, 'logout_backup');
      } catch (err) {
        console.warn('Error saving backup before logout:', err);
      }
    }
    setIsSavingBeforeLogout(false);
    setIsLogoutModalOpen(false);
    saveStoredUserProfile(null);
    setCurrentUser(null);
  };

  const handleLogoutDirect = () => {
    setIsLogoutModalOpen(false);
    saveStoredUserProfile(null);
    setCurrentUser(null);
  };

  const handleResetData = () => {
    localStorage.clear();
    const reset = resetToDefaultData();
    setCentrales(reset.centrales);
    setWorkGroups(reset.workGroups);
    setReports(reset.reports);
  };

  const handleOpenExportModal = (format: 'pdf' | 'word') => {
    setExportModalInitialFormat(format);
    setIsExportModalOpen(true);
  };

  const handleImportExcelReportsAdvanced = (
    newReports: DailyReport[],
    affectedDates: string[],
    mode: 'replace' | 'append' = 'replace',
    newCentralesToAdd?: Central[],
    newWorkGroupsToAdd?: WorkGroup[]
  ) => {
    let updatedCentrales = [...centrales];
    if (newCentralesToAdd && newCentralesToAdd.length > 0) {
      updatedCentrales = [...updatedCentrales, ...newCentralesToAdd];
      setCentrales(updatedCentrales);
      saveCentrales(updatedCentrales);
    }

    let updatedWorkGroups = [...workGroups];
    if (newWorkGroupsToAdd && newWorkGroupsToAdd.length > 0) {
      updatedWorkGroups = [...updatedWorkGroups, ...newWorkGroupsToAdd];
      setWorkGroups(updatedWorkGroups);
      saveWorkGroups(updatedWorkGroups);
    }

    let finalReports = [...reports];

    if (mode === 'replace') {
      // Remove existing reports for all affected dates
      finalReports = finalReports.filter(r => !affectedDates.includes(r.date));
      finalReports = [...finalReports, ...newReports];
    } else {
      // Append mode: merge new report counts with existing report counts
      const reportMap = new Map<string, DailyReport>();
      finalReports.forEach(r => {
        reportMap.set(`${r.date}_${r.centralId}_${r.workGroupId}`, { ...r });
      });

      newReports.forEach(r => {
        const key = `${r.date}_${r.centralId}_${r.workGroupId}`;
        if (reportMap.has(key)) {
          const existing = reportMap.get(key)!;
          reportMap.set(key, {
            ...existing,
            reportCount: existing.reportCount + r.reportCount,
            updatedAt: new Date().toISOString()
          });
        } else {
          reportMap.set(key, { ...r });
        }
      });

      finalReports = Array.from(reportMap.values());
    }

    setReports(finalReports);
    saveReports(finalReports);
    triggerAutoDriveBackup(updatedCentrales, updatedWorkGroups, finalReports);
  };

  const handleSaveDailyGrid = (reportsToSave: DailyReport[], targetDate: string) => {
    const filteredOut = reports.filter(r => r.date !== targetDate);
    const updatedReports = [...filteredOut, ...reportsToSave];

    setReports(updatedReports);
    saveReports(updatedReports);
    triggerAutoDriveBackup(centrales, workGroups, updatedReports);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-semibold">
        Cargando Sistema Estadístico de Telecomunicaciones...
      </div>
    );
  }

  // Display Welcome Landing Page if user is not logged in
  if (!currentUser || !currentUser.isAuthenticated) {
    return <WelcomeLandingView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      
      {/* Top NOC Header */}
      <Header
        centrales={centrales}
        workGroups={workGroups}
        reports={reports}
        onImportBackup={handleImportBackup}
        onOpenExportModal={handleOpenExportModal}
        activeTab={activeTab}
        currentUser={currentUser}
        onNavigateToDrive={() => setActiveTab('drive_backup')}
        onLogout={() => setIsLogoutModalOpen(true)}
        syncStatus={syncStatus}
      />

      {/* Module Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Active Module Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8" id="active-view-container">
        
        {activeTab === 'dashboard' && (
          <DashboardGeneral
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
          />
        )}

        {activeTab === 'semanal' && (
          <AnalisisSemanalHistorico
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
          />
        )}

        {activeTab === 'tecnica' && (
          <TecnicaInstaladaView
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
            onUpdateCentrales={handleUpdateCentrales}
          />
        )}

        {activeTab === 'diferencias' && (
          <MatrizDiferenciasView
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
          />
        )}

        {activeTab === 'excel' && (
          <ImportExcelView
            centrales={centrales}
            workGroups={workGroups}
            onImportReports={handleImportExcelReportsAdvanced}
          />
        )}

        {activeTab === 'centrales' && (
          <CentralesGruposView
            centrales={centrales}
            workGroups={workGroups}
            onUpdateCentrales={handleUpdateCentrales}
            onUpdateWorkGroups={handleUpdateWorkGroups}
          />
        )}

        {activeTab === 'registro' && (
          <RegistroDiarioView
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
            onSaveDailyGrid={handleSaveDailyGrid}
          />
        )}

        {activeTab === 'historial' && (
          <HistorialView
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
            onClearAllReports={handleClearAllReports}
            onDeleteDateReports={handleDeleteDateReports}
          />
        )}

        {activeTab === 'drive_backup' && (
          <GoogleDriveBackupView
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
            onImportBackup={handleImportBackup}
            currentUser={currentUser}
            onUpdateCurrentUser={setCurrentUser}
          />
        )}

        {activeTab === 'ajustes' && (
          <AjustesView
            settings={reportSettings}
            onUpdateSettings={setReportSettings}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TelecomStat NOC &copy; {new Date().getFullYear()} — Plataforma de Estadística Operativa de Redes</span>
          <span>Soporte Técnico de Telecomunicaciones — Fechas limitadas a ≤ Hoy</span>
        </div>
      </footer>

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        centrales={centrales}
        workGroups={workGroups}
        reports={reports}
        startDate={getPastDateStr(30)}
        endDate={getTodayStr()}
        settings={reportSettings}
        onOpenSettingsTab={() => setActiveTab('ajustes')}
      />

      {/* Logout Confirmation Modal with Backup Proposal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <LogOut className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">¿Cerrar Sesión de Trabajo?</h3>
                <p className="text-xs text-slate-400">Sesión actual: {currentUser?.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
              ¿Desea realizar una copia de seguridad en su cuenta de <strong>Google Drive</strong> antes de salir para asegurar todos los folios y cambios recientes?
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleLogoutConfirmSave}
                disabled={isSavingBeforeLogout}
                className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                {isSavingBeforeLogout ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando en Google Drive y Saliendo...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Guardar Respaldo en Drive y Salir</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLogoutDirect}
                disabled={isSavingBeforeLogout}
                className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-700 transition-colors"
              >
                <span>Cerrar Sesión sin Guardar</span>
              </button>

              <button
                onClick={() => setIsLogoutModalOpen(false)}
                disabled={isSavingBeforeLogout}
                className="w-full text-center text-xs text-slate-400 hover:text-white py-1.5 transition-colors"
              >
                Cancelar y Permanecer en la App
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
