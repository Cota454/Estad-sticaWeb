import React, { useState, useMemo } from 'react';
import { ClipboardPaste, CheckCircle2, AlertTriangle, FileSpreadsheet, Play, Sparkles, Calendar, Layers, Table } from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import { parseExcelClipboardData } from '../utils/statCalculations';
import { getTodayStr, isFutureDate } from '../utils/dateUtils';
import { CopyTableButton } from './CopyButton';

interface ImportExcelViewProps {
  centrales: Central[];
  workGroups: WorkGroup[];
  onImportReports: (importedReports: DailyReport[], targetDate: string) => void;
}

export const ImportExcelView: React.FC<ImportExcelViewProps> = ({
  centrales,
  workGroups,
  onImportReports
}) => {
  const todayStr = getTodayStr();
  const [pastedText, setPastedText] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sample format string to help user
  const SAMPLE_EXCEL_FORMAT = `Central, PLEXT, CONM, TRANS, ENER, BROAD, SOP
Central Metropolitana, 8, 3, 2, 1, 5, 2
Central Norte (Tele), 4, 1, 0, 1, 3, 1
Central Este, 2, 2, 1, 0, 2, 0
Central Sur, 5, 4, 2, 1, 4, 1
Central Digital Oeste, 3, 1, 1, 0, 2, 1
Central Fibra Centro, 6, 2, 3, 1, 6, 2`;

  // Real-time parse result for preview table
  const previewParseResult = useMemo(() => {
    if (!pastedText.trim()) return null;
    return parseExcelClipboardData(pastedText, workGroups, centrales);
  }, [pastedText, workGroups, centrales]);

  // Headers and rows for CopyTableButton on preview
  const previewCopyHeaders = useMemo(() => {
    if (!previewParseResult || !previewParseResult.success) return [];
    return [
      'Central Telefónica',
      ...previewParseResult.matchedGroups.map(g => `${g.code} (${g.name})`),
      'TOTAL'
    ];
  }, [previewParseResult]);

  const previewCopyRows = useMemo(() => {
    if (!previewParseResult || !previewParseResult.success) return [];
    return previewParseResult.rows.map(r => {
      let rowTot = 0;
      const grpVals = previewParseResult.matchedGroups.map(g => {
        const val = r.groupValues[g.id] || 0;
        rowTot += val;
        return val;
      });
      return [r.centralName, ...grpVals, rowTot];
    });
  }, [previewParseResult]);

  const handleParseAndImport = () => {
    if (!pastedText.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Por favor pegue los datos copiados desde Excel antes de continuar.'
      });
      return;
    }

    if (isFutureDate(targetDate)) {
      setStatusMessage({
        type: 'error',
        text: `No se pueden ingresar reportes con fecha futura (${targetDate}). Por favor seleccione hoy (${todayStr}) o una fecha pasada.`
      });
      return;
    }

    const parseResult = parseExcelClipboardData(pastedText, workGroups, centrales);

    if (!parseResult.success) {
      setStatusMessage({
        type: 'error',
        text: parseResult.message
      });
      return;
    }

    // Convert parsed rows into DailyReport items
    const newReports: DailyReport[] = [];

    parseResult.rows.forEach(row => {
      let matchedCentral = centrales.find(
        c => c.name.toLowerCase() === row.centralName.toLowerCase() ||
             c.name.toLowerCase().includes(row.centralName.toLowerCase()) ||
             row.centralName.toLowerCase().includes(c.name.toLowerCase())
      );

      const centralId = matchedCentral ? matchedCentral.id : `cnt_custom_${row.centralName.replace(/\s+/g, '_').toLowerCase()}`;

      parseResult.matchedGroups.forEach(grp => {
        const count = row.groupValues[grp.id] || 0;
        newReports.push({
          id: `rep_${targetDate}_${centralId}_${grp.id}`,
          date: targetDate,
          centralId,
          workGroupId: grp.id,
          reportCount: count,
          notes: 'Importado masivamente desde Excel',
          updatedAt: new Date().toISOString()
        });
      });
    });

    onImportReports(newReports, targetDate);

    setStatusMessage({
      type: 'success',
      text: `¡Importación exitosa! Se han guardado ${newReports.length} registros para la fecha ${targetDate} (${parseResult.rows.length} centrales procesadas).`
    });

    setPastedText('');
  };

  const handlePasteSample = () => {
    setPastedText(SAMPLE_EXCEL_FORMAT);
    setStatusMessage({
      type: 'info',
      text: 'Se ha cargado una plantilla de ejemplo organizada por Código de Grupo (PLEXT, CONM, TRANS, ENER, BROAD, SOP).'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Excel Import Header & Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-blue-600" />
              <span>Pegar Tablas de Reportes desde Excel</span>
            </h2>
            <p className="text-xs text-slate-500">
              Copie una tabla directamente desde Excel o Hoja de Cálculo de Google. La aplicación organizará automáticamente las columnas por <strong>Código de Grupo de Trabajo</strong>.
            </p>
          </div>

          {/* Date Picker for Import Target */}
          <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-blue-600" />
            <label className="text-xs font-semibold text-slate-700">Fecha del Reporte:</label>
            <input
              type="date"
              max={todayStr}
              value={targetDate}
              onChange={(e) => {
                const val = e.target.value;
                if (isFutureDate(val)) {
                  alert(`No se permiten fechas futuras. Ajustado a hoy: ${todayStr}`);
                  setTargetDate(todayStr);
                } else {
                  setTargetDate(val);
                }
              }}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Format Instruction Card */}
        <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Organización por Código de Grupo de Trabajo:</span>
          </div>
          <p className="text-slate-600">
            Los encabezados de columna en Excel pueden llevar los <strong>Códigos de Grupo</strong> (por ejemplo: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">PLEXT</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">CONM</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">TRANS</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">ENER</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">BROAD</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">SOP</code>) o nombres de los grupos.
          </p>
        </div>

        {/* Status Message Alert */}
        {statusMessage && (
          <div className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
            statusMessage.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-200' :
            'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Textarea for Clipboard Paste */}
        <div className="mt-5 relative">
          <textarea
            rows={8}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`Pegue aquí la tabla copiada desde Excel...\n\nEjemplo con Código de Grupo:\nCentral, PLEXT, CONM, TRANS, ENER, BROAD, SOP\nCentral Norte (Tele), 5, 1, 2, 0, 3, 1`}
            className="w-full bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl border border-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-inner"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={handlePasteSample}
              className="inline-flex items-center space-x-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition-colors font-semibold border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Cargar Ejemplos por Código de Grupo</span>
            </button>

            <button
              onClick={handleParseAndImport}
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              <Play className="w-4 h-4" />
              <span>Procesar e Importar al Histórico</span>
            </button>
          </div>
        </div>

        {/* Preview Table organized by Group Code */}
        {previewParseResult && previewParseResult.success && previewParseResult.rows.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Vista Previa Organizada por Código de Grupo ({previewParseResult.rows.length} centrales)
                </h3>
              </div>

              <CopyTableButton
                headers={previewCopyHeaders}
                rows={previewCopyRows}
                title={`Importación Excel Organizada por Código de Grupo - Fecha ${targetDate}`}
                variant="outline"
              />
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-900 text-white font-semibold">
                  <tr>
                    <th className="p-3">Central Telefónica</th>
                    {previewParseResult.matchedGroups.map(grp => (
                      <th key={grp.id} className="p-3 text-center min-w-[100px]">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white inline-block mb-0.5" style={{ backgroundColor: grp.color }}>
                          {grp.code}
                        </span>
                        <div className="text-[10px] text-slate-300 font-normal truncate max-w-[120px]">{grp.name}</div>
                      </th>
                    ))}
                    <th className="p-3 text-center bg-slate-800 text-cyan-400 font-bold">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewParseResult.rows.map((row, idx) => {
                    let totalRow = 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{row.centralName}</td>
                        {previewParseResult.matchedGroups.map(grp => {
                          const val = row.groupValues[grp.id] || 0;
                          totalRow += val;
                          return (
                            <td key={grp.id} className="p-3 text-center font-mono font-bold text-slate-800">
                              {val}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-mono font-extrabold text-cyan-700 bg-slate-50">
                          {totalRow}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
