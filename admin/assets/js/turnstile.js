// Cloudflare Turnstile as a Vue component (explicit rendering).
// Usage: <turnstile-widget action="login" ref="captcha" @token="t => token = t" @expired="token = ''"></turnstile-widget>
// Tokens are single use: call this.$refs.captcha.reset() after every submit, successful or not.
// This file is duplicated in website/ and admin/: keep both copies identical.

import { config } from './config.js';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__pdfsTurnstileReady';

let loader = null;

export function loadTurnstile() {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (!loader) {
    loader = new Promise((resolve, reject) => {
      window.__pdfsTurnstileReady = () => resolve(window.turnstile);
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        loader = null;
        reject(new Error('Não foi possível carregar a verificação anti-robô.'));
      };
      document.head.appendChild(script);
    });
  }

  return loader;
}

export const TurnstileWidget = {
  name: 'TurnstileWidget',
  props: {
    action: { type: String, required: true }
  },
  emits: ['token', 'expired', 'error'],
  data() {
    return { failed: false };
  },
  template: `
    <div class="turnstile-box">
      <div ref="container"></div>
      <p v-if="failed" class="field-error">Não foi possível carregar a verificação anti-robô. Recarregue a página.</p>
    </div>`,
  async mounted() {
    try {
      const turnstile = await loadTurnstile();
      this.widgetId = turnstile.render(this.$refs.container, {
        sitekey: config.turnstileSiteKey,
        action: this.action,
        theme: 'dark',
        language: 'pt-br',
        callback: (token) => this.$emit('token', token),
        'expired-callback': () => this.$emit('expired'),
        'error-callback': () => this.$emit('error')
      });
    } catch (error) {
      this.failed = true;
      this.$emit('error');
    }
  },
  beforeUnmount() {
    if (window.turnstile && this.widgetId !== undefined) {
      window.turnstile.remove(this.widgetId);
    }
  },
  methods: {
    reset() {
      this.$emit('expired');
      if (window.turnstile && this.widgetId !== undefined) {
        window.turnstile.reset(this.widgetId);
      }
    }
  }
};
