const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    plan: {
      type: String,
      enum: ['starter', 'pro', 'enterprise'],
      required: [true, 'El plan a contratar es requerido']
    },
    durationMonths: {
      type: Number,
      enum: [1, 3, 6, 12],
      default: 1
    },
    paymentMethod: {
      type: String,
      enum: ['pago_movil', 'binance_pay', 'usdt_trc20', 'usdt_bep20', 'transferencia'],
      required: [true, 'El método de pago es requerido']
    },
    referenceNumber: {
      type: String,
      required: [true, 'El número de referencia o hash de transacción es obligatorio'],
      trim: true,
      index: true
    },
    amountPaid: {
      type: Number,
      required: [true, 'El monto pagado es obligatorio'],
      min: 0.01
    },
    currency: {
      type: String,
      enum: ['VES', 'USDT', 'USD'],
      default: 'USD'
    },
    exchangeRateAtPayment: {
      type: Number,
      default: null
    },
    receiptUrl: {
      type: String,
      required: [true, 'El comprobante de pago es obligatorio']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ''
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Payment', PaymentSchema);
