import React, { useState } from 'react';
import { Copy, Check, Image as ImageIcon, Table as TableIcon } from 'lucide-react';
import { copyTableToClipboard, copyElementAsImageToClipboard } from '../utils/clipboardUtils';

interface CopyTableButtonProps {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  className?: string;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'dark' | 'outline';
  size?: 'sm' | 'md';
}

export const CopyTableButton: React.FC<CopyTableButtonProps> = ({
  headers,
  rows,
  title,
  className = '',
  buttonText = 'Copiar Tabla',
  variant = 'secondary',
  size = 'sm'
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyTableToClipboard(headers, rows, title);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert('No se pudo copiar al portapapeles. Intente seleccionar el texto manualmente.');
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm';
      case 'dark':
        return 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700';
      case 'outline':
        return 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300';
      case 'secondary':
      default:
        return 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200';
    }
  };

  const sizeStyles = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs font-bold';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all ${getVariantStyles()} ${sizeStyles} ${className}`}
      title="Copiar tabla en formato compatible con Word y Excel"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in" />
          <span className="text-emerald-600 font-bold">¡Tabla Copiada!</span>
        </>
      ) : (
        <>
          <TableIcon className="w-3.5 h-3.5 opacity-80" />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
};

interface CopyImageButtonProps {
  elementId: string;
  fallbackTextSummary?: string;
  className?: string;
  buttonText?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'dark' | 'outline';
  size?: 'sm' | 'md';
}

export const CopyImageButton: React.FC<CopyImageButtonProps> = ({
  elementId,
  fallbackTextSummary,
  className = '',
  buttonText = 'Copiar Gráfica',
  label,
  variant = 'dark',
  size = 'sm'
}) => {
  const [copied, setCopied] = useState(false);
  const [successLabel, setSuccessLabel] = useState('¡Imagen Copiada!');

  const displayText = label || buttonText;

  const handleCopy = async () => {
    const result = await copyElementAsImageToClipboard(elementId, fallbackTextSummary);
    if (result.success) {
      setSuccessLabel(result.mode === 'download' ? '¡PNG Descargado!' : '¡Imagen Copiada!');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      alert('No se pudo procesar la gráfica. Intente nuevamente.');
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm';
      case 'dark':
        return 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700';
      case 'outline':
        return 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300';
      case 'secondary':
      default:
        return 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200';
    }
  };

  const sizeStyles = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs font-bold';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all ${getVariantStyles()} ${sizeStyles} ${className}`}
      title="Copiar o descargar gráfica como imagen (PNG) para pegar en Word, PowerPoint o Excel"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in" />
          <span className="text-emerald-600 font-bold">{successLabel}</span>
        </>
      ) : (
        <>
          <ImageIcon className="w-3.5 h-3.5 opacity-80" />
          <span>{displayText}</span>
        </>
      )}
    </button>
  );
};
