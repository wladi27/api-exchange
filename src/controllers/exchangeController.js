const { getExchangeRates } = require('../services/scraperService');
const ExchangeRate = require('../models/ExchangeRate');
const { PLANS } = require('../config/constants');

const round2 = (val) => (val !== null && val !== undefined && !isNaN(val)) ? Math.round((Number(val) + Number.EPSILON) * 100) / 100 : null;

// GET /api/v1/tipo-cambio
async function getTipoCambio(req, res) {
  const data = await getExchangeRates();

  if (!data.usd || !data.eur) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'No fue posible obtener las tasas oficiales en este momento. Intente nuevamente en unos segundos.'
    });
  }

  const usd = round2(data.usd);
  const eur = round2(data.eur);
  const usdt = round2(data.usdt) || round2(usd * 1.175);

  return res.json({
    success: true,
    source: 'Banco Central de Venezuela (BCV) & Binance P2P',
    base_currency: 'VES',
    date: data.date,
    prices: {
      usd_bs: usd,
      eur_bs: eur,
      usdt_bs: usdt
    },
    is_cached: Boolean(data.isCached)
  });
}

// GET /api/v1/dolar
async function getDolar(req, res) {
  const data = await getExchangeRates();

  if (!data.usd) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Valor del dólar oficial no disponible.'
    });
  }

  const usd = round2(data.usd);

  return res.json({
    success: true,
    currency: 'USD',
    symbol: '$',
    price_bs: usd,
    base_currency: 'VES',
    date: data.date,
    source: 'Banco Central de Venezuela (BCV)'
  });
}

// GET /api/v1/euro
async function getEuro(req, res) {
  const data = await getExchangeRates();

  if (!data.eur) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Valor del euro oficial no disponible.'
    });
  }

  const eur = round2(data.eur);

  return res.json({
    success: true,
    currency: 'EUR',
    symbol: '€',
    price_bs: eur,
    base_currency: 'VES',
    date: data.date,
    source: 'Banco Central de Venezuela (BCV)'
  });
}

// GET /api/v1/usdt
async function getUsdt(req, res) {
  const data = await getExchangeRates();
  const usdt = round2(data.usdt) || round2((data.usd || 813.74) * 1.175);

  return res.json({
    success: true,
    currency: 'USDT',
    symbol: '₮',
    price_bs: usdt,
    base_currency: 'VES',
    date: data.date,
    source: 'Binance P2P & Mercado Paralelo'
  });
}

// GET /api/v1/convert?amount=100&from=USD&to=VES
async function convertCurrency(req, res) {
  const { amount, from = 'USD', to = 'VES' } = req.query;

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'BadRequest',
      message: 'El parámetro "amount" debe ser un número positivo válido.'
    });
  }

  const fromCurr = from.toUpperCase();
  const toCurr = to.toUpperCase();

  const data = await getExchangeRates();
  if (!data.usd || !data.eur) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Tasas de cambio no disponibles para conversión.'
    });
  }

  const usd = round2(data.usd);
  const eur = round2(data.eur);
  const usdt = round2(data.usdt) || round2(usd * 1.175);

  // Mapear tasas a VES
  const ratesToVes = {
    USD: usd,
    EUR: eur,
    USDT: usdt,
    VES: 1
  };

  if (!ratesToVes[fromCurr] || !ratesToVes[toCurr]) {
    return res.status(400).json({
      success: false,
      error: 'UnsupportedConversion',
      message: `Conversión no soportada entre ${fromCurr} y ${toCurr}. Monedas válidas: USD, EUR, USDT, VES.`
    });
  }

  let rate = 1;
  if (fromCurr === toCurr) {
    rate = 1;
  } else if (toCurr === 'VES') {
    rate = ratesToVes[fromCurr];
  } else if (fromCurr === 'VES') {
    rate = 1 / ratesToVes[toCurr];
  } else {
    // Cruce de divisas: por ejemplo USD a EUR, USDT a USD, etc.
    rate = ratesToVes[fromCurr] / ratesToVes[toCurr];
  }

  const result = round2(numAmount * rate);

  return res.json({
    success: true,
    amount: round2(numAmount),
    from: fromCurr,
    to: toCurr,
    rate: round2(rate),
    result: result,
    date: data.date,
    source: 'BCV & Binance P2P'
  });
}

// GET /api/v1/historico?startDate=2026-01-01&endDate=2026-01-31&limit=30
async function getHistoricalRates(req, res) {
  try {
    const { startDate, endDate, limit = 30 } = req.query;
    const apiKeyDoc = req.apiKeyDoc;
    const userPlan = apiKeyDoc ? apiKeyDoc.plan : 'free';
    const planConfig = PLANS[userPlan] || PLANS.free;

    const maxDaysAllowed = planConfig.historyDays || 30;

    const query = {};

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    }

    const maxLimit = Math.min(parseInt(limit) || 30, 365);

    const history = await ExchangeRate.find(query)
      .sort({ fetchedAt: -1 })
      .limit(maxLimit)
      .select('date sourceDateString rates baseCurrency fetchedAt -_id');

    return res.json({
      success: true,
      plan: userPlan,
      count: history.length,
      history
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error consultando histórico de tasas.'
    });
  }
}

module.exports = {
  getTipoCambio,
  getDolar,
  getEuro,
  getUsdt,
  convertCurrency,
  getHistoricalRates
};
