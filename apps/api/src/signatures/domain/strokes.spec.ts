import { parseStrokes, strokesToSvg } from './strokes';

describe('firma vectorial', () => {
  const sample = { width: 600, height: 240, strokes: [[[10, 10], [20, 25], [30, 40], [40, 42]], [[50, 50], [60, 55], [70, 70], [80, 75]]] };

  it('genera SVG con un path por trazo y sin contenido del cliente', () => {
    const svg = strokesToSvg(parseStrokes(JSON.stringify(sample)));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).not.toContain('<script');
  });

  it('rechaza firmas vacías o demasiado cortas', () => {
    expect(() => parseStrokes({ width: 600, height: 240, strokes: [] })).toThrow();
    expect(() => parseStrokes({ width: 600, height: 240, strokes: [[[1, 1]]] })).toThrow();
  });

  it('rechaza coordenadas no numéricas', () => {
    expect(() => parseStrokes({ width: 600, height: 240, strokes: [[['<script>', 1]]] })).toThrow();
  });
});
