import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envío de correo. En el MVP no hay proveedor configurado: sin SMTP_URL el mensaje
 * se registra en el log (solo fuera de producción). Ver ASSUMPTIONS A-19.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Últimos mensajes (solo entorno de pruebas) para verificar flujos en tests. */
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    const config = env();
    if (config.NODE_ENV === 'test') {
      this.outbox.push(message);
      return;
    }
    if (!config.SMTP_URL) {
      if (config.NODE_ENV === 'production') {
        this.logger.error('SMTP_URL no configurado: no fue posible enviar el correo.');
        return;
      }
      this.logger.warn({ to: message.to, subject: message.subject, body: message.text }, 'Correo (modo desarrollo)');
      return;
    }
    // Integración SMTP pendiente de proveedor corporativo. Se deja un punto de extensión explícito.
    this.logger.warn({ to: message.to, subject: message.subject }, 'Proveedor SMTP no implementado en el MVP');
  }
}
