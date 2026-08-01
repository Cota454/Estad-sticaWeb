import html2canvas, { Options } from 'html2canvas';

/**
 * Converts an oklch color string into a standard rgb(...) or rgba(...) string.
 */
function oklchToRgb(lStr: string, cStr: string, hStr: string, aStr?: string): string {
  try {
    let l = parseFloat(lStr);
    if (lStr.includes('%')) l = l / 100;
    let c = parseFloat(cStr);
    let h = parseFloat(hStr);
    if (isNaN(h)) h = 0;
    let alpha = aStr !== undefined ? parseFloat(aStr) : 1;
    if (aStr && aStr.includes('%')) alpha = parseFloat(aStr) / 100;

    // Convert OKLCH to OKLAB
    const hRad = (h * Math.PI) / 180;
    const a = c * Math.cos(hRad);
    const b = c * Math.sin(hRad);

    // OKLAB to LMS
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    // LMS to Linear RGB
    let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let blue = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    // Linear RGB to sRGB gamma correction
    const gammaCorrect = (val: number) => {
      val = Math.max(0, Math.min(1, val));
      return val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    r = Math.round(gammaCorrect(r) * 255);
    g = Math.round(gammaCorrect(g) * 255);
    blue = Math.round(gammaCorrect(blue) * 255);

    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${blue}, ${alpha.toFixed(2)})`;
    }
    return `rgb(${r}, ${g}, ${blue})`;
  } catch {
    return 'rgb(100, 116, 139)';
  }
}

/**
 * Replaces all occurrences of oklch(...) in a CSS string with rgb/rgba equivalents.
 */
export function replaceOklchInString(str: string): string {
  if (!str || !str.includes('oklch')) return str;

  // Pattern matches oklch(L C H) or oklch(L C H / A)
  const oklchRegex = /oklch\(\s*([0-9.%]+)\s+([0-9.%]+)\s+([0-9.%]+)(?:\s*\/\s*([0-9.%]+))?\s*\)/gi;

  let result = str.replace(oklchRegex, (_match, l, c, h, a) => {
    return oklchToRgb(l, c, h, a);
  });

  // Fallback for any missed oklch/oklab patterns that html2canvas cannot parse
  if (result.includes('oklch(')) {
    result = result.replace(/oklch\([^)]+\)/gi, 'rgb(100, 116, 139)');
  }
  if (result.includes('oklab(')) {
    result = result.replace(/oklab\([^)]+\)/gi, 'rgb(100, 116, 139)');
  }

  return result;
}

/**
 * Sanitizes a cloned DOM document before html2canvas parses its CSS rules.
 */
export function sanitizeDocForHtml2Canvas(clonedDoc: Document): void {
  try {
    // 1. Sanitize all <style> elements in clonedDoc
    const styles = clonedDoc.querySelectorAll('style');
    styles.forEach((style) => {
      if (style.textContent && style.textContent.includes('oklch')) {
        style.textContent = replaceOklchInString(style.textContent);
      }
    });

    // 2. Sanitize inline style attributes on all cloned elements
    const allElements = clonedDoc.querySelectorAll('*');
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style && htmlEl.style.cssText && htmlEl.style.cssText.includes('oklch')) {
        htmlEl.style.cssText = replaceOklchInString(htmlEl.style.cssText);
      }
    });
  } catch (err) {
    console.warn('Error during html2canvas document sanitization:', err);
  }
}

/**
 * Returns safe html2canvas options with onclone pre-configured to handle oklch colors.
 */
export function getSafeHtml2CanvasOptions(overrideOptions?: Partial<Options>): Partial<Options> {
  const { onclone, ...rest } = overrideOptions || {};

  return {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    ...rest,
    onclone: (clonedDoc: Document, element: HTMLElement) => {
      sanitizeDocForHtml2Canvas(clonedDoc);
      if (onclone) {
        onclone(clonedDoc, element);
      }
    }
  };
}
