// Shared UI pieces for the customer panel: icons, password input, modal, code block, footer and the public-page shell.

import { config } from './config.js';
import { highlight } from './highlight.js';

/* ------------------------------------------------------------------ helpers */

/** Copies text to the clipboard (with a fallback for non-secure contexts). */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Falls back below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (error) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/** Reads "#token=..." from the URL and removes it from the address bar and history. */
export function takeHashToken() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token') || '';
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return token.trim();
}

/* ------------------------------------------------------------------ icons */

const ICONS = {
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m17 6 3 3"/><path d="m14.5 8.5 2 2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/><path d="m2 2 20 20"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  play: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'
};

export const AppIcon = {
  name: 'AppIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 18 }
  },
  computed: {
    paths() {
      return ICONS[this.name] || '';
    }
  },
  template: `<svg class="icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" v-html="paths"></svg>`
};

/* ------------------------------------------------------------------ brand + footer */

export const BrandMark = {
  name: 'BrandMark',
  components: { AppIcon },
  props: {
    href: { type: String, default: '' }
  },
  data() {
    return { logo: new URL('../img/logo-code.png', import.meta.url).href };
  },
  computed: {
    target() {
      return this.href || config.adminUrl + '/';
    }
  },
  template: `
    <a class="brand" :href="target" aria-label="PDF Services, da CODECYCLE">
      <img :src="logo" alt="" width="84" height="26">
      <span class="brand-divider" aria-hidden="true"></span>
      <span class="brand-product">PDF <span>Services</span></span>
    </a>`
};

export const AppFooter = {
  name: 'AppFooter',
  data() {
    return { config, year: new Date().getFullYear() };
  },
  template: `
    <footer class="app-footer">
      <p>
        PDF Services é software livre (AGPL v3) —
        <a :href="config.sourceCodeUrl" target="_blank" rel="noopener">código-fonte</a>
      </p>
      <nav class="app-footer-links" aria-label="Documentos legais">
        <a :href="config.websiteUrl + '/termos'">Termos de Uso</a>
        <a :href="config.websiteUrl + '/privacidade'">Privacidade</a>
        <a :href="config.companyUrl" target="_blank" rel="noopener">© {{ year }} CODECYCLE</a>
      </nav>
    </footer>`
};

/** Layout of the public pages (login, password recovery, e-mail verification). */
export const AuthShell = {
  name: 'AuthShell',
  components: { BrandMark, AppFooter },
  data() {
    return { config };
  },
  template: `
    <div class="auth-page grid-bg">
      <header class="auth-header">
        <brand-mark :href="config.websiteUrl + '/'"></brand-mark>
        <a class="auth-header-link" :href="config.websiteUrl + '/'">Conheça o PDF Services</a>
      </header>
      <main class="auth-main" id="conteudo">
        <div class="auth-card card">
          <slot></slot>
        </div>
      </main>
      <app-footer></app-footer>
    </div>`
};

/* ------------------------------------------------------------------ form pieces */

let uid = 0;
export function nextId(prefix = 'f') {
  uid += 1;
  return `${prefix}-${uid}`;
}

/** Password input with a show/hide toggle. v-model compatible. */
export const PasswordInput = {
  name: 'PasswordInput',
  components: { AppIcon },
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  data() {
    return { visible: false };
  },
  methods: {
    focus() {
      this.$refs.input.focus();
    }
  },
  template: `
    <div class="password-input">
      <input ref="input" v-bind="$attrs" :type="visible ? 'text' : 'password'" :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)" spellcheck="false" autocapitalize="off">
      <button type="button" class="password-toggle" @click="visible = !visible"
        :aria-label="visible ? 'Ocultar senha' : 'Mostrar senha'" :aria-pressed="visible ? 'true' : 'false'">
        <app-icon :name="visible ? 'eyeOff' : 'eye'"></app-icon>
      </button>
    </div>`
};

/** Error alert with the API message. */
export const ErrorAlert = {
  name: 'ErrorAlert',
  components: { AppIcon },
  props: { message: { type: String, default: '' } },
  template: `
    <div v-if="message" class="alert alert-error" role="alert">
      <app-icon name="alert" class="alert-icon"></app-icon>
      <div><slot>{{ message }}</slot></div>
    </div>`
};

