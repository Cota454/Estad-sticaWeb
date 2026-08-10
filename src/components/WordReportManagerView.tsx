import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  Download,
  Settings,
  CheckCircle2,
  ListFilter,
  BarChart2,
  Table as TableIcon,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  FileSpreadsheet,
  X,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square
} from 'lucide-react';
import { Central, WorkGroup, DailyReport, RepairRecord, WordReportProfile, WordReportSectionConfig } from '../types';
import {
  loadWordReportProfiles,
  saveWordReportProfiles,
  createNewWordProfile,
  WEB_CATALOG_TABLES,
  DEFAULT_WORD_SECTIONS
} from '../utils/wordProfileUtils';
import { generateWordReport } from '../utils/reportExportGenerator';

interface WordReportManagerViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords?: RepairRecord[];
  onBackToHub?: () => void;
}

export const WordReportManagerView: React.FC<WordReportManagerViewProps> = ({
  centrales,
  workGroups,
  reports,
  repairRecords = [],
  onBackToHub
}) => {
  const [profiles, setProfiles] = useState<WordReportProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Modal States
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState<boolean>(false);
  const [newDocName, setNewDocName] = useState<string>('');
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [newDocFilePrefix, setNewDocFilePrefix] = useState<string>('');
  const [newDocDept, setNewDocDept] = useState<string>('');

  // Selection of tables/charts for the new document modal
  const [modalSelectedSections, setModalSelectedSections] = useState<
    { key: string; includeTables: boolean; includeCharts: boolean }[]
  >([]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Date Filters
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [displayDate, setDisplayDate] = useState<string>(
    new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
  );

  useEffect(() => {
    const loaded = loadWordReportProfiles();
    setProfiles(loaded);
    if (loaded.length > 0) {
      setActiveProfileId(loaded[0].id);
    }
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const handleUpdateProfile = (updated: WordReportProfile) => {
    const nextProfiles = profiles.map(p => (p.id === updated.id ? updated : p));
    setProfiles(nextProfiles);
    saveWordReportProfiles(nextProfiles);
  };

  const handleOpenCreateModal = () => {
    setNewDocName(`Nuevo Informe Personalizado ${profiles.length + 1}`);
    setNewDocTitle('INFORME OPERATIVO A MEDIDA NOC');
    setNewDocFilePrefix('INFORME_OPERATIVO_PERSONALIZADO');
    setNewDocDept('DEPARTAMENTO DE OPERACIONES Y MANTENIMIENTO DE RED');

    // Initialize with all catalog tables selected by default
    setModalSelectedSections(
      WEB_CATALOG_TABLES.map(cat => ({
        key: cat.key,
        includeTables: true,
        includeCharts: true
      }))
    );
    setIsNewDocModalOpen(true);
  };

  const toggleModalSectionKey = (key: string) => {
    setModalSelectedSections(prev => {
      const exists = prev.some(s => s.key === key);
      if (exists) {
        return prev.filter(s => s.key !== key);
      } else {
        return [...prev, { key, includeTables: true, includeCharts: true }];
      }
    });
  };

  const toggleModalSectionTables = (key: string) => {
    setModalSelectedSections(prev =>
      prev.map(s => (s.key === key ? { ...s, includeTables: !s.includeTables } : s))
    );
  };

  const toggleModalSectionCharts = (key: string) => {
    setModalSelectedSections(prev =>
      prev.map(s => (s.key === key ? { ...s, includeCharts: !s.includeCharts } : s))
    );
  };

  const selectAllModalSections = (select: boolean) => {
    if (select) {
      setModalSelectedSections(
        WEB_CATALOG_TABLES.map(cat => ({
          key: cat.key,
          includeTables: true,
          includeCharts: true
        }))
      );
    } else {
      setModalSelectedSections([]);
    }
  };

  const handleConfirmCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    // Create profile with selected keys
    const selectedKeys = modalSelectedSections.map(s => s.key);
    const newProfile = createNewWordProfile(newDocName.trim(), selectedKeys.length > 0 ? selectedKeys : undefined);

    if (newDocTitle.trim()) newProfile.documentTitle = newDocTitle.trim();
    if (newDocFilePrefix.trim()) newProfile.fileNamePrefix = newDocFilePrefix.trim();
    if (newDocDept.trim()) newProfile.departmentName = newDocDept.trim();

    // Customize includeTables and includeCharts per section based on modal state
    newProfile.sections = newProfile.sections.map(sec => {
      const match = modalSelectedSections.find(m => m.key === sec.key);
      if (match) {
        return {
          ...sec,
          includeTables: match.includeTables,
          includeCharts: match.includeCharts
        };
      }
      return sec;
    });

    const nextProfiles = [...profiles, newProfile];
    setProfiles(nextProfiles);
    saveWordReportProfiles(nextProfiles);
    setActiveProfileId(newProfile.id);

    setIsNewDocModalOpen(false);
    showFeedback('¡Nuevo modelo de informe Word creado correctamente con tus selecciones!');
  };

  const handleConfirmDeleteDocument = () => {
    if (!deleteConfirmId) return;
    if (profiles.length <= 1) {
      showFeedback('Debe conservar al menos un perfil de exportación de Word.', 'error');
      setDeleteConfirmId(null);
      return;
    }

    const nextProfiles = profiles.filter(p => p.id !== deleteConfirmId);
    setProfiles(nextProfiles);
    saveWordReportProfiles(nextProfiles);
    if (activeProfileId === deleteConfirmId) {
      setActiveProfileId(nextProfiles[0].id);
    }
    setDeleteConfirmId(null);
    showFeedback('Plantilla de informe eliminada.');
  };

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleToggleSection = (secId: string) => {
    if (!activeProfile) return;
    const nextSections = activeProfile.sections.map(s => {
      if (s.id === secId) {
        return { ...s, enabled: !s.enabled };
      }
      return s;
    });
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
  };

  const handleToggleTables = (secId: string) => {
    if (!activeProfile) return;
    const nextSections = activeProfile.sections.map(s => {
      if (s.id === secId) {
        return { ...s, includeTables: !s.includeTables };
      }
      return s;
    });
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
  };

  const handleToggleCharts = (secId: string) => {
    if (!activeProfile) return;
    const nextSections = activeProfile.sections.map(s => {
      if (s.id === secId) {
        return { ...s, includeCharts: !s.includeCharts };
      }
      return s;
    });
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
  };

  const handleChangeSectionKey = (secId: string, newKey: string) => {
    if (!activeProfile) return;
    const catalogMeta = WEB_CATALOG_TABLES.find(c => c.key === newKey);
    const nextSections = activeProfile.sections.map(s => {
      if (s.id === secId) {
        return {
          ...s,
          key: newKey,
          title: catalogMeta ? catalogMeta.title : s.title,
          customNotes: catalogMeta ? catalogMeta.description : s.customNotes
        };
      }
      return s;
    });
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
  };

  const handleUpdateSectionTitle = (secId: string, title: string) => {
    if (!activeProfile) return;
    const nextSections = activeProfile.sections.map(s => (s.id === secId ? { ...s, title } : s));
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
  };

  const handleUpdateSectionNotes = (secId: string, customNotes: string) => {
    if (!activeProfile) return;
    const nextSections = activeProfile.sections.map(s => (s.id === secId ? { ...s, customNotes } : s));
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
  };

  const handleMoveSection = (idx: number, direction: 'up' | 'down') => {
    if (!activeProfile) return;
    const sections = [...activeProfile.sections];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const temp = sections[idx];
    sections[idx] = sections[targetIdx];
    sections[targetIdx] = temp;

    handleUpdateProfile({ ...activeProfile, sections });
  };

  const handleAddSectionToActiveProfile = (catalogKey?: string) => {
    if (!activeProfile) return;
    const defaultCatalog = WEB_CATALOG_TABLES.find(c => c.key === catalogKey) || WEB_CATALOG_TABLES[0];
    const newSec: WordReportSectionConfig = {
      id: `sec_dyn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: defaultCatalog.key,
      title: defaultCatalog.title,
      enabled: true,
      includeTables: true,
      includeCharts: true,
      customNotes: defaultCatalog.description
    };
    handleUpdateProfile({
      ...activeProfile,
      sections: [...activeProfile.sections, newSec]
    });
    showFeedback('Nueva sección agregada a la plantilla.');
  };

  const handleRemoveSectionFromActiveProfile = (secId: string) => {
    if (!activeProfile) return;
    if (activeProfile.sections.length <= 1) {
      showFeedback('La plantilla debe tener al menos una sección.', 'error');
      return;
    }
    const nextSections = activeProfile.sections.filter(s => s.id !== secId);
    handleUpdateProfile({ ...activeProfile, sections: nextSections });
    showFeedback('Sección removida de la plantilla.');
  };

  const handleExportWord = async () => {
    if (!activeProfile) return;
    setIsExporting(true);
    try {
      await generateWordReport({
        centrales,
        workGroups,
        reports,
        repairRecords,
        startDate,
        endDate,
        displayDate,
        format: 'word',
        profile: activeProfile,
        sectionsConfig: activeProfile.sections
      });
      showFeedback('¡Documento Word (.docx) procesado y descargado exitosamente!');
    } catch (err) {
      console.error('Error al exportar documento Word:', err);
      showFeedback('Ocurrió un error al procesar el archivo Word.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const enabledSectionsCount = activeProfile?.sections.filter(s => s.enabled).length || 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Módulo 4 • Centro de Procesamiento de Informes
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Exportador Multidocumento Word
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestor y Procesador de Informes Word
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Cree, configure y modifique qué tablas, secciones y gráficas de la web se procesarán en sus informes oficiales Word (.docx).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
            >
              Volver al Hub
            </button>
          )}
          <button
            onClick={handleExportWord}
            disabled={isExporting || enabledSectionsCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-sm text-sm transition-all"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Procesando Word...' : 'Procesar y Exportar Word'}
          </button>
        </div>
      </div>

      {/* Tabs list for Word Profiles / Documents */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 pt-3 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-2">
            {profiles.map(p => {
              const isActive = p.id === activeProfileId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProfileId(p.id)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-t-xl text-sm font-semibold transition-all border-t border-x ${
                    isActive
                      ? 'bg-white text-blue-700 border-slate-200 shadow-xs border-b-2 border-b-blue-600'
                      : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <FileText className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{p.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs ${
                      isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.sections.filter(s => s.enabled).length} sec.
                  </span>
                </button>
              );
            })}

            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2.5 mb-1 text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Crear Nuevo Documento Word</span>
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMessage && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
              feedbackMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Profile Configuration Workspace */}
        {activeProfile && (
          <div className="p-6 space-y-6">
            {/* Header metadata form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de la Pestaña / Modelo
                </label>
                <input
                  type="text"
                  value={activeProfile.name}
                  onChange={e => handleUpdateProfile({ ...activeProfile, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Título Principal del Word
                </label>
                <input
                  type="text"
                  value={activeProfile.documentTitle}
                  onChange={e => handleUpdateProfile({ ...activeProfile, documentTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Prefijo de Archivo
                </label>
                <input
                  type="text"
                  value={activeProfile.fileNamePrefix}
                  onChange={e => handleUpdateProfile({ ...activeProfile, fileNamePrefix: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Date range selection */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">
                  Período y Fechas de Filtro para Exportación:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Desde:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Hasta:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Etiqueta Fecha:</span>
                  <input
                    type="text"
                    value={displayDate}
                    onChange={e => setDisplayDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white w-36"
                  />
                </div>
              </div>
            </div>

            {/* Sections & Tables customization list */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Estructura y Secciones del Informe "{activeProfile.name}"
                  </h3>
                  <p className="text-xs text-slate-500">
                    Elija qué tabla y gráfica de la web asociar a cada sección, personalice sus títulos, notas, o agregue nuevas secciones.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSectionToActiveProfile()}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>+ Agregar Sección</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(activeProfile.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {activeProfile.sections.map((sec, idx) => {
                  return (
                    <div
                      key={sec.id}
                      className={`p-4 rounded-xl border transition-all ${
                        sec.enabled
                          ? 'bg-white border-slate-300 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Top bar of the section item */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={sec.enabled}
                              onChange={() => handleToggleSection(sec.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {sec.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Reorder controls */}
                            <button
                              type="button"
                              onClick={() => handleMoveSection(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30 hover:bg-slate-100"
                              title="Mover arriba"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSection(idx, 'down')}
                              disabled={idx === activeProfile.sections.length - 1}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30 hover:bg-slate-100"
                              title="Mover abajo"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            {/* Controls for tables & charts */}
                            {sec.enabled && (
                              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTables(sec.id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    sec.includeTables
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  <TableIcon className="w-3.5 h-3.5" />
                                  <span>Tabla</span>
                                  {sec.includeTables && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleCharts(sec.id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    sec.includeCharts
                                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  <BarChart2 className="w-3.5 h-3.5" />
                                  <span>Gráfica</span>
                                  {sec.includeCharts && <CheckCircle2 className="w-3 h-3 text-purple-600" />}
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveSectionFromActiveProfile(sec.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                              title="Eliminar esta sección"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Dropdown selector for which table/chart from web catalog */}
                        {sec.enabled && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Tabla / Gráfica de la Web a Utilizar:
                              </label>
                              <select
                                value={sec.key}
                                onChange={e => handleChangeSectionKey(sec.id, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                              >
                                {WEB_CATALOG_TABLES.map(cat => (
                                  <option key={cat.key} value={cat.key}>
                                    {cat.title}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Título Personalizado en Word:
                              </label>
                              <input
                                type="text"
                                value={sec.title}
                                onChange={e => handleUpdateSectionTitle(sec.id, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Notas / Explicación del Párrafo en Word:
                              </label>
                              <textarea
                                rows={2}
                                value={sec.customNotes || ''}
                                onChange={e => handleUpdateSectionNotes(sec.id, e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom summary callout */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-bold">
                    Documento Listo para Generación: {enabledSectionsCount} Secciones Seleccionadas
                  </h4>
                  <p className="text-xs text-slate-300">
                    El documento Word se construirá en formato .docx profesional con tablas estilizadas y gráficas en alta resolución.
                  </p>
                </div>
              </div>

              <button
                onClick={handleExportWord}
                disabled={isExporting || enabledSectionsCount === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-all whitespace-nowrap shadow-md"
              >
                {isExporting ? 'Procesando...' : 'Procesar Word Ahora'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW WORD DOCUMENT MODAL WITH TABLE & CHART SELECTION CHECKBOXES */}
      {isNewDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Crear Nuevo Modelo de Informe Word</h3>
                  <p className="text-xs text-slate-500">Configure los datos y elija qué tablas y gráficas incluir</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewDocModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateDocument} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre de la Pestaña / Modelo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Informe Semanal Guardia Red"
                    value={newDocName}
                    onChange={e => setNewDocName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Prefijo de Nombre de Archivo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: INFORME_OPERATIVO_GUARDIA_NOC"
                    value={newDocFilePrefix}
                    onChange={e => setNewDocFilePrefix(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Título Principal Encabezado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: INFORME TÉCNICO DE GUARDIA OPERATIVA NOC"
                    value={newDocTitle}
                    onChange={e => setNewDocTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* SELECTION OF TABLES AND CHARTS CHECKLIST */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Seleccionar Tablas y Gráficas de la Web a Incluir
                    </label>
                    <p className="text-xs text-slate-500">
                      Marque cuáles tablas y gráficas desea integrar en esta nueva plantilla:
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectAllModalSections(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Marcar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllModalSections(false)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  {WEB_CATALOG_TABLES.map(cat => {
                    const selState = modalSelectedSections.find(m => m.key === cat.key);
                    const isSelected = !!selState;

                    return (
                      <div
                        key={cat.key}
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-white border-blue-200 shadow-2xs'
                            : 'bg-slate-100/60 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleModalSectionKey(cat.key)}
                              className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">
                                {cat.title}
                              </span>
                              <span className="text-xs text-slate-500 block line-clamp-1">
                                {cat.description}
                              </span>
                            </div>
                          </label>

                          {isSelected && selState && (
                            <div className="flex items-center gap-1.5 pl-7 sm:pl-0">
                              <button
                                type="button"
                                onClick={() => toggleModalSectionTables(cat.key)}
                                className={`px-2 py-1 rounded-md text-xs font-semibold border transition-all ${
                                  selState.includeTables
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}
                              >
                                Tabla
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleModalSectionCharts(cat.key)}
                                className={`px-2 py-1 rounded-md text-xs font-semibold border transition-all ${
                                  selState.includeCharts
                                    ? 'bg-purple-50 text-purple-700 border-purple-300'
                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}
                              >
                                Gráfica
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewDocModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Documento Personalizado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-full border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">¿Eliminar esta plantilla Word?</h3>
                <p className="text-xs text-slate-500">Esta acción removerá la configuración seleccionada.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              ¿Está seguro de eliminar la plantilla de informe Word "{profiles.find(p => p.id === deleteConfirmId)?.name}"?
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDocument}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
