import React, { useState } from 'react';
import { ClipboardPaste, CheckCircle2, AlertTriangle, FileSpreadsheet, Play, Sparkles, Calendar } from 'lucide-react';
import { Central, WorkGroup, DailyReport } from '../types';
import { parseExcelClipboardData } from '../utils/statCalculations';
import { getTodayStr, isFutureDate } from '../utils/dateUtils';

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
  const SAMPLE_EXCEL_FORMAT = `Central, Planta Exterior, Conmutación, Transmisión y Fibra, Energía y Climatización, Banda Ancha y FTTH, Soporte e Ingeniero
Central Metropolitana, 8, 3, 2, 1, 5, 2
Central Norte (Tele), 4, 1, 0, 1, 3, 1
Central Este, 2, 2, 1, 0, 2, 0
Central Sur, 5, 4, 2, 1, 4, 1
Central Digital Oeste, 3, 1, 1, 0, 2, 1
Central Fibra Centro, 6, 2, 3, 1, 6, 2`;

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
      // Find matching central
      let matchedCentral = centrales.find(
        c => c.name.toLowerCase() === row.centralName.toLowerCase() ||
             c.name.toLowerCase().includes(row.centralName.toLowerCase()) ||
             row.centralName.toLowerCase().includes(c.name.toLowerCase())
      );

      // If central doesn't exist, use or default
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
      text: 'Se ha cargado una plantilla de ejemplo. Presione "Procesar e Importar al Histórico" para probar.'
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
              Copie una tabla directamente desde Excel o Hoja de Cálculo de Google y péguela en el área inferior
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
            <span>Estructura Requerida de la Tabla:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
            <li><strong>Fila 1:</strong> Nombre de la columna de central seguido por los nombres de los <strong>grupos de trabajo separados por coma</strong> o tabulación.</li>
            <li><strong>Fila 2 en adelante:</strong> Nombre de la central telefónica más los <strong>valores numéricos de reportes</strong> para cada grupo.</li>
          </ul>
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
            rows={10}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`Pegue aquí los datos desde Excel...\n\nEjemplo:\nCentral, Planta Exterior, Conmutación, Transmisión y Fibra, Energía y Climatización, Banda Ancha, Soporte\nCentral Norte (Tele), 5, 1, 2, 0, 3, 1`}
            className="w-full bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl border border-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-inner"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={handlePasteSample}
              className="inline-flex items-center space-x-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition-colors font-semibold border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Cargar Plantilla de Ejemplo</span>
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

      </div>

    </div>
  );
};
