const Payment = require('../models/Payment');
const User = require('../models/User');
const BankAccount = require('../models/BankAccount');
const AppConfig = require('../models/AppConfig');
const ExchangeRate = require('../models/ExchangeRate');
const { getExchangeRates } = require('../services/scraperService');

// GET /api/v1/billing/payment-methods
async function getPaymentMethods(req, res) {
  try {
    let usdBc = 842.21;
    let rateDate = 'Martes, 15 Septiembre 2026';

    try {
      const rateData = await getExchangeRates();
      if (rateData && rateData.usd) {
        usdBc = rateData.usd;
        rateDate = rateData.date;
      }
    } catch (rateErr) {
      console.warn('⚠️ No se pudo obtener tasa BCV en getPaymentMethods:', rateErr.message);
    }

    const config = await AppConfig.getOrCreate();

    // Mapear planes con su precio en Bolívares calculado
    const plansWithPrices = (config.plans || []).map(p => {
      const obj = p.toObject ? p.toObject() : p;
      return {
        ...obj,
        priceBs: usdBc ? Math.round(obj.priceUsd * usdBc * 100) / 100 : null
      };
    });

    return res.json({
      success: true,
      plans: plansWithPrices,
      currentExchangeRate: { usd_bs: usdBc, date: rateDate || 'Oficial' },
      paymentMethods: config.paymentMethods
    });
  } catch (error) {
    console.error('Error en getPaymentMethods:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al consultar métodos de pago y planes.'
    });
  }
}

