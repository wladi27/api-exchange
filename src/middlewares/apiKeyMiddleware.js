const ApiKey = require('../models/ApiKey');
const { PLANS } = require('../config/constants');
const { isDbConnected } = require('../config/db');

// L1 In-Memory Fast Cache para validación instantánea (<0.1ms)
const keyMemoryCache = new Map();
const KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché por clave

// Limpieza periódica de caché
setInterval(() => {
  const now = Date.now();
  for (const [hash, item] of keyMemoryCache.entries()) {
    if (now - item.cachedAt > KEY_CACHE_TTL_MS * 2) {
      keyMemoryCache.delete(hash);
    }
  }
}, 10 * 60 * 1000);

async function optionalApiKey(req, res, next) {
  let rawKey = req.headers['x-api-key'];

  if (!rawKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer bcv_')) {
    rawKey = req.headers.authorization.split(' ')[1];
  }

  // 1. Si la petición viene de la App Móvil Principal (Expo) o es cliente oficial
  const isMobileApp = req.headers['x-app-client'] === 'expo-dolar-app' || 
                       req.headers['user-agent']?.includes('Expo') ||
                       req.headers['user-agent']?.includes('okhttp') ||
                       req.headers['user-agent']?.includes('CFNetwork');

  if (!rawKey) {
    // La App Móvil y los clientes oficiales tienen acceso ILIMITADO (sin restricción de peticiones)
    req.apiKeyDoc = {
      _id: `app_${req.ip || 'mobile'}`,
      plan: isMobileApp ? 'mobile_app_unlimited' : 'free',
      rateLimitPerMin: isMobileApp ? 9999999 : 300,
      monthlyQuota: 999999999,
      isUnlimited: isMobileApp || true, // La app móvil es el cliente principal, sin límites
      active: true
    };
    return next();
  }

  // Si viene una clave de desarrollador, validarla normalmente
  return requireApiKey(req, res, next);
}

async function requireApiKey(req, res, next) {
  let rawKey = req.headers['x-api-key'];

  if (!rawKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer bcv_')) {
    rawKey = req.headers.authorization.split(' ')[1];
  }

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API Key requerida. Inclúyala en la cabecera X-Api-Key o Authorization: Bearer bcv_...',
      documentation: '/docs'
    });
  }

  const trimmedKey = rawKey.trim();
  const keyHash = ApiKey.hashKey(trimmedKey);
  const now = Date.now();

  // 1. COMPROBACIÓN ULTRARRÁPIDA EN MEMORIA RAM (< 0.1ms)
  let cachedEntry = keyMemoryCache.get(keyHash);

  if (cachedEntry && (now - cachedEntry.cachedAt < KEY_CACHE_TTL_MS)) {
    const keyData = cachedEntry.data;

    if (!keyData.active) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API Key inactiva o revocada.'
      });
    }

    if (keyData.expiresAt && new Date(keyData.expiresAt).getTime() < now) {
      return res.status(401).json({
        success: false,
        error: 'KeyExpired',
        message: 'Esta API Key ha expirado.'
      });
    }

    // Cuota mensual en memoria
    if (keyData.currentMonthUsage >= keyData.monthlyQuota) {
      return res.status(429).json({
        success: false,
        error: 'MonthlyQuotaExceeded',
        message: `Límite mensual excedido (${keyData.monthlyQuota.toLocaleString()} req).`,
        plan: keyData.plan
      });
    }

    // Incrementar en memoria y flush asíncrono
    keyData.currentMonthUsage += 1;
    ApiKey.updateOne({ _id: keyData._id }, { $inc: { currentMonthUsage: 1 }, $set: { lastUsedAt: new Date() } }).catch(() => {});

    req.apiKeyDoc = keyData;
    return next();
  }

  // 2. Si no está en memoria, consultar base de datos
  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'DatabaseUnavailable',
      message: 'Base de datos temporalmente no disponible para validar credenciales.'
    });
  }

  try {
    const apiKeyDoc = await ApiKey.findOne({ keyHash }).lean();

    if (!apiKeyDoc || !apiKeyDoc.active) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API Key inválida, inactiva o revocada.'
      });
    }

    if (apiKeyDoc.expiresAt && new Date(apiKeyDoc.expiresAt).getTime() < now) {
      return res.status(401).json({
        success: false,
        error: 'KeyExpired',
        message: 'Esta API Key ha expirado.'
      });
    }

    // Guardar en caché L1 de memoria para peticiones subsiguientes
    keyMemoryCache.set(keyHash, {
      data: {
        ...apiKeyDoc,
        _id: apiKeyDoc._id.toString()
      },
      cachedAt: now
    });

    // Incrementar uso asíncronamente
    ApiKey.updateOne({ _id: apiKeyDoc._id }, { $inc: { currentMonthUsage: 1 }, $set: { lastUsedAt: new Date() } }).catch(() => {});

    req.apiKeyDoc = apiKeyDoc;
    next();
  } catch (error) {
    console.error('Error validando API Key:', error.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Error interno verificando credenciales.'
    });
  }
}

module.exports = { requireApiKey, optionalApiKey, keyMemoryCache };