/* ------------------------------------------------------------------ modal */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ModalDialog = {
  name: 'ModalDialog',
  components: { AppIcon },
  props: {
    title: { type: String, required: true },
    danger: { type: Boolean, default: false },
    persistent: { type: Boolean, default: false },
    wide: { type: Boolean, default: false }
  },
  emits: ['close'],
  data() {
    return { titleId: nextId('modal-title') };
  },
  mounted() {
    this.previousFocus = document.activeElement;
    document.body.classList.add('modal-open');
    this.onKeydown = (event) => this.handleKey(event);
    document.addEventListener('keydown', this.onKeydown);
    this.$nextTick(() => {
      // The root is a <teleport>, so search from the dialog element, not this.$el.
      const dialog = this.$refs.dialog;
      if (!dialog) {
        return;
      }
      const autofocus = dialog.querySelector('[autofocus]') || dialog.querySelector('.modal-body ' + FOCUSABLE) || dialog;
      autofocus.focus();
    });
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeydown);
    document.body.classList.remove('modal-open');
    if (this.previousFocus && typeof this.previousFocus.focus === 'function' && document.contains(this.previousFocus)) {
      this.previousFocus.focus();
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    onBackdrop() {
      if (!this.persistent) {
        this.close();
      }
    },
    handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const items = Array.from(this.$refs.dialog.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  },
  template: `
    <teleport to="body">
      <div class="modal-backdrop" @mousedown.self="onBackdrop">
        <div ref="dialog" class="modal" :class="{ 'modal-danger': danger, 'modal-wide': wide }" role="dialog" aria-modal="true"
          :aria-labelledby="titleId" tabindex="-1">
          <div class="modal-header">
            <h2 :id="titleId" class="modal-title">
              <app-icon v-if="danger" name="alert" :size="20"></app-icon>
              {{ title }}
            </h2>
            <button type="button" class="icon-btn" @click="close" aria-label="Fechar">
              <app-icon name="x"></app-icon>
            </button>
          </div>
          <div class="modal-body"><slot></slot></div>
          <div class="modal-footer" v-if="$slots.footer"><slot name="footer"></slot></div>
        </div>
      </div>
    </teleport>`
};

/* ------------------------------------------------------------------ copy button + code block */

export const CopyButton = {
  name: 'CopyButton',
  components: { AppIcon },
  props: {
    text: { type: String, required: true },
    label: { type: String, default: 'Copiar' },
    small: { type: Boolean, default: true },
    variant: { type: String, default: 'ghost' }
  },
  data() {
    return { state: 'idle' };
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    async copy() {
      const ok = await copyText(this.text);
      this.state = ok ? 'copied' : 'failed';
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.state = 'idle';
      }, 2200);
    }
  },
  template: `
    <button type="button" class="btn copy-btn" :class="['btn-' + variant, { 'btn-sm': small, 'is-copied': state === 'copied' }]" @click="copy">
      <app-icon :name="state === 'copied' ? 'check' : 'copy'" :size="15"></app-icon>
      <span>{{ state === 'copied' ? 'Copiado!' : state === 'failed' ? 'Não foi possível copiar' : label }}</span>
      <span class="sr-only" role="status">{{ state === 'copied' ? 'Copiado para a área de transferência.' : '' }}</span>
    </button>`
};

export const CodeBlock = {
  name: 'CodeBlock',
  components: { CopyButton },
  props: {
    code: { type: String, required: true },
    lang: { type: String, default: 'text' },
    title: { type: String, default: '' }
  },
  computed: {
    html() {
      return highlight(this.code, this.lang);
    }
  },
  template: `
    <div class="code code-block">
      <div class="code-header">
        <span class="code-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="code-title">{{ title || lang }}</span>
        <copy-button :text="code" label="Copiar"></copy-button>
      </div>
      <pre tabindex="0"><code v-html="html"></code></pre>
    </div>`
};
