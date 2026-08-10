import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Calendar, CheckCircle2, X, Download, AlertCircle, Sparkles, Settings } from 'lucide-react';
import { Central, WorkGroup, DailyReport, RepairRecord, ReportSettings } from '../types';
import { getTodayStr, getPastDateStr, formatDateShort } from '../utils/dateUtils';
import { generateWordReport, generatePDFReport, buildReportFileName } from '../utils/reportExportGenerator';
import { FullPrintableReport } from './FullPrintableReport';
import { DEFAULT_REPORT_SETTINGS } from '../utils/settingsUtils';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords?: RepairRecord[];
  startDate: string;
  endDate: string;
  settings?: ReportSettings;
  onOpenSettingsTab?: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  centrales,
  workGroups,
  reports,
  repairRecords,
  startDate: initialStartDate,
  endDate: initialEndDate,
  settings = DEFAULT_REPORT_SETTINGS,
  onOpenSettingsTab
}) => {
  if (!isOpen) return null;

  const todayFormatted = getTodayStr();
  
  // State
  const [selectedFormat, setSelectedFormat] = useState<'word' | 'pdf'>('word');
  const [dateOption, setDateOption] = useState<'current' | 'manual'>('current');
  const [manualDate, setManualDate] = useState<string>(todayFormatted);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Date Range Interval State
  const [rangePreset, setRangePreset] = useState<'1day' | '1week' | '1month' | '1year' | 'custom'>('1month');
  const [reportStartDate, setReportStartDate] = useState<string>(initialStartDate || getPastDateStr(29));
  const [reportEndDate, setReportEndDate] = useState<string>(initialEndDate || todayFormatted);

  const handlePresetChange = (preset: '1day' | '1week' | '1month' | '1year' | 'custom') => {
    setRangePreset(preset);
    if (preset === '1day') {
      setReportStartDate(todayFormatted);
      setReportEndDate(todayFormatted);
    } else if (preset === '1week') {
      setReportStartDate(getPastDateStr(6));
      setReportEndDate(todayFormatted);
    } else if (preset === '1month') {
      setReportStartDate(getPastDateStr(29));
      setReportEndDate(todayFormatted);
    } else if (preset === '1year') {
      setReportStartDate(getPastDateStr(364));
      setReportEndDate(todayFormatted);
    }
  };

  const effectiveDisplayDate = dateOption === 'current' ? todayFormatted : (manualDate || todayFormatted);
  const previewFileName = buildReportFileName(effectiveDisplayDate, selectedFormat, settings.fileNamePrefix);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      if (selectedFormat === 'word') {
        await generateWordReport({
          centrales,
          workGroups,
          reports,
          repairRecords,
          startDate: reportStartDate,
          endDate: reportEndDate,
          displayDate: effectiveDisplayDate,
          format: 'word',
          settings
        });
      } else {
        await generatePDFReport('full-printable-report-container', effectiveDisplayDate, settings.fileNamePrefix);
      }
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Ocurrió un error al generar el archivo. Por favor reintente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 relative overflow-hidden">
        
        {/* Off-screen Container for PDF Capture (rendered in DOM without display:none so html2canvas captures it properly) */}
        <div
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '900px',
            zIndex: -100,
            opacity: 1,
            pointerEvents: 'none',
            backgroundColor: '#ffffff'
          }}
        >
          <FullPrintableReport
            id="full-printable-report-container"
            centrales={centrales}
            workGroups={workGroups}
            reports={reports}
            startDate={reportStartDate}
            endDate={reportEndDate}
            displayDate={effectiveDisplayDate}
            settings={settings}
          />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Exportar Informe Estadístico Operativo
              </h2>
              <p className="text-xs text-slate-500">
                {settings.documentTitle} — Tablas, Gráficas y Análisis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-4">
          
          {/* Format Selection */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-2">
              1. Seleccione el Formato de Exportación
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat('word')}
                className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedFormat === 'word'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedFormat === 'word' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block">Documento Word (.docx)</span>
                  <span className="text-[10px] text-slate-500 block">Formato Microsoft Word editable</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedFormat === 'pdf'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedFormat === 'pdf' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block">Documento PDF (.pdf)</span>
                  <span className="text-[10px] text-slate-500 block">Formato para impresión o firma</span>
                </div>
              </button>
            </div>
          </div>

          {/* Interval / Period Selection */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center justify-between">
              <span>2. Intervalo de Evaluación (Tablas y Gráficas)</span>
              <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 font-mono">
                {formatDateShort(reportStartDate)} al {formatDateShort(reportEndDate)}
              </span>
            </label>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePresetChange('1day')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    rangePreset === '1day'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  1 Día
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('1week')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    rangePreset === '1week'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  1 Semana
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('1month')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    rangePreset === '1month'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  1 Mes
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('1year')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    rangePreset === '1year'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  1 Año
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('custom')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    rangePreset === 'custom'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {/* Range Inputs */}
              <div className="flex items-center space-x-2 pt-1 border-t border-slate-200/60">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Desde:</span>
                  <input
                    type="date"
                    disabled={rangePreset !== 'custom'}
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Hasta:</span>
                  <input
                    type="date"
                    disabled={rangePreset !== 'custom'}
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Date Selection Options */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              3. Selección de Fecha para el Nombre del Documento
            </label>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              
              <label className="flex items-center space-x-3 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="radio"
                  name="dateOption"
                  value="current"
                  checked={dateOption === 'current'}
                  onChange={() => setDateOption('current')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span>Usar fecha actual del sistema (<strong>{todayFormatted}</strong>)</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="radio"
                  name="dateOption"
                  value="manual"
                  checked={dateOption === 'manual'}
                  onChange={() => setDateOption('manual')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span>Ingresar fecha manualmente</span>
              </label>

              {dateOption === 'manual' && (
                <div className="mt-2 pl-7">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Seleccione la fecha deseada para el nombre del archivo.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Filename Preview Callout */}
          <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200/80 text-blue-900 text-xs">
            <span className="font-bold text-blue-800 block mb-0.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Nombre asignado al archivo:
              </span>
              {onOpenSettingsTab && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettingsTab();
                  }}
                  className="text-[10px] text-blue-700 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Settings className="w-3 h-3" />
                  <span>Personalizar en Ajustes</span>
                </button>
              )}
            </span>
            <code className="bg-white px-2.5 py-1 rounded-lg border border-blue-200 text-slate-900 font-mono text-[11px] font-bold block overflow-x-auto mt-1">
              {previewFileName}
            </code>
          </div>

          {/* Included Content Checklist */}
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-800 block">Secciones activadas para el informe:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              {settings.includeExecutiveSummary && (
                <span className="flex items-center gap-1 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Resumen Ejecutivo y KPIs
                </span>
              )}
              {settings.includeMatrixTable && (
                <span className="flex items-center gap-1 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Matriz Centrales x Grupos
                </span>
              )}
              {settings.includeTechInstalledTable && (
                <span className="flex items-center gap-1 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Técnica Instalada y % Interrupción
                </span>
              )}
              {settings.includeDayOfWeekStats && (
                <span className="flex items-center gap-1 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Patrón Diario (Lun - Sáb)
                </span>
              )}
              {settings.includeHistoricalEvolution && (
                <span className="flex items-center gap-1 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Evolución Histórica
                </span>
              )}
              {settings.includeConclusions && (
                <span className="flex items-center gap-1 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Conclusiones y Recomendaciones
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className={`inline-flex items-center gap-2 text-xs font-bold text-white px-5 py-2.5 rounded-xl shadow-md transition-all ${
              selectedFormat === 'word'
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
            } disabled:opacity-50`}
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? 'Generando informe...' : `Descargar Informe (${selectedFormat.toUpperCase()})`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
