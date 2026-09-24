import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let cached: string | null = null;

/** @font-face de IBM Plex Sans embebido (el PDF no depende de fuentes del sistema ni de red). */
export function embeddedFontCss(): string {
  if (cached !== null) return cached;
  try {
    const dir = join(dirname(require.resolve('@fontsource/ibm-plex-sans/package.json')), 'files');
    cached = [400, 500, 600, 700]
      .map((weight) => {
        const data = readFileSync(join(dir, `ibm-plex-sans-latin-${weight}-normal.woff2`)).toString('base64');
        return `@font-face{font-family:'IBM Plex Sans';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
      })
      .join('\n');
  } catch {
    cached = '';
  }
  return cached;
}
