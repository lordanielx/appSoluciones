import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser } from 'playwright-core';
import { env } from '../../config/env';

export interface PdfOptions {
  headerTemplate: string;
  footerTemplate: string;
}

/**
 * Conversión HTML → PDF con Chromium (Playwright). Reutiliza un navegador por proceso
 * y abre un contexto aislado por documento. JavaScript deshabilitado y sin red:
 * el HTML incluye todos los recursos embebidos.
 */
@Injectable()
export class PdfRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderer.name);
  private browser: Promise<Browser> | null = null;

  async render(html: string, options: PdfOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
    try {
      const page = await context.newPage();
      await page.route('**/*', (route) =>
        route.request().url().startsWith('data:') ? route.continue() : route.abort(),
      );
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        margin: { top: '22mm', bottom: '20mm', left: '14mm', right: '14mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await context.close();
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      const b = await this.browser.catch(() => null);
      await b?.close();
    }
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = chromium
        .launch({
          executablePath: env().PDF_CHROMIUM_PATH,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
        })
        .then((b) => {
          b.on('disconnected', () => {
            this.logger.warn('Chromium desconectado; se relanzará en la próxima generación');
            this.browser = null;
          });
          return b;
        })
        .catch((err: unknown) => {
          this.browser = null;
          throw err;
        });
    }
    return this.browser;
  }
}
