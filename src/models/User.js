const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },
    email: {
      type: String,
      required: [true, 'El correo electrónico es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor ingrese un correo electrónico válido'
      ]
    },
    passwordHash: {
      type: String,
      required: [true, 'La contraseña es obligatoria']
    },
    role: {
      type: String,
      enum: ['developer', 'admin'],
      default: 'developer',
      index: true
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'pro_annual', 'business', 'enterprise'],
      default: 'free',
      index: true
    },
    subscriptionStatus: {
      type: String,
      enum: ['free', 'active', 'expired'],
      default: 'free'
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null
    },
    company: {
      type: String,
      trim: true,
      default: ''
    },
    aiUsage: {
      monthlyCount: { type: Number, default: 0 },
      currentMonth: { type: String, default: () => new Date().toISOString().slice(0, 7) }, // "YYYY-MM"
      totalRequests: { type: Number, default: 0 }
    },
    refreshTokens: [
      {
        token: String,
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Método para verificar contraseña
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Ocultar datos sensibles al serializar a JSON
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
