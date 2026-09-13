// Customer panel: layout (sidebar + topbar) and hash routing (#/consumo, #/chaves, ...), without vue-router.

import { config } from '../config.js';
import { requireSession, clearSession, getSession, buildLoginUrl, loginUrl } from '../session.js';
import { formatMoney } from '../format.js';
import { AppIcon, BrandMark, AppFooter } from '../ui.js';
import { store, refreshAccount, loadCapabilitiesQuietly, refreshAccountQuietly } from './store.js';
import { UsageView } from './views/usage.js';
import { KeysView } from './views/keys.js';
import { DocsView } from './views/docs.js';
import { TestView } from './views/test.js';
import { AccountView } from './views/account.js';
import { CreditsView } from './views/credits.js';

const { markRaw } = Vue;

const ROUTES = [
  { path: '/consumo', label: 'Consumo', icon: 'chart', component: markRaw(UsageView) },
  { path: '/chaves', label: 'Chaves de API', icon: 'key', component: markRaw(KeysView) },
  { path: '/documentacao', label: 'Documentação', icon: 'book', component: markRaw(DocsView) },
  { path: '/teste', label: 'Executar Teste', icon: 'play', component: markRaw(TestView) },
  { path: '/conta', label: 'Minha conta', icon: 'user', component: markRaw(AccountView) },
  { path: '/creditos', label: 'Comprar créditos', icon: 'card', component: markRaw(CreditsView), badge: 'Em breve' }
];

function resolveRoute() {
  const path = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  return ROUTES.find((route) => route.path === path) || null;
}

