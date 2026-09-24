import { z } from 'zod';

const MAX_STROKES = 300;
const MAX_POINTS = 8000;

/** Trazos capturados por SignaturePad: coordenadas en px del lienzo. */
export const strokesSchema = z.object({
  width: z.number().int().min(50).max(4000),
  height: z.number().int().min(30).max(4000),
  strokes: z
    .array(z.array(z.tuple([z.number().finite(), z.number().finite()])).min(1))
    .min(1, { message: 'La firma está vacía.' })
    .max(MAX_STROKES),
});
export type SignatureStrokes = z.infer<typeof strokesSchema>;

export function parseStrokes(raw: unknown): SignatureStrokes {
  const json = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  const parsed = strokesSchema.parse(json);
  const points = parsed.strokes.reduce((n, s) => n + s.length, 0);
  if (points > MAX_POINTS) throw new Error('La firma tiene demasiados puntos.');
  if (points < 8) throw new Error('La firma es demasiado corta.');
  return parsed;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * SVG generado en el servidor a partir de los trazos (nunca se almacena un SVG enviado
 * por el cliente, lo que evita inyección de scripts). Representación vectorial de la firma.
 */
export function strokesToSvg({ width, height, strokes }: SignatureStrokes): string {
  const paths = strokes
    .map((stroke) => {
      const [first, ...rest] = stroke;
      if (!first) return '';
      if (rest.length === 0) {
        return `<circle cx="${round(first[0])}" cy="${round(first[1])}" r="1.4" fill="#0B1F33"/>`;
      }
      const d = `M${round(first[0])} ${round(first[1])}` + rest.map(([x, y]) => ` L${round(x)} ${round(y)}`).join('');
      return `<path d="${d}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="none" stroke="#0B1F33" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
