import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

/** Minimal, brandable HTML shell used by every transactional email. */
const LAYOUT = `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
          <tr><td style="background:{{primaryColor}};padding:20px 24px;color:#ffffff;font-size:18px;font-weight:600">
            {{companyName}}
          </td></tr>
          <tr><td style="padding:24px">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">{{title}}</h1>
            <div style="font-size:14px;line-height:1.6;color:#334155">{{{body}}}</div>
            {{#if actionUrl}}
            <div style="margin-top:24px">
              <a href="{{actionUrl}}" style="display:inline-block;background:{{primaryColor}};color:#ffffff;
                 text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">
                {{actionLabel}}
              </a>
            </div>
            {{/if}}
          </td></tr>
          <tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">
            Este mensaje fue enviado por {{appName}}. Si no esperaba este correo puede ignorarlo.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const layoutTemplate = Handlebars.compile(LAYOUT);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly driver: 'log' | 'smtp';
  /** Every message sent while the driver is `log`, for tests and the demo. */
  readonly outbox: MailMessage[] = [];

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<'log' | 'smtp'>('env.MAIL_DRIVER') ?? 'log';
    if (this.driver === 'smtp') {
      this.transporter = createTransport({
        host: this.config.get<string>('env.SMTP_HOST'),
        port: this.config.get<number>('env.SMTP_PORT'),
        secure: this.config.get<boolean>('env.SMTP_SECURE'),
        auth: this.config.get<string>('env.SMTP_USER')
          ? {
              user: this.config.get<string>('env.SMTP_USER'),
              pass: this.config.get<string>('env.SMTP_PASS'),
            }
          : undefined,
      });
    }
  }

  render(params: {
    title: string;
    body: string;
    actionUrl?: string;
    actionLabel?: string;
    companyName?: string;
    primaryColor?: string;
  }): string {
    return layoutTemplate({
      appName: this.config.get<string>('env.APP_NAME') ?? 'TALENTO',
      companyName: params.companyName ?? this.config.get<string>('env.APP_NAME') ?? 'TALENTO',
      primaryColor: params.primaryColor ?? '#2563eb',
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel ?? 'Abrir en TALENTO',
    });
  }

  async send(message: MailMessage): Promise<void> {
    if (this.driver === 'log' || !this.transporter) {
      this.outbox.push(message);
      if (this.outbox.length > 500) this.outbox.splice(0, this.outbox.length - 500);
      this.logger.log(
        `[mail:log] Para ${Array.isArray(message.to) ? message.to.join(', ') : message.to} | ${message.subject}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('env.MAIL_FROM'),
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments,
    });
  }
}
