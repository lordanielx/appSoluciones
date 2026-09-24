import type { AuthResponse } from '@meca/shared';
import { ApiError, NetworkError } from './errors';

export const API_BASE = '/api/v1';
const CSRF_HEADERS = { 'X-Requested-With': 'meca-web' };

type Listener = (session: AuthResponse | null) => void;

/**
 * Cliente HTTP. El access token vive solo en memoria (nunca en localStorage);
 * el refresh token es una cookie HttpOnly que el navegador envía a /api/v1/auth.
 */
class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<AuthResponse | null> | null = null;
  private listeners = new Set<Listener>();

  onSessionChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setSession(session: AuthResponse | null) {
    this.accessToken = session?.accessToken ?? null;
    this.listeners.forEach((l) => l(session));
  }

  hasToken() {
    return this.accessToken !== null;
  }

  /** Renueva el access token; varias llamadas concurrentes comparten la misma solicitud. */
  refresh(): Promise<AuthResponse | null> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<AuthResponse | null> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: CSRF_HEADERS });
    } catch {
      throw new NetworkError();
    }
    if (!res.ok) {
      this.setSession(null);
      return null;
    }
    const session = (await res.json()) as AuthResponse;
    this.setSession(session);
    return session;
  }

  async request<T>(path: string, init: RequestInit & { json?: unknown; retry?: boolean } = {}): Promise<T> {
    const { json, retry = true, headers, ...rest } = init;
    const h = new Headers(headers);
    if (json !== undefined) h.set('Content-Type', 'application/json');
    if (this.accessToken) h.set('Authorization', `Bearer ${this.accessToken}`);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        ...rest,
        headers: h,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
    } catch {
      throw new NetworkError();
    }
    if (res.status === 401 && retry && !path.startsWith('/auth/')) {
      const session = await this.refresh();
      if (session) return this.request<T>(path, { ...init, retry: false });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw ApiError.fromBody(res.status, body);
    }
    if (res.status === 204) return undefined as T;
    const type = res.headers.get('content-type') ?? '';
    return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>;
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | string[]>) {
    return this.request<T>(params ? `${path}?${toQuery(params)}` : path);
  }
  post<T>(path: string, json?: unknown) {
    return this.request<T>(path, { method: 'POST', json: json ?? {} });
  }
  patch<T>(path: string, json: unknown) {
    return this.request<T>(path, { method: 'PATCH', json });
  }
  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
  upload<T>(path: string, form: FormData) {
    return this.request<T>(path, { method: 'POST', body: form });
  }
  csrfPost<T>(path: string) {
    return this.request<T>(path, { method: 'POST', headers: CSRF_HEADERS, retry: false });
  }
}

export function toQuery(params: Record<string, string | number | boolean | undefined | string[]>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, String(v));
  }
  return q.toString();
}

export const api = new ApiClient();
