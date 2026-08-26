import React, { useState, useMemo } from 'react';
import {
  FileText,
  X,
  Copy,
  Check,
  FileDown,
  Printer,
  Calendar,
  Clock,
  Layers,
  Phone,
  Radio,
  FileSpreadsheet,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { IpCableExcelParseResult, IpCableRow, ZoneConfig } from '../types/ipCablesTypes';
import {
  getDemoraDays,
  matchTelefonoTypeFilter,
  findMatchingZoneForItem,
  optimizeAndSimplifyRows
} from '../utils/ipCablesExcelParser';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  excelData: IpCableExcelParseResult | null;
  zones: ZoneConfig[];
  isConsolidationActive: boolean;
}

interface MatrixResult {
  title: string;
  subtitle: string;
  rows: string[];
  columns: string[];
  cellMap: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

const DEMORA_CATEGORIES = [
  { key: '0', label: '0 Días (Atención Inmediata)', filterFn: (d: number) => d === 0 },
  { key: '1', label: '1 Día', filterFn: (d: number) => d === 1 },
  { key: '2', label: '2 Días', filterFn: (d: number) => d === 2 },
  { key: '3', label: '3 Días', filterFn: (d: number) => d === 3 },
  { key: '4_30', label: '4 - 30 Días (Demora Crítica)', filterFn: (d: number) => d >= 4 && d <= 30 }
];

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  excelData,
  zones,
  isConsolidationActive
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'telefono' | 'txd'>('all');
  const [copied, setCopied] = useState(false);
  const [localOptimization, setLocalOptimization] = useState<boolean>(isConsolidationActive);

