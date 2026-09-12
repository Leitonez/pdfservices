// Customer session (JWT issued by /v1/auth/login), kept in localStorage.
// Paths are resolved from this module's URL, so they work from any page of the panel.

import { apiRequest, ApiError } from './api.js';

const STORAGE_KEY = 'pdfservices.session';
const EXPIRY_MARGIN_MS = 10 * 1000;

/** Absolute URL of the panel root (admin/). */
export const panelUrl = new URL('../../', import.meta.url).href;

/** Absolute URL of the login page. */
export const loginUrl = new URL('../../login/', import.meta.url).href;

const DEFAULT_ROUTE = '#/consumo';

/** Accepts only in-panel hash routes such as "#/chaves", to avoid open redirects. */
export function sanitizeNext(next) {
  return typeof next === 'string' && /^#\/[a-z0-9\-\/]*$/i.test(next) ? next : DEFAULT_ROUTE;
}

export function getSession() {
  let session;
  try {
    session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (error) {
    session = null;
  }

  if (!session || !session.accessToken || !session.expiresAt) {
    return null;
  }

  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt - EXPIRY_MARGIN_MS <= Date.now()) {
    clearSession();
    return null;
  }

  return session;
}

export function saveSession({ accessToken, expiresAt, account }) {
  const session = { accessToken, expiresAt, account: account || null };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    // Storage full or blocked: the session lives only for this page view.
  }
  return session;
}

/** Keeps the cached account (company name, balance) in sync after a GET /v1/account. */
export function updateSessionAccount(account) {
  const session = getSession();
  if (session) {
    saveSession({ ...session, account });
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignored: nothing to clear.
  }
}

/** Builds the login URL, remembering the current panel route so the user returns to it. */
export function buildLoginUrl({ next = window.location.hash, reason } = {}) {
  const url = new URL(loginUrl);
  const route = sanitizeNext(next);
  if (route !== DEFAULT_ROUTE) {
    url.searchParams.set('next', route);
  }
  if (reason) {
    url.searchParams.set('motivo', reason);
  }
  return url.href;
}

/** Returns the session or redirects to the login page (returning null). */
export function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.replace(buildLoginUrl());
    return null;
  }
  return session;
}

/** Public pages: if already logged in, go straight to the panel. Returns true when redirecting. */
export function redirectIfLoggedIn(next) {
  if (getSession()) {
    window.location.replace(panelUrl + sanitizeNext(next));
    return true;
  }
  return false;
}

/** apiRequest with the bearer token; on 401 the session is dropped and the user is sent to the login page. */
export async function authRequest(path, options = {}) {
  const session = getSession();
  if (!session) {
    window.location.replace(buildLoginUrl({ reason: 'expirada' }));
    throw new ApiError(401, 'session_expired', 'Sua sessão expirou. Entre novamente.');
  }

  try {
    return await apiRequest(path, { ...options, token: session.accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      window.location.replace(buildLoginUrl({ reason: 'expirada' }));
    }
    throw error;
  }
}
