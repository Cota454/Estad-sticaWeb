import html2canvas from 'html2canvas';

/**
 * Copies table data to clipboard in both TSV (plain text) and HTML table formats,
 * enabling direct pasting into Microsoft Word, Excel, Google Sheets, or PowerPoint.
 */
export async function copyTableToClipboard(
  headers: string[],
  rows: (string | number)[][],
  title?: string
): Promise<boolean> {
  const tsvLines = [
    title ? `[ ${title} ]` : null,
    headers.join('\t'),
    ...rows.map(row => row.map(cell => String(cell !== undefined && cell !== null ? cell : '').replace(/\t/g, ' ')).join('\t'))
  ].filter(Boolean).join('\n');

  const htmlContent = `
    ${title ? `<h3 style="font-family: sans-serif; color: #0f172a; margin-bottom: 8px;">${title}</h3>` : ''}
    <table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; width: 100%;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
          ${headers.map(h => `<th style="padding: 8px 12px; text-align: left; border: 1px solid #334155;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => `
          <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            ${row.map(cell => `<td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: ${typeof cell === 'number' ? 'center' : 'left'};">${cell}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const textBlob = new Blob([tsvLines], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob
        })
      ]);
      return true;
    } else {
      await navigator.clipboard.writeText(tsvLines);
      return true;
    }
  } catch (err) {
    console.warn('HTML Clipboard fallback to plain text:', err);
    try {
      await navigator.clipboard.writeText(tsvLines);
      return true;
    } catch (e2) {
      console.error('Clipboard copy failed:', e2);
      return false;
    }
  }
}

/**
 * Captures an HTML element (e.g. chart container) as an image (PNG) and copies it to clipboard.
 * Fallback to plain text image data notice if image write is disallowed.
 */
export async function copyElementAsImageToClipboard(
  elementIdOrRef: string | HTMLElement,
  fallbackTextSummary?: string
): Promise<boolean> {
  try {
    const el = typeof elementIdOrRef === 'string' ? document.getElementById(elementIdOrRef) : elementIdOrRef;
    if (!el) {
      if (fallbackTextSummary) {
        await navigator.clipboard.writeText(fallbackTextSummary);
        return true;
      }
      return false;
    }

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          if (fallbackTextSummary) await navigator.clipboard.writeText(fallbackTextSummary);
          resolve(true);
          return;
        }

        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({
                [blob.type]: blob
              })
            ]);
            resolve(true);
          } else if (fallbackTextSummary) {
            await navigator.clipboard.writeText(fallbackTextSummary);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (clipErr) {
          console.warn('Image clipboard failed, falling back to text summary', clipErr);
          if (fallbackTextSummary) {
            await navigator.clipboard.writeText(fallbackTextSummary);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      }, 'image/png');
    });
  } catch (err) {
    console.error('Failed to copy element as image:', err);
    if (fallbackTextSummary) {
      try {
        await navigator.clipboard.writeText(fallbackTextSummary);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}
