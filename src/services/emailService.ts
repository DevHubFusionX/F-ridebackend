import nodemailer from 'nodemailer';
import { renderEmailHtml } from '../utils/templateLoader.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

type EmailType = 'otp' | 'welcome' | 'waitlist' | 'review_pending' | 'approved' | 'receipt' | 'security_alert';

export const sendEmail = async (to: string, templateType: EmailType, data: Record<string, any>) => {
  const subjectMap: Record<EmailType, string> = {
    otp: `Your F-ride Verification Code: ${data.otp}`,
    welcome: `Welcome to the F-ride Network, ${data.name}`,
    waitlist: `You're on the F-ride Early Access List`,
    review_pending: `Identity Review Pending - F-ride`,
    approved: `You are F-ride Verified!`,
    receipt: `Your F-ride Trip Receipt - ${data.date}`,
    security_alert: `Security Alert: New Login Detected`,
  };

  const headerTitleMap: Record<EmailType, string> = {
    otp: `Verify Identity`,
    welcome: `Welcome Aboard`,
    waitlist: `You're On The List`,
    review_pending: `Documents In Review`,
    approved: `You are Verified`,
    receipt: `Trip Receipt`,
    security_alert: `Security Alert`,
  };

  const subject = subjectMap[templateType] || 'Notification from F-ride';
  const headerTitle = headerTitleMap[templateType] || 'Notification';

  const htmlTemplate = renderEmailHtml(templateType, { ...data, subject, headerTitle });

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    console.log('-----------------------------------------');
    console.log(`[MAIL MOCK] Sending ${templateType} to ${to}`);
    console.log('-----------------------------------------');
    return { success: true, mocked: true };
  }

  const info = await transporter.sendMail({
    from: `"F-ride" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: htmlTemplate,
  });

  console.log(`[MAIL] Message sent: ${info.messageId}`);
  return { success: true, messageId: info.messageId };
};
