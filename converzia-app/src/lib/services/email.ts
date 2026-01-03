// ============================================
// Email Service
// Simple email sending using Resend or similar
// ============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@converzia.io";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.converzia.io";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, email not sent", { to: options.to, subject: options.subject });
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return { success: false, error: `Email API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
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

