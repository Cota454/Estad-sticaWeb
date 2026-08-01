import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Central, WorkGroup, DailyReport, ReportSettings } from '../types';
import { calculateTechInstalledMatrix, calculateDayOfWeekStats, filterReportsByDateRange } from './statCalculations';
import { DEFAULT_REPORT_SETTINGS } from './settingsUtils';

interface ReportExportParams {
  centrales: Central[];
  workGroups: WorkGroup[];
  reports: DailyReport[];
  startDate: string;
  endDate: string;
  displayDate: string; // The user-selected or current date string for document name
  format: 'pdf' | 'word';
  settings?: ReportSettings;
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
    workGroups,
    reports,
    startDate,
    endDate,
    displayDate,
    settings = DEFAULT_REPORT_SETTINGS
  } = params;

  // Filtered reports (excluding Sundays)
  const filtered = filterReportsByDateRange(reports, startDate, endDate, true);

  // Totals
  const totalReports = filtered.reduce((acc, r) => acc + (r.reportCount || 0), 0);
  const matrix = calculateTechInstalledMatrix(filtered, startDate, endDate, centrales, workGroups);
  const totalInstalledTech = matrix.reduce((acc, m) => acc + m.totalCapacity, 0);
  const globalPct = totalInstalledTech > 0 ? ((totalReports / totalInstalledTech) * 100).toFixed(2) : '0';
  const dayOfWeekStats = calculateDayOfWeekStats(reports, startDate, endDate);

  // Matrix by Central & Group (report counts)
  const countsByCentralGroup: Record<string, Record<string, number>> = {};
  filtered.forEach(r => {
    if (!countsByCentralGroup[r.centralId]) countsByCentralGroup[r.centralId] = {};
    countsByCentralGroup[r.centralId][r.workGroupId] = (countsByCentralGroup[r.centralId][r.workGroupId] || 0) + r.reportCount;
  });

  // Helper cell generator
  const createCell = (text: string, isBold: boolean = false, isHeader: boolean = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, bgColor?: string) => {
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

  const childrenElements: any[] = [
    // Document Header Title
    new Paragraph({
      text: settings.documentTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: `${settings.documentSubtitle}\n`, italics: true, size: 22, color: '475569' }),
        new TextRun({ text: `${settings.departmentName}\n`, size: 19, color: '64748B' }),
        new TextRun({ text: `Fecha del Informe: ${displayDate}`, bold: true, size: 20, color: '1E293B' }),
        new TextRun({ text: ` | Periodo: ${startDate} al ${endDate}`, size: 20, color: '64748B' })
      ]
    })
  ];

  // SECTION 1: Resumen General
  if (settings.includeExecutiveSummary) {
    childrenElements.push(
      new Paragraph({
        text: '1. Resumen Ejecutivo de la Red Telecom',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({ text: `${settings.customExecutiveSummary}\n\n`, size: 21 }),
          new TextRun({ text: `Periodo Evaluado: ${startDate} al ${endDate}. `, size: 20 }),
          new TextRun({ text: `Total Reportes: `, size: 20 }),
          new TextRun({ text: `${totalReports} averías`, bold: true, color: '0284C7', size: 20 }),
          new TextRun({ text: ` | Técnica Instalada: `, size: 20 }),
          new TextRun({ text: `${totalInstalledTech.toLocaleString()} unidades`, bold: true, size: 20 }),
          new TextRun({ text: ` | % Interrupción Global: `, size: 20 }),
          new TextRun({ text: `${globalPct}%`, bold: true, color: 'D97706', size: 20 }),
          new TextRun({ text: '\nNota: Los días domingos se excluyen de la contabilidad diaria por ser días no laborables.', italics: true, size: 19, color: '64748B' })
        ]
      })
    );
  }

  // SECTION 2: Matriz por Central y Grupo
  if (settings.includeMatrixTable) {
    childrenElements.push(
      new Paragraph({
        text: '2. Matriz de Reportes por Central Telefónica y Grupo de Trabajo',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createCell('Central', true, true, AlignmentType.LEFT, '0F172A'),
              ...workGroups.map(g => createCell(g.code, true, true, AlignmentType.CENTER, '0F172A')),
              createCell('TOTAL', true, true, AlignmentType.CENTER, '1E293B')
            ]
          }),
          ...centrales.map(c => {
            let centralTot = 0;
            const cells = workGroups.map(g => {
              const cnt = countsByCentralGroup[c.id]?.[g.id] || 0;
              centralTot += cnt;
              return createCell(cnt.toString(), false, false, AlignmentType.CENTER);
            });

            return new TableRow({
              children: [
                createCell(`${c.name} (${c.code})`, true, false, AlignmentType.LEFT),
                ...cells,
                createCell(centralTot.toString(), true, false, AlignmentType.CENTER, 'F1F5F9')
              ]
            });
          })
        ]
      })
    );

    if (settings.matrixExplanation) {
      childrenElements.push(
        new Paragraph({
          text: 'Análisis Detallado de la Matriz de Averías:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 60 }
        }),
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({ text: settings.matrixExplanation, size: 21, color: '334155' })
          ]
        })
      );
    }
  }

  // SECTION 3: Técnica Instalada & % Interrupción
  if (settings.includeTechInstalledTable) {
    childrenElements.push(
      new Paragraph({
        text: '3. Análisis de Técnica Instalada y Porcentaje de Interrupción',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createCell('Central Telefónica', true, true, AlignmentType.LEFT, '0F172A'),
              createCell('Técnica Instalada', true, true, AlignmentType.CENTER, '1E293B'),
              createCell('Total Reportes', true, true, AlignmentType.CENTER, '1E293B'),
              createCell('% Interrupción', true, true, AlignmentType.CENTER, '0284C7')
            ]
          }),
          ...matrix.map(m => (
            new TableRow({
              children: [
                createCell(m.centralName, true, false, AlignmentType.LEFT),
                createCell(m.totalCapacity.toLocaleString(), false, false, AlignmentType.CENTER),
                createCell(m.totalReports.toString(), false, false, AlignmentType.CENTER),
                createCell(`${m.totalPercentage}%`, true, false, AlignmentType.CENTER, m.totalPercentage > 3 ? 'FEF2F2' : 'F0F9FF')
              ]
            })
          ))
        ]
      })
    );

    if (settings.techInstalledExplanation) {
      childrenElements.push(
        new Paragraph({
          text: 'Explicación e Interpretación de la Técnica Instalada:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 60 }
        }),
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({ text: settings.techInstalledExplanation, size: 21, color: '334155' })
          ]
        })
      );
    }
  }

  // SECTION 4: Comportamiento por Día de la Semana
  if (settings.includeDayOfWeekStats) {
    childrenElements.push(
      new Paragraph({
        text: '4. Comportamiento Histórico por Día de la Semana (Lunes a Sábado)',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createCell('Día de la Semana', true, true, AlignmentType.LEFT, '0F172A'),
              createCell('Total Averías', true, true, AlignmentType.CENTER, '1E293B'),
              createCell('Días Evaluados', true, true, AlignmentType.CENTER, '1E293B'),
              createCell('Promedio / Día', true, true, AlignmentType.CENTER, '0F172A')
            ]
          }),
          ...dayOfWeekStats.map(d => (
            new TableRow({
              children: [
                createCell(d.dayName, true, false, AlignmentType.LEFT),
                createCell(d.totalReports.toString(), false, false, AlignmentType.CENTER),
                createCell(d.dayCount.toString(), false, false, AlignmentType.CENTER),
                createCell(d.averageReports.toString(), true, false, AlignmentType.CENTER)
              ]
            })
          ))
        ]
      })
    );

    if (settings.dayOfWeekExplanation) {
      childrenElements.push(
        new Paragraph({
          text: 'Análisis de Tendencia y Patrón Diario:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 60 }
        }),
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({ text: settings.dayOfWeekExplanation, size: 21, color: '334155' })
          ]
        })
      );
    }
  }

  // SECTION 5: Historical Evolution Explanation
  if (settings.includeHistoricalEvolution && settings.historicalExplanation) {
    childrenElements.push(
      new Paragraph({
        text: '5. Tendencia y Evolución Histórica de la Red',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 }
      }),
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({ text: settings.historicalExplanation, size: 21, color: '334155' })
        ]
      })
    );
  }

  // SECTION 6: Conclusiones y Recomendaciones
  if (settings.includeConclusions && settings.customConclusions) {
    childrenElements.push(
      new Paragraph({
        text: '6. Conclusiones y Recomendaciones Operativas',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 }
      })
    );

    const lines = settings.customConclusions.split('\n').filter(Boolean);
    lines.forEach(line => {
      childrenElements.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: `• ${line}`, size: 21, color: '1E293B' })
          ]
        })
      );
    });
  }

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
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

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
