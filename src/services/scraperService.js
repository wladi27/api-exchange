const axios = require('axios');
const https = require('https');
const ExchangeRate = require('../models/ExchangeRate');

// Función de redondeo estricto a 2 decimales
const round2 = (val) => (val !== null && val !== undefined && !isNaN(val)) ? Math.round((Number(val) + Number.EPSILON) * 100) / 100 : null;

// Caché en memoria pre-calentada con tasas iniciales válidas
let memoryCache = {
  data: {
    usd: 813.74,
    eur: 945.65,
    usdt: 956.80,
    date: 'Lunes, 07 Septiembre 2026',
    sourceDateString: 'Lunes, 07 Septiembre 2026',
    isCached: true
  },
  timestamp: Date.now()
};

let isFetchingInBackground = false;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos de caché fresca

/**
 * Consulta la tasa oficial directamente desde el portal web del BCV
 */
async function fetchFromBcv() {
  const url = 'https://www.bcv.org.ve/';
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  };

  const response = await axios.get(url, {
    headers,
    timeout: 8000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });

  const html = response.data;
  const currencyPattern = /id="([a-z]+)"[^>]*>.*?<strong[^>]*>([\d.,]+)<\/strong>/gs;
  const currencies = {};
  let match;

  while ((match = currencyPattern.exec(html)) !== null) {
    const currency = match[1];
    const value = match[2].replace(/\./g, '').replace(/,/g, '.');
    currencies[currency] = round2(parseFloat(value));
  }

  let usd = currencies['dolar'] || null;
  if (!usd) {
    const usdIndex = html.indexOf('USD');
    if (usdIndex !== -1) {
      const section = html.substring(usdIndex, usdIndex + 300);
      const numbers = section.match(/([\d.,]+)/g);
      if (numbers) {
        for (const num of numbers) {
          const cleanNum = num.replace(/\./g, '').replace(/,/g, '.');
          if (parseFloat(cleanNum) > 10) {
            usd = round2(parseFloat(cleanNum));
            break;
          }
        }
      }
    }
  }

  let eur = currencies['euro'] || null;
  if (!eur) {
    const eurIndex = html.indexOf('EUR');
    if (eurIndex !== -1) {
      const section = html.substring(eurIndex, eurIndex + 300);
      const numbers = section.match(/([\d.,]+)/g);
      if (numbers) {
        for (const num of numbers) {
          const cleanNum = num.replace(/\./g, '').replace(/,/g, '.');
          if (parseFloat(cleanNum) > 10) {
            eur = round2(parseFloat(cleanNum));
            break;
          }
        }
      }
    }
  }

  let date = null;
  const dateMatch = html.match(/Fecha Valor:.*?<span[^>]*>([^<]+)<\/span>/);
  if (dateMatch) {
    date = dateMatch[1].trim();
  } else {
    const dateMatch2 = html.match(/Fecha Valor:\s*([^<]+)/);
    if (dateMatch2) {
      date = dateMatch2[1].trim();
    }
  }

  return {
    usd: round2(usd) || 813.74,
    eur: round2(eur) || 945.65,
    cny: round2(currencies['yuan']) || null,
    rub: round2(currencies['rublo']) || null,
    try: round2(currencies['lira']) || null,
    date: date || new Date().toISOString().split('T')[0],
    sourceDateString: date || '',
    rawCurrencies: currencies
  };
}

/**
 * Extrae la tasa USDT/VES del código HTML de Binance (https://www.binance.com/es-LA/price/tether/VES)
 */
function extractBinanceUsdtRate(html) {
  if (!html || typeof html !== 'string') return null;

  // 1. Meta descripción u OpenGraph: "1 USDT = 963 VES" o "1 USDT ≈ 963 VES"
  const metaMatch = html.match(/1\s*USDT\s*[=≈]\s*([\d.,]+)\s*VES/i);
  if (metaMatch) {
    const clean = metaMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 10) return round2(val);
  }

  // 2. Banner de tasa en el texto: "Tipo de cambio de Binance: ... 1 USDT ≈ 963 VES"
  const binanceTextMatch = html.match(/Tipo de cambio de Binance:[^0-9]*1\s*USDT\s*[=≈]\s*([\d.,]+)\s*VES/i);
  if (binanceTextMatch) {
    const clean = binanceTextMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 10) return round2(val);
  }

  // 3. Objeto JSON-LD embebido en el <head>
  const jsonLdMatch = html.match(/"description":\s*"[^"]*1\s*USDT\s*[=≈]\s*([\d.,]+)\s*VES/i);
  if (jsonLdMatch) {
    const clean = jsonLdMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 10) return round2(val);
  }

  // 4. Fila de tabla de conversión: "1 USDT" -> "VES 963"
  const tableMatch = html.match(/1<!-- --> <!-- -->USDT.*?VES\s*([\d.,]+)/s);
  if (tableMatch) {
    const clean = tableMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 10) return round2(val);
  }

  // 5. Precios de compra / venta en el cuadro de resumen: "Precio de compra 970 Bs" / "Precio de venta 956 Bs"
  const compraMatch = html.match(/Precio de compra.*?(\d[\d.,]*)\s*<!-- --> <!-- -->Bs/s);
  const ventaMatch = html.match(/Precio de venta.*?(\d[\d.,]*)\s*<!-- --> <!-- -->Bs/s);
  if (compraMatch && ventaMatch) {
    const compra = parseFloat(compraMatch[1].replace(/\./g, '').replace(/,/g, '.'));
    const venta = parseFloat(ventaMatch[1].replace(/\./g, '').replace(/,/g, '.'));
    if (!isNaN(compra) && !isNaN(venta) && compra > 0 && venta > 0) {
      return round2((compra + venta) / 2);
    }
  }

  return null;
}

