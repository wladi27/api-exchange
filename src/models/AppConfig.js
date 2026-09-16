const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  priceUsd: { type: Number, required: true, min: 0 },
  durationMonths: { type: Number, default: 1 },
  rateLimitPerMin: { type: Number, default: 300 },
  monthlyQuota: { type: Number, default: 50000 },
  historyDays: { type: Number, default: 365 },
  description: { type: String, default: '' },
  features: [{ type: String }],
  isPopular: { type: Boolean, default: false },
  badge: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { _id: false });

const AppConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global_config', unique: true },
  plans: [PlanSchema],
  paymentMethods: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      pago_movil: {
        enabled: true,
        name: 'Pago Móvil (Bolívares)',
        bank: '0102 - Banco de Venezuela',
        bankName: '0102 - Banco de Venezuela',
        bankCode: '0102',
        phone: '0412-1941735',
        phoneNumber: '0412-1941735',
        idNumber: 'V-27330449',
        accountHolder: 'Wladimir Figuera',
        holderName: 'Wladimir Figuera',
        instructions: 'Realiza el pago móvil al monto exacto en Bolívares calculado a la tasa oficial del día.'
      },
      binance_pay: {
        enabled: true,
        name: 'Binance Pay (USDT)',
        payId: '123456789',
        usdtTrc20Address: '',
        usdtBep20Address: '',
        qrImageUrl: '',
        binanceEmail: 'pagos@klippve.com',
        instructions: 'Envía USDT vía Binance Pay sin comisiones a nuestro Pay ID o Correo.'
      },
      zinli: {
        enabled: true,
        name: 'Zinli (USD)',
        email: 'pagos@klippve.com',
        accountHolder: 'KlippVE',
        holderName: 'KlippVE',
        instructions: 'Transfiere el monto exacto en USD a nuestro correo de Zinli.'
      },
      paypal: {
        enabled: true,
        name: 'PayPal (USD)',
        email: 'pagos@klippve.com',
        paypalMeLink: '',
        instructions: 'Envía el pago en USD vía PayPal como familiar/amigo.'
      }
    }
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false, strict: false });

// Planes por defecto iniciales
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Klipp Free',
    priceUsd: 0,
    durationMonths: 1,
    rateLimitPerMin: 30,
    monthlyQuota: 1000,
    historyDays: 7,
    description: 'Tasas oficiales en vivo, calculadora manual y generador de cobros BDV.',
    features: [
      'Tasas oficiales BCV y Binance P2P en tiempo real',
      'Calculadora de cambio y montos rápidos',
      'Generador de cobros Pago Móvil para BDV y banca nacional',
      'Conversor sin conexión a internet'
    ],
    isPopular: false,
    badge: 'Gratis',
    active: true
  },
  {
    id: 'pro',
    name: 'Klipp Pro',
    priceUsd: 4.99,
    durationMonths: 1,
    rateLimitPerMin: 600,
    monthlyQuota: 100000,
    historyDays: 365,
    description: 'Desbloquea escaneo visual con IA, lectura de etiquetas por voz y más.',
    features: [
      '✨ Escáner visual de etiquetas con IA Klipp',
      '🎙️ Entrada por voz con cálculo automático de fracciones/gramos',
      '🛒 Carrito de compras inteligente con totalización en Bs y USD',
      '📊 Histórico completo de tasas y gráficos interactivos',
      '⚡ Sin límites de consultas ni publicidad'
    ],
    isPopular: true,
    badge: 'Más Popular',
    active: true
  },
  {
    id: 'pro_annual',
    name: 'Klipp Pro Anual',
    priceUsd: 39.99,
    durationMonths: 12,
    rateLimitPerMin: 1200,
    monthlyQuota: 1000000,
    historyDays: 1825,
    description: 'Ahorra más del 30% con suscripción anual y soporte prioritario.',
    features: [
      '🌟 Todos los beneficios de Klipp Pro por 12 meses',
      '💰 Descuento especial de 2 meses gratis',
      '🚀 Acceso prioritario a nuevas funciones de IA Klipp',
      '🛡️ Soporte directo VIP por WhatsApp'
    ],
    isPopular: false,
    badge: 'Ahorra 33%',
    active: true
  },
  {
    id: 'business',
    name: 'Klipp Negocio',
    priceUsd: 9.99,
    durationMonths: 1,
    rateLimitPerMin: 2000,
    monthlyQuota: 2000000,
    historyDays: 3650,
    description: 'Para comercios, supermercados y bodegones de alto volumen.',
    features: [
      '🏪 Múltiples cuentas bancarias y cajeros',
      '📦 Exportación de listas de compras y reportes PDF/Excel',
      '🔑 Acceso a API Keys para conectar con sistemas POS/ERP',
      '🤖 Procesamiento masivo de etiquetas de precios en lote'
    ],
    isPopular: false,
    badge: 'Comercios',
    active: true
  }
];

/**
 * Obtener o inicializar configuración global
 */
AppConfigSchema.statics.getOrCreate = async function() {
  let config = await this.findOne({ key: 'global_config' });
  if (!config) {
    config = await this.create({
      key: 'global_config',
      plans: DEFAULT_PLANS
    });
  }
  return config;
};

module.exports = mongoose.model('AppConfig', AppConfigSchema);
