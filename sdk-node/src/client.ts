import {
  DolarClientOptions,
  ExchangeRatesResponse,
  SingleCurrencyResponse,
  ConvertOptions,
  ConvertResponse,
  HistoricalRatesOptions,
  HistoricalRatesResponse
} from './types';
import {
  DolarApiError,
  AuthenticationError,
  RateLimitError,
  QuotaExceededError
} from './errors';

export class DolarApiClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: DolarClientOptions) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error('Debe proporcionar una API Key válida para instanciar DolarApiClient.');
    }

    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl || 'http://localhost:3003').replace(/\/+$/, '');
    this.timeout = options.timeout || 10000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  private async request<T>(endpoint: string, queryParams?: Record<string, any>): Promise<T> {
    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (queryParams) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Api-Key': this.apiKey,
            'Accept': 'application/json',
            'User-Agent': '@dolar-api/sdk-node/1.0.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data: any = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
          return data as T;
        }

        // Manejo específico de errores HTTP
        if (response.status === 401) {
          throw new AuthenticationError(data.message || 'API Key no válida o revocada.');
        }

        if (response.status === 429) {
          if (data.error === 'MonthlyQuotaExceeded') {
            throw new QuotaExceededError(data.message, data.quota, data.plan);
          }
          const retryAfter = data.retry_after_seconds ? parseInt(data.retry_after_seconds) : undefined;
          throw new RateLimitError(data.message || 'Límite de velocidad excedido.', retryAfter);
        }

        if (response.status >= 500 && attempt <= this.maxRetries) {
          // Reintento exponencial para 5xx
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 200, 5000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw new DolarApiError(
          data.message || `Error en la petición: ${response.statusText}`,
          response.status,
          data.error || 'ApiError',
          data
        );
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (
          err instanceof AuthenticationError ||
          err instanceof RateLimitError ||
          err instanceof QuotaExceededError
        ) {
          throw err;
        }

        lastError = err;

        if (attempt <= this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 200, 5000);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new DolarApiError('Fallo de conexión tras varios reintentos.', 500);
  }

  /**
   * Obtiene todas las tasas oficiales vigentes (USD, EUR, CNY, RUB, etc.)
   */
  public async getRates(): Promise<ExchangeRatesResponse> {
    return this.request<ExchangeRatesResponse>('/api/v1/tipo-cambio');
  }

  /**
   * Obtiene la tasa oficial del Dólar (USD) en Bolívares
   */
  public async getUsd(): Promise<SingleCurrencyResponse> {
    return this.request<SingleCurrencyResponse>('/api/v1/dolar');
  }

  /**
   * Obtiene la tasa oficial del Euro (EUR) en Bolívares
   */
  public async getEur(): Promise<SingleCurrencyResponse> {
    return this.request<SingleCurrencyResponse>('/api/v1/euro');
  }

  /**
   * Convierte un monto entre USD, EUR y VES al tipo de cambio oficial
   */
  public async convert(options: ConvertOptions): Promise<ConvertResponse> {
    return this.request<ConvertResponse>('/api/v1/convert', options);
  }

  /**
   * Consulta el histórico de tasas según el plan contratado
   */
  public async getHistoricalRates(options?: HistoricalRatesOptions): Promise<HistoricalRatesResponse> {
    return this.request<HistoricalRatesResponse>('/api/v1/historico', options);
  }
}
