const ApiKey = require('../models/ApiKey');
const { PLANS } = require('../config/constants');
const { isDbConnected } = require('../config/db');

// GET /api/v1/user/keys
async function listKeys(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'Base de datos temporalmente no disponible.'
      });
    }
    const keys = await ApiKey.find({ userId: req.user._id }).sort({ createdAt: -1 });

    const formattedKeys = keys.map(k => {
      k.checkAndResetMonthlyQuota();
      return {
        id: k._id,
        name: k.name,
        maskedKey: `${k.keyPrefix}...${k.keyLastChars}`,
        environment: k.environment,
        plan: k.plan,
        rateLimitPerMin: k.rateLimitPerMin,
        monthlyQuota: k.monthlyQuota,
        currentMonthUsage: k.currentMonthUsage,
        active: k.active,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt
      };
    });

    return res.json({
      success: true,
      count: formattedKeys.length,
      keys: formattedKeys
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al listar las API Keys.'
    });
  }
}

// POST /api/v1/user/keys
async function createKey(req, res) {
  try {
    const { name, environment } = req.body;
    const user = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'El nombre descriptivo de la API Key es requerido.'
      });
    }

    // Limitar cantidad de claves según el plan (ej. Free: máx 2, Starter: máx 5, Pro: máx 20)
    const existingCount = await ApiKey.countDocuments({ userId: user._id, active: true });
    const maxKeysAllowed = user.plan === 'free' ? 2 : user.plan === 'starter' ? 5 : 20;

    if (existingCount >= maxKeysAllowed) {
      return res.status(403).json({
        success: false,
        error: 'KeyLimitReached',
        message: `Has alcanzado el límite de ${maxKeysAllowed} API Keys activas para tu plan (${user.plan}). Elimina una clave o actualiza tu suscripción.`
      });
    }

    const env = environment === 'test' ? 'test' : 'live';
    const keyData = ApiKey.generateRawKey(env);
    const planInfo = PLANS[user.plan] || PLANS.free;

    const newKey = await ApiKey.create({
      userId: user._id,
      keyHash: keyData.keyHash,
      keyPrefix: keyData.keyPrefix,
      keyLastChars: keyData.keyLastChars,
      name: name.trim(),
      environment: env,
      plan: user.plan,
      rateLimitPerMin: planInfo.rateLimitPerMin,
      monthlyQuota: planInfo.monthlyQuota
    });

    return res.status(201).json({
      success: true,
      message: 'API Key generada exitosamente. Asegúrate de copiarla ahora ya que no se volverá a mostrar completa.',
      apiKey: {
        id: newKey._id,
        rawKey: keyData.rawKey,
        name: newKey.name,
        maskedKey: `${keyData.keyPrefix}...${keyData.keyLastChars}`,
        environment: newKey.environment,
        plan: newKey.plan,
        rateLimitPerMin: newKey.rateLimitPerMin,
        monthlyQuota: newKey.monthlyQuota,
        createdAt: newKey.createdAt
      }
    });
  } catch (error) {
    console.error('Error en createKey:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al generar la API Key.'
    });
  }
}

// PATCH /api/v1/user/keys/:id
async function updateKey(req, res) {
  try {
    const { name, active } = req.body;
    const key = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'API Key no encontrada.'
      });
    }

    if (name !== undefined) key.name = name.trim();
    if (active !== undefined) key.active = Boolean(active);

    await key.save();

    return res.json({
      success: true,
      message: 'API Key actualizada correctamente.',
      apiKey: {
        id: key._id,
        name: key.name,
        maskedKey: `${key.keyPrefix}...${key.keyLastChars}`,
        active: key.active
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al actualizar la API Key.'
    });
  }
}

// DELETE /api/v1/user/keys/:id
async function revokeKey(req, res) {
  try {
    const key = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'API Key no encontrada.'
      });
    }

    await ApiKey.deleteOne({ _id: key._id });

    return res.json({
      success: true,
      message: 'API Key revocada y eliminada permanentemente.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al revocar la API Key.'
    });
  }
}

// POST /api/v1/user/keys/:id/rotate
async function rotateKey(req, res) {
  try {
    const oldKey = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });

    if (!oldKey) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'API Key no encontrada.'
      });
    }

    // Generar nuevos datos criptográficos
    const keyData = ApiKey.generateRawKey(oldKey.environment);
    oldKey.keyHash = keyData.keyHash;
    oldKey.keyPrefix = keyData.keyPrefix;
    oldKey.keyLastChars = keyData.keyLastChars;
    oldKey.lastUsedAt = null;
    await oldKey.save();

    return res.json({
      success: true,
      message: 'API Key rotada exitosamente. La clave anterior ha dejado de funcionar.',
      apiKey: {
        id: oldKey._id,
        rawKey: keyData.rawKey,
        name: oldKey.name,
        maskedKey: `${keyData.keyPrefix}...${keyData.keyLastChars}`,
        updatedAt: oldKey.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al rotar la API Key.'
    });
  }
}

module.exports = {
  listKeys,
  createKey,
  updateKey,
  revokeKey,
  rotateKey
};
