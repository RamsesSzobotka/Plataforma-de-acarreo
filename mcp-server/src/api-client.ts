/**
 * Cliente HTTP para comunicarse con el backend de la Plataforma de Acarreos.
 * Maneja autenticación, errores y retry.
 */

import { httpErrorToMcpError, McpError } from './errors';

interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 10_000;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return this.request<T>(url.toString(), { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(url: string, options: { method: string; body?: string }): Promise<T> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: options.method,
          headers: this.getHeaders(),
          body: options.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseBody = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw httpErrorToMcpError(response.status, responseBody);
        }

        return responseBody as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof McpError) {
          if (!error.retryable) throw error;
          // Solo reintentar si es retryable
        }

        // Si no es recuperable, lanzar inmediatamente
        if (error instanceof McpError && !error.retryable) {
          throw error;
        }

        // Backoff exponencial
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new McpError(
      'BACKEND_UNAVAILABLE',
      `No se pudo conectar con el backend después de ${maxRetries + 1} intentos`,
      503,
      true,
    );
  }
}
