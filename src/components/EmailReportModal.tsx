import React, { useState } from 'react';
import {
  Mail,
  X,
  Copy,
  Check,
  Send,
  Eye,
  Trash2,
  ListOrdered,
  Sparkles,
  FileText,
  AlertCircle,
  FileDown
} from 'lucide-react';

export interface SelectedSectionData {
  id: string;
  title: string;
  category: 'summary' | 'network' | 'matrices' | 'rankings';
  order: number;
  htmlContent: string;
  textContent: string;
}

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSections: SelectedSectionData[];
  onRemoveSection: (id: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  onSelectSummaryOnly: () => void;
  totalAvailableCount: number;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
  isOpen,
  onClose,
  selectedSections,
  onRemoveSection,
  onClearAll,
  onSelectAll,
  onSelectSummaryOnly,
  totalAvailableCount
}) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState(`Informe Ejecutivo de Incidencias IP / Cables - ${new Date().toLocaleDateString()}`);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'text'>('preview');

  if (!isOpen) return null;

  // Order sections logically: summary -> network -> matrices -> rankings
  const sortedSections = [...selectedSections].sort((a, b) => a.order - b.order);

  const fullHtmlReport = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; }
        .header { border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
        .header h2 { color: #0f172a; margin: 0 0 6px 0; font-size: 22px; }
        .header p { color: #64748b; margin: 0; font-size: 13px; }
        .section-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; }
        tr:nth-child(even) { background-color: #f1f5f9; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .kpi-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; }
        .kpi-val { font-size: 20px; font-weight: bold; color: #2563eb; }
        .kpi-lbl { font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
        .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>📊 ${subject}</h2>
          <p>Generado automáticamente desde la Plataforma de Gestión de Incidencias IP</p>
        </div>
        ${sortedSections.map(s => `
          <div class="section-card">
            <div class="section-title">📌 ${s.title}</div>
            ${s.htmlContent}
          </div>
        `).join('')}
        <div class="footer">
          Este correo fue generado desde la herramienta de Análisis IP de Cables de Planta Externa.
        </div>
      </div>
    </body>
    </html>
  `;

  const fullTextReport = sortedSections.map(s => `=== ${s.title.toUpperCase()} ===\n${s.textContent}\n`).join('\n\n');

  const handleCopy = () => {
    try {
      const blobHtml = new Blob([fullHtmlReport], { type: 'text/html' });
      const blobText = new Blob([fullTextReport], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      
      navigator.clipboard.write(data).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {
        // Fallback to text
        navigator.clipboard.writeText(fullTextReport);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } catch {
      navigator.clipboard.writeText(fullTextReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendMailto = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(`Hola,\n\nAdjunto el resumen ejecutivo de las secciones seleccionadas:\n\n${fullTextReport}\n\nSaludos.`);
    const mailtoUrl = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleExportWord = () => {
    const htmlDoc = `
      <html xmlns:o='urn:schemas-microsoft-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          @page { size: 8.5in 11in; margin: 1in; }
          body { font-family: Arial, sans-serif; background-color: #ffffff; color: #1e293b; margin: 0; padding: 20px; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
          .header h2 { color: #0f172a; margin: 0 0 6px 0; font-size: 18pt; }
          .header p { color: #64748b; margin: 0; font-size: 10pt; }
          .section-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
          .section-title { font-size: 13pt; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 24px; text-align: center; font-size: 9pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>📊 ${subject}</h2>
          <p>Generado automáticamente desde la Plataforma de Gestión de Incidencias Telecom - ${new Date().toLocaleDateString()}</p>
        </div>
        ${sortedSections.map(s => `
          <div class="section-card">
            <div class="section-title">📌 ${s.title}</div>
            ${s.htmlContent}
          </div>
        `).join('')}
        <div class="footer">
          Documento oficial generado desde la Plataforma de Gestión de Incidencias Telecom.
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanFileName = subject.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_');
    link.download = `${cleanFileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Preparar Informe por Correo
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {selectedSections.length} de {totalAvailableCount} Seleccionados
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Organización automática en secuencia ejecutiva narrativa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Selection Toolbar (Improvement #1) */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Selección Rápida:</span>
            <button
              onClick={onSelectAll}
              className="px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-700/50 transition-all font-semibold"
            >
              Seleccionar Todas ({totalAvailableCount})
            </button>
            <button
              onClick={onSelectSummaryOnly}
              className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-700/50 transition-all font-semibold flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Solo Resumen Ejecutivo
            </button>
          </div>

          {selectedSections.length > 0 && (
            <button
              onClick={onClearAll}
              className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/40 transition-all font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar Todo
            </button>
          )}
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Email metadata inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Destinatario (Email):
              </label>
              <input
                type="email"
                placeholder="ejemplo@telecom.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Asunto del Correo:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* List of included items ordered logically */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4 text-blue-400" />
                Secciones Incluidas ({selectedSections.length})
              </h4>
              <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                    activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Vista Previa HTML
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                    activeTab === 'text' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Texto Plano
                </button>
              </div>
            </div>

            {selectedSections.length === 0 ? (
              <div className="p-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No has seleccionado ninguna tabla o gráfico</p>
                <p className="text-xs text-slate-500">
                  Usa los botones de correo en cada recuadro o haz clic en "Seleccionar Todas" arriba.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Badges bar */}
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {sortedSections.map(s => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700"
                    >
                      <span>{s.title}</span>
                      <button
                        onClick={() => onRemoveSection(s.id)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Quitar esta sección"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Preview Box (Improvement #3: Live HTML Preview) */}
                {activeTab === 'preview' ? (
                  <div className="bg-white text-slate-900 rounded-xl p-4 max-h-80 overflow-y-auto text-xs border border-slate-300 shadow-inner">
                    <div dangerouslySetInnerHTML={{ __html: fullHtmlReport }} />
                  </div>
                ) : (
                  <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl max-h-80 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                    {fullTextReport}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={selectedSections.length === 0}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              title="Copia el reporte en formato HTML enriquecido para pegarlo directo en Outlook, Gmail, Teams o WhatsApp"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
              <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Reporte Formateado'}</span>
            </button>

            <button
              onClick={handleExportWord}
              disabled={selectedSections.length === 0}
              className="px-4 py-2.5 bg-indigo-900/80 hover:bg-indigo-700 disabled:opacity-50 text-indigo-100 rounded-xl font-bold text-xs flex items-center gap-2 border border-indigo-700/60 transition-all cursor-pointer shadow-sm"
              title="Exporta y descarga el informe completo como un documento de Word (.doc) compatible con Microsoft Word"
            >
              <FileDown className="w-4 h-4 text-indigo-300" />
              <span>Exportar Word (.doc)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSendMailto}
              disabled={selectedSections.length === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Abrir Cliente de Correo</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