  // Generate dynamic filename and title with current timestamp (YYYY-MM-DD_HH-mm-ss)
  const reportDate = useMemo(() => new Date(), [isOpen]);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${reportDate.getFullYear()}-${pad(reportDate.getMonth() + 1)}-${pad(reportDate.getDate())}`;
  const timeStr = `${pad(reportDate.getHours())}-${pad(reportDate.getMinutes())}-${pad(reportDate.getSeconds())}`;
  const reportFileName = `Análisis de las IP ${dateStr}_${timeStr}`;

  // Extract available years from dataset
  const availableYears = useMemo(() => {
    if (!excelData) return [];
    const yrSet = new Set<number>();
    excelData.consolidatedRows.forEach(item => {
      if (item.fechaReporte && item.fechaReporte.length >= 4) {
        const y = parseInt(item.fechaReporte.split('-')[0], 10);
        if (!isNaN(y)) yrSet.add(y);
      }
    });
    return Array.from(yrSet).sort((a, b) => b - a);
  }, [excelData]);

  // Universe of rows to process
  const baseRows = useMemo(() => {
    if (!excelData) return [];
    if (localOptimization) {
      return optimizeAndSimplifyRows(excelData.consolidatedRows);
    }
    return excelData.consolidatedRows;
  }, [excelData, localOptimization]);

  // Segment 1: Teléfono (Solo números)
  const rowsTelefono = useMemo(() => {
    return baseRows.filter(r => matchTelefonoTypeFilter(r, 'telefono'));
  }, [baseRows]);

  // Segment 2: TxD Dato (Con letras)
  const rowsTxD = useMemo(() => {
    return baseRows.filter(r => matchTelefonoTypeFilter(r, 'txd_dato'));
  }, [baseRows]);

  // Generic matrix calculator: Centrales vs Grupos
  const buildCentralesMatrix = (rows: IpCableRow[], title: string, subtitle: string): MatrixResult => {
    const presentCentrales = new Set<string>();
    const presentGroups = new Set<string>();

    rows.forEach(item => {
      if (item.central) presentCentrales.add(item.central.trim().toUpperCase());
      if (item.grupo) {
        item.grupo.split('/').forEach(g => presentGroups.add(g.trim()));
      }
    });

    const colsList = Array.from(presentGroups).filter(Boolean).sort();
    if (colsList.length === 0 && excelData?.uniqueGroups) {
      colsList.push(...excelData.uniqueGroups);
    }

    const rowsList = Array.from(presentCentrales).filter(Boolean).sort();

    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    rowsList.forEach(r => {
      cellMap[r] = {};
      rowTotals[r] = 0;
      colsList.forEach(c => { cellMap[r][c] = 0; });
    });
    colsList.forEach(c => { colTotals[c] = 0; });

    rows.forEach(item => {
      const cnt = (item.central || 'CENTRAL GENERAL').trim().toUpperCase();
      const rawGroups = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim()).filter(Boolean);
      const uniqueGroups = Array.from(new Set(rawGroups));

      if (!cellMap[cnt]) {
        cellMap[cnt] = {};
        rowTotals[cnt] = 0;
        if (!rowsList.includes(cnt)) rowsList.push(cnt);
        colsList.forEach(c => { cellMap[cnt][c] = 0; });
      }

      uniqueGroups.forEach(g => {
        if (!colsList.includes(g)) {
          colsList.push(g);
          colTotals[g] = 0;
          rowsList.forEach(r => { if (!cellMap[r][g]) cellMap[r][g] = 0; });
        }

        cellMap[cnt][g] = (cellMap[cnt][g] || 0) + 1;
        rowTotals[cnt] = (rowTotals[cnt] || 0) + 1;
        colTotals[g] = (colTotals[g] || 0) + 1;
        grandTotal += 1;
      });
    });

    return {
      title,
      subtitle,
      rows: rowsList.sort(),
      columns: colsList.sort(),
      cellMap,
      rowTotals,
      colTotals,
      grandTotal
    };
  };

  // Generic matrix calculator: Zonificación vs Grupos
  const buildZonasMatrix = (rows: IpCableRow[], title: string, subtitle: string): MatrixResult => {
    const UNZONED_KEY = 'Sin Zonificar';
    const presentGroups = new Set<string>();

    rows.forEach(item => {
      if (item.grupo) {
        item.grupo.split('/').forEach(g => presentGroups.add(g.trim()));
      }
    });

    const colsList = Array.from(presentGroups).filter(Boolean).sort();
    if (colsList.length === 0 && excelData?.uniqueGroups) {
      colsList.push(...excelData.uniqueGroups);
    }

    const configuredZoneNames = zones.map(z => z.name);
    const rowsList = [...configuredZoneNames];

    const cellMap: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    rowsList.forEach(z => {
      cellMap[z] = {};
      rowTotals[z] = 0;
      colsList.forEach(c => { cellMap[z][c] = 0; });
    });

    cellMap[UNZONED_KEY] = {};
    rowTotals[UNZONED_KEY] = 0;
    colsList.forEach(c => { cellMap[UNZONED_KEY][c] = 0; });
    colsList.forEach(c => { colTotals[c] = 0; });

    rows.forEach(item => {
      const rawGroups = (item.grupo || 'GRUPO GENERAL').split('/').map(g => g.trim()).filter(Boolean);
      const uniqueGroups = Array.from(new Set(rawGroups));

      const matchedZone = findMatchingZoneForItem(item, zones);
      const targetZoneKey = matchedZone ? matchedZone.name : UNZONED_KEY;

      if (!cellMap[targetZoneKey]) {
        cellMap[targetZoneKey] = {};
        rowTotals[targetZoneKey] = 0;
        if (!rowsList.includes(targetZoneKey)) rowsList.push(targetZoneKey);
        colsList.forEach(c => { cellMap[targetZoneKey][c] = 0; });
      }

      uniqueGroups.forEach(g => {
        if (!colsList.includes(g)) {
          colsList.push(g);
          colTotals[g] = 0;
          rowsList.forEach(r => { if (!cellMap[r][g]) cellMap[r][g] = 0; });
        }

        cellMap[targetZoneKey][g] = (cellMap[targetZoneKey][g] || 0) + 1;
        rowTotals[targetZoneKey] = (rowTotals[targetZoneKey] || 0) + 1;
        colTotals[g] = (colTotals[g] || 0) + 1;
        grandTotal += 1;
      });
    });

    const finalRows = [...configuredZoneNames];
    if ((rowTotals[UNZONED_KEY] || 0) > 0 && !finalRows.includes(UNZONED_KEY)) {
      finalRows.push(UNZONED_KEY);
    }

    return {
      title,
      subtitle,
      rows: finalRows,
      columns: colsList.sort(),
      cellMap,
      rowTotals,
      colTotals,
      grandTotal
    };
  };

  // Helper to extract active months (with count >= 1)
  const getActiveMonthsForRows = (rows: IpCableRow[]) => {
    const monthMap = new Map<string, { year: number; month: number; label: string; rows: IpCableRow[] }>();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    rows.forEach(item => {
      if (item.fechaReporte && item.fechaReporte.length >= 7) {
        const parts = item.fechaReporte.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);

        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          if (selectedYear !== 'all' && y !== parseInt(selectedYear, 10)) {
            return;
          }

          const key = `${y}-${pad(m)}`;
          if (!monthMap.has(key)) {
            monthMap.set(key, {
              year: y,
              month: m,
              label: `${monthNames[m - 1]} ${y}`,
              rows: []
            });
          }
          monthMap.get(key)!.rows.push(item);
        }
      }
    });

    // Only return months with at least 1 report, sorted chronologically
    return Array.from(monthMap.values())
      .filter(m => m.rows.length >= 1)
      .sort((a, b) => a.year - b.year || a.month - b.month);
  };

  // Compute sections for Teléfono
  const telefonoSections = useMemo(() => {
    // 1. Monthly Matrices
    const activeMonths = getActiveMonthsForRows(rowsTelefono);
    const monthlyData = activeMonths.map(m => ({
      key: `${m.year}-${m.month}`,
      label: m.label,
      count: m.rows.length,
      matrixCentrales: buildCentralesMatrix(
        m.rows,
        `Matriz de Reportes: Central Telefónica vs Grupo - ${m.label}`,
        `📞 Teléfono (Solo números) • Mes: ${m.label} • Total: ${m.rows.length} servicios`
      ),
      matrixZonas: buildZonasMatrix(
        m.rows,
        `Matriz de Zonificación vs Grupo - ${m.label}`,
        `📞 Teléfono (Solo números) • Mes: ${m.label} • Total: ${m.rows.length} servicios`
      )
    }));

    // 2. Delay Matrices
    const delayData = DEMORA_CATEGORIES.map(cat => {
      const catRows = rowsTelefono.filter(r => cat.filterFn(getDemoraDays(r)));
      return {
        key: cat.key,
        label: cat.label,
        count: catRows.length,
        matrixCentrales: buildCentralesMatrix(
          catRows,
          `Matriz de Reportes: Central Telefónica vs Grupo - Demora ${cat.label}`,
          `📞 Teléfono (Solo números) • Intervalo: ${cat.label} • Total: ${catRows.length} servicios`
        ),
        matrixZonas: buildZonasMatrix(
          catRows,
          `Matriz de Zonificación vs Grupo - Demora ${cat.label}`,
          `📞 Teléfono (Solo números) • Intervalo: ${cat.label} • Total: ${catRows.length} servicios`
        )
      };
    });

    return {
      monthlyData,
      delayData,
      totalRows: rowsTelefono.length
    };
  }, [rowsTelefono, selectedYear, zones, excelData]);

  // Compute sections for TxD Dato
  const txdSections = useMemo(() => {
    // 1. Monthly Matrices
    const activeMonths = getActiveMonthsForRows(rowsTxD);
    const monthlyData = activeMonths.map(m => ({
      key: `${m.year}-${m.month}`,
      label: m.label,
      count: m.rows.length,
      matrixCentrales: buildCentralesMatrix(
        m.rows,
        `Matriz de Reportes: Central Telefónica vs Grupo - ${m.label}`,
        `💻 TxD Dato (Con letras) • Mes: ${m.label} • Total: ${m.rows.length} servicios`
      ),
      matrixZonas: buildZonasMatrix(
        m.rows,
        `Matriz de Zonificación vs Grupo - ${m.label}`,
        `💻 TxD Dato (Con letras) • Mes: ${m.label} • Total: ${m.rows.length} servicios`
      )
    }));

    // 2. Delay Matrices
    const delayData = DEMORA_CATEGORIES.map(cat => {
      const catRows = rowsTxD.filter(r => cat.filterFn(getDemoraDays(r)));
      return {
        key: cat.key,
        label: cat.label,
        count: catRows.length,
        matrixCentrales: buildCentralesMatrix(
          catRows,
          `Matriz de Reportes: Central Telefónica vs Grupo - Demora ${cat.label}`,
          `💻 TxD Dato (Con letras) • Intervalo: ${cat.label} • Total: ${catRows.length} servicios`
        ),
        matrixZonas: buildZonasMatrix(
          catRows,
          `Matriz de Zonificación vs Grupo - Demora ${cat.label}`,
          `💻 TxD Dato (Con letras) • Intervalo: ${cat.label} • Total: ${catRows.length} servicios`
        )
      };
    });

    return {
      monthlyData,
      delayData,
      totalRows: rowsTxD.length
    };
  }, [rowsTxD, selectedYear, zones, excelData]);

  // Render a Single Matrix Table Component
  const renderMatrixCard = (mat: MatrixResult, badgeColor: 'blue' | 'emerald') => {
    const isBlue = badgeColor === 'blue';
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h5 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isBlue ? 'bg-blue-400' : 'bg-emerald-400'}`} />
              {mat.title}
            </h5>
            <p className="text-[11px] text-slate-400 mt-0.5">{mat.subtitle}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-black border ${
              isBlue ? 'bg-blue-950/80 text-blue-300 border-blue-700/50' : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
            }`}>
              Total: {mat.grandTotal}
            </span>
          </div>
        </div>

        {mat.rows.length === 0 || mat.grandTotal === 0 ? (
          <div className="py-5 text-center text-slate-500 italic text-xs">
            Sin reportes para este criterio de segmentación.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-black text-white">Elemento</th>
                  {mat.columns.map(c => (
                    <th key={c} className="py-2.5 px-3 text-center">{c}</th>
                  ))}
                  <th className="py-2.5 px-3 text-center text-amber-400 font-black">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {mat.rows.map(r => (
                  <tr key={r} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-bold text-white whitespace-nowrap">{r}</td>
                    {mat.columns.map(c => {
                      const val = mat.cellMap[r]?.[c] || 0;
                      return (
                        <td key={c} className={`py-2 px-3 text-center font-mono ${val > 0 ? 'text-blue-300 font-bold' : 'text-slate-600'}`}>
                          {val > 0 ? val : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-center font-mono font-black text-amber-300 bg-amber-950/20">
                      {mat.rowTotals[r] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-950 font-black border-t-2 border-slate-800 text-white text-[11px]">
                <tr>
                  <td className="py-2.5 px-3 text-amber-400 font-black">TOTAL GENERAL</td>
                  {mat.columns.map(c => (
                    <td key={c} className="py-2.5 px-3 text-center font-mono text-cyan-300">
                      {mat.colTotals[c] || 0}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-400 text-xs bg-emerald-950/40">
                    {mat.grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Full HTML builder for Word / Clipboard / Printing
  const generateFullHtml = (): string => {
    const tableStyle = `width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5pt; font-family: Arial, sans-serif;`;
    const thStyle = `border: 1px solid #cbd5e1; padding: 6px 8px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center;`;
    const thFirstStyle = `border: 1px solid #cbd5e1; padding: 6px 8px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: left;`;
    const tdStyle = `border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;`;
    const tdFirstStyle = `border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; font-weight: bold;`;
    const tfStyle = `border: 1px solid #cbd5e1; padding: 6px 8px; background-color: #f1f5f9; font-weight: bold; text-align: center;`;
    const tfFirstStyle = `border: 1px solid #cbd5e1; padding: 6px 8px; background-color: #f1f5f9; font-weight: bold; text-align: left; color: #0f172a;`;

    const renderHtmlTable = (mat: MatrixResult) => `
      <div style="margin-bottom: 24px; page-break-inside: avoid; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
        <div style="font-weight: bold; font-size: 11pt; color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-bottom: 6px;">
          ${mat.title}
        </div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 8px;">
          ${mat.subtitle}
        </div>
        <table style="${tableStyle}">
          <thead>
            <tr>
              <th style="${thFirstStyle}">Elemento</th>
              ${mat.columns.map(c => `<th style="${thStyle}">${c}</th>`).join('')}
              <th style="${thStyle}; background-color: #1e293b;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${mat.rows.map((r, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="${tdFirstStyle}">${r}</td>
                ${mat.columns.map(c => {
                  const val = mat.cellMap[r]?.[c] || 0;
                  return `<td style="${tdStyle}">${val > 0 ? val : '-'}</td>`;
                }).join('')}
                <td style="${tdStyle}; font-weight: bold; background-color: #f1f5f9;">${mat.rowTotals[r] || 0}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td style="${tfFirstStyle}">TOTAL GENERAL</td>
              ${mat.columns.map(c => `<td style="${tfStyle}">${mat.colTotals[c] || 0}</td>`).join('')}
              <td style="${tfStyle}; background-color: #e2e8f0; color: #0f172a;">${mat.grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${reportFileName}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: Arial, sans-serif; background-color: #ffffff; color: #1e293b; margin: 0; padding: 20px; }
          h1 { color: #0f172a; font-size: 18pt; margin: 0 0 6px 0; border-bottom: 3px solid #2563eb; padding-bottom: 8px; }
          h2 { color: #1e293b; font-size: 14pt; margin: 24px 0 12px 0; border-bottom: 1px solid #94a3b8; padding-bottom: 6px; }
          h3 { color: #334155; font-size: 12pt; margin: 16px 0 8px 0; }
          .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 10pt; }
          .section-block { margin-bottom: 30px; }
          .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 8.5pt; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <h1>📊 ${reportFileName}</h1>
        <div class="meta-box">
          <strong>Fecha y Hora de Generación:</strong> ${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}<br/>
          <strong>Total de Servicios Consolidados:</strong> ${baseRows.length}<br/>
          <strong>Filtro de Año:</strong> ${selectedYear === 'all' ? 'Todos los Años' : selectedYear}<br/>
          <strong>Consolidación Activa:</strong> ${localOptimization ? 'Sí (Optimización Teléfono / Asociado)' : 'No (Base)'}
        </div>
    `;

    // 1. Teléfono section
    html += `
      <div class="section-block">
        <h2>📞 1. Segmento: Columna Teléfono $\rightarrow$ Teléfono (Solo números) [Total: ${telefonoSections.totalRows} servicios]</h2>
        
        <h3>📅 1.1 Análisis Cronológico Mes por Mes</h3>
        ${telefonoSections.monthlyData.length === 0 ? '<p><i>No hay meses con reportes en este período.</i></p>' : ''}
        ${telefonoSections.monthlyData.map(m => `
          ${renderHtmlTable(m.matrixCentrales)}
          ${renderHtmlTable(m.matrixZonas)}
        `).join('')}

        <h3>⏱️ 1.2 Análisis por Demora en Días</h3>
        ${telefonoSections.delayData.map(d => `
          ${renderHtmlTable(d.matrixCentrales)}
          ${renderHtmlTable(d.matrixZonas)}
        `).join('')}
      </div>
    `;

    // 2. TxD section
    html += `
      <div class="section-block" style="page-break-before: always;">
        <h2>💻 2. Segmento: Columna Teléfono $\rightarrow$ TxD Dato (Con letras) [Total: ${txdSections.totalRows} servicios]</h2>
        
        <h3>📅 2.1 Análisis Cronológico Mes por Mes</h3>
        ${txdSections.monthlyData.length === 0 ? '<p><i>No hay meses con reportes en este período.</i></p>' : ''}
        ${txdSections.monthlyData.map(m => `
          ${renderHtmlTable(m.matrixCentrales)}
          ${renderHtmlTable(m.matrixZonas)}
        `).join('')}

        <h3>⏱️ 2.2 Análisis por Demora en Días</h3>
        ${txdSections.delayData.map(d => `
          ${renderHtmlTable(d.matrixCentrales)}
          ${renderHtmlTable(d.matrixZonas)}
        `).join('')}
      </div>
      <div class="footer">
        Documento oficial generado por la Plataforma de Análisis de Incidencias IP y Planta Externa.
      </div>
      </body>
      </html>
    `;

    return html;
  };

  // Copy Formatted to Clipboard
  const handleCopyClipboard = () => {
    try {
      const htmlContent = generateFullHtml();
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([reportFileName], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

      navigator.clipboard.write(data).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {
        navigator.clipboard.writeText(htmlContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Export to Word (.doc)
  const handleExportWord = () => {
    const htmlContent = generateFullHtml();
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportFileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to Excel (.xls HTML table format)
  const handleExportExcel = () => {
    const htmlContent = generateFullHtml();
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportFileName}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Report
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generateFullHtml());
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30 shrink-0">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  {reportFileName}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {baseRows.length} Servicios Consolidados
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Informe estructurado por Columna Teléfono (Teléfono vs TxD Dato), Cronología Mes por Mes y Demora en Días
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Filters & Actions */}
        <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          
          {/* Filter selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400 font-bold text-[11px]">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">Todos los Años</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr} className="bg-slate-900 text-white">{yr}</option>
                ))}
              </select>
            </div>

            {/* Optimization toggle */}
            <button
              onClick={() => setLocalOptimization(!localOptimization)}
              className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] flex items-center space-x-1.5 transition-all cursor-pointer ${
                localOptimization
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Alternar simplificación de pares Teléfono / Asociado"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Optimización Teléfono/Asoc: {localOptimization ? 'Activa' : 'Inactiva'}</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vista Completa
            </button>
            <button
              onClick={() => setActiveTab('telefono')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'telefono' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Phone className="w-3 h-3" />
              Teléfono ({telefonoSections.totalRows})
            </button>
            <button
              onClick={() => setActiveTab('txd')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'txd' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3 h-3" />
              TxD Dato ({txdSections.totalRows})
            </button>
          </div>

        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 bg-slate-950/40">

          {/* Section 1: Teléfono (Solo números) */}
          {(activeTab === 'all' || activeTab === 'telefono') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-blue-500/40 pb-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                    <Phone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">
                      1. Segmento: Columna Teléfono $\rightarrow$ 📞 Teléfono (Solo números)
                    </h4>
                    <p className="text-xs text-slate-400">Total de servicios analizados: <strong className="text-white font-mono">{telefonoSections.totalRows}</strong></p>
                  </div>
                </div>
              </div>

              {/* 1.1 Mes por Mes */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-300 uppercase tracking-wider bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-800/40">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>1.1 Matrices de Reportes Mes por Mes (Meses con $\ge 1$ reporte)</span>
                </div>

                {telefonoSections.monthlyData.length === 0 ? (
                  <div className="p-4 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                    No se registraron meses con reportes en este segmento para el año seleccionado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {telefonoSections.monthlyData.map(m => (
                      <React.Fragment key={m.key}>
                        {renderMatrixCard(m.matrixCentrales, 'blue')}
                        {renderMatrixCard(m.matrixZonas, 'emerald')}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* 1.2 Por Demora en Días */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 uppercase tracking-wider bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-800/40">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>1.2 Matrices por Demora en Días (0, 1, 2, 3 y 4-30 días)</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {telefonoSections.delayData.map(d => (
                    <React.Fragment key={d.key}>
                      {renderMatrixCard(d.matrixCentrales, 'blue')}
                      {renderMatrixCard(d.matrixZonas, 'emerald')}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: TxD Dato (Con letras) */}
          {(activeTab === 'all' || activeTab === 'txd') && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between border-b-2 border-emerald-500/40 pb-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Radio className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">
                      2. Segmento: Columna Teléfono $\rightarrow$ 💻 TxD Dato (Con letras)
                    </h4>
                    <p className="text-xs text-slate-400">Total de servicios analizados: <strong className="text-white font-mono">{txdSections.totalRows}</strong></p>
                  </div>
                </div>
              </div>

              {/* 2.1 Mes por Mes */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300 uppercase tracking-wider bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/40">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>2.1 Matrices de Reportes Mes por Mes (Meses con $\ge 1$ reporte)</span>
                </div>

                {txdSections.monthlyData.length === 0 ? (
                  <div className="p-4 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                    No se registraron meses con reportes en este segmento para el año seleccionado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {txdSections.monthlyData.map(m => (
                      <React.Fragment key={m.key}>
                        {renderMatrixCard(m.matrixCentrales, 'blue')}
                        {renderMatrixCard(m.matrixZonas, 'emerald')}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* 2.2 Por Demora en Días */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 uppercase tracking-wider bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-800/40">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>2.2 Matrices por Demora en Días (0, 1, 2, 3 y 4-30 días)</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {txdSections.delayData.map(d => (
                    <React.Fragment key={d.key}>
                      {renderMatrixCard(d.matrixCentrales, 'blue')}
                      {renderMatrixCard(d.matrixZonas, 'emerald')}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              title="Copiar todas las matrices en formato HTML enriquecido para Word / Excel / Correo"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
              <span>{copied ? '¡Informe Copiado!' : 'Copiar Informe Formateado'}</span>
            </button>

            <button
              onClick={handleExportWord}
              className="px-4 py-2.5 bg-indigo-900/80 hover:bg-indigo-700 text-indigo-100 rounded-xl font-bold text-xs flex items-center gap-2 border border-indigo-700/60 transition-all cursor-pointer shadow-sm"
              title="Exportar documento oficial de Word (.doc)"
            >
              <FileDown className="w-4 h-4 text-indigo-300" />
              <span>Exportar Word (.doc)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-900/80 hover:bg-emerald-700 text-emerald-100 rounded-xl font-bold text-xs flex items-center gap-2 border border-emerald-700/60 transition-all cursor-pointer shadow-sm"
              title="Exportar tablas completas a Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Exportar Excel (.xls)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              title="Imprimir o Guardar como PDF"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Imprimir / PDF</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
