const express = require('express');
const router = express.Router();
const keyController = require('../controllers/keyController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Todas las rutas de gestión de claves requieren sesión JWT
router.use(requireAuth);

router.get('/', keyController.listKeys);
router.post('/', keyController.createKey);
router.patch('/:id', keyController.updateKey);
router.delete('/:id', keyController.revokeKey);
router.post('/:id/rotate', keyController.rotateKey);

module.exports = router;
