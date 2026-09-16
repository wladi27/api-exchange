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
    pago_movil: {
      enabled: { type: Boolean, default: true },
      name: { type: String, default: 'Pago Móvil (Bolívares)' },
      bankName: { type: String, default: '0102 - Banco de Venezuela' },
      bankCode: { type: String, default: '0102' },
      phoneNumber: { type: String, default: '0412-1941735' },
      idNumber: { type: String, default: 'V-27330449' },
      holderName: { type: String, default: 'Wladimir Figuera' },
      instructions: { type: String, default: 'Realiza el pago móvil al monto exacto en Bolívares calculado a la tasa oficial del día.' }
    },
    binance_pay: {
      enabled: { type: Boolean, default: true },
      name: { type: String, default: 'Binance Pay (USDT)' },
      payId: { type: String, default: '123456789' },
      binanceEmail: { type: String, default: 'pagos@klippve.com' },
      instructions: { type: String, default: 'Envía USDT vía Binance Pay sin comisiones a nuestro Pay ID o Correo.' }
    },
    zinli: {
      enabled: { type: Boolean, default: true },
      name: { type: String, default: 'Zinli (USD)' },
      email: { type: String, default: 'pagos@klippve.com' },
      holderName: { type: String, default: 'KlippVE' },
      instructions: { type: String, default: 'Transfiere el monto exacto en USD a nuestro correo de Zinli.' }
    },
    paypal: {
      enabled: { type: Boolean, default: true },
      name: { type: String, default: 'PayPal (USD)' },
      email: { type: String, default: 'pagos@klippve.com' },
      instructions: { type: String, default: 'Envía el pago en USD vía PayPal como familiar/amigo.' }
    }
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

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
      '✨ Escáner visual de etiquetas con IA Google Gemini',
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
      '🚀 Acceso prioritario a nuevos modelos de IA Gemini',
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