// POST /api/v1/billing/report-payment
async function reportPayment(req, res) {
  try {
    const {
      plan,
      durationMonths = 1,
      paymentMethod,
      referenceNumber,
      amountPaid,
      currency,
      senderBank,
      senderPhone,
      senderEmail,
      receiptBase64
    } = req.body;

    const user = req.user;

    if (!plan || plan === 'free') {
      return res.status(400).json({
        success: false,
        error: 'InvalidPlan',
        message: 'Debe seleccionar un plan de suscripción de pago (pro, pro_annual, business).'
      });
    }

    const validMethods = ['pago_movil', 'binance_pay', 'zinli', 'paypal', 'usdt_trc20', 'usdt_bep20'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'InvalidPaymentMethod',
        message: `Método de pago no soportado. Opciones válidas: ${validMethods.join(', ')}.`
      });
    }

    if (!referenceNumber || !referenceNumber.trim()) {
      return res.status(400).json({
        success: false,
        error: 'MissingReference',
        message: 'El número de referencia, ID de transacción o correo es obligatorio.'
      });
    }

    const numAmount = parseFloat(amountPaid);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'InvalidAmount',
        message: 'El monto pagado debe ser un número válido mayor a cero.'
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
        message: 'Ya existe un reporte de pago registrado con este número de referencia.'
      });
    }

    let receiptUrl = '';
    if (req.file) {
      receiptUrl = `/uploads/receipts/${req.file.filename}`;
    } else if (receiptBase64 && typeof receiptBase64 === 'string') {
      // Si viene por base64 (ej. desde la app móvil), almacenar o guardar metadata
      receiptUrl = receiptBase64.startsWith('data:') ? receiptBase64 : `data:image/jpeg;base64,${receiptBase64}`;
    }

    const latestRate = await ExchangeRate.findOne().sort({ fetchedAt: -1 });

    const payment = await Payment.create({
      userId: user._id,
      plan,
      durationMonths: parseInt(durationMonths) || 1,
      paymentMethod,
      referenceNumber: referenceNumber.trim(),
      amountPaid: numAmount,
      currency: currency || (paymentMethod === 'pago_movil' ? 'VES' : 'USD'),
      exchangeRateAtPayment: latestRate?.rates?.usd || 842.21,
      receiptUrl: receiptUrl || 'https://placehold.co/400x300?text=Comprobante+Digital',
      senderBank: senderBank || '',
      senderPhone: senderPhone || '',
      senderEmail: senderEmail || '',
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Comprobante de pago reportado exitosamente. Tu solicitud está en proceso de verificación.',
      payment: {
        id: payment._id,
        plan: payment.plan,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        amountPaid: payment.amountPaid,
        currency: payment.currency,
        status: payment.status,
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

// GET /api/v1/billing/my-subscription
async function getMySubscription(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'UserNotFound' });
    }

    const [payments, config, accountsCount] = await Promise.all([
      Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
      AppConfig.getOrCreate(),
      BankAccount.countDocuments({ userId: user._id })
    ]);

    const activePlan = (config.plans || []).find(p => p.id === user.plan) || {
      id: user.plan || 'free',
      name: user.plan === 'pro' ? 'Klipp Pro' : user.plan === 'business' ? 'Klipp Negocio' : 'Klipp Free',
      aiMonthlyQuota: user.plan === 'business' ? 20000 : user.plan === 'pro' ? 3000 : user.plan === 'pro_annual' ? 5000 : 0,
      maxBankAccounts: user.plan === 'business' ? 100 : user.plan === 'pro' ? 10 : user.plan === 'pro_annual' ? 25 : 2
    };

    let daysRemaining = 0;
    if (user.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date()) {
      daysRemaining = Math.ceil((new Date(user.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }

    // Verificar mes actual para uso de IA
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const aiMonthlyUsed = (user.aiUsage && user.aiUsage.currentMonth === currentMonthStr) ? (user.aiUsage.monthlyCount || 0) : 0;
    const aiLimit = activePlan.aiMonthlyQuota !== undefined ? activePlan.aiMonthlyQuota : 3000;
    const maxAccounts = activePlan.maxBankAccounts !== undefined ? activePlan.maxBankAccounts : 2;

    return res.json({
      success: true,
      subscription: {
        plan: user.plan || 'free',
        planDetails: activePlan,
        status: user.subscriptionStatus || 'free',
        isActive: user.subscriptionStatus === 'active' || user.plan === 'pro' || user.plan === 'business',
        isPro: user.plan === 'pro' || user.plan === 'pro_annual' || user.plan === 'business',
        expiresAt: user.subscriptionExpiresAt,
        daysRemaining
      },
      quotaInfo: {
        aiMonthlyQuota: aiLimit,
        aiMonthlyUsed: aiMonthlyUsed,
        aiMonthlyRemaining: Math.max(0, aiLimit - aiMonthlyUsed),
        maxBankAccounts: maxAccounts,
        currentBankAccounts: accountsCount
      },
      recentPayments: payments
    });
  } catch (error) {
    console.error('Error en getMySubscription:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al consultar datos de suscripción.'
    });
  }
}

// POST /api/v1/billing/ai-quota/check-and-consume
async function checkAndConsumeAiQuota(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'UserNotFound' });
    }

    const config = await AppConfig.getOrCreate();
    const userPlanId = user.plan || 'free';
    const planConfig = (config.plans || []).find(p => p.id === userPlanId) || {
      id: userPlanId,
      name: userPlanId.toUpperCase(),
      aiMonthlyQuota: userPlanId === 'business' ? 20000 : userPlanId === 'pro' ? 3000 : userPlanId === 'pro_annual' ? 5000 : 0
    };

    const monthlyLimit = planConfig.aiMonthlyQuota !== undefined ? planConfig.aiMonthlyQuota : 0;
    const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // Inicializar aiUsage si no existe
    if (!user.aiUsage) {
      user.aiUsage = {
        monthlyCount: 0,
        currentMonth: currentMonthStr,
        totalRequests: 0
      };
    }

    // Reiniciar automáticamente si cambió el mes
    if (user.aiUsage.currentMonth !== currentMonthStr) {
      user.aiUsage.monthlyCount = 0;
      user.aiUsage.currentMonth = currentMonthStr;
    }

    // Validar si el plan no tiene cuota (ej: Free con 0 consultas)
    if (monthlyLimit <= 0) {
      return res.status(403).json({
        success: false,
        allowed: false,
        error: 'AiNotAvailableInPlan',
        code: 'AI_NOT_AVAILABLE',
        plan: userPlanId,
        message: 'Las funciones de Inteligencia Artificial (Escáner visual y Dictado por voz) están reservadas para los planes Klipp Pro y Klipp Negocio. Actualiza tu plan para desbloquearlas.',
        monthlyLimit: 0,
        monthlyUsed: user.aiUsage.monthlyCount
      });
    }

    // Validar si ha superado el límite mensual
    if (user.aiUsage.monthlyCount >= monthlyLimit) {
      return res.status(403).json({
        success: false,
        allowed: false,
        error: 'AiQuotaExceeded',
        code: 'AI_QUOTA_EXCEEDED',
        plan: userPlanId,
        message: `Has alcanzado tu límite mensual de ${monthlyLimit.toLocaleString()} consultas de IA Klipp para el plan ${planConfig.name}. Tu cuota se reiniciará el próximo mes o puedes actualizar a Klipp Negocio.`,
        monthlyLimit,
        monthlyUsed: user.aiUsage.monthlyCount,
        remaining: 0
      });
    }

    // Consumir 1 petición
    user.aiUsage.monthlyCount += 1;
    user.aiUsage.totalRequests = (user.aiUsage.totalRequests || 0) + 1;
    user.markModified('aiUsage');
    await user.save();

    return res.json({
      success: true,
      allowed: true,
      monthlyUsed: user.aiUsage.monthlyCount,
      monthlyLimit,
      remaining: Math.max(0, monthlyLimit - user.aiUsage.monthlyCount),
      plan: userPlanId
    });
  } catch (error) {
    console.error('Error en checkAndConsumeAiQuota:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al verificar cuota de Inteligencia Artificial.'
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
  getMySubscription,
  getMyPayments,
  checkAndConsumeAiQuota
};
