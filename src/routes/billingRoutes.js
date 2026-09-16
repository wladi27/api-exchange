const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadReceipt } = require('../middlewares/uploadMiddleware');

// Obtener métodos de pago e instrucciones (Público)
router.get('/payment-methods', billingController.getPaymentMethods);

// Reportar pago con comprobante y consultar pagos (Requiere Auth)
router.post(
  '/report-payment',
  requireAuth,
  uploadReceipt.single('receipt'),
  billingController.reportPayment
);
router.get('/my-subscription', requireAuth, billingController.getMySubscription);
router.get('/my-payments', requireAuth, billingController.getMyPayments);
router.post('/ai-quota/check-and-consume', requireAuth, billingController.checkAndConsumeAiQuota);

module.exports = router;