if (requireSession()) {
  if (!resolveRoute()) {
    history.replaceState(null, '', window.location.pathname + window.location.search + '#' + ROUTES[0].path);
  }

  Vue.createApp({
    components: { AppIcon, BrandMark, AppFooter },
    data() {
      return { routes: ROUTES, route: resolveRoute(), menuOpen: false, store, config };
    },
    computed: {
      account() {
        return store.account;
      },
      balanceText() {
        return this.account ? formatMoney(this.account.balance) : '—';
      },
      isZeroBalance() {
        return !!this.account && Number(this.account.balance) <= 0;
      }
    },
    watch: {
      route: {
        immediate: true,
        handler(route) {
          document.title = `${route.label} · PDF Services`;
        }
      },
      menuOpen(open) {
        if (open) {
          this.$nextTick(() => {
            const link = this.$refs.sidebar.querySelector('.nav-link');
            link && link.focus();
          });
        }
      }
    },
    created() {
      this.onHashChange = () => this.navigate();
      this.onKeydown = (event) => {
        if (event.key === 'Escape' && this.menuOpen) {
          this.closeMenu(true);
        }
      };
      // Another tab logged out or switched accounts: follow it instead of mixing sessions.
      this.onStorage = (event) => {
        if (event.key !== null && event.key !== 'pdfservices.session') {
          return;
        }
        const session = getSession();
        if (!session) {
          window.location.replace(buildLoginUrl());
        } else if (store.account && session.account && session.account.id !== store.account.id) {
          window.location.reload();
        }
      };
      window.addEventListener('hashchange', this.onHashChange);
      window.addEventListener('storage', this.onStorage);
      document.addEventListener('keydown', this.onKeydown);
      refreshAccountQuietly();
      loadCapabilitiesQuietly();
    },
    beforeUnmount() {
      window.removeEventListener('hashchange', this.onHashChange);
      window.removeEventListener('storage', this.onStorage);
      document.removeEventListener('keydown', this.onKeydown);
    },
    methods: {
      navigate() {
        const route = resolveRoute();
        if (!route) {
          history.replaceState(null, '', '#' + ROUTES[0].path);
          this.route = ROUTES[0];
        } else {
          this.route = route;
        }
        this.menuOpen = false;
        window.scrollTo(0, 0);
        this.$nextTick(() => this.focusMain());
      },
      focusMain() {
        const heading = this.$refs.main && this.$refs.main.querySelector('h1');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      },
      closeMenu(restoreFocus) {
        this.menuOpen = false;
        if (restoreFocus) {
          this.$nextTick(() => this.$refs.menuButton && this.$refs.menuButton.focus());
        }
      },
      retryAccount() {
        refreshAccount().catch(() => {});
      },
      logout() {
        clearSession();
        window.location.replace(loginUrl);
      }
    },
    template: `
      <div class="app-shell">
        <button type="button" class="skip-link" @click="focusMain">Pular para o conteúdo</button>

        <aside id="sidebar" ref="sidebar" class="sidebar" :class="{ 'is-open': menuOpen }" aria-label="Menu do painel">
          <div class="sidebar-top">
            <brand-mark href="#/consumo"></brand-mark>
            <button type="button" class="icon-btn sidebar-close" @click="closeMenu(true)" aria-label="Fechar menu">
              <app-icon name="x"></app-icon>
            </button>
          </div>
          <p class="nav-section-label">Painel</p>
          <nav aria-label="Seções do painel">
            <ul class="nav">
              <li v-for="item in routes" :key="item.path">
                <a class="nav-link" :href="'#' + item.path" :aria-current="route.path === item.path ? 'page' : null" @click="menuOpen = false">
                  <app-icon :name="item.icon"></app-icon>
                  <span>{{ item.label }}</span>
                  <span v-if="item.badge" class="badge badge-accent">{{ item.badge }}</span>
                </a>
              </li>
            </ul>
          </nav>
          <div class="sidebar-foot">
            <div class="sidebar-help">
              <strong>Precisa de ajuda?</strong>
              <p>Dúvidas sobre a integração, créditos ou faturamento: fale com a CODECYCLE.</p>
              <a :href="config.contactUrl">{{ config.contactEmail }}</a>
            </div>
          </div>
        </aside>
        <div v-if="menuOpen" class="sidebar-backdrop" @click="closeMenu(false)" aria-hidden="true"></div>

        <div class="main-col">
          <header class="topbar">
            <button ref="menuButton" type="button" class="icon-btn menu-toggle" @click="menuOpen = !menuOpen"
              :aria-expanded="menuOpen ? 'true' : 'false'" aria-controls="sidebar" aria-label="Abrir menu">
              <app-icon name="menu"></app-icon>
            </button>
            <div class="topbar-account">
              <div class="topbar-label">Empresa</div>
              <div class="topbar-company" :title="account && account.companyName">{{ account ? account.companyName : 'Carregando…' }}</div>
            </div>
            <a class="balance-pill" :class="{ 'is-empty': isZeroBalance }" href="#/creditos" :aria-label="'Saldo atual: ' + balanceText + '. Ver como obter créditos.'">
              <app-icon name="wallet" :size="17"></app-icon>
              <span class="balance-label">Saldo</span>
              <span class="balance-value">{{ balanceText }}</span>
            </a>
            <button type="button" class="btn btn-ghost btn-sm" @click="logout" aria-label="Sair do painel">
              <app-icon name="logout" :size="16"></app-icon><span class="logout-label">Sair</span>
            </button>
          </header>

          <main ref="main" class="content" id="conteudo">
            <div v-if="store.accountError" class="alert alert-error" role="alert">
              <app-icon name="alert" class="alert-icon"></app-icon>
              <div>
                Não foi possível carregar os dados da conta. {{ store.accountError }}
                <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" @click="retryAccount">Tentar novamente</button></div>
              </div>
            </div>
            <component :is="route.component" :key="route.path"></component>
          </main>

          <app-footer></app-footer>
        </div>

        <div class="toasts" role="status" aria-live="polite">
          <div v-for="t in store.toasts" :key="t.id" class="toast" :class="'toast-' + t.kind">
            <app-icon :name="t.kind === 'error' ? 'alert' : 'check'"></app-icon>
            <span>{{ t.message }}</span>
          </div>
        </div>
      </div>`
  }).mount('#app');
}
