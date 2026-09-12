// Shared panel state: the account (balance), the capability price list and toasts.

import { apiRequest } from '../api.js';
import { authRequest, getSession, updateSessionAccount } from '../session.js';

const session = getSession();

export const store = Vue.reactive({
  account: session ? session.account : null,
  accountError: '',
  capabilities: [],
  capabilitiesError: '',
  toasts: []
});

let accountPromise = null;

/** GET /v1/account (deduplicated). Rejects on error; store.accountError keeps the message. */
export function refreshAccount() {
  if (!accountPromise) {
    accountPromise = authRequest('/v1/account')
      .then((account) => {
        store.account = account;
        store.accountError = '';
        updateSessionAccount(account);
        return account;
      })
      .catch((error) => {
        if (error.code !== 'session_expired' && error.status !== 401) {
          store.accountError = error.message;
        }
        throw error;
      })
      .finally(() => {
        accountPromise = null;
      });
  }
  return accountPromise;
}

/** Same as refreshAccount, for fire-and-forget calls. */
export function refreshAccountQuietly() {
  refreshAccount().catch(() => {});
}

let capabilitiesPromise = null;

/** GET /v1/capabilities (public, cached for the page lifetime). */
export function loadCapabilities() {
  if (!capabilitiesPromise) {
    capabilitiesPromise = apiRequest('/v1/capabilities')
      .then((list) => {
        store.capabilities = Array.isArray(list) ? list : [];
        store.capabilitiesError = '';
        return store.capabilities;
      })
      .catch((error) => {
        capabilitiesPromise = null;
        store.capabilitiesError = error.message;
        throw error;
      });
  }
  return capabilitiesPromise;
}

export function loadCapabilitiesQuietly() {
  loadCapabilities().catch(() => {});
}

/** The html2pdf capability (the only one today), or the first available. */
export function mainCapability() {
  return store.capabilities.find((c) => c.name === 'html2pdf') || store.capabilities[0] || null;
}

export function capabilityName(name) {
  const capability = store.capabilities.find((c) => c.name === name);
  return capability ? capability.displayName : name;
}

let toastId = 0;

export function toast(message, kind = 'success') {
  toastId += 1;
  const id = toastId;
  store.toasts.push({ id, message, kind });
  setTimeout(() => {
    const index = store.toasts.findIndex((t) => t.id === id);
    if (index >= 0) {
      store.toasts.splice(index, 1);
    }
  }, 4500);
}
