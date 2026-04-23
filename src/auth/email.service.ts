import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private appUrl(): string {
    return this.config.get<string>('APP_URL') || 'http://localhost:3000';
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${this.appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await this.deliver({
      to: email,
      subject: 'รีเซ็ตรหัสผ่าน SDQ Assessment',
      html: `
        <p>กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 60 นาที):</p>
        <p><a href="${url}">${url}</a></p>
        <p>หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้</p>
      `,
      devLabel: 'Password reset',
      devUrl: url,
    });
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const url = `${this.appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.deliver({
      to: email,
      subject: 'ยืนยันอีเมล SDQ Assessment',
      html: `
        <p>กดลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ (หมดอายุใน 24 ชั่วโมง):</p>
        <p><a href="${url}">${url}</a></p>
      `,
      devLabel: 'Email verification',
      devUrl: url,
    });
  }

  private async deliver(params: {
    to: string;
    subject: string;
    html: string;
    devLabel: string;
    devUrl: string;
  }): Promise<void> {
    // TODO: wire up real SMTP/Resend/SES — logs URL for now
    this.logger.log(
      `[${params.devLabel}] to=${params.to} url=${params.devUrl}`,
    );
  }
}
