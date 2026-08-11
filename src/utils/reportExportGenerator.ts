import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getSafeHtml2CanvasOptions } from './html2canvasFix';
import { Central, WorkGroup, DailyReport, RepairRecord, ReportSettings, WordReportProfile, WordReportSectionConfig } from '../types';
import { DEFAULT_REPORT_SETTINGS } from './settingsUtils';
import { loadRepairRecords } from '../data/mockData';

/**
 * Generate high-resolution Bar Chart Image on Canvas and return Uint8Array for docx embedding
 */
function generateBarChartCanvasImage(
  title: string,
  categories: string[],
  series1Name: string,
  series1Data: number[],
  series2Name: string,
  series2Data: number[],
  colors: { series1: string; series2: string },
  options?: { rotateLabels?: boolean }
): Uint8Array {
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 620;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array();

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer Border & Card Shadow Simulation
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Title
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'left';
  ctx.fillText(title, 40, 48);

  // Plot Margins
  const marginLeft = 80;
  const marginRight = 40;
  const marginTop = 75;
  const n = categories.length;
  const shouldRotate = options?.rotateLabels ?? (n > 6);
  const marginBottom = shouldRotate ? 140 : 100;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  // Max Value for Y Axis
  const maxValRaw = Math.max(...series1Data, ...series2Data, 1);
  const niceMax = Math.max(5, Math.ceil(maxValRaw * 1.25));

  // Grid Lines & Y Axis Labels
  const gridSteps = 4;
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#F1F5F9';
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = Math.round((niceMax / gridSteps) * i);
    const yPos = marginTop + plotHeight - (yVal / niceMax) * plotHeight;

    ctx.beginPath();
    ctx.moveTo(marginLeft, yPos);
    ctx.lineTo(marginLeft + plotWidth, yPos);
    ctx.stroke();

    ctx.fillText(yVal.toString(), marginLeft - 12, yPos + 5);
  }

  // Base X Axis Line
  ctx.beginPath();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.moveTo(marginLeft, marginTop + plotHeight);
  ctx.lineTo(marginLeft + plotWidth, marginTop + plotHeight);
  ctx.stroke();

  // Bars
  if (n > 0) {
    const catWidth = plotWidth / n;
    const groupPadding = Math.min(catWidth * 0.15, 20);
    const barWidth = Math.max(4, (catWidth - groupPadding * 2) / 2);

    for (let i = 0; i < n; i++) {
      const catX = marginLeft + i * catWidth;
      const bar1X = catX + groupPadding;
      const bar2X = bar1X + barWidth + Math.min(2, barWidth * 0.2);

      const val1 = series1Data[i] || 0;
      const val2 = series2Data[i] || 0;

      const h1 = (val1 / niceMax) * plotHeight;
      const h2 = (val2 / niceMax) * plotHeight;

      const y1 = marginTop + plotHeight - h1;
      const y2 = marginTop + plotHeight - h2;

      // Draw Bar 1
      ctx.fillStyle = colors.series1;
      ctx.fillRect(bar1X, y1, barWidth, h1);

      // Value label 1
      if (val1 > 0) {
        ctx.font = n > 25 ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
        ctx.fillStyle = colors.series1;
        ctx.textAlign = 'center';
        ctx.fillText(val1.toString(), bar1X + barWidth / 2, y1 - 4);
      }

      // Draw Bar 2
      ctx.fillStyle = colors.series2;
      ctx.fillRect(bar2X, y2, barWidth, h2);

      // Value label 2
      if (val2 > 0) {
        ctx.font = n > 25 ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
        ctx.fillStyle = colors.series2;
        ctx.textAlign = 'center';
        ctx.fillText(val2.toString(), bar2X + barWidth / 2, y2 - 4);
      }

      // Category Label below X Axis
      const labelX = catX + catWidth / 2;
      const labelY = marginTop + plotHeight + 15;

      if (shouldRotate) {
        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate((Math.PI / 180) * 45); // 45 degrees angle down-right
        ctx.font = n > 25 ? 'bold 11px sans-serif' : 'bold 13px sans-serif';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'left';
        ctx.fillText(categories[i], 0, 5);
        ctx.restore();
      } else {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText(categories[i], labelX, labelY + 15);
      }
    }
  }

  // --- LEGEND AT THE BOTTOM (CENTERED) ---
  ctx.font = 'bold 15px sans-serif';
  const text1Width = ctx.measureText(series1Name).width;
  const text2Width = ctx.measureText(series2Name).width;
  const item1Width = 24 + text1Width;
  const item2Width = 24 + text2Width;
  const gap = 45;
  const totalLegendWidth = item1Width + gap + item2Width;
  const legendX = (width - totalLegendWidth) / 2;
  const legendY = height - 32;

  // Series 1 Legend Box & Label
  ctx.fillStyle = colors.series1;
  ctx.fillRect(legendX, legendY - 14, 18, 18);
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'left';
  ctx.fillText(series1Name, legendX + 26, legendY);

  // Series 2 Legend Box & Label
  const item2X = legendX + item1Width + gap;
  ctx.fillStyle = colors.series2;
  ctx.fillRect(item2X, legendY - 14, 18, 18);
  ctx.fillStyle = '#1E293B';
  ctx.fillText(series2Name, item2X + 26, legendY);

  // Convert canvas to image Uint8Array
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('Error generating bar chart canvas image:', e);
    return new Uint8Array();
  }
}

/**
 * Generate MTTR and Repairs Canvas Image
 * Left Y-Axis: MTTR Promedio (Horas)
 * Right Y-Axis: Cantidad de Reparaciones
 */
