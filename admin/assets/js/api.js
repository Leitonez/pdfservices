// Minimal client for the PDF Services API. Errors are thrown as ApiError with the server's pt-BR message.
// This file is duplicated in website/ and admin/: keep both copies identical.

import { config } from './config.js';

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  let response;
  try {
    response = await fetch(config.apiUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new ApiError(0, 'network_error', 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (data && data.error) || 'error',
      (data && data.message) || 'Ocorreu um erro inesperado. Tente novamente.',
      data && data.fields
    );
  }

  return data;
}
