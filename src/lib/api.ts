/**
 * Thin fetch wrapper for the ENDOCON API.
 * - Sends the session cookie (credentials: 'include').
 * - Adds the CSRF token to every state-changing request.
 * - Unwraps the { success, message, data } envelope and throws ApiError otherwise.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api';

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Reviewer (judge) portal: separate session → its own CSRF token and 401 handling. */
let reviewerCsrfToken: string | null = null;
export function setReviewerCsrfToken(token: string | null): void {
  reviewerCsrfToken = token;
}
let onReviewerUnauthorized: (() => void) | null = null;
export function setReviewerUnauthorizedHandler(fn: (() => void) | null): void {
  onReviewerUnauthorized = fn;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Delivery result of an email the request sent (see the backend's email tracker). */
export interface EmailDelivery {
  to?: string;
  type?: string;
  status: 'sent' | 'failed' | 'retrying' | 'scheduled' | 'queued' | 'skipped';
  error?: string;
}

export interface ApiResult<T> {
  data: T;
  message: string;
  /** Present when the request sent emails: whether each one was sent or failed. */
  emails?: EmailDelivery[];
}

/** Surfaces email problems in the browser console (the reply itself has the details). */
function reportEmails(path: string, emails?: EmailDelivery[]) {
  const problems = emails?.filter((e) => e.status === 'failed' || e.status === 'retrying');
  if (problems?.length) console.warn(`[ENDOCON] Email not sent for ${path}:`, problems);
}

async function request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}, opts: { reviewer?: boolean } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = opts.reviewer ? reviewerCsrfToken : csrfToken;
  if (method !== 'GET' && token) headers['X-CSRF-Token'] = token;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Please check your internet connection and try again.');
  }

  let json: { success?: boolean; message?: string; data?: T; code?: string; errors?: Record<string, string>; emails?: EmailDelivery[] } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok || json.success === false) {
    if (res.status === 401) {
      if (opts.reviewer) onReviewerUnauthorized?.();
      else onUnauthorized?.();
    }
    throw new ApiError(res.status, json.code ?? 'ERROR', json.message ?? 'Something went wrong. Please try again.', json.errors ?? {});
  }
  // Every ENDOCON API reply is a { success: true, data } envelope. Anything else means the request
  // reached a different server (e.g. another app on the proxy port) – never treat that as success.
  if (json.success !== true) {
    console.error(`[ENDOCON] Unexpected response from ${method} ${BASE}${path} – is the ENDOCON API running on the configured port?`, json);
    throw new ApiError(res.status, 'UNEXPECTED_RESPONSE', 'Unexpected response from the server. Please try again later.');
  }
  reportEmails(path, json.emails);
  return { data: json.data as T, message: json.message ?? '', emails: json.emails };
}

/**
 * multipart upload with progress (fetch cannot report upload progress). Same envelope / error
 * handling as request(); `onProgress` receives 0–100.
 */
function uploadWithProgress<T>(path: string, form: FormData, onProgress: (percent: number) => void): Promise<ApiResult<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'The upload was interrupted. Please check your internet connection and try again.'));
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      let json: { success?: boolean; message?: string; data?: T; code?: string; errors?: Record<string, string>; emails?: EmailDelivery[] } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON (e.g. nginx "413 Request Entity Too Large") */
      }
      if (xhr.status === 413) return reject(new ApiError(413, 'UPLOAD_TOO_LARGE', 'The files are too large for the server. Please upload smaller files.'));
      if (xhr.status < 200 || xhr.status >= 300 || json.success !== true) {
        if (xhr.status === 401 && onUnauthorized) onUnauthorized();
        return reject(new ApiError(xhr.status, json.code ?? 'ERROR', json.message ?? 'Something went wrong. Please try again.', json.errors ?? {}));
      }
      reportEmails(path, json.emails);
      resolve({ data: json.data as T, message: json.message ?? '', emails: json.emails });
    };
    xhr.send(form);
  });
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path).then((r) => r.data),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>('POST', path, body ?? {}, headers),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData, onProgress?: (percent: number) => void) =>
    onProgress ? uploadWithProgress<T>(path, form, onProgress) : request<T>('POST', path, form),
};

/** Calls from the reviewer portal (reviewer session + reviewer CSRF token). */
export const reviewerApi = {
  get: <T>(path: string) => request<T>('GET', `/reviewer${path}`, undefined, {}, { reviewer: true }).then((r) => r.data),
  post: <T>(path: string, body?: unknown) => request<T>('POST', `/reviewer${path}`, body ?? {}, {}, { reviewer: true }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', `/reviewer${path}`, body ?? {}, {}, { reviewer: true }),
};

/** URL for a file download served by the API (session cookie authorises it). */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export function queryString(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
