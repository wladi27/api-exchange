const mongoose = require('mongoose');

const BankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es obligatorio'],
      index: true
    },
    type: {
      type: String,
      enum: ['PAGO_MOVIL', 'TRANSFERENCIA', 'DIVISA_LOCAL', 'ZELLE', 'BINANCE_PAY', 'OTRO'],
      default: 'PAGO_MOVIL',
      index: true
    },
    label: {
      type: String,
      trim: true,
      default: 'Mi Cuenta Principal',
      maxlength: [60, 'La etiqueta no puede exceder 60 caracteres']
    },
    bankName: {
      type: String,
      trim: true,
      default: ''
    },
    bankCode: {
      type: String,
      trim: true,
      default: ''
    },
    holderName: {
      type: String,
      required: [true, 'El nombre del titular es obligatorio'],
      trim: true,
      maxlength: [120, 'El nombre del titular no puede exceder 120 caracteres']
    },
    docType: {
      type: String,
      enum: ['V', 'E', 'J', 'G', 'P', 'RIF', 'PASAPORTE', 'OTRO'],
      default: 'V'
    },
    docNumber: {
      type: String,
      trim: true,
      default: ''
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: ''
    },
    accountNumber: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    payId: {
      type: String,
      trim: true,
      default: ''
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, 'Las notas no pueden exceder 300 caracteres'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Índice compuesto para buscar rápidamente cuentas por usuario y orden de actualización
BankAccountSchema.index({ userId: 1, isDefault: -1, updatedAt: -1 });

module.exports = mongoose.model('BankAccount', BankAccountSchema);
