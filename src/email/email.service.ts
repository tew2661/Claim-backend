import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'localhost',
        port: parseInt(process.env.MAIL_PORT || '587', 10),
        secure: process.env.MAIL_SECURE == 'true', // false for STARTTLS
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    const mailOptions = {
      from: `"Supplier Claim Management" <${process.env.MAIL_FROM || ''}>`,
      to: process.env.MAIL_TEST_SENT == 'true' ? process.env.MAIL_SENT_TO : to,
      subject: subject,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      throw new Error(`ส่งอีเมลไม่สำเร็จ: ${error.message}`);
    }
  }
}
