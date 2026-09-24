import type { ReactNode } from 'react';
import { BrandMark } from '@/layouts/Brand';

/** Estructura común de autenticación: panel técnico a la izquierda (desktop) y formulario. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(360px,440px)_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-white lg:flex">
        <BrandMark inverse />
        <div className="relative z-10">
          <p className="label-caps !text-white/50">Plataforma interna</p>
          <p className="mt-3 max-w-xs text-xl font-medium leading-snug">Órdenes de trabajo, checklist, evidencias y firmas en un solo registro trazable.</p>
          <dl className="mt-8 grid grid-cols-3 border-t border-white/15 pt-4 text-xs text-white/60">
            <div><dt>Módulo</dt><dd className="mt-1 text-white">OT</dd></div>
            <div><dt>Informe</dt><dd className="mt-1 text-white">PDF</dd></div>
            <div><dt>Campo</dt><dd className="mt-1 text-white">Offline</dd></div>
          </dl>
        </div>
        {/* Retícula técnica tenue: referencia a plano de ingeniería, no decoración ilustrativa. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <p className="relative z-10 text-2xs text-white/40">MECAELECTRIC S.A.S. · Uso exclusivo del personal autorizado</p>
      </aside>
      <main className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <BrandMark className="mb-10 lg:hidden" />
          <h1 className="text-2xl font-semibold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
