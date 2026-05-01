import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface SendParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  devLabel: string;
  devSummary: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private fromAddress = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not configured — emails will only be logged. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable delivery.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    this.fromAddress = from || `SDQ Assessment <${user}>`;
    this.logger.log(`SMTP transporter ready (host=${host}, port=${port})`);
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    await this.deliver({
      to: email,
      subject: 'รหัสตั้งรหัสผ่านใหม่ SDQ Assessment',
      html: codeEmailHtml({
        title: 'ตั้งรหัสผ่านใหม่',
        intro: 'รหัสสำหรับตั้งรหัสผ่านใหม่ของคุณคือ:',
        code,
        outro:
          'รหัสนี้จะหมดอายุใน 10 นาที หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้',
      }),
      text: `รหัสตั้งรหัสผ่านใหม่ของคุณคือ ${code} (หมดอายุใน 10 นาที)`,
      devLabel: 'Password reset code',
      devSummary: `code=${code}`,
    });
  }

  async sendEmailVerificationCode(email: string, code: string): Promise<void> {
    await this.deliver({
      to: email,
      subject: 'รหัสยืนยันอีเมล SDQ Assessment',
      html: codeEmailHtml({
        title: 'ยืนยันอีเมล',
        intro: 'รหัสยืนยันอีเมลของคุณคือ:',
        code,
        outro:
          'รหัสนี้จะหมดอายุใน 10 นาที หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้',
      }),
      text: `รหัสยืนยันอีเมลของคุณคือ ${code} (หมดอายุใน 10 นาที)`,
      devLabel: 'Email verification code',
      devSummary: `code=${code}`,
    });
  }

  private async deliver(params: SendParams): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[${params.devLabel}] to=${params.to} ${params.devSummary} (no SMTP — log only)`,
      );
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      this.logger.log(
        `[${params.devLabel}] sent to=${params.to} messageId=${info.messageId}`,
      );
    } catch (err) {
      this.logger.error(
        `[${params.devLabel}] failed to=${params.to}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}

function codeEmailHtml(opts: {
  title: string;
  intro: string;
  code: string;
  outro: string;
}): string {
  return `<!doctype html>
<html lang="th">
  <body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#122644">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e6ec;overflow:hidden">
            <tr>
              <td style="padding:32px 32px 24px">
                <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#122644">${opts.title}</h1>
                <p style="margin:0 0 24px;font-size:14px;color:#6B7486">SDQ Assessment</p>
                <p style="margin:0 0 16px;font-size:14px;color:#333A4A">${opts.intro}</p>
                <div style="background:#f7f8fa;border:1px solid #e2e6ec;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px">
                  <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#00935B">${opts.code}</span>
                </div>
                <p style="margin:0;font-size:13px;color:#6B7486;line-height:1.6">${opts.outro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f7f8fa;border-top:1px solid #e2e6ec">
                <p style="margin:0;font-size:12px;color:#9AA3B2;text-align:center">
                  © SDQ Assessment System
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
