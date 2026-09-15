const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { optionalApiKey } = require('../middlewares/apiKeyMiddleware');
const { dynamicRateLimiter } = require('../middlewares/rateLimitMiddleware');

// Aplicar autenticación por API Key opcional (permite uso público free controlado) y Rate Limiter dinámico
router.use(optionalApiKey, dynamicRateLimiter);

router.get('/tipo-cambio', exchangeController.getTipoCambio);
router.get('/dolar', exchangeController.getDolar);
router.get('/euro', exchangeController.getEuro);
router.get('/usdt', exchangeController.getUsdt);
router.get('/convert', exchangeController.convertCurrency);
router.get('/historico', exchangeController.getHistoricalRates);

module.exports = router;
