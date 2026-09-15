const mongoose = require('mongoose');
const crypto = require('crypto');
const { PLANS } = require('../config/constants');

const ApiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    keyPrefix: {
      type: String,
      required: true // ej. "bcv_live_a1b2c3"
    },
    keyLastChars: {
      type: String,
      required: true // ej. "...9xyz"
    },
    name: {
      type: String,
      required: [true, 'El nombre de la API Key es requerido'],
      trim: true,
      maxlength: 100
    },
    environment: {
      type: String,
      enum: ['live', 'test'],
      default: 'live'
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'enterprise'],
      default: 'free'
    },
    rateLimitPerMin: {
      type: Number,
      default: 30
    },
    monthlyQuota: {
      type: Number,
      default: 1000
    },
    currentMonthUsage: {
      type: Number,
      default: 0
    },
    currentMonthStart: {
      type: Date,
      default: () => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
      }
    },
    scopes: {
      type: [String],
      default: ['rates:read', 'historical:read']
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Utilidad estática para generar una clave criptográfica aleatoria y su hash SHA-256
ApiKeySchema.statics.generateRawKey = function (environment = 'live') {
  const prefix = environment === 'test' ? 'bcv_test_' : 'bcv_live_';
  const randomBytes = crypto.randomBytes(24).toString('hex'); // 48 hex chars
  const rawKey = `${prefix}${randomBytes}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 16);
  const keyLastChars = rawKey.slice(-6);

  return {
    rawKey,
    keyHash,
    keyPrefix,
    keyLastChars
  };
};

// Utilidad para computar el hash SHA-256 de una clave recibida
ApiKeySchema.statics.hashKey = function (rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
};

// Sincronizar límites basados en el plan del usuario
ApiKeySchema.methods.syncWithPlan = function (planName) {
  const planInfo = PLANS[planName] || PLANS.free;
  this.plan = planName;
  this.rateLimitPerMin = planInfo.rateLimitPerMin;
  this.monthlyQuota = planInfo.monthlyQuota;
};

// Comprobar y reiniciar cuota mensual si el mes cambió
ApiKeySchema.methods.checkAndResetMonthlyQuota = function () {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (!this.currentMonthStart || this.currentMonthStart < currentMonth) {
    this.currentMonthStart = currentMonth;
    this.currentMonthUsage = 0;
  }
};

module.exports = mongoose.model('ApiKey', ApiKeySchema);
