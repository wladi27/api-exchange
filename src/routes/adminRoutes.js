const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdminRole } = require('../middlewares/adminMiddleware');

// Todas las rutas de administración requieren autenticación y rol 'admin'
router.use(requireAuth, requireAdminRole);

router.get('/config', adminController.getAdminConfig);
router.put('/config/plans', adminController.updatePlansConfig);
router.put('/config/payment-methods', adminController.updatePaymentMethodsConfig);

router.get('/payments', adminController.listPayments);
router.post('/payments/:id/approve', adminController.approvePayment);
router.post('/payments/:id/reject', adminController.rejectPayment);
router.get('/stats', adminController.getAdminStats);

module.exports = router;
