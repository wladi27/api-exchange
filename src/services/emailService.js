const axios = require('axios');

/**
 * Servicio de envío de correos electrónicos para Klipp.
 * Soporta:
 * 1. Resend API (3,000 correos gratis/mes con RESEND_API_KEY)
 * 2. Modo desarrollo / consola si no hay credenciales configuradas
 */
class EmailService {
  constructor() {
    this.resendApiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.EMAIL_FROM || 'Klipp <soporte@klippve.com>';
  }

  /**
   * Genera el HTML para el correo de recuperación con OTP
   */
  getOtpEmailTemplate(name, otp) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña - Klipp</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #08090D;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #F4F5F7;
    }
    .container {
      max-width: 520px;
      margin: 40px auto;
      background-color: #12151E;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 32px 20px 32px;
      text-align: center;
      background: linear-gradient(180deg, rgba(255, 122, 26, 0.12) 0%, rgba(18, 21, 30, 0) 100%);
    }
    .logo-badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #FF7A1A 0%, #FFA043 100%);
      color: #FFFFFF;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 16px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0 0 8px 0;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 13.5px;
      color: #8B92A3;
      margin: 0;
      line-height: 20px;
    }
    .body {
      padding: 10px 32px 32px 32px;
    }
    .greeting {
      font-size: 15px;
      color: #E2E8F0;
      margin-bottom: 16px;
    }
    .otp-card {
      background-color: #090B10;
      border: 1px dashed rgba(255, 122, 26, 0.35);
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #FF9A3D;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'SF Mono', Consolas, Monaco, 'Courier New', monospace;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #FFFFFF;
      margin: 0;
    }
    .otp-hint {
      font-size: 12px;
      color: #5A6172;
      margin-top: 10px;
    }
    .notice {
      font-size: 13px;
      color: #8B92A3;
      line-height: 19px;
      background-color: rgba(255, 255, 255, 0.03);
      padding: 14px;
      border-radius: 10px;
      margin-top: 18px;
    }
    .footer {
      padding: 20px 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      font-size: 11px;
      color: #5A6172;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">K</div>
      <h1 class="title">Recuperación de Contraseña</h1>
      <p class="subtitle">Código de seguridad para restablecer tu cuenta</p>
    </div>

    <div class="body">
      <div class="greeting">Hola ${name || 'Usuario'},</div>
      <p style="font-size: 13.5px; color: #8B92A3; line-height: 20px; margin: 0;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Klipp</strong>.
        Introduce el siguiente código en la aplicación:
      </p>

      <div class="otp-card">
        <div class="otp-label">Código de Verificación</div>
        <div class="otp-code">${otp}</div>
        <div class="otp-hint">Válido por los próximos 15 minutos</div>
      </div>

      <div class="notice">
        🔒 <strong>Aviso de seguridad:</strong> Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura. Tu contraseña actual no se modificará.
      </div>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} KlippVE · Plataforma Financiera y Monitoreo de Tasas
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Envía el correo con el código OTP
   */
  async sendPasswordResetOtp(toEmail, name, otp) {
    const subject = `${otp} es tu código de recuperación de Klipp`;
    const html = this.getOtpEmailTemplate(name, otp);

    const apiKey = process.env.RESEND_API_KEY || this.resendApiKey;
    const fromAddress = process.env.EMAIL_FROM || 'Klipp <seguridad@klipp.lat>';

    // 1. Si hay clave de Resend configurada, enviar vía Resend API
    if (apiKey && !apiKey.includes('tu_resend_api_key')) {
      try {
        const response = await axios.post(
          'https://api.resend.com/emails',
          {
            from: fromAddress,
            to: [toEmail],
            subject,
            html,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 12000,
          }
        );

        console.log(`📧 [Resend] Correo de recuperación enviado a ${toEmail} desde ${fromAddress}. ID:`, response.data?.id);
        return { success: true, provider: 'resend', id: response.data?.id };
      } catch (err) {
        const errorData = err.response?.data || {};
        const errorMsg = errorData.message || err.message;
        console.error('❌ [Resend] Error enviando correo vía API:', errorData || err.message);
        return {
          success: false,
          provider: 'resend',
          error: errorMsg
        };
      }
    }

    // 2. Modo desarrollo / consola si no hay API key configurada
    console.log('====================================================');
    console.log(`🔑 [Klipp Auth (Dev)] CÓDIGO OTP PARA: ${toEmail}`);
    console.log(`👉 CÓDIGO: ${otp}`);
    console.log(`⏱️ Válido por 15 minutos.`);
    console.log('====================================================');

    return {
      success: true,
      provider: 'dev_console',
      testMode: true,
    };
  }
}

module.exports = new EmailService();
