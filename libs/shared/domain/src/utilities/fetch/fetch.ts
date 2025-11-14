export type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, any>;
  headers?: Record<string, string>;
  baseUrl?: string;
};

export class Fetch {
  private static defaultHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('AccessToken')}` };
  }

  public static async request<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, baseUrl = '' } = options;

    const finalUrl = baseUrl ? `${baseUrl}${url}` : url;
    const finalHeaders = { ...this.defaultHeaders(), ...headers };

    const fetchOptions: RequestInit = { method, headers: finalHeaders };

    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return (await fetch(finalUrl, fetchOptions)).json();
  }

  public static async get<T = any>(url: string, options: Omit<FetchOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  public static async post<T = any>(
    url: string,
    body?: Record<string, any>,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  public static async put<T = any>(
    url: string,
    body?: Record<string, any>,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  public static async delete<T = any>(url: string, options: Omit<FetchOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  public static async patch<T>(
    url: string,
    body?: Record<string, any>,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }
}

export const $fetch = Fetch;