function generateMttrChartCanvasImage(
  title: string,
  categories: string[],
  mttrData: number[],
  repairsData: number[]
): Uint8Array {
  try {
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 620;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8Array();

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Outer Border
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Title
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'left';
    ctx.fillText(title, 40, 48);

    // Margins
    const marginLeft = 80;
    const marginRight = 80;
    const marginTop = 75;
    const n = categories.length;
    const shouldRotate = n > 6;
    const marginBottom = shouldRotate ? 140 : 100;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    // Max values for dual scale
    const maxMttrRaw = Math.max(...mttrData, 1);
    const niceMaxMttr = Math.max(2, Math.ceil(maxMttrRaw * 1.25));

    const maxRepairsRaw = Math.max(...repairsData, 1);
    const niceMaxRepairs = Math.max(5, Math.ceil(maxRepairsRaw * 1.25));

    // Grid Lines & Y Axis Labels
    const gridSteps = 4;
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridSteps; i++) {
      const y = marginTop + plotHeight - (i / gridSteps) * plotHeight;

      // Grid line
      ctx.strokeStyle = i === 0 ? '#64748B' : '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(marginLeft + plotWidth, y);
      ctx.stroke();

      // Left Y Label (MTTR Horas)
      const mttrVal = (niceMaxMttr * (i / gridSteps)).toFixed(1);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#7C3AED';
      ctx.textAlign = 'right';
      ctx.fillText(`${mttrVal} h`, marginLeft - 10, y + 4);

      // Right Y Label (Reparaciones Count)
      const repVal = Math.round(niceMaxRepairs * (i / gridSteps));
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.fillText(`${repVal}`, marginLeft + plotWidth + 10, y + 4);
    }

    // Bars
    if (n > 0) {
      const catWidth = plotWidth / n;
      const groupPadding = Math.min(catWidth * 0.15, 20);
      const barWidth = Math.max(4, (catWidth - groupPadding * 2) / 2);

      for (let i = 0; i < n; i++) {
        const catX = marginLeft + i * catWidth;
        const bar1X = catX + groupPadding;
        const bar2X = bar1X + barWidth + Math.min(2, barWidth * 0.2);

        const valMttr = mttrData[i] || 0;
        const valRep = repairsData[i] || 0;

        const h1 = (valMttr / niceMaxMttr) * plotHeight;
        const h2 = (valRep / niceMaxRepairs) * plotHeight;

        const y1 = marginTop + plotHeight - h1;
        const y2 = marginTop + plotHeight - h2;

        // Bar 1 (MTTR)
        if (h1 > 0) {
          ctx.fillStyle = '#7C3AED';
          ctx.fillRect(bar1X, y1, barWidth, h1);
          ctx.font = n > 25 ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
          ctx.fillStyle = '#6D28D9';
          ctx.textAlign = 'center';
          ctx.fillText(`${valMttr.toFixed(1)}h`, bar1X + barWidth / 2, y1 - 4);
        }

        // Bar 2 (Repairs)
        if (h2 > 0) {
          ctx.fillStyle = '#10B981';
          ctx.fillRect(bar2X, y2, barWidth, h2);
          ctx.font = n > 25 ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
          ctx.fillStyle = '#047857';
          ctx.textAlign = 'center';
          ctx.fillText(`${valRep}`, bar2X + barWidth / 2, y2 - 4);
        }

        // Category Label
        const labelX = catX + catWidth / 2;
        const labelY = marginTop + plotHeight + 15;

        if (shouldRotate) {
          ctx.save();
          ctx.translate(labelX, labelY);
          ctx.rotate((Math.PI / 180) * 45);
          ctx.font = n > 25 ? 'bold 11px sans-serif' : 'bold 13px sans-serif';
          ctx.fillStyle = '#0F172A';
          ctx.textAlign = 'left';
          ctx.fillText(categories[i], 0, 5);
          ctx.restore();
        } else {
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = '#0F172A';
          ctx.textAlign = 'center';
          ctx.fillText(categories[i], labelX, labelY + 15);
        }
      }
    }

    // --- LEGEND AT THE BOTTOM (CENTERED) ---
    const series1Name = 'MTTR Promedio (Horas)';
    const series2Name = 'Cant. Reparaciones';
    ctx.font = 'bold 15px sans-serif';
    const text1Width = ctx.measureText(series1Name).width;
    const text2Width = ctx.measureText(series2Name).width;
    const item1Width = 24 + text1Width;
    const item2Width = 24 + text2Width;
    const gap = 45;
    const totalLegendWidth = item1Width + gap + item2Width;
    const legendX = (width - totalLegendWidth) / 2;
    const legendY = height - 32;

    // Series 1 Legend (MTTR - Purple)
    ctx.fillStyle = '#7C3AED';
    ctx.fillRect(legendX, legendY - 14, 18, 18);
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'left';
    ctx.fillText(series1Name, legendX + 26, legendY);

    // Series 2 Legend (Reparaciones - Emerald)
    const item2X = legendX + item1Width + gap;
    ctx.fillStyle = '#10B981';
    ctx.fillRect(item2X, legendY - 14, 18, 18);
    ctx.fillStyle = '#1E293B';
    ctx.fillText(series2Name, item2X + 26, legendY);

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('Error generating MTTR chart canvas image:', e);
    return new Uint8Array();
  }
}

/**
 * Generate array of dates between startStr and endStr (inclusive)
 */
