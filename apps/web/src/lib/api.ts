import type { ApiError, ApiResponse } from '@talento/shared';

const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1';

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
/** Called when the session can no longer be recovered. */
let onUnauthenticated: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** True when the failure is a validation error with per-field details. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as Array<{ path?: string; message?: string }>)
        .filter((issue) => issue.path)
        .map((issue) => [issue.path as string, issue.message ?? 'Dato invalido']),
    );
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, unknown>;
  /** Skips the automatic refresh retry (used by the refresh call itself). */
  skipRefresh?: boolean;
  raw?: boolean;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(API_BASE + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!response.ok) return false;
        const payload = (await response.json()) as ApiResponse<{ accessToken: string }>;
        accessToken = payload.data.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        // Let the next failure start a fresh attempt.
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, skipRefresh, raw, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> =>
    fetch(buildUrl(path, query), {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await doFetch();

  if (response.status === 401 && !skipRefresh) {
    const recovered = await refreshSession();
    if (recovered) {
      response = await doFetch();
    } else {
      onUnauthenticated?.();
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    let payload: Partial<ApiError> = {};
    if (contentType.includes('application/json')) {
      payload = (await response.json().catch(() => ({}))) as Partial<ApiError>;
    }
    throw new ApiRequestError(
      response.status,
      payload.code ?? 'HTTP_ERROR',
      payload.message ?? 'No fue posible completar la operacion',
      payload.details,
    );
  }

  if (raw || !contentType.includes('application/json')) {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}

/** Unwraps the `{ data }` envelope. */
export async function apiGet<T>(path: string, query?: Record<string, unknown>): Promise<T> {
  const payload = await request<ApiResponse<T>>(path, { method: 'GET', query });
  return payload.data;
}

/** Keeps `{ data, meta }` for paginated listings. */
export async function apiList<T>(
  path: string,
  query?: Record<string, unknown>,
): Promise<ApiResponse<T[]>> {
  return request<ApiResponse<T[]>>(path, { method: 'GET', query });
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<T> {
  const payload = await request<ApiResponse<T>>(path, { method: 'POST', body, query });
  return payload?.data as T;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const payload = await request<ApiResponse<T>>(path, { method: 'PATCH', body });
  return payload?.data as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const payload = await request<ApiResponse<T>>(path, { method: 'DELETE' });
  return payload?.data as T;
}

/** Downloads a CSV or binary export and triggers the browser save dialog. */
export async function apiDownload(
  path: string,
  filename: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<void> {
  const response = await fetch(buildUrl(path), {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok)
    throw new ApiRequestError(
      response.status,
      'DOWNLOAD_ERROR',
      'No fue posible descargar el archivo',
    );

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Uploads a file through a pre-signed URL and confirms it with the API. */
export async function uploadFile(
  file: File,
  options: {
    entityType?: string;
    entityId?: string;
    visibility?: 'private' | 'company' | 'public';
  } = {},
): Promise<{ fileId: string }> {
  const presign = await apiPost<{
    fileId: string;
    url: string;
    method: 'PUT' | 'POST';
    headers: Record<string, string>;
  }>('/files/presign', {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    visibility: options.visibility ?? 'private',
    entityType: options.entityType ?? null,
    entityId: options.entityId ?? null,
  });

  const uploadResponse = await fetch(presign.url, {
    method: presign.method,
    headers: presign.headers,
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new ApiRequestError(
      uploadResponse.status,
      'UPLOAD_FAILED',
      'No fue posible subir el archivo',
    );
  }

  await apiPost(`/files/${presign.fileId}/confirm`, {});
  return { fileId: presign.fileId };
}

/**
 * Uploads an attachment from a portal that runs without a session (careers,
 * ethics hotline). The MIME allow-list and the size quota are enforced again
 * server side; nothing here identifies the visitor.
 */
export async function uploadPublicFile(
  companySlug: string,
  file: File,
): Promise<{ fileId: string }> {
  const presign = await apiPost<{
    fileId: string;
    url: string;
    method: 'PUT' | 'POST';
    headers: Record<string, string>;
  }>(`/public/${companySlug}/uploads`, {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  });

  const uploadResponse = await fetch(presign.url, {
    method: presign.method,
    headers: presign.headers,
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new ApiRequestError(
      uploadResponse.status,
      'UPLOAD_FAILED',
      'No fue posible subir el archivo',
    );
  }

  await apiPost(`/public/${companySlug}/uploads/${presign.fileId}/confirm`, {});
  return { fileId: presign.fileId };
}
