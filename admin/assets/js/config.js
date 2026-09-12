// Environment configuration. Public values only: never put secrets in the frontend.
// When served from localhost, the local API and Cloudflare's always-pass Turnstile test key are used.
// This file is duplicated in website/ and admin/: keep both copies identical.

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const config = Object.freeze({
  isLocal,
  apiUrl: isLocal ? 'http://localhost:7215' : 'https://api.pdfservices.sistema.site',
  websiteUrl: isLocal ? 'http://localhost:5501' : 'https://pdfservices.sistema.site',
  adminUrl: isLocal ? 'http://localhost:5502' : 'https://my.pdfservices.sistema.site',
  turnstileSiteKey: isLocal ? '1x00000000000000000000AA' : '0x4AAAAAAExw-sqL2INeyVDp',
  sourceCodeUrl: 'https://github.com/Leitonez/pdfservices',
  companyUrl: 'https://codecycle.com.br',
  contactUrl: 'mailto:produtos@codecycle.com.br',
  contactEmail: 'produtos@codecycle.com.br'
});
