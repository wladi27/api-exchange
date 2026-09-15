const mongoose = require('mongoose');

const ExchangeRateSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Formato 'YYYY-MM-DD' o fecha valor del BCV
      required: true,
      index: true
    },
    sourceDateString: {
      type: String,
      default: ''
    },
    rates: {
      usd: {
        type: Number,
        required: true
      },
      eur: {
        type: Number,
        required: true
      },
      usdt: {
        type: Number,
        default: null
      },
      cny: Number,
      rub: Number,
      try: Number
    },
    baseCurrency: {
      type: String,
      default: 'VES'
    },
    source: {
      type: String,
      default: 'Banco Central de Venezuela'
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    rawCurrencies: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Índice compuesto para consultar rápidamente tasas recientes
ExchangeRateSchema.index({ date: -1, fetchedAt: -1 });

module.exports = mongoose.model('ExchangeRate', ExchangeRateSchema);
