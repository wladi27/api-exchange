/**
 * Middleware de Rate Limiting por minuto dinámico según el plan de la API Key.
 * Utiliza ventana deslizante en memoria con fallback y limpieza automática de registros antiguos.
 */

const rateLimitStore = new Map();
const WINDOW_MS = 60 * 1000; // 1 minuto

// Limpieza periódica de llaves inactivas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function dynamicRateLimiter(req, res, next) {
  const apiKeyDoc = req.apiKeyDoc;
  if (!apiKeyDoc) {
    return next();
  }

  // Si la petición proviene de la App Móvil o un plan ilimitado, permitir sin restricciones
  if (apiKeyDoc.isUnlimited || apiKeyDoc.plan === 'mobile_app_unlimited' || req.headers['x-app-client'] === 'expo-dolar-app') {
    res.setHeader('X-RateLimit-Limit', 'unlimited');
    res.setHeader('X-RateLimit-Remaining', 'unlimited');
    res.setHeader('X-Plan', 'mobile_app_unlimited');
    return next();
  }

  const keyId = apiKeyDoc._id.toString();
  const maxRequests = apiKeyDoc.rateLimitPerMin || 30;
  const now = Date.now();

  let record = rateLimitStore.get(keyId);

  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { count: 0, windowStart: now };
    rateLimitStore.set(keyId, record);
  }

  record.count += 1;

  const remaining = Math.max(0, maxRequests - record.count);
  const resetSeconds = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);

  // Cabeceras comerciales estándar
  res.setHeader('X-RateLimit-Limit', String(maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetSeconds));
  res.setHeader('X-Plan', apiKeyDoc.plan);

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'TooManyRequests',
      message: `Has superado el límite de velocidad de tu plan (${maxRequests} req/min). Por favor espere ${resetSeconds}s o actualice su plan.`,
      retry_after_seconds: resetSeconds,
      plan: apiKeyDoc.plan,
      rate_limit: maxRequests
    });
  }

  next();
}

module.exports = { dynamicRateLimiter };
