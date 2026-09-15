/**
 * Constantes y Configuración de Planes y Métodos de Pago
 */

const PLANS = {
  free: {
    id: 'free',
    name: 'Developer Free',
    priceUsd: 0,
    rateLimitPerMin: 30,
    monthlyQuota: 1000,
    historyDays: 7,
    webhooksAllowed: false,
    description: 'Para pruebas, prototipos y proyectos personales pequeños.'
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceUsd: 9,
    rateLimitPerMin: 300,
    monthlyQuota: 50000,
    historyDays: 365,
    webhooksAllowed: true,
    maxWebhooks: 1,
    description: 'Para pequeños comercios, apps en crecimiento y bots automatizados.'
  },
  pro: {
    id: 'pro',
    name: 'Pro / Business',
    priceUsd: 29,
    rateLimitPerMin: 1200,
    monthlyQuota: 500000,
    historyDays: 1825, // 5 años
    webhooksAllowed: true,
    maxWebhooks: 5,
    description: 'Para empresas, pasarelas de pago, ERPs y plataformas de alto volumen.'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: 99,
    rateLimitPerMin: 3000,
    monthlyQuota: 5000000,
    historyDays: 3650, // Ilimitado (10 años)
    webhooksAllowed: true,
    maxWebhooks: 20,
    description: 'Para fintechs, corporaciones y requerimientos de infraestructura dedicada.'
  }
};

const PAYMENT_METHODS = {
  pago_movil: {
    id: 'pago_movil',
    name: 'Pago Móvil (Bolívares)',
    bank: process.env.PAGO_MOVIL_BANK || '0102 - Banco de Venezuela',
    phone: process.env.PAGO_MOVIL_PHONE || '0412-1234567',
    idNumber: process.env.PAGO_MOVIL_ID || 'V-12345678',
    instructions: 'Realiza el pago móvil al cambio oficial BCV del día. Luego sube el número de referencia y la captura de pantalla.'
  },
  binance_pay: {
    id: 'binance_pay',
    name: 'Binance Pay (USDT)',
    binanceId: process.env.BINANCE_PAY_ID || '123456789',
    binanceEmail: process.env.BINANCE_PAY_EMAIL || 'pagos@dolarapi.com',
    instructions: 'Envía el monto exacto en USDT vía Binance Pay sin comisiones. Adjunta el Order ID o comprobante de Binance.'
  },
  usdt_trc20: {
    id: 'usdt_trc20',
    name: 'USDT (Red TRC-20 / Tron)',
    address: process.env.USDT_TRC20_ADDRESS || 'Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    instructions: 'Envía USDT únicamente por la red Tron (TRC-20). Adjunta el Hash (TxID) de la transacción.'
  },
  usdt_bep20: {
    id: 'usdt_bep20',
    name: 'USDT (Red BEP-20 / BNB Chain)',
    address: process.env.USDT_BEP20_ADDRESS || '0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    instructions: 'Envía USDT únicamente por la red BNB Smart Chain (BEP-20). Adjunta el Hash (TxID) de la transacción.'
  }
};

module.exports = {
  PLANS,
  PAYMENT_METHODS
};
