# @dolar-api/sdk

> Librería cliente oficial en TypeScript y Node.js para interactuar con la plataforma Dolar API y consultar las tasas oficiales del Banco Central de Venezuela (BCV).

[![npm version](https://img.shields.io/npm/v/@dolar-api/sdk.svg)](https://www.npmjs.com/package/@dolar-api/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Instalación

```bash
npm install @dolar-api/sdk
# o mediante pnpm / yarn / bun:
pnpm add @dolar-api/sdk
yarn add @dolar-api/sdk
bun add @dolar-api/sdk
```

---

## Inicio Rápido

```typescript
import { DolarApiClient, AuthenticationError, RateLimitError, QuotaExceededError } from '@dolar-api/sdk';

// 1. Inicializar el cliente con tu API Key
const client = new DolarApiClient({
  apiKey: process.env.DOLAR_API_KEY || 'bcv_live_tu_clave_aqui',
  timeout: 5000,    // Tiempo de espera en milisegundos
  maxRetries: 3     // Reintentos automáticos ante fallos de red
});

async function main() {
  try {
    // 2. Obtener todas las tasas vigentes oficiales del BCV (USD y EUR a 2 decimales)
    const { prices, date, source } = await client.getRates();
    console.log('Fuente Oficial:', source);
    console.log('Fecha Valor:', date);
    console.log('Dólar Oficial (USD):', prices.usd_bs.toFixed(2), 'VES');
    console.log('Euro Oficial (EUR):', prices.eur_bs.toFixed(2), 'VES');

    // 3. Conversión directa y exacta entre divisas
    const conversion = await client.convert({
      amount: 150.00,
      from: 'USD',
      to: 'VES'
    });
    console.log('Resultado de Conversión:', {
      montoOriginal: `${conversion.amount.toFixed(2)} ${conversion.from}`,
      tasaAplicada: `${conversion.rate.toFixed(2)} VES`,
      totalCalculado: `${conversion.result.toFixed(2)} ${conversion.to}`
    });

    // 4. Consultar registros históricos
    const history = await client.getHistoricalRates({
      startDate: '2026-01-01',
      limit: 10
    });
    console.log(`Registros históricos obtenidos: ${history.count}`);

  } catch (error) {
    // 5. Manejo tipado de excepciones
    if (error instanceof AuthenticationError) {
      console.error('Error de autenticación: Verifica tu API Key.');
    } else if (error instanceof QuotaExceededError) {
      console.error(`Cuota mensual alcanzada para el plan ${error.plan}.`);
    } else if (error instanceof RateLimitError) {
      console.warn(`Límite por minuto alcanzado. Reintentar en ${error.retryAfterSeconds} segundos.`);
    } else {
      console.error('Error inesperado en la petición:', error);
    }
  }
}

main();
```

---

## Manejo de Errores Tipados

El SDK exporta clases de error específicas para un control determinista en producción:

```typescript
import {
  DolarApiClient,
  AuthenticationError,
  RateLimitError,
  QuotaExceededError,
  DolarApiError
} from '@dolar-api/sdk';

try {
  const rates = await client.getRates();
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Código 401: Clave no válida o revocada
    console.error('Credenciales no autorizadas.');
  } else if (error instanceof QuotaExceededError) {
    // Código 429: Cuota mensual del plan agotada
    console.error(`Has alcanzado el límite mensual de tu suscripción.`);
  } else if (error instanceof RateLimitError) {
    // Código 429: Límite de peticiones por minuto alcanzado
    console.warn(`Reintenta en ${error.retryAfterSeconds} segundos.`);
  } else if (error instanceof DolarApiError) {
    // Otros errores HTTP con código de estado
    console.error(`Error HTTP ${error.statusCode}: ${error.message}`);
  } else {
    // Fallo de red o timeout
    console.error('Error de conexión:', error);
  }
}
```

---

## Opciones de Configuración

| Propiedad | Tipo | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | **Requerido** | Tu API Key (`bcv_live_...` o `bcv_test_...`) |
| `baseUrl` | `string` | `'http://localhost:3003'` | URL base de la API |
| `timeout` | `number` | `10000` | Tiempo máximo de espera por petición en milisegundos |
| `maxRetries` | `number` | `3` | Número de reintentos automáticos ante fallas transitorias de red o errores 5xx |

---

## Licencia

MIT © Dolar API
