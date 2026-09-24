import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from './Button';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  /** PNG para el PDF + trazos vectoriales (el servidor genera el SVG). */
  export: () => Promise<{ png: Blob; strokes: string }>;
}

type Point = [number, number];

const INK = '#0B1F33';
const LINE_WIDTH = 2.4;
const MIN_POINTS = 8;

/**
 * Captura de firma por trazos en canvas (pointer events: dedo, lápiz o mouse).
 * Conserva las coordenadas de cada trazo para generar una representación vectorial.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onChange?: (empty: boolean) => void }>(
  function SignaturePad({ label, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Point[][]>([]);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    const size = () => {
      const c = canvasRef.current;
      return c ? { width: Math.round(c.clientWidth), height: Math.round(c.clientHeight) } : { width: 0, height: 0 };
    };

    const redraw = useCallback(() => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const s of strokes.current) drawStroke(ctx, s);
    }, []);

    const resize = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = size();
      c.width = width * dpr;
      c.height = height * dpr;
      redraw();
    }, [redraw]);

    useEffect(() => {
      resize();
      const obs = new ResizeObserver(resize);
      if (canvasRef.current) obs.observe(canvasRef.current);
      return () => obs.disconnect();
    }, [resize]);

    const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = e.currentTarget.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      strokes.current.push([pointFrom(e)]);
      redraw();
    };
    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const stroke = strokes.current[strokes.current.length - 1];
      if (!stroke) return;
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      const rect = e.currentTarget.getBoundingClientRect();
      for (const ev of events) stroke.push([ev.clientX - rect.left, ev.clientY - rect.top]);
      redraw();
    };
    const onUp = () => {
      if (!drawing.current) return;
      drawing.current = false;
      const total = strokes.current.reduce((n, s) => n + s.length, 0);
      const isEmpty = total < MIN_POINTS;
      setEmpty(isEmpty);
      onChange?.(isEmpty);
    };

    const clear = () => {
      strokes.current = [];
      setEmpty(true);
      onChange?.(true);
      redraw();
    };

    useImperativeHandle(ref, () => ({
      isEmpty: () => strokes.current.reduce((n, s) => n + s.length, 0) < MIN_POINTS,
      clear,
      export: async () => {
        const { width, height } = size();
        // PNG a resolución fija 2x con fondo transparente, independiente del DPR del equipo.
        const out = document.createElement('canvas');
        out.width = width * 2;
        out.height = height * 2;
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('No fue posible exportar la firma.');
        ctx.scale(2, 2);
        ctx.strokeStyle = INK;
        ctx.fillStyle = INK;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const s of strokes.current) drawStroke(ctx, s);
        const png = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
        if (!png) throw new Error('No fue posible exportar la firma.');
        const round = (n: number) => Math.round(n * 10) / 10;
        const payload = { width, height, strokes: strokes.current.map((s) => s.map(([x, y]) => [round(x), round(y)])) };
        return { png, strokes: JSON.stringify(payload) };
      },
    }));

    return (
      <div className="flex flex-col gap-2">
        <div className="relative rounded border border-border-strong bg-surface">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={label}
            className="block h-48 w-full touch-none select-none sm:h-56"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
          />
          <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-border-strong" aria-hidden />
          <span className="pointer-events-none absolute bottom-3 left-6 text-2xs uppercase tracking-[0.08em] text-text-muted">Firme sobre la línea</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">{empty ? 'Sin firma' : 'Firma capturada'}</span>
          <Button variant="ghost" size="sm" onClick={clear} disabled={empty} icon={<Eraser className="h-4 w-4" />}>
            Borrar y repetir
          </Button>
        </div>
      </div>
    );
  },
);

function drawStroke(ctx: CanvasRenderingContext2D, s: Point[]) {
  const [first] = s;
  if (!first) return;
  if (s.length === 1) {
    ctx.beginPath();
    ctx.arc(first[0], first[1], LINE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  // Suavizado con curvas cuadráticas por puntos medios.
  for (let i = 1; i < s.length - 1; i++) {
    const [x, y] = s[i] as Point;
    const [nx, ny] = s[i + 1] as Point;
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const last = s[s.length - 1] as Point;
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}
