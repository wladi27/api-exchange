const Payment = require('../models/Payment');
const { PLANS, PAYMENT_METHODS } = require('../config/constants');
const ExchangeRate = require('../models/ExchangeRate');

const { getExchangeRates } = require('../services/scraperService');

// GET /api/v1/billing/payment-methods
async function getPaymentMethods(req, res) {
  try {
    let usdBc = null;
    let rateDate = null;

    try {
      const rateData = await getExchangeRates();
      if (rateData && rateData.usd) {
        usdBc = rateData.usd;
        rateDate = rateData.date;
      }
    } catch (rateErr) {
      console.warn('⚠️ No se pudo obtener tasa BCV en getPaymentMethods:', rateErr.message);
    }

    const plansWithPrices = Object.values(PLANS).map(p => {
      return {
        ...p,
        priceBs: usdBc ? Math.round(p.priceUsd * usdBc * 100) / 100 : null
      };
    });

    return res.json({
      success: true,
      plans: plansWithPrices,
      currentExchangeRate: usdBc ? { usd_bs: usdBc, date: rateDate || 'Oficial' } : null,
      paymentMethods: Object.values(PAYMENT_METHODS)
    });
  } catch (error) {
    console.error('Error en getPaymentMethods:', error);
    return res.status(200).json({
      success: true,
      plans: Object.values(PLANS).map(p => ({ ...p, priceBs: null })),
      currentExchangeRate: null,
      paymentMethods: Object.values(PAYMENT_METHODS)
    });
  }
}

// POST /api/v1/billing/report-payment
async function reportPayment(req, res) {
  try {
    const { plan, durationMonths, paymentMethod, referenceNumber, amountPaid, currency } = req.body;
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'MissingReceipt',
        message: 'Debe adjuntar la imagen o PDF del comprobante de pago.'
      });
    }

    if (!plan || !PLANS[plan] || plan === 'free') {
      return res.status(400).json({
        success: false,
        error: 'InvalidPlan',
        message: 'Debe seleccionar un plan válido de pago (starter, pro, enterprise).'
      });
    }

    if (!paymentMethod || !PAYMENT_METHODS[paymentMethod]) {
      return res.status(400).json({
        success: false,
        error: 'InvalidPaymentMethod',
        message: 'Método de pago inválido. Opciones: pago_movil, binance_pay, usdt_trc20, usdt_bep20.'
      });
    }

    if (!referenceNumber || !referenceNumber.trim()) {
      return res.status(400).json({
        success: false,
        error: 'MissingReference',
        message: 'El número de referencia o hash de transacción es obligatorio.'
      });
    }

    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'InvalidAmount',
        message: 'El monto pagado debe ser un número mayor a cero.'
      });
    }

    // Comprobar si ya existe un reporte con la misma referencia pendiente o aprobada
    const existingRef = await Payment.findOne({
      referenceNumber: referenceNumber.trim(),
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRef) {
      return res.status(409).json({
        success: false,
        error: 'DuplicateReference',
        message: 'Ya existe un reporte de pago registrado con ese número de referencia.'
      });
    }

    const latestRate = await ExchangeRate.findOne().sort({ fetchedAt: -1 });
    const receiptUrl = `/uploads/receipts/${req.file.filename}`;

    const payment = await Payment.create({
      userId: user._id,
      plan,
      durationMonths: parseInt(durationMonths) || 1,
      paymentMethod,
      referenceNumber: referenceNumber.trim(),
      amountPaid: parseFloat(amountPaid),
      currency: currency || (paymentMethod === 'pago_movil' ? 'VES' : 'USDT'),
      exchangeRateAtPayment: latestRate ? latestRate.rates.usd : null,
      receiptUrl,
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Comprobante de pago enviado exitosamente. Tu solicitud está en revisión por un administrador.',
      payment: {
        id: payment._id,
        plan: payment.plan,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        amountPaid: payment.amountPaid,
        currency: payment.currency,
        status: payment.status,
        receiptUrl: payment.receiptUrl,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error('Error en reportPayment:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: error.message || 'Error al procesar el reporte de pago.'
    });
  }
}

// GET /api/v1/billing/my-payments
async function getMyPayments(req, res) {
  try {
    const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al consultar historial de pagos.'
    });
  }
}

module.exports = {
  getPaymentMethods,
  reportPayment,
  getMyPayments
};
