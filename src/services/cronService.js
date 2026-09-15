const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { PLANS } = require('../config/constants');
const { getExchangeRates } = require('./scraperService');

// Intervalo de scraping de fondo en milisegundos (15 minutos)
const SCRAPER_INTERVAL_MS = 15 * 60 * 1000;

// Intervalo de revisión de suscripciones (cada 1 hora)
const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkExpiredSubscriptions() {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      subscriptionStatus: 'active',
      subscriptionExpiresAt: { $ne: null, $lte: now }
    });

    if (expiredUsers.length === 0) {
      return;
    }

    console.log(`⏰ Procesando ${expiredUsers.length} suscripciones vencidas...`);

    for (const user of expiredUsers) {
      user.plan = 'free';
      user.subscriptionStatus = 'expired';
      await user.save();

      // Degradar sus API Keys a los límites de Free
      const freePlan = PLANS.free;
      await ApiKey.updateMany(
        { userId: user._id, active: true },
        {
          $set: {
            plan: 'free',
            rateLimitPerMin: freePlan.rateLimitPerMin,
            monthlyQuota: freePlan.monthlyQuota
          }
        }
      );

      console.log(`📉 Usuario ${user.email} degradado a plan Free por vencimiento.`);
    }
  } catch (error) {
    console.error('Error en checkExpiredSubscriptions:', error.message);
  }
}

function startCronJobs() {
  console.log('🚀 Iniciando tareas programadas de fondo (Scraper & Expiración de Suscripciones)...');

  // Primer scraping al iniciar
  getExchangeRates().catch(err => console.error('Error en scraping inicial:', err.message));

  // Tarea periódica de scraping (cada 15 min)
  setInterval(() => {
    getExchangeRates(true).catch(err => console.error('Error en scraping periódico:', err.message));
  }, SCRAPER_INTERVAL_MS);

  // Tarea de verificación de expiración (cada hora)
  setInterval(() => {
    checkExpiredSubscriptions();
  }, EXPIRY_CHECK_INTERVAL_MS);

  // Verificación inicial de suscripciones
  checkExpiredSubscriptions();
}

module.exports = {
  startCronJobs,
  checkExpiredSubscriptions
};
