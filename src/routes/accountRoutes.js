const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Proteger todas las rutas de cuentas bancarias con JWT
router.use(requireAuth);

router.get('/', accountController.getAccounts);
router.post('/', accountController.createAccount);
router.get('/:id', accountController.getAccountById);
router.put('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);
router.post('/:id/default', accountController.setDefaultAccount);

module.exports = router;
