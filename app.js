const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

// Habilitar CORS
app.use(cors());
app.use(express.json());

const PORT = 5001;

// Cache configuration
let cache = {
    data: null,
    timestamp: 0
};
const CACHE_DURATION = 300000; // 5 minutes

// Function to fetch prices from BCV
async function getBcvPrices() {
    const now = Date.now();

    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
        console.log('Using cached data');
        return cache.data;
    }

    console.log('Connecting to BCV...');

    try {
        const response = await axios.get('https://www.bcv.org.ve/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'es-ES,es;q=0.8'
            },
            timeout: 10000,
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false
            })
        });

        const html = response.data;

        // Extract all currencies
        const currencyPattern = /id="([a-z]+)"[^>]*>.*?<strong[^>]*>([\d.,]+)<\/strong>/gs;
        const currencies = {};
        let match;

        while ((match = currencyPattern.exec(html)) !== null) {
            const currency = match[1];
            const value = match[2].replace(/\./g, '').replace(/,/g, '.');
            currencies[currency] = parseFloat(value);
        }

        console.log('Currencies found:', currencies);

        // Get USD
        let usd = currencies['dolar'] || null;
        if (!usd) {
            const usdIndex = html.indexOf('USD');
            if (usdIndex !== -1) {
                const section = html.substring(usdIndex, usdIndex + 300);
                const numbers = section.match(/([\d.,]+)/g);
                if (numbers) {
                    for (const num of numbers) {
                        const cleanNum = num.replace(/\./g, '').replace(/,/g, '.');
                        if (parseFloat(cleanNum) > 100) {
                            usd = parseFloat(cleanNum);
                            break;
                        }
                    }
                }
            }
        }

        // Get EUR
        let eur = null;
        if (currencies['euro'] && currencies['euro'] > 100) {
            eur = currencies['euro'];
        } else {
            const eurIndex = html.indexOf('EUR');
            if (eurIndex !== -1) {
                const section = html.substring(eurIndex, eurIndex + 300);
                const numbers = section.match(/([\d.,]+)/g);
                if (numbers) {
                    for (const num of numbers) {
                        const cleanNum = num.replace(/\./g, '').replace(/,/g, '.');
                        if (parseFloat(cleanNum) > 100) {
                            eur = parseFloat(cleanNum);
                            break;
                        }
                    }
                }
            }
        }

        // Get date
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

        const result = { usd, eur, date };

        // Update cache
        cache.data = result;
        cache.timestamp = now;

        console.log(`Data updated: USD=${usd}, EUR=${eur}`);
        return result;

    } catch (error) {
        console.error('Error:', error.message);
        if (cache.data) {
            console.log('Using expired cache due to error');
            return cache.data;
        }
        return { usd: null, eur: null, date: null };
    }
}

// API Routes - Version 1
app.get('/api/v1/tipo-cambio', async (req, res) => {
    console.log('Request received to /api/v1/tipo-cambio');
    const { usd, eur, date } = await getBcvPrices();

    if (usd === null || eur === null) {
        return res.status(404).json({
            success: false,
            message: 'Unable to fetch data from BCV',
            error: 'Currency values not found'
        });
    }

    res.json({
        success: true,
        version: 'v1',
        date: date,
        prices: {
            usd_bs: usd,
            eur_bs: eur
        },
        source: 'Banco Central de Venezuela',
        base_currency: 'Bolivar (Bs.)'
    });
});

app.get('/api/v1/dolar', async (req, res) => {
    const { usd } = await getBcvPrices();

    if (usd === null) {
        return res.status(404).json({
            success: false,
            message: 'USD value not found'
        });
    }

    res.json({
        success: true,
        version: 'v1',
        currency: 'USD',
        price_bs: usd,
        base_currency: 'Bolivar (Bs.)'
    });
});

app.get('/api/v1/euro', async (req, res) => {
    const { eur } = await getBcvPrices();

    if (eur === null) {
        return res.status(404).json({
            success: false,
            message: 'EUR value not found'
        });
    }

    res.json({
        success: true,
        version: 'v1',
        currency: 'EUR',
        price_bs: eur,
        base_currency: 'Bolivar (Bs.)'
    });
});

app.get('/api/v1/debug', async (req, res) => {
    try {
        const response = await axios.get('https://www.bcv.org.ve/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000,
            httpsAgent: new (require('https').Agent)({
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
            currencies[currency] = parseFloat(value);
        }

        res.json({
            success: true,
            currencies_by_id: currencies,
            html_length: html.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Documentation UI
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs.html'));
});

// Redirect root to docs
app.get('/', (req, res) => {
    res.redirect('/docs');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('BCV Exchange Rate API');
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Documentation: http://localhost:${PORT}/docs`);
    console.log(`API: http://localhost:${PORT}/api/v1/tipo-cambio`);
    console.log('='.repeat(60));
    console.log('CORS enabled - Accessible from any domain');
    console.log('='.repeat(60));
});