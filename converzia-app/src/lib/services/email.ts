// ============================================
// Email Service
// Email sending using Resend with proper templates and alerts
// ============================================

import { Resend } from 'resend';
import { logger } from '@/lib/utils/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@converzia.io";
const FROM_NAME = process.env.FROM_NAME || "Converzia";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.converzia.io";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@converzia.com";

// Initialize Resend client if API key is available
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using Resend SDK
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured, email not sent", { to: options.to, subject: options.subject });
    return { success: false, error: "Email service not configured" };
  }

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      logger.error("Resend API error", result.error, { to: options.to, subject: options.subject });
      return { success: false, error: result.error.message };
    }

    logger.info("Email sent successfully", { id: result.data?.id, to: options.to, subject: options.subject });
    return { success: true };
  } catch (error) {
    logger.error("Error sending email", error, { to: options.to, subject: options.subject });
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send tenant approval email
 */
export async function sendTenantApprovalEmail(
  email: string,
  tenantName: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">¡Bienvenido a Converzia!</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola,
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Tu solicitud de acceso para <strong>${tenantName}</strong> ha sido <strong style="color: #10b981;">aprobada</strong>.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Ya podés acceder a tu portal y comenzar a configurar tu cuenta.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/portal" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Acceder al Portal
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            Si tenés alguna pregunta, no dudes en contactarnos.
          </p>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Saludos,<br>
            El equipo de Converzia
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Tu cuenta de ${tenantName} ha sido aprobada`,
    html,
  });
}

/**
 * Send tenant rejection email
 */
export async function sendTenantRejectionEmail(
  email: string,
  tenantName: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola,
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Lamentamos informarte que tu solicitud de acceso para <strong>${tenantName}</strong> no ha sido aprobada en este momento.
          </p>
          
          ${reason ? `<p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;"><strong>Motivo:</strong> ${reason}</p>` : ""}
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Si tenés alguna pregunta, podés contactarnos respondiendo a este email.
          </p>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Saludos,<br>
            El equipo de Converzia
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Actualización sobre tu solicitud de ${tenantName}`,
    html,
  });
}

/**
 * Send low credits alert email
 */
export async function sendLowCreditsAlert(
  email: string,
  tenantName: string,
  currentBalance: number
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h2 style="color: #856404; margin-top: 0;">⚠️ Créditos bajos</h2>
          <p style="font-size: 16px;">
            Tu cuenta de <strong>${tenantName}</strong> tiene solo <strong>${currentBalance} créditos restantes</strong>.
          </p>
          <p style="font-size: 16px;">
            Te recomendamos recargar créditos pronto para no interrumpir la calificación de tus leads.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/portal/billing" style="display: inline-block; background: #ffc107; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Comprar créditos
            </a>
          </div>
          <p style="font-size: 14px; color: #666;">
            Si ya compraste créditos recientemente, puedes ignorar este mensaje.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `⚠️ Créditos bajos en ${tenantName}`,
    html,
  });
}

/**
 * Send critical error alert to admin
 */
export async function sendCriticalErrorAlert(
  errorType: string,
  errorMessage: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: monospace; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; border-radius: 5px;">
          <h2 style="color: #721c24; margin-top: 0;">🚨 Error Crítico</h2>
          <p><strong>Tipo:</strong> ${errorType}</p>
          ${tenantId ? `<p><strong>Tenant ID:</strong> ${tenantId}</p>` : ''}
          <p><strong>Mensaje:</strong></p>
          <pre style="background-color: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px;">${errorMessage}</pre>
          <p style="font-size: 12px; color: #666; margin-top: 20px;">
            Timestamp: ${new Date().toISOString()}
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `🚨 Error Crítico: ${errorType}`,
    html,
  });
}

/**
 * Send webhook failure alert to admin
 */
export async function sendWebhookFailureAlert(
  webhookType: string,
  failureCount: number,
  lastError: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: monospace; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 5px;">
          <h2 style="color: #856404; margin-top: 0;">⚠️ Fallo en Webhook</h2>
          <p><strong>Tipo de webhook:</strong> ${webhookType}</p>
          <p><strong>Fallos consecutivos:</strong> ${failureCount}</p>
          <p><strong>Último error:</strong></p>
          <pre style="background-color: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px;">${lastError}</pre>
          <p style="font-size: 12px; color: #666; margin-top: 20px;">
            Por favor, revisa la configuración del webhook y los logs del sistema.
          </p>
          <p style="font-size: 12px; color: #666;">
            Timestamp: ${new Date().toISOString()}
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `⚠️ Fallo en Webhook: ${webhookType}`,
    html,
  });
}

