// Shared site chrome: header and footer as small Vue apps mounted on <header id="site-header"> and
// <footer id="site-footer">. Each placeholder carries data-base with the relative path to the site root
// ("" on the home page, "../" on sub pages, "/" on 404.html, which may be served from any path).

import { config } from './config.js';

const { createApp } = window.Vue;

const NAV = [
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'preco', label: 'Preço' },
  { id: 'privacidade', label: 'Privacidade' },
  { id: 'codigo-aberto', label: 'Código aberto' },
  { id: 'faq', label: 'FAQ' }
];

const SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export const ICONS = {
  github: `<svg class="i" ${SVG}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`,
  menu: `<svg class="i" ${SVG}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  close: `<svg class="i" ${SVG}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  arrow: `<svg class="i i-sm" ${SVG}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`
};

const brandTemplate = `
  <a class="brand" :href="homeHref">
    <img :src="base + 'assets/img/logo-code.png'" alt="CODECYCLE" width="107" height="24">
    <span class="brand-divider" aria-hidden="true"></span>
    <span class="brand-product">PDF <span>Services</span></span>
  </a>`;

const SiteHeader = {
  props: { base: { type: String, default: '' } },
  data() {
    return { open: false, icons: ICONS };
  },
  computed: {
    homeHref() {
      return this.base || './';
    },
    links() {
      return NAV.map((item) => ({ ...item, href: this.base + '#' + item.id }));
    },
    signupHref() {
      return this.base + 'cadastro';
    },
    loginUrl() {
      return config.adminUrl + '/login';
    },
    sourceUrl() {
      return config.sourceCodeUrl;
    }
  },
  mounted() {
    this.onKey = (event) => {
      if (event.key === 'Escape' && this.open) {
        this.close(true);
      }
    };
    this.media = window.matchMedia('(min-width: 1080px)');
    this.onMedia = () => { if (this.media.matches) this.open = false; };
    document.addEventListener('keydown', this.onKey);
    this.media.addEventListener('change', this.onMedia);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey);
    this.media.removeEventListener('change', this.onMedia);
  },
  methods: {
    close(focusToggle) {
      this.open = false;
      if (focusToggle && this.$refs.toggle) {
        this.$refs.toggle.focus();
      }
    }
  },
  template: `
    <div class="container bar">
      ${brandTemplate}
      <nav class="site-nav" aria-label="Principal">
        <a v-for="link in links" :key="link.id" :href="link.href">{{ link.label }}</a>
      </nav>
      <div class="header-actions">
        <a class="icon-link desktop-only" :href="sourceUrl" target="_blank" rel="noopener" title="Código-fonte no GitHub">
          <span v-html="icons.github"></span><span class="sr-only">Código-fonte no GitHub (abre em nova aba)</span>
        </a>
        <a class="btn btn-ghost desktop-only" :href="loginUrl">Entrar</a>
        <a class="btn btn-primary desktop-only" :href="signupHref">Criar conta</a>
        <button ref="toggle" type="button" class="nav-toggle" aria-controls="site-menu" :aria-expanded="open ? 'true' : 'false'"
                @click="open = !open">
          <span v-html="open ? icons.close : icons.menu"></span>
          <span class="sr-only">{{ open ? 'Fechar menu' : 'Abrir menu' }}</span>
        </button>
      </div>
    </div>
    <nav id="site-menu" class="mobile-menu" aria-label="Menu" v-show="open">
      <div class="container">
        <ul>
          <li v-for="link in links" :key="link.id">
            <a :href="link.href" @click="close(false)">{{ link.label }} <span v-html="icons.arrow"></span></a>
          </li>
          <li><a :href="sourceUrl" target="_blank" rel="noopener">Código-fonte no GitHub <span v-html="icons.github"></span></a></li>
        </ul>
        <div class="menu-actions">
          <a class="btn btn-ghost" :href="loginUrl">Entrar</a>
          <a class="btn btn-primary" :href="signupHref">Criar conta</a>
        </div>
      </div>
    </nav>`
};

const SiteFooter = {
  props: { base: { type: String, default: '' } },
  data() {
    return { config, year: new Date().getFullYear() };
  },
  computed: {
    homeHref() {
      return this.base || './';
    },
    loginUrl() {
      return config.adminUrl + '/login';
    }
  },
  template: `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-about">
          ${brandTemplate}
          <p>API para converter HTML em PDF com iText pdfHTML. Pague por uso, sem guardar seus documentos, com código aberto.</p>
        </div>
        <nav class="footer-col" aria-labelledby="footer-produto">
          <h2 id="footer-produto">Produto</h2>
          <ul>
            <li><a :href="base + '#como-funciona'">Como funciona</a></li>
            <li><a :href="base + '#preco'">Preço</a></li>
            <li><a :href="base + '#privacidade'">Privacidade</a></li>
            <li><a :href="base + '#faq'">Perguntas frequentes</a></li>
          </ul>
        </nav>
        <nav class="footer-col" aria-labelledby="footer-guias">
          <h2 id="footer-guias">Guias</h2>
          <ul>
            <li><a :href="base + 'gerar-pdf-a-partir-de-html-em-csharp'">HTML para PDF em C#</a></li>
            <li><a :href="base + 'gerar-pdf-a-partir-de-html-em-nodejs'">HTML para PDF em Node.js</a></li>
            <li><a :href="base + 'gerar-pdf-a-partir-de-html-em-python'">HTML para PDF em Python</a></li>
          </ul>
        </nav>
        <nav class="footer-col" aria-labelledby="footer-conta">
          <h2 id="footer-conta">Conta</h2>
          <ul>
            <li><a :href="base + 'cadastro'">Criar conta</a></li>
            <li><a :href="loginUrl">Entrar</a></li>
            <li><a :href="config.adminUrl">Painel do cliente</a></li>
            <li><a :href="config.contactUrl">Fale com a CODECYCLE</a></li>
          </ul>
        </nav>
        <nav class="footer-col" aria-labelledby="footer-legal">
          <h2 id="footer-legal">Legal e código</h2>
          <ul>
            <li><a :href="base + 'termos'">Termos de Uso</a></li>
            <li><a :href="base + 'privacidade'">Política de Privacidade</a></li>
            <li><a :href="config.sourceCodeUrl" target="_blank" rel="noopener">Código-fonte (GitHub)</a></li>
            <li><a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">Licença GNU AGPL v3</a></li>
          </ul>
        </nav>
      </div>
      <div class="footer-bottom">
        <span>© {{ year }} <a :href="config.companyUrl" target="_blank" rel="noopener">CODECYCLE</a> · Software livre sob AGPL v3</span>
        <span class="mono">pdfservices.sistema.site</span>
      </div>
    </div>`
};

/** Mounts the header and footer apps on their placeholders, if present. */
export function mountChrome() {
  const parts = [['site-header', SiteHeader], ['site-footer', SiteFooter]];
  for (const [id, component] of parts) {
    const element = document.getElementById(id);
    if (element) {
      createApp(component, { base: element.dataset.base || '' }).mount(element);
    }
  }
}
