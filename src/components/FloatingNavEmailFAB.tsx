import React, { useState } from 'react';
import {
  Mail,
  Navigation,
  CheckCircle2,
  Trash2,
  ChevronUp,
  LayoutGrid,
  Send,
  X,
  Sparkles
} from 'lucide-react';

export interface SectionNavItem {
  id: string;
  title: string;
  category: 'summary' | 'network' | 'matrices' | 'rankings';
  isSelected: boolean;
  order: number;
}

interface FloatingNavEmailFABProps {
  sections: SectionNavItem[];
  selectedCount: number;
  onToggleSection: (id: string) => void;
  onClearAll: () => void;
  onOpenEmailModal: () => void;
  onSelectAll: () => void;
  onSelectSummaryOnly: () => void;
}

export const FloatingNavEmailFAB: React.FC<FloatingNavEmailFABProps> = ({
  sections,
  selectedCount,
  onToggleSection,
  onClearAll,
  onOpenEmailModal,
  onSelectAll,
  onSelectSummaryOnly
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end space-y-3 font-sans">
      {/* Expanded Menu Panel */}
      {isOpen && (
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl w-80 max-h-[80vh] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg">
                <Navigation className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-sm text-white">Navegación y Reportes</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick selections */}
          <div className="py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-bold">Seleccionadas: <strong className="text-blue-400">{selectedCount}</strong></span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={onSelectAll}
                className="text-blue-400 hover:text-blue-300 font-bold hover:underline"
              >
                Todas
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={onSelectSummaryOnly}
                className="text-amber-400 hover:text-amber-300 font-bold hover:underline"
              >
                Resumen
              </button>
              {selectedCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <button
                    onClick={onClearAll}
                    className="text-red-400 hover:text-red-300 font-bold hover:underline flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Section Navigation List with Checkboxes */}
          <div className="py-2 overflow-y-auto space-y-1.5 flex-1 max-h-60">
            {sections.map(s => (
              <div
                key={s.id}
                className={`flex items-center justify-between p-2 rounded-xl transition-all border text-xs ${
                  s.isSelected
                    ? 'bg-blue-950/40 border-blue-600/40 text-blue-200'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                {/* Scroll button */}
                <button
                  onClick={() => scrollToSection(s.id)}
                  className="flex-1 text-left font-semibold truncate pr-2 hover:text-blue-400 transition-colors flex items-center gap-1.5"
                  title="Ir directamente a este recuadro"
                >
                  <ChevronUp className="w-3 h-3 text-slate-500 shrink-0 rotate-90" />
                  <span className="truncate">{s.title}</span>
                </button>

                {/* Email toggle checkbox */}
                <button
                  onClick={() => onToggleSection(s.id)}
                  className={`p-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                    s.isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  title={s.isSelected ? 'Quitar del reporte por correo' : 'Añadir al reporte por correo'}
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Mail Action button */}
          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenEmailModal();
              }}
              disabled={selectedCount === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar {selectedCount} Recuadro(s) por Correo</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Trigger FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-3 rounded-full shadow-2xl border border-blue-400/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <div className="relative">
          <Mail className="w-5 h-5 text-white" />
          {selectedCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md">
              {selectedCount}
            </span>
          )}
        </div>
        <span className="font-extrabold text-xs hidden sm:inline">Navegar & Correo</span>
      </button>
    </div>
  );
};
