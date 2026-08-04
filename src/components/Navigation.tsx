import React from 'react';
import { LayoutDashboard, TrendingUp, Layers, Cpu, GitCompare, ClipboardPaste, Building2, CalendarPlus, History, Settings, Cloud } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onBackToHub?: () => void;
}

export const NAVIGATION_TABS = [
  { id: 'dashboard', label: 'Dashboard General', icon: LayoutDashboard },
  { id: 'semanal', label: 'Análisis Semanal', icon: TrendingUp },
  { id: 'comparativa', label: 'Comparativa Multi-Periodos', icon: Layers },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'tecnica', label: 'Técnica Instalada', icon: Cpu },
  { id: 'diferencias', label: 'Matriz de Diferencias', icon: GitCompare },
  { id: 'excel', label: 'Pegar desde Excel', icon: ClipboardPaste },
  { id: 'centrales', label: 'Centrales y Grupos', icon: Building2 },
  { id: 'registro', label: 'Registro Diario', icon: CalendarPlus },
  { id: 'drive_backup', label: 'Google Drive Backup', icon: Cloud },
  { id: 'ajustes', label: 'Ajustes Informe', icon: Settings }
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, onBackToHub }) => {
  return (
    <nav className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-300">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex space-x-1 overflow-x-auto py-2 no-scrollbar">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-black rounded-lg transition-all bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 mr-1 shadow-sm"
              title="Volver al Portal Principal de Módulos"
            >
              <span>← Portal</span>
            </button>
          )}

          {NAVIGATION_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
