const Payment = require('../models/Payment');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const AppConfig = require('../models/AppConfig');
const emailService = require('../services/emailService');
const { PLANS } = require('../config/constants');

// GET /api/v1/admin/config
async function getAdminConfig(req, res) {
  try {
    const config = await AppConfig.getOrCreate();
    return res.json({
      success: true,
      config: {
        plans: config.plans,
        paymentMethods: config.paymentMethods,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    console.error('Error en getAdminConfig:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al consultar la configuración de la aplicación.'
    });
  }
}

// PUT /api/v1/admin/config/plans
async function updatePlansConfig(req, res) {
  try {
    const { plans } = req.body;
    if (!Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'InvalidPlans',
        message: 'Debe proporcionar un arreglo de planes válido.'
      });
    }

    const config = await AppConfig.getOrCreate();
    config.plans = plans;
    config.markModified('plans');
    config.updatedBy = req.user._id;
    config.updatedAt = new Date();
    await config.save();

    return res.json({
      success: true,
      message: 'Planes y precios actualizados exitosamente.',
      plans: config.plans
    });
  } catch (error) {
    console.error('Error en updatePlansConfig:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al actualizar planes y precios.'
    });
  }
}

// PUT /api/v1/admin/config/payment-methods
async function updatePaymentMethodsConfig(req, res) {
  try {
    const { paymentMethods } = req.body;
    if (!paymentMethods || typeof paymentMethods !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'InvalidPaymentMethods',
        message: 'Datos de métodos de pago inválidos.'
      });
    }

    const config = await AppConfig.getOrCreate();
    config.paymentMethods = {
      ...(config.paymentMethods || {}),
      ...paymentMethods
    };
    config.markModified('paymentMethods');
    config.updatedBy = req.user._id;
    config.updatedAt = new Date();
    await config.save();

    return res.json({
      success: true,
      message: 'Datos de métodos de pago actualizados exitosamente.',
      paymentMethods: config.paymentMethods
    });
  } catch (error) {
    console.error('Error en updatePaymentMethodsConfig:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al actualizar métodos de pago.'
    });
  }
}

// GET /api/v1/admin/payments
async function listPayments(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('userId', 'name email company plan subscriptionStatus')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      payments
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al listar pagos para el administrador.'
    });
  }
}

// POST /api/v1/admin/payments/:id/approve
async function approvePayment(req, res) {
  try {
    const paymentId = req.params.id;
    const adminUser = req.user;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Reporte de pago no encontrado.'
      });
    }

    if (payment.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'AlreadyApproved',
        message: 'Este pago ya ha sido aprobado previamente.'
      });
    }

    const user = await User.findById(payment.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'UserNotFound',
        message: 'El usuario asociado a este pago ya no existe.'
      });
    }

    // Calcular nueva fecha de expiración
    const daysToAdd = (payment.durationMonths || 1) * 30;
    const baseDate =
      user.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date()
        ? new Date(user.subscriptionExpiresAt)
        : new Date();

    const newExpiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    // Actualizar usuario
    user.plan = payment.plan;
    user.subscriptionStatus = 'active';
    user.subscriptionExpiresAt = newExpiresAt;
    await user.save();

    // Actualizar estado del pago
    payment.status = 'approved';
    payment.approvedBy = adminUser._id;
    payment.approvedAt = new Date();
    await payment.save();

    // Actualizar automáticamente todas las API Keys activas del usuario
    const planConfig = PLANS[payment.plan] || PLANS.pro || PLANS.starter || { rateLimitPerMin: 600, monthlyQuota: 100000 };
    await ApiKey.updateMany(
      { userId: user._id, active: true },
      {
        $set: {
          plan: payment.plan,
          rateLimitPerMin: planConfig.rateLimitPerMin || 600,
          monthlyQuota: planConfig.monthlyQuota || 100000
        }
      }
    );

    // Notificar al usuario por correo electrónico automáticamente
    emailService.sendPaymentApprovedEmail(
      user.email,
      user.name,
      payment.plan,
      newExpiresAt,
      payment.amountPaid,
      payment.currency
    ).catch(e => console.warn('⚠️ Error al enviar correo de confirmación de pago:', e.message));

    return res.json({
      success: true,
      message: `Pago aprobado exitosamente. Usuario actualizado al plan "${payment.plan}" hasta el ${newExpiresAt.toLocaleDateString()}.`,
      payment: {
        id: payment._id,
        status: payment.status,
        plan: payment.plan,
        approvedAt: payment.approvedAt
      },
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error en approvePayment:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al aprobar el pago.'
    });
  }
}

// POST /api/v1/admin/payments/:id/reject
async function rejectPayment(req, res) {
  try {
    const paymentId = req.params.id;
    const { reason } = req.body;
    const adminUser = req.user;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Reporte de pago no encontrado.'
      });
    }

    payment.status = 'rejected';
    payment.adminNotes = reason ? reason.trim() : 'Comprobante o referencia no válidos.';
    payment.approvedBy = adminUser._id;
    await payment.save();

    // Notificar al usuario por correo electrónico
    User.findById(payment.userId).then(user => {
      if (user && user.email) {
        emailService.sendPaymentRejectedEmail(
          user.email,
          user.name,
          payment.plan,
          payment.adminNotes
        ).catch(e => console.warn('⚠️ Error enviando correo de rechazo:', e.message));
      }
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'El pago ha sido marcado como rechazado.',
      payment: {
        id: payment._id,
        status: payment.status,
        adminNotes: payment.adminNotes
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al rechazar el pago.'
    });
  }
}

// GET /api/v1/admin/stats
async function getAdminStats(req, res) {
  try {
    const [totalUsers, totalKeys, pendingPayments, approvedPayments] = await Promise.all([
      User.countDocuments({ role: 'developer' }),
      ApiKey.countDocuments({ active: true }),
      Payment.countDocuments({ status: 'pending' }),
      Payment.countDocuments({ status: 'approved' })
    ]);

    const usersByPlan = await User.aggregate([
      { $match: { role: 'developer' } },
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalActiveKeys: totalKeys,
        pendingPayments,
        approvedPayments,
        usersByPlan: usersByPlan.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al consultar estadísticas de administración.'
    });
  }
}

module.exports = {
  getAdminConfig,
  updatePlansConfig,
  updatePaymentMethodsConfig,
  listPayments,
  approvePayment,
  rejectPayment,
  getAdminStats
};
