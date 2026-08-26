import React from 'react';
import { FileText, Sparkles } from 'lucide-react';

interface FloatingReportFABProps {
  onOpenReportModal: () => void;
  totalRecordsCount: number;
}

export const FloatingReportFAB: React.FC<FloatingReportFABProps> = ({
  onOpenReportModal,
  totalRecordsCount
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end space-y-3 font-sans">
      <button
        onClick={onOpenReportModal}
        className="group relative flex items-center space-x-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white px-5 py-3.5 rounded-full shadow-2xl border border-blue-400/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title="Generar Informe Ejecutivo: Análisis de las IP con Matrices por Teléfono, Mes y Demora en Días"
      >
        <div className="p-1 bg-white/20 rounded-full">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-black text-xs sm:text-sm tracking-wide">Crear Informe</span>
          <span className="text-[10px] text-blue-100 font-medium hidden sm:inline">
            Análisis de las IP ({totalRecordsCount})
          </span>
        </div>
      </button>
    </div>
  );
};
