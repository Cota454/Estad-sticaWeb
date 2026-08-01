/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Central, WorkGroup, DailyReport } from './types';
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
import { AjustesView } from './components/AjustesView';
import { ExportReportModal } from './components/ExportReportModal';
import { getTodayStr, getPastDateStr } from './utils/dateUtils';
import { loadReportSettings } from './utils/settingsUtils';
import { ReportSettings } from './types';

export default function App() {
  const [centrales, setCentrales] = useState<Central[]>([]);
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportSettings, setReportSettings] = useState<ReportSettings>(loadReportSettings());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalInitialFormat, setExportModalInitialFormat] = useState<'pdf' | 'word'>('word');

  // Initial load
  useEffect(() => {
    const c = loadCentrales();
    const wg = loadWorkGroups();
    const r = loadReports();

    setCentrales(c);
    setWorkGroups(wg);
    setReports(r);
    setIsLoaded(true);
  }, []);

  // Update handlers
  const handleUpdateCentrales = (updated: Central[]) => {
    setCentrales(updated);
    saveCentrales(updated);
  };

  const handleUpdateWorkGroups = (updated: WorkGroup[]) => {
    setWorkGroups(updated);
    saveWorkGroups(updated);
  };

  const handleImportBackup = (backup: { centrales: Central[]; workGroups: WorkGroup[]; reports: DailyReport[] }) => {
    setCentrales(backup.centrales);
    setWorkGroups(backup.workGroups);
    setReports(backup.reports);

    saveCentrales(backup.centrales);
    saveWorkGroups(backup.workGroups);
    saveReports(backup.reports);
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

  const handleImportExcelReports = (newReports: DailyReport[], targetDate: string) => {
    // Remove old reports for targetDate and replace with new ones
    const filteredOut = reports.filter(r => r.date !== targetDate);
    const updatedReports = [...filteredOut, ...newReports];
    
    setReports(updatedReports);
    saveReports(updatedReports);
  };

  const handleSaveDailyGrid = (reportsToSave: DailyReport[], targetDate: string) => {
    const filteredOut = reports.filter(r => r.date !== targetDate);
    const updatedReports = [...filteredOut, ...reportsToSave];

    setReports(updatedReports);
    saveReports(updatedReports);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-semibold">
        Cargando Sistema Estadístico de Telecomunicaciones...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      
      {/* Top NOC Header */}
      <Header
        centrales={centrales}
        workGroups={workGroups}
        reports={reports}
        onImportBackup={handleImportBackup}
        onResetData={handleResetData}
        onOpenExportModal={handleOpenExportModal}
        activeTab={activeTab}
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
            onImportReports={handleImportExcelReports}
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

    </div>
  );
}
