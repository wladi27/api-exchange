export interface DolarClientOptions {
  /**
   * Tu API Key de la plataforma (ej. bcv_live_... o bcv_test_...)
   */
  apiKey: string;

  /**
   * URL base de la API (por defecto: 'http://localhost:3003' o tu dominio en producción)
   */
  baseUrl?: string;

  /**
   * Tiempo máximo de espera por petición en milisegundos (por defecto: 10000ms)
   */
  timeout?: number;

  /**
   * Número máximo de reintentos automáticos ante fallos transitorios de red o 5xx (por defecto: 3)
   */
  maxRetries?: number;
}

export interface PricesMap {
  usd_bs: number;
  eur_bs: number;
  cny_bs?: number;
  rub_bs?: number;
  try_bs?: number;
}

export interface ExchangeRatesResponse {
  success: boolean;
  source: string;
  base_currency: string;
  date: string;
  prices: PricesMap;
  is_cached?: boolean;
}

export interface SingleCurrencyResponse {
  success: boolean;
  currency: 'USD' | 'EUR';
  symbol: string;
  price_bs: number;
  base_currency: string;
  date: string;
  source: string;
}

export interface ConvertOptions {
  amount: number;
  from: 'USD' | 'EUR' | 'VES';
  to: 'USD' | 'EUR' | 'VES';
}

export interface ConvertResponse {
  success: boolean;
  amount: number;
  from: string;
  to: string;
  rate: number;
  result: number;
  date: string;
  source: string;
}

export interface HistoricalRatesOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface HistoricalRateItem {
  date: string;
  sourceDateString?: string;
  rates: {
    usd: number;
    eur: number;
    cny?: number;
    rub?: number;
    try?: number;
  };
  baseCurrency: string;
  fetchedAt?: string;
}

export interface HistoricalRatesResponse {
  success: boolean;
  plan: string;
  count: number;
  history: HistoricalRateItem[];
}