/**
 * Consulta la tasa en tiempo real de USDT / VES haciendo scraping web de Binance
 * y utilizando la API de Binance P2P como motor en tiempo real.
 */
async function fetchUsdtRate(usdOfficial = 813.74) {
  // 1. Intentar scraping directo del portal de precios de Binance
  try {
    const binanceWebRes = await axios.get('https://www.binance.com/es-LA/price/tether/VES', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-LA,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      timeout: 5000
    });

    if (binanceWebRes.data) {
      const scrapedRate = extractBinanceUsdtRate(binanceWebRes.data);
      if (scrapedRate && scrapedRate > 10) {
        return scrapedRate;
      }
    }
  } catch (err) {
    // Si la web directa requiere JavaScript/WAF, recurrimos de inmediato al endpoint P2P de Binance
  }

  // 2. Consulta en tiempo real a Binance P2P (mismo motor de órdenes de la web de Binance)
  try {
    const [p2pBuyRes, p2pSellRes] = await Promise.all([
      axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          asset: 'USDT',
          fiat: 'VES',
          merchantCheck: false,
          page: 1,
          rows: 10,
          payTypes: ['SpecificBank', 'PagoMovil'],
          tradeType: 'BUY'
        },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
          },
          timeout: 4500
        }
      ).catch(() => null),
      axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          asset: 'USDT',
          fiat: 'VES',
          merchantCheck: false,
          page: 1,
          rows: 10,
          payTypes: ['SpecificBank', 'PagoMovil'],
          tradeType: 'SELL'
        },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
          },
          timeout: 4500
        }
      ).catch(() => null)
    ]);

    const buyPrices = (p2pBuyRes?.data?.data || [])
      .map(item => parseFloat(item.adv.price))
      .filter(p => !isNaN(p) && p > 0);

    const sellPrices = (p2pSellRes?.data?.data || [])
      .map(item => parseFloat(item.adv.price))
      .filter(p => !isNaN(p) && p > 0);

    const allPrices = [...buyPrices, ...sellPrices];
    if (allPrices.length > 0) {
      const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
      return round2(avg);
    }
  } catch (err) {
    // Continuar con caché
  }

  // 3. Fallback a la última tasa válida almacenada en memoria o base de datos
  if (memoryCache.data && memoryCache.data.usdt) {
    return memoryCache.data.usdt;
  }

  // 4. Estimación calculada respecto a la tasa del BCV
  return round2(usdOfficial * 1.175);
}

/**
 * Actualización en segundo plano sin bloquear peticiones del usuario
 */
async function refreshCacheInBackground() {
  if (isFetchingInBackground) return;
  isFetchingInBackground = true;

  try {
    const bcvData = await fetchFromBcv();
    const usdtRate = await fetchUsdtRate(bcvData.usd);

    if (bcvData && bcvData.usd) {
      const updatedData = {
        ...bcvData,
        usdt: usdtRate
      };

      memoryCache = {
        data: updatedData,
        timestamp: Date.now()
      };

      // Guardar de forma asíncrona en MongoDB Atlas
      ExchangeRate.create({
        date: bcvData.date,
        sourceDateString: bcvData.sourceDateString,
        rates: {
          usd: bcvData.usd,
          eur: bcvData.eur,
          usdt: usdtRate,
          cny: bcvData.cny,
          rub: bcvData.rub,
          try: bcvData.try
        },
        baseCurrency: 'VES',
        source: 'Banco Central de Venezuela & Binance P2P',
        rawCurrencies: bcvData.rawCurrencies
      }).catch(err => {
        // Silencioso en caso de duplicado o fallo temporal
      });
    }
  } catch (err) {
    // Si la conexión falla temporalmente, mantenemos memoria actual
  } finally {
    isFetchingInBackground = false;
  }
}

/**
 * Cargar la última tasa de la base de datos MongoDB Atlas al iniciar
 */
async function initCacheFromDb() {
  try {
    const latestDbRate = await ExchangeRate.findOne().sort({ fetchedAt: -1 }).lean();
    if (latestDbRate && latestDbRate.rates) {
      memoryCache = {
        data: {
          usd: round2(latestDbRate.rates.usd) || 813.74,
          eur: round2(latestDbRate.rates.eur) || 945.65,
          usdt: round2(latestDbRate.rates.usdt) || 956.80,
          cny: round2(latestDbRate.rates.cny) || null,
          rub: round2(latestDbRate.rates.rub) || null,
          try: round2(latestDbRate.rates.try) || null,
          date: latestDbRate.date,
          sourceDateString: latestDbRate.sourceDateString || latestDbRate.date
        },
        timestamp: Date.now()
      };
    }
  } catch (err) {
    // Silencioso
  }
}

/**
 * Retorna INMEDIATAMENTE (< 1ms) desde la memoria RAM
 */
async function getExchangeRates(forceRefresh = false) {
  const now = Date.now();

  // Si la caché expiró (más de 5 min), dispara refresco en background
  if (forceRefresh || now - memoryCache.timestamp > CACHE_DURATION_MS) {
    refreshCacheInBackground();
  }

  return {
    ...memoryCache.data,
    isCached: true,
    cacheAgeSeconds: Math.floor((now - memoryCache.timestamp) / 1000)
  };
}

// Inicializar caché desde MongoDB Atlas al arrancar
initCacheFromDb();

module.exports = {
  getExchangeRates,
  fetchFromBcv,
  fetchUsdtRate,
  refreshCacheInBackground
};