function getDatesArray(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  if (!startStr || !endStr) return dates;
  const curr = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (curr <= end) {
    const yr = curr.getFullYear();
    const mo = String(curr.getMonth() + 1).padStart(2, '0');
    const da = String(curr.getDate()).padStart(2, '0');
    dates.push(`${yr}-${mo}-${da}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export interface ReportExportParams {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  repairRecords?: RepairRecord[];
  startDate: string;
  endDate: string;
  displayDate: string; // The user-selected or current date string for document name
  format: 'pdf' | 'word';
  settings?: ReportSettings;
  profile?: WordReportProfile;
  sectionsConfig?: WordReportSectionConfig[];
}

/**
 * Format string for file name: "<prefix> <fecha>.<ext>"
 */
export function buildReportFileName(displayDate: string, format: 'pdf' | 'word', prefix?: string): string {
  const sanitizedDate = displayDate.replace(/[/\\?%*:|"<>]/g, '-');
  const ext = format === 'word' ? 'docx' : 'pdf';
  const filePrefix = prefix?.trim() || 'Estadística de las IP CTA SE';
  return `${filePrefix} ${sanitizedDate}.${ext}`;
}

/**
 * Generate Word (.docx) Document
 */
export async function generateWordReport(params: ReportExportParams): Promise<void> {
  const {
    centrales,
    reports,
    repairRecords: providedRepairRecords,
    startDate,
    endDate,
    displayDate,
    settings = DEFAULT_REPORT_SETTINGS
  } = params;

  // Use provided repair records or load from localStorage
  const loadedRepairRecords = (providedRepairRecords && providedRepairRecords.length > 0)
    ? providedRepairRecords
    : loadRepairRecords();

  // Helper cell generator for docx tables
  const createCell = (
    text: string,
    isBold: boolean = false,
    isHeader: boolean = false,
    align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
    bgColor?: string
  ) => {
    return new TableCell({
      shading: bgColor ? { fill: bgColor } : undefined,
      children: [
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({
              text,
              bold: isBold || isHeader,
              color: isHeader ? 'FFFFFF' : '0F172A',
              size: isHeader ? 20 : 19
            })
          ]
        })
      ]
    });
  };

  // Helper to match a repair record to a central
  const isRepairForCentral = (repair: RepairRecord, central: Central): boolean => {
    if (repair.centralId && repair.centralId === central.id) return true;
    if (!repair.centralName) return false;
    const cName = central.name.trim().toLowerCase();
    const cCode = central.code.trim().toLowerCase();
    const rName = repair.centralName.trim().toLowerCase();
    return rName === cName || rName === cCode || rName.includes(cName) || cName.includes(rName);
  };

  // Helper to check if ISO YYYY-MM-DD date is within range [startDate, endDate]
  const isDateInRange = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  // Calculate statistics per central for both tables
  const tableData = centrales.map(central => {
    // Total reports in date range
    const centralReports = reports.filter(r => r.centralId === central.id && isDateInRange(r.date));
    const totalReports = centralReports.reduce((sum, r) => sum + (r.reportCount || 0), 0);

    // Repairs matching this central
    const centralRepairs = loadedRepairRecords.filter(r => isRepairForCentral(r, central));

    // Table 1: Reported in same period AND repaired in same period
    const repairsSamePeriod = centralRepairs.filter(r => {
      const repDate = r.reportDate || r.date;
      const fixDate = r.date;
      return isDateInRange(repDate) && isDateInRange(fixDate);
    }).length;

    const pendingSamePeriod = Math.max(0, totalReports - repairsSamePeriod);
    const effSamePeriodVal = totalReports > 0 ? (repairsSamePeriod / totalReports) * 100 : 0;
    const effSamePeriod = totalReports > 0 ? `${effSamePeriodVal.toFixed(1)}%` : '0.0%';

    // Table 2: Total repaired in the date range (regardless of when reported)
    const totalRepairedInPeriod = centralRepairs.filter(r => isDateInRange(r.date)).length;
    const balance = totalRepairedInPeriod - totalReports;
    const balanceStr = balance > 0 ? `+${balance}` : `${balance}`;
    const effTotalVal = totalReports > 0 ? (totalRepairedInPeriod / totalReports) * 100 : 100;
    const effTotal = totalReports > 0 ? `${effTotalVal.toFixed(1)}%` : '100.0%';

    return {
      central,
      totalReports,
      repairsSamePeriod,
      pendingSamePeriod,
      effSamePeriod,
      totalRepairedInPeriod,
      balance,
      balanceStr,
      effTotal
    };
  });

  // Calculate Aggregated Totals
  const grandTotalReports = tableData.reduce((acc, d) => acc + d.totalReports, 0);
  const grandTotalRepairsSamePeriod = tableData.reduce((acc, d) => acc + d.repairsSamePeriod, 0);
  const grandTotalPendingSamePeriod = tableData.reduce((acc, d) => acc + d.pendingSamePeriod, 0);
  const grandTotalEffSamePeriod = grandTotalReports > 0
    ? `${((grandTotalRepairsSamePeriod / grandTotalReports) * 100).toFixed(1)}%`
    : '0.0%';

  const grandTotalRepairedInPeriod = tableData.reduce((acc, d) => acc + d.totalRepairedInPeriod, 0);
  const grandTotalBalance = grandTotalRepairedInPeriod - grandTotalReports;
  const grandTotalBalanceStr = grandTotalBalance > 0 ? `+${grandTotalBalance}` : `${grandTotalBalance}`;
  const grandTotalEffTotal = grandTotalReports > 0
    ? `${((grandTotalRepairedInPeriod / grandTotalReports) * 100).toFixed(1)}%`
    : '100.0%';

  // Generate Bar Chart Images
  const categories = tableData.map(d => d.central.code || d.central.name);

  // Chart 1: Total Reportes vs Reparadas Mismo Mes
  const chart1Bytes = generateBarChartCanvasImage(
    'Comparativa: Total Reportes vs Reparadas en el Mismo Período',
    categories,
    'Total Reportes',
    tableData.map(d => d.totalReports),
    'Reparadas Mismo Mes',
    tableData.map(d => d.repairsSamePeriod),
    { series1: '#0284C7', series2: '#10B981' }
  );

  // Chart 2: Total Reportes vs Total Reparado
  const chart2Bytes = generateBarChartCanvasImage(
    'Comparativa: Total Reportes vs Total Reparado en el Período',
    categories,
    'Total Reportes',
    tableData.map(d => d.totalReports),
    'Total Reparado',
    tableData.map(d => d.totalRepairedInPeriod),
    { series1: '#0284C7', series2: '#059669' }
  );

  // --- SECCIÓN 3: EVOLUCIÓN DIARIA POR MES (GRÁFICOS SIN TABLA) ---
  const MONTH_NAMES_SPANISH = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const datesList = getDatesArray(startDate, endDate);

  interface DailyItem {
    dateStr: string;
    dayLabel: string;
    dailyReports: number;
    dailyRepairs: number;
  }

  const dailyByMonth: Record<string, DailyItem[]> = {};

  datesList.forEach(dateStr => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthKey = `${parts[0]}-${parts[1]}`;
      if (!dailyByMonth[monthKey]) {
        dailyByMonth[monthKey] = [];
      }

      const dailyReports = reports
        .filter(r => r.date === dateStr)
        .reduce((acc, r) => acc + (r.reportCount || 0), 0);

      const dailyRepairs = loadedRepairRecords
        .filter(r => r.date === dateStr)
        .length;

      dailyByMonth[monthKey].push({
        dateStr,
        dayLabel: `${parts[2]}/${parts[1]}`,
        dailyReports,
        dailyRepairs
      });
    }
  });

  const sortedMonthKeys = Object.keys(dailyByMonth).sort();

  // Generate a daily bar chart for each month in the range
  const monthlyCharts: { title: string; imageBytes: Uint8Array }[] = [];

  sortedMonthKeys.forEach(monthKey => {
    const [yearStr, monthNumStr] = monthKey.split('-');
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    const monthName = MONTH_NAMES_SPANISH[monthIndex] || monthNumStr;

    const items = dailyByMonth[monthKey];
    const categories = items.map(d => d.dayLabel);
    const series1 = items.map(d => d.dailyReports);
    const series2 = items.map(d => d.dailyRepairs);

    const chartTitle = sortedMonthKeys.length > 1
      ? `Evolución Diaria: Reportes vs Reparadas (${monthName} ${yearStr})`
      : `Evolución Diaria: Total Reportes vs Total Reparado por Día (${monthName} ${yearStr})`;

    const chartBytes = generateBarChartCanvasImage(
      chartTitle,
      categories,
      'Reportes del Día',
      series1,
      'Reparaciones del Día',
      series2,
      { series1: '#0284C7', series2: '#10B981' },
      { rotateLabels: true }
    );

    if (chartBytes.length > 0) {
      monthlyCharts.push({ title: chartTitle, imageBytes: chartBytes });
    }
  });

  // --- SECCIÓN 4 DATA: TIEMPO DE DEMORA (MTTR) Y REPARACIONES POR CENTRAL Y GRUPO ---
  const isRepairForGroup = (repair: RepairRecord, group: WorkGroup): boolean => {
    if (repair.workGroupId && repair.workGroupId === group.id) return true;
    if (!repair.grupo) return false;
    const gName = group.name.trim().toLowerCase();
    const gCode = group.code.trim().toLowerCase();
    const rGroup = repair.grupo.trim().toLowerCase();
    return rGroup === gName || rGroup === gCode || rGroup.includes(gName) || gName.includes(rGroup);
  };

  const mttrTableData = centrales.map(central => {
    const centralRepairs = loadedRepairRecords.filter(r => isRepairForCentral(r, central) && isDateInRange(r.date));

    const groupsStat: Record<string, { count: number; mttrSum: number; avgMttr: number }> = {};
    let centralTotalCount = 0;
    let centralMttrSum = 0;

    params.workGroups.forEach(wg => {
      const groupRepairs = centralRepairs.filter(r => isRepairForGroup(r, wg));
      const count = groupRepairs.length;
      const mttrSum = groupRepairs.reduce((acc, r) => acc + (r.mttrHours || 0), 0);
      const avgMttr = count > 0 ? mttrSum / count : 0;

      groupsStat[wg.id] = { count, mttrSum, avgMttr };
      centralTotalCount += count;
      centralMttrSum += mttrSum;
    });

    const centralAvgMttr = centralTotalCount > 0 ? centralMttrSum / centralTotalCount : 0;

    return {
      centralId: central.id,
      centralName: central.name,
      centralCode: central.code || central.name,
      groups: groupsStat,
      totalCount: centralTotalCount,
      mttrSum: centralMttrSum,
      avgMttr: centralAvgMttr
    };
  });

  // Calculate Group Totals (Bottom row)
  const groupTotals: Record<string, { count: number; mttrSum: number; avgMttr: number }> = {};
  let grandMttrTotalCount = 0;
  let grandMttrTotalSum = 0;

  params.workGroups.forEach(wg => {
    let wgCount = 0;
    let wgMttrSum = 0;

    mttrTableData.forEach(row => {
      const cell = row.groups[wg.id];
      if (cell) {
        wgCount += cell.count;
        wgMttrSum += cell.mttrSum;
      }
    });

    const wgAvg = wgCount > 0 ? wgMttrSum / wgCount : 0;
    groupTotals[wg.id] = { count: wgCount, mttrSum: wgMttrSum, avgMttr: wgAvg };

    grandMttrTotalCount += wgCount;
    grandMttrTotalSum += wgMttrSum;
  });

  const grandMttrAvg = grandMttrTotalCount > 0 ? grandMttrTotalSum / grandMttrTotalCount : 0;

  // Chart 4: MTTR and Repairs per Central
  const mttrCategories = mttrTableData.map(d => d.centralCode);
  const mttrValues = mttrTableData.map(d => parseFloat(d.avgMttr.toFixed(1)));
  const mttrRepairsCount = mttrTableData.map(d => d.totalCount);

  const chartMttrBytes = generateMttrChartCanvasImage(
    'Análisis de Tiempo Medio de Reparación (MTTR) y Volumen de Reparaciones por Central',
    mttrCategories,
    mttrValues,
    mttrRepairsCount
  );

  // Section configuration resolver helper
  const getSecConfig = (secKey: string) => {
    const configs = params.sectionsConfig || params.profile?.sections;
    if (!configs) return { enabled: true, includeTables: true, includeCharts: true, customNotes: '' };
    const found = configs.find(s => s.key === secKey);
    if (!found) return { enabled: true, includeTables: true, includeCharts: true, customNotes: '' };
    return found;
  };

  // Helper to calculate total installed capacity for a central
  const getCentralCapacity = (central: Central): number => {
    if (!central || !central.installedTech) return 0;
    if (typeof (central.installedTech as any).total === 'number') {
      return (central.installedTech as any).total;
    }
    const vals = Object.values(central.installedTech) as number[];
    return vals.reduce((a, b) => a + b, 0);
  };

  // --- SECCIÓN 1 DATA: REPORTES VS TÉCNICA INSTALADA POR CENTRAL ---
  const techInstalledTableData = centrales.map(central => {
    const installed = getCentralCapacity(central);
    const centralReports = reports.filter(r => r.centralId === central.id && isDateInRange(r.date));
    const totalReports = centralReports.reduce((sum, r) => sum + (r.reportCount || 0), 0);
    const impactPct = installed > 0 ? (totalReports / installed) * 100 : 0;
    const impactPctStr = installed > 0 ? `${impactPct.toFixed(2)}%` : '0.00%';

    return {
      central,
      installed,
      totalReports,
      impactPct,
      impactPctStr
    };
  });

  const grandTotalTechInstalled = techInstalledTableData.reduce((acc, d) => acc + d.installed, 0);
  const grandTotalTechReports = techInstalledTableData.reduce((acc, d) => acc + d.totalReports, 0);
  const grandTotalImpactPct = grandTotalTechInstalled > 0
    ? `${((grandTotalTechReports / grandTotalTechInstalled) * 100).toFixed(2)}%`
    : '0.00%';

  // Chart 1: Reportes vs Técnica Instalada por Central
  const techCategories = techInstalledTableData.map(d => d.central.code || d.central.name);
  const chartTechBytes = generateBarChartCanvasImage(
    'Análisis de Cantidad de Reportes y % respecto a la Técnica Instalada',
    techCategories,
    'Técnica Instalada (Líneas)',
    techInstalledTableData.map(d => d.installed),
    'Total Reportes (Averías)',
    techInstalledTableData.map(d => d.totalReports),
    { series1: '#0284C7', series2: '#F59E0B' }
  );

  // --- SECCIÓN 1: TABLA 1B - DESGLOSE DE AFECTADOS Y % RESPECTO A TÉCNICA INSTALADA POR GRUPO Y CENTRAL ---
  const techGroupBreakdownTableData = centrales.map(central => {
    const installed = getCentralCapacity(central);
    const centralReports = reports.filter(r => r.centralId === central.id && isDateInRange(r.date));

    const groupStats: Record<string, { count: number; impactPct: number; impactPctStr: string }> = {};
    let totalCentralAffected = 0;

    params.workGroups.forEach(wg => {
      const wgReports = centralReports.filter(r => r.workGroupId === wg.id);
      const count = wgReports.reduce((sum, r) => sum + (r.reportCount || 0), 0);
      totalCentralAffected += count;

      const impactPct = installed > 0 ? (count / installed) * 100 : 0;
      const impactPctStr = installed > 0 ? `${impactPct.toFixed(2)}%` : '0.00%';
      groupStats[wg.id] = { count, impactPct, impactPctStr };
    });

    const totalCentralImpactPct = installed > 0 ? (totalCentralAffected / installed) * 100 : 0;
    const totalCentralImpactPctStr = installed > 0 ? `${totalCentralImpactPct.toFixed(2)}%` : '0.00%';

    return {
      central,
      installed,
      groupStats,
      totalCentralAffected,
      totalCentralImpactPctStr
    };
  });

  // Calculate totals per group across all centrales
  const groupTechTotals: Record<string, { count: number; impactPctStr: string }> = {};
  let grandTotalGroupTechAffected = 0;

  params.workGroups.forEach(wg => {
    let wgTotalCount = 0;
    techGroupBreakdownTableData.forEach(row => {
      const cell = row.groupStats[wg.id];
      if (cell) {
        wgTotalCount += cell.count;
      }
    });
    grandTotalGroupTechAffected += wgTotalCount;

    const wgImpactPct = grandTotalTechInstalled > 0 ? (wgTotalCount / grandTotalTechInstalled) * 100 : 0;
    groupTechTotals[wg.id] = {
      count: wgTotalCount,
      impactPctStr: grandTotalTechInstalled > 0 ? `${wgImpactPct.toFixed(2)}%` : '0.00%'
    };
  });

  const grandTotalTechGroupImpactPctStr = grandTotalTechInstalled > 0
    ? `${((grandTotalGroupTechAffected / grandTotalTechInstalled) * 100).toFixed(2)}%`
    : '0.00%';

  // --- SECCIÓN 4 DATA: EVOLUCIÓN POR GRUPOS DE TRABAJO ---
  // isRepairForGroup is already defined above in helper functions scope

  const groupTableData = params.workGroups.map(wg => {
    const groupReports = reports.filter(r => r.workGroupId === wg.id && isDateInRange(r.date));
    const totalReports = groupReports.reduce((sum, r) => sum + (r.reportCount || 0), 0);

    const groupRepairs = loadedRepairRecords.filter(r => isRepairForGroup(r, wg) && isDateInRange(r.date));
    const totalRepairs = groupRepairs.length;

    const pending = Math.max(0, totalReports - totalRepairs);
    const effPct = totalReports > 0 ? (totalRepairs / totalReports) * 100 : (totalRepairs > 0 ? 100 : 0);

    return {
      workGroup: wg,
      totalReports,
      totalRepairs,
      pending,
      effPctStr: `${effPct.toFixed(1)}%`
    };
  });

  const chartGroupBytes = generateBarChartCanvasImage(
    'Evolución Operativa por Grupos de Trabajo: Reportes vs Reparadas',
    params.workGroups.map(wg => wg.code || wg.name),
    'Reportes Asignados',
    groupTableData.map(d => d.totalReports),
    'Reparaciones Ejecutadas',
    groupTableData.map(d => d.totalRepairs),
    { series1: '#3B82F6', series2: '#10B981' }
  );

  // --- SECCIÓN 6 DATA: CLAVES DE FALLA POR CENTRAL Y GRUPO ---
  const extractClave = (r: RepairRecord): string => {
    if (r.claveCode && r.claveCode.trim()) return r.claveCode.trim().toUpperCase();
    if (r.rawRowData) {
      for (const k of Object.keys(r.rawRowData)) {
        if (k.toLowerCase().includes('clave')) {
          const val = String(r.rawRowData[k] || '').trim();
          if (val) return val.toUpperCase();
        }
      }
    }
    return 'SIN_CLAVE';
  };

  const repairsInRange = loadedRepairRecords.filter(r => isDateInRange(r.date));

  // Claves x Central Matrix
  const claveCentralCounts: Record<string, Record<string, number>> = {};
  const claveTotalCounts: Record<string, number> = {};

  repairsInRange.forEach(r => {
    const clave = extractClave(r);
    if (!claveCentralCounts[clave]) {
      claveCentralCounts[clave] = {};
      claveTotalCounts[clave] = 0;
    }
    claveTotalCounts[clave] = (claveTotalCounts[clave] || 0) + 1;

    // Find central
    const matchedC = centrales.find(c => isRepairForCentral(r, c));
    const cId = matchedC ? matchedC.id : 'OTRA';
    claveCentralCounts[clave][cId] = (claveCentralCounts[clave][cId] || 0) + 1;
  });

  const sortedClaves = Object.keys(claveTotalCounts).sort((a, b) => claveTotalCounts[b] - claveTotalCounts[a]);
  const totalClaveRepairs = repairsInRange.length || 1;

  const topClaves = sortedClaves.slice(0, 10);
  const chartClavesBytes = generateBarChartCanvasImage(
    'Top Claves de Falla con Mayor Recurrencia en el Período',
    topClaves,
    'Cantidad de Incidencias',
    topClaves.map(k => claveTotalCounts[k]),
    '% del Total de Reparaciones',
    topClaves.map(k => parseFloat(((claveTotalCounts[k] / totalClaveRepairs) * 100).toFixed(1))),
    { series1: '#8B5CF6', series2: '#EC4899' }
  );

  // --- SECCIÓN 7 DATA: ANÁLISIS DE REPLICADOS / REPETIDOS ---
  const serviceMap: Record<string, RepairRecord[]> = {};
  repairsInRange.forEach(r => {
    const s = (r.serviceNumber || '').trim().toUpperCase();
    if (s && s !== 'S/N' && s !== 'N/A' && s !== '0') {
      if (!serviceMap[s]) serviceMap[s] = [];
      serviceMap[s].push(r);
    }
  });

  const repeatedServices = Object.entries(serviceMap).filter(([_, recs]) => recs.length > 1);

  // Separate into numeric vs alphanumeric
  const numericRepeated: { service: string; records: RepairRecord[]; count: number }[] = [];
  const alphanumericRepeated: { service: string; records: RepairRecord[]; count: number }[] = [];

  repeatedServices.forEach(([service, records]) => {
    const isPureDigits = /^\d+$/.test(service);
    const item = { service, records, count: records.length };
    if (isPureDigits) {
      numericRepeated.push(item);
    } else {
      alphanumericRepeated.push(item);
    }
  });

  numericRepeated.sort((a, b) => b.count - a.count);
  alphanumericRepeated.sort((a, b) => b.count - a.count);

  // Document Content Elements
  const childrenElements: any[] = [
    // --- PORTADA / HEADER ---
    new Paragraph({
      text: params.profile?.documentTitle || settings.documentTitle || 'INFORME TÉCNICO DE REPORTES Y REPARACIONES',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({ text: `${settings.documentSubtitle || 'Estadística de las IP CTA SE'}\n`, italics: true, size: 22, color: '475569' }),
        new TextRun({ text: `${params.profile?.departmentName || settings.departmentName || 'Departamento de Telecomunicaciones'}\n`, size: 20, color: '64748B' }),
        new TextRun({ text: `Fecha del Informe: `, bold: true, size: 20, color: '1E293B' }),
        new TextRun({ text: `${displayDate}    |    `, size: 20, color: '1E293B' }),
        new TextRun({ text: `Período Evaluado: `, bold: true, size: 20, color: '1E293B' }),
        new TextRun({ text: `${startDate} al ${endDate}\n`, size: 20, color: '475569' })
      ]
    })
  ];

  // Render sections dynamically in the exact order configured in the profile
  const activeSections = params.sectionsConfig || params.profile?.sections || DEFAULT_WORD_SECTIONS;
  const enabledSections = activeSections.filter(s => s.enabled);

  enabledSections.forEach((sec, idx) => {
    // Heading
    childrenElements.push(
      new Paragraph({
        text: sec.title || `Sección ${idx + 1}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 120 }
      })
    );

    // Custom notes
    if (sec.customNotes) {
      childrenElements.push(
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: sec.customNotes,
              size: 20,
              color: '334155'
            })
          ]
        })
      );
    }

    // Render Table and/or Chart based on section key
    if (sec.key === 'sec1_tech') {
      if (sec.includeTables) {
        childrenElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Central Telefónica', true, true, AlignmentType.LEFT, '0F172A'),
                  createCell('Técnica Instalada (Líneas)', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('Total Reportes (Averías)', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('% Impacto / Incidencia', true, true, AlignmentType.CENTER, '0284C7')
                ]
              }),
              ...techInstalledTableData.map(row => (
                new TableRow({
                  children: [
                    createCell(`${row.central.name} (${row.central.code})`, true, false, AlignmentType.LEFT),
                    createCell(row.installed.toLocaleString(), false, false, AlignmentType.CENTER),
                    createCell(row.totalReports.toString(), false, false, AlignmentType.CENTER),
                    createCell(row.impactPctStr, true, false, AlignmentType.CENTER, row.impactPct > 3 ? 'FEF2F2' : 'F0FDF4')
                  ]
                })
              )),
              new TableRow({
                children: [
                  createCell('TOTAL GENERAL', true, false, AlignmentType.LEFT, 'E2E8F0'),
                  createCell(grandTotalTechInstalled.toLocaleString(), true, false, AlignmentType.CENTER, 'E2E8F0'),
                  createCell(grandTotalTechReports.toString(), true, false, AlignmentType.CENTER, 'E2E8F0'),
                  createCell(grandTotalImpactPct, true, false, AlignmentType.CENTER, 'CBD5E1')
                ]
              })
            ]
          })
        );
      }

      if (sec.includeCharts && chartTechBytes.length > 0) {
        childrenElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 300 },
            children: [
              new ImageRun({
                data: chartTechBytes,
                transformation: { width: 550, height: 265 },
                type: 'png'
              })
            ]
          })
        );
      }

      if (sec.includeTables) {
        childrenElements.push(
          new Paragraph({
            text: 'Afectados por Grupo de Trabajo y % respecto a la Técnica Instalada por Central',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Central Telefónica', true, true, AlignmentType.LEFT, '0F172A'),
                  ...params.workGroups.flatMap(wg => [
                    createCell(`${wg.code || wg.name}`, true, true, AlignmentType.CENTER, '0F172A'),
                    createCell('% Téc.', true, true, AlignmentType.CENTER, '0284C7')
                  ]),
                  createCell('TOTAL AFECTADOS', true, true, AlignmentType.CENTER, '1E293B'),
                  createCell('% TÉC. TOTAL', true, true, AlignmentType.CENTER, '0369A1')
                ]
              }),
              ...techGroupBreakdownTableData.map(row => (
                new TableRow({
                  children: [
                    createCell(`${row.central.name} (${row.central.code})`, true, false, AlignmentType.LEFT),
                    ...params.workGroups.flatMap(wg => {
                      const st = row.groupStats[wg.id];
                      return [
                        createCell(st ? st.count.toString() : '0', false, false, AlignmentType.CENTER),
                        createCell(st ? st.impactPctStr : '0.00%', true, false, AlignmentType.CENTER, 'F8FAFC')
                      ];
                    }),
                    createCell(row.totalCentralAffected.toString(), true, false, AlignmentType.CENTER, 'F1F5F9'),
                    createCell(row.totalCentralImpactPctStr, true, false, AlignmentType.CENTER, 'E0F2FE')
                  ]
                })
              )),
              new TableRow({
                children: [
                  createCell('TOTAL GENERAL', true, false, AlignmentType.LEFT, 'E2E8F0'),
                  ...params.workGroups.flatMap(wg => {
                    const tot = groupTechTotals[wg.id];
                    return [
                      createCell(tot ? tot.count.toString() : '0', true, false, AlignmentType.CENTER, 'E2E8F0'),
                      createCell(tot ? tot.impactPctStr : '0.00%', true, false, AlignmentType.CENTER, 'CBD5E1')
                    ];
                  }),
                  createCell(grandTotalGroupTechAffected.toString(), true, false, AlignmentType.CENTER, 'CBD5E1'),
                  createCell(grandTotalTechGroupImpactPctStr, true, false, AlignmentType.CENTER, 'BAE6FD')
                ]
              })
            ]
          })
        );
      }
    } else if (sec.key === 'sec2_same_period') {
      if (sec.includeTables) {
        childrenElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Central Telefónica', true, true, AlignmentType.LEFT, '0F172A'),
                  createCell('Total Reportes', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('Reparadas Mismo Mes', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('Pendientes Período', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('% Cumplimiento', true, true, AlignmentType.CENTER, '0284C7')
                ]
              }),
              ...tableData.map(row => (
                new TableRow({
                  children: [
                    createCell(`${row.central.name} (${row.central.code})`, true, false, AlignmentType.LEFT),
                    createCell(row.totalReports.toString(), false, false, AlignmentType.CENTER),
                    createCell(row.repairsSamePeriod.toString(), false, false, AlignmentType.CENTER),
                    createCell(row.pendingSamePeriod.toString(), false, false, AlignmentType.CENTER, row.pendingSamePeriod > 0 ? 'FEF2F2' : 'F0FDF4'),
                    createCell(row.effSamePeriod, true, false, AlignmentType.CENTER, 'F8FAFC')
                  ]
                })
              )),
              new TableRow({
                children: [
                  createCell('TOTAL GENERAL', true, false, AlignmentType.LEFT, 'E2E8F0'),
                  createCell(grandTotalReports.toString(), true, false, AlignmentType.CENTER, 'E2E8F0'),
                  createCell(grandTotalRepairsSamePeriod.toString(), true, false, AlignmentType.CENTER, 'E2E8F0'),
                  createCell(grandTotalPendingSamePeriod.toString(), true, false, AlignmentType.CENTER, 'E2E8F0'),
                  createCell(grandTotalEffSamePeriod, true, false, AlignmentType.CENTER, 'CBD5E1')
                ]
              })
            ]
          })
        );
      }

      if (sec.includeCharts && chart1Bytes.length > 0) {
        childrenElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 300 },
            children: [
              new ImageRun({
                data: chart1Bytes,
                transformation: { width: 550, height: 265 },
                type: 'png'
              })
            ]
          })
        );
      }
    } else if (sec.key === 'sec3_daily_month') {
      if (sec.includeCharts) {
        monthlyCharts.forEach(chart => {
          childrenElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 180, after: 300 },
              children: [
                new ImageRun({
                  data: chart.imageBytes,
                  transformation: { width: 550, height: 265 },
                  type: 'png'
                })
              ]
            })
          );
        });
      }
    } else if (sec.key === 'sec4_daily_groups') {
      if (sec.includeTables) {
        childrenElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Grupo de Trabajo / Brigada', true, true, AlignmentType.LEFT, '0F172A'),
                  createCell('Reportes Asignados', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('Reparaciones Resueltas', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('Pendientes', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('% Atendido', true, true, AlignmentType.CENTER, '0284C7')
                ]
              }),
              ...groupTableData.map(row => (
                new TableRow({
                  children: [
                    createCell(`${row.workGroup.name} (${row.workGroup.code})`, true, false, AlignmentType.LEFT),
                    createCell(row.totalReports.toString(), false, false, AlignmentType.CENTER),
                    createCell(row.totalRepairs.toString(), false, false, AlignmentType.CENTER),
                    createCell(row.pending.toString(), false, false, AlignmentType.CENTER, row.pending > 0 ? 'FEF2F2' : 'F0FDF4'),
                    createCell(row.effPctStr, true, false, AlignmentType.CENTER, 'F8FAFC')
                  ]
                })
              ))
            ]
          })
        );
      }

      if (sec.includeCharts && chartGroupBytes.length > 0) {
        childrenElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 300 },
            children: [
              new ImageRun({
                data: chartGroupBytes,
                transformation: { width: 550, height: 265 },
                type: 'png'
              })
            ]
          })
        );
      }
    } else if (sec.key === 'sec5_mttr') {
      if (sec.includeTables) {
        childrenElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Central / Unidad', true, true, AlignmentType.LEFT, '0F172A'),
                  ...params.workGroups.map(wg => createCell(wg.code || wg.name, true, true, AlignmentType.CENTER, '0F172A')),
                  createCell('PROMEDIO / TOTAL', true, true, AlignmentType.CENTER, '6D28D9')
                ]
              }),
              ...mttrTableData.map(row => (
                new TableRow({
                  children: [
                    createCell(row.centralName, true, false, AlignmentType.LEFT),
                    ...params.workGroups.map(wg => {
                      const cell = row.groups[wg.id];
                      const text = cell && cell.count > 0 ? `${cell.avgMttr.toFixed(1)}h (${cell.count})` : '-';
                      return createCell(text, false, false, AlignmentType.CENTER);
                    }),
                    createCell(
                      row.totalCount > 0 ? `${row.avgMttr.toFixed(1)}h (${row.totalCount})` : '-',
                      true,
                      false,
                      AlignmentType.CENTER,
                      'F3E8FF'
                    )
                  ]
                })
              )),
              new TableRow({
                children: [
                  createCell('PROMEDIO GENERAL / TOTAL', true, false, AlignmentType.LEFT, 'E2E8F0'),
                  ...params.workGroups.map(wg => {
                    const gStat = groupTotals[wg.id];
                    const text = gStat && gStat.count > 0 ? `${gStat.avgMttr.toFixed(1)}h (${gStat.count})` : '-';
                    return createCell(text, true, false, AlignmentType.CENTER, 'E2E8F0');
                  }),
                  createCell(
                    grandMttrTotalCount > 0 ? `${grandMttrAvg.toFixed(1)}h (${grandMttrTotalCount})` : '-',
                    true,
                    false,
                    AlignmentType.CENTER,
                    'DDD6FE'
                  )
                ]
              })
            ]
          })
        );
      }

      if (sec.includeCharts && chartMttrBytes.length > 0) {
        childrenElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new ImageRun({
                data: chartMttrBytes,
                transformation: { width: 550, height: 265 },
                type: 'png'
              })
            ]
          })
        );
      }
    } else if (sec.key === 'sec6_claves') {
      if (sec.includeTables) {
        childrenElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Clave de Falla', true, true, AlignmentType.LEFT, '0F172A'),
                  createCell('Ocurrencias / Frecuencia', true, true, AlignmentType.CENTER, '0F172A'),
                  createCell('% del Total', true, true, AlignmentType.CENTER, '0284C7')
                ]
              }),
              ...sortedClaves.slice(0, 15).map(clave => {
                const count = claveTotalCounts[clave];
                const pct = ((count / totalClaveRepairs) * 100).toFixed(1);
                return new TableRow({
                  children: [
                    createCell(clave, true, false, AlignmentType.LEFT),
                    createCell(count.toString(), false, false, AlignmentType.CENTER),
                    createCell(`${pct}%`, true, false, AlignmentType.CENTER, 'F8FAFC')
                  ]
                });
              })
            ]
          })
        );
      }

      if (sec.includeCharts && chartClavesBytes.length > 0) {
        childrenElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 300 },
            children: [
              new ImageRun({
                data: chartClavesBytes,
                transformation: { width: 550, height: 265 },
                type: 'png'
              })
            ]
          })
        );
      }
    } else if (sec.key === 'sec7_repetidos') {
      if (sec.includeTables) {
        // 7A: Numéricos
        childrenElements.push(
          new Paragraph({
            text: 'Servicios Numéricos Repetidos',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 120 }
          })
        );

        if (numericRepeated.length === 0) {
          childrenElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'No se detectaron reincidencias de servicios numéricos en el período evaluado.',
                  italics: true
                })
              ],
              spacing: { after: 180 }
            })
          );
        } else {
          const rows7A: TableRow[] = [
            new TableRow({
              children: [
                createCell('Servicio / Abonado', true, true, AlignmentType.LEFT, '0F172A'),
                createCell('Folios / Tickets', true, true, AlignmentType.LEFT, '0F172A'),
                createCell('Fecha Reporte', true, true, AlignmentType.CENTER, '0F172A'),
                createCell('Fecha Cierre', true, true, AlignmentType.CENTER, '0F172A'),
                createCell('Técnico / Grupo', true, true, AlignmentType.LEFT, '0F172A'),
                createCell('Clave', true, true, AlignmentType.CENTER, '0284C7')
              ]
            })
          ];

          numericRepeated.slice(0, 20).forEach(item => {
            item.records.forEach((r, idx) => {
              rows7A.push(
                new TableRow({
                  children: [
                    createCell(idx === 0 ? `${item.service} (${item.count}x)` : '', true, false, AlignmentType.LEFT, idx === 0 ? 'FEF2F2' : undefined),
                    createCell(r.ticketCode || 'FOLIO_N/A', false, false, AlignmentType.LEFT),
                    createCell(r.reportDate || r.date || '-', false, false, AlignmentType.CENTER),
                    createCell(r.date || '-', false, false, AlignmentType.CENTER),
                    createCell(`${r.technician || 'N/A'} / ${r.grupo || 'N/A'}`, false, false, AlignmentType.LEFT),
                    createCell(extractClave(r), true, false, AlignmentType.CENTER, 'F8FAFC')
                  ]
                })
              );
            });
          });

          childrenElements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows7A
            })
          );
        }

        // 7B: Alfanuméricos
        childrenElements.push(
          new Paragraph({
            text: 'Servicios Alfanuméricos / Especiales Repetidos',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          })
        );

        if (alphanumericRepeated.length === 0) {
          childrenElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'No se detectaron reincidencias de servicios alfanuméricos en el período evaluado.',
                  italics: true
                })
              ],
              spacing: { after: 180 }
            })
          );
        } else {
          const rows7B: TableRow[] = [
            new TableRow({
              children: [
                createCell('Servicio Especial', true, true, AlignmentType.LEFT, '0F172A'),
                createCell('Folios / Tickets', true, true, AlignmentType.LEFT, '0F172A'),
                createCell('Fecha Reporte', true, true, AlignmentType.CENTER, '0F172A'),
                createCell('Fecha Cierre', true, true, AlignmentType.CENTER, '0F172A'),
                createCell('Técnico / Grupo', true, true, AlignmentType.LEFT, '0F172A'),
                createCell('Clave', true, true, AlignmentType.CENTER, '0284C7')
              ]
            })
          ];

          alphanumericRepeated.slice(0, 20).forEach(item => {
            item.records.forEach((r, idx) => {
              rows7B.push(
                new TableRow({
                  children: [
                    createCell(idx === 0 ? `${item.service} (${item.count}x)` : '', true, false, AlignmentType.LEFT, idx === 0 ? 'EFF6FF' : undefined),
                    createCell(r.ticketCode || 'FOLIO_N/A', false, false, AlignmentType.LEFT),
                    createCell(r.reportDate || r.date || '-', false, false, AlignmentType.CENTER),
                    createCell(r.date || '-', false, false, AlignmentType.CENTER),
                    createCell(`${r.technician || 'N/A'} / ${r.grupo || 'N/A'}`, false, false, AlignmentType.LEFT),
                    createCell(extractClave(r), true, false, AlignmentType.CENTER, 'F8FAFC')
                  ]
                })
              );
            });
          });

          childrenElements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows7B
            })
          );
        }
      }
    }
  });

  // Build Word Document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: childrenElements
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const fileName = buildReportFileName(displayDate, 'word', settings.fileNamePrefix);
  saveAs(blob, fileName);
}

