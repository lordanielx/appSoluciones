import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const cache = new Map<string, string>();

/** @font-face de IBM Plex Sans embebido (el PDF no depende de fuentes del sistema ni de red). */
export function embeddedFontCss(weights: readonly number[] = [400, 500, 600, 700]): string {
  const key = weights.join(',');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let css: string;
  try {
    const dir = join(dirname(require.resolve('@fontsource/ibm-plex-sans/package.json')), 'files');
    css = weights
      .map((weight) => {
        const data = readFileSync(join(dir, `ibm-plex-sans-latin-${weight}-normal.woff2`)).toString('base64');
        return `@font-face{font-family:'IBM Plex Sans';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
      })
      .join('\n');
  } catch {
    css = '';
  }
  cache.set(key, css);
  return css;
}
