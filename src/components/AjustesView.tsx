import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Check, FileText, ToggleLeft, ToggleRight, Info, Layout, Sparkles, SlidersHorizontal } from 'lucide-react';
import { ReportSettings } from '../types';
import { DEFAULT_REPORT_SETTINGS, saveReportSettings, resetReportSettings } from '../utils/settingsUtils';

interface AjustesViewProps {
  settings: ReportSettings;
  onUpdateSettings: (newSettings: ReportSettings) => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({ settings, onUpdateSettings }) => {
  const [formData, setFormData] = useState<ReportSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleToggle = (key: keyof ReportSettings) => {
    setFormData(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleChange = (key: keyof ReportSettings, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveReportSettings(formData);
    onUpdateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('¿Desea restablecer los textos y la configuración del informe a sus valores por defecto?')) {
      const defaultSet = resetReportSettings();
      setFormData(defaultSet);
      onUpdateSettings(defaultSet);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-blue-600/30 text-blue-400 rounded-2xl border border-blue-500/30">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Configuración y Ajustes del Informe Técnico
            </h1>
            <p className="text-xs text-slate-300">
              Personalice los títulos, textos explicativos, encabezados y active/desactive las tablas y gráficas que se exportan en Word y PDF.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Valores por Defecto</span>
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 transition-all border border-blue-400/30"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Ajustes</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 flex items-center justify-between animate-in fade-in zoom-in duration-200">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">¡Ajustes guardados correctamente! Los informes Word y PDF usarán esta nueva configuración.</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* SECTION 1: Document Identification & Titles */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              1. Títulos e Identificación del Documento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Título Principal del Informe
              </label>
              <input
                type="text"
                value={formData.documentTitle}
                onChange={(e) => handleChange('documentTitle', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                placeholder="ESTADÍSTICA DE LAS IP CTA SE"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Subtítulo del Informe
              </label>
              <input
                type="text"
                value={formData.documentSubtitle}
                onChange={(e) => handleChange('documentSubtitle', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                placeholder="Informe Técnico Operativo de Redes y Centrales Telefónicas"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Nombre de la Dirección / Departamento
              </label>
              <input
                type="text"
                value={formData.departmentName}
                onChange={(e) => handleChange('departmentName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                placeholder="Dirección IP CTA SE — Departamento Estadística & Operaciones"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Prefijo del Nombre del Archivo Exportado
              </label>
              <input
                type="text"
                value={formData.fileNamePrefix}
                onChange={(e) => handleChange('fileNamePrefix', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                placeholder="Estadística de las IP CTA SE"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Ejemplo generado: <code>{formData.fileNamePrefix} 31-07-2026.docx</code>
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Active Sections & Tables in Export */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                2. Selección de Tablas y Secciones a Incluir en el Informe
              </h2>
              <p className="text-xs text-slate-500">
                Active o desactive las secciones que desea que figuren en la versión impresa PDF y Word
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            
            {/* Toggle Item */}
            <div
              onClick={() => handleToggle('includeExecutiveSummary')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                formData.includeExecutiveSummary
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>1. Resumen Ejecutivo y KPIs</span>
              {formData.includeExecutiveSummary ? (
                <ToggleRight className="w-6 h-6 text-blue-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
              )}
            </div>

            {/* Toggle Item */}
            <div
              onClick={() => handleToggle('includeMatrixTable')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                formData.includeMatrixTable
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>2. Matriz Centrales x Grupos</span>
              {formData.includeMatrixTable ? (
                <ToggleRight className="w-6 h-6 text-blue-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
              )}
            </div>

            {/* Toggle Item */}
            <div
              onClick={() => handleToggle('includeTechInstalledTable')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                formData.includeTechInstalledTable
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>3. Técnica Instalada y % Interrupción</span>
              {formData.includeTechInstalledTable ? (
                <ToggleRight className="w-6 h-6 text-blue-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
              )}
            </div>

            {/* Toggle Item */}
            <div
              onClick={() => handleToggle('includeDayOfWeekStats')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                formData.includeDayOfWeekStats
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>4. Comportamiento por Día (Lun - Sáb)</span>
              {formData.includeDayOfWeekStats ? (
                <ToggleRight className="w-6 h-6 text-blue-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
              )}
            </div>

            {/* Toggle Item */}
            <div
              onClick={() => handleToggle('includeHistoricalEvolution')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                formData.includeHistoricalEvolution
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>5. Evolución Histórica Diaria</span>
              {formData.includeHistoricalEvolution ? (
                <ToggleRight className="w-6 h-6 text-blue-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
              )}
            </div>

            {/* Toggle Item */}
            <div
              onClick={() => handleToggle('includeConclusions')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                formData.includeConclusions
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span>6. Conclusiones y Recomendaciones</span>
              {formData.includeConclusions ? (
                <ToggleRight className="w-6 h-6 text-blue-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
              )}
            </div>

          </div>
        </div>

        {/* SECTION 3: Custom Text Explanations */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <Layout className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                3. Edición de Textos y Explicaciones Detalladas
              </h2>
              <p className="text-xs text-slate-500">
                Personalice los análisis descriptivos que aparecen debajo de cada tabla y gráfica en el informe
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            
            {/* Custom Executive Summary */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Texto Introductorio del Resumen Ejecutivo
              </label>
              <textarea
                rows={3}
                value={formData.customExecutiveSummary}
                onChange={(e) => handleChange('customExecutiveSummary', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Matrix Explanation */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Explicación para la Matriz por Central y Grupo de Trabajo
              </label>
              <textarea
                rows={3}
                value={formData.matrixExplanation}
                onChange={(e) => handleChange('matrixExplanation', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Tech Installed Explanation */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Explicación de la Técnica Instalada y % Interrupción
              </label>
              <textarea
                rows={3}
                value={formData.techInstalledExplanation}
                onChange={(e) => handleChange('techInstalledExplanation', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Day of week Explanation */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Explicación del Comportamiento por Día de la Semana
              </label>
              <textarea
                rows={3}
                value={formData.dayOfWeekExplanation}
                onChange={(e) => handleChange('dayOfWeekExplanation', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Historical Explanation */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Explicación de la Evolución Histórica de Averías
              </label>
              <textarea
                rows={3}
                value={formData.historicalExplanation}
                onChange={(e) => handleChange('historicalExplanation', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Custom Conclusions */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Conclusiones y Recomendaciones Operativas
              </label>
              <textarea
                rows={4}
                value={formData.customConclusions}
                onChange={(e) => handleChange('customConclusions', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Escriba cada recomendación en un renglón separado.
              </span>
            </div>

          </div>
        </div>

        {/* Save Footer Action */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Restablecer Textos
          </button>
          
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Toda la Configuración</span>
          </button>
        </div>

      </form>
    </div>
  );
};