/**
 * Generate PDF Document via html2canvas / jsPDF
 */
export async function generatePDFReport(
  elementId: string,
  displayDate: string,
  fileNamePrefix?: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found for PDF export.`);
    alert('No se encontró el contenedor del informe para exportar.');
    return;
  }

  try {
    const canvas = await html2canvas(element, getSafeHtml2CanvasOptions({
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    }));

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Top Header Banner
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pdfWidth, 18, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.text((fileNamePrefix || 'ESTADÍSTICA DE LAS IP CTA SE') + ' — INFORME TÉCNICO OFICIAL', 10, 11);
    pdf.setFontSize(8);
    pdf.text(`Fecha del Informe: ${displayDate}`, pdfWidth - 65, 11);

    const imgWidth = pdfWidth - 16;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 22;

    pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 26);

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      // Banner on sub-pages
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pdfWidth, 10, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text((fileNamePrefix || 'ESTADÍSTICA DE LAS IP CTA SE') + ' — Continuación del informe', 10, 7);

      pdf.addImage(imgData, 'PNG', 8, position + 5, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 15);
    }

    const fileName = buildReportFileName(displayDate, 'pdf', fileNamePrefix);
    pdf.save(fileName);
  } catch (err) {
    console.error('Error generating PDF report:', err);
    alert('Ocurrió un problema al generar el documento PDF.');
  }
}
