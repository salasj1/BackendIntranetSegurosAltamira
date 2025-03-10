import { sendMailWithRetry } from './transporter.js';

export async function sendEmail(mailOptions) {
  try {
    const resultMail = await sendMailWithRetry(mailOptions);
    if (resultMail.success) {
      console.log('Email sent successfully:', mailOptions);
      return { success: true, message: 'Email sent successfully' };
    } else {
      console.error('Failed to send email:', resultMail.error);
      return { success: false, message: 'Failed to send email', error: resultMail.error };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: 'Error sending email', error };
  }
}