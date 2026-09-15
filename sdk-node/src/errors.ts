export class DolarApiError extends Error {
  public statusCode: number;
  public errorType: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, errorType: string = 'ApiError', details?: any) {
    super(message);
    this.name = 'DolarApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.details = details;
    Object.setPrototypeOf(this, DolarApiError.prototype);
  }
}

export class AuthenticationError extends DolarApiError {
  constructor(message: string = 'API Key inválida, inactiva o revocada.') {
    super(message, 401, 'Unauthorized');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends DolarApiError {
  public retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message, 429, 'TooManyRequests');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class QuotaExceededError extends DolarApiError {
  public quota?: number;
  public plan?: string;

  constructor(message: string, quota?: number, plan?: string) {
    super(message, 429, 'MonthlyQuotaExceeded');
    this.name = 'QuotaExceededError';
    this.quota = quota;
    this.plan = plan;
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}
