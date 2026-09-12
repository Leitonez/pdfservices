// Landing page: live price, cost calculator and integration example tabs.
// The page content is plain HTML (in-DOM template); code blocks use v-pre so they are never compiled.

import { apiRequest } from '../api.js';
import { config } from '../config.js';
import { formatMoney, formatNumber } from '../format.js';
import { mountChrome } from '../site.js';

const { createApp } = window.Vue;

const FALLBACK_PRICE = 0.001;
const VOLUMES = [1000, 5000, 10000, 50000, 100000, 250000, 500000, 1000000];
const TABS = ['curl', 'csharp', 'node', 'python', 'php'];

mountChrome();

createApp({
  data() {
    return {
      config,
      price: FALLBACK_PRICE,
      volumeIndex: 2,
      tab: 'curl',
      copied: '',
      volumes: VOLUMES
    };
  },
  computed: {
    loginUrl() {
      return config.adminUrl + '/login/';
    },
    priceLabel() {
      return formatMoney(this.price);
    },
    /** As sent in the X-Charged-Amount header (invariant culture). */
    priceRaw() {
      return String(this.price);
    },
    perReal() {
      return formatNumber(Math.floor(1 / this.price + 1e-9));
    },
    volume() {
      return VOLUMES[this.volumeIndex];
    },
    volumeLabel() {
      return formatNumber(this.volume);
    },
    costLabel() {
      return formatMoney(Math.round(this.volume * this.price * 100) / 100, 2);
    },
    costText() {
      return this.volumeLabel + ' conversões custam ' + this.costLabel;
    }
  },
  async mounted() {
    try {
      const capabilities = await apiRequest('/v1/capabilities');
      const html2pdf = Array.isArray(capabilities) ? capabilities.find((c) => c.name === 'html2pdf') : null;
      if (html2pdf && Number(html2pdf.price) > 0) {
        this.price = Number(html2pdf.price);
      }
    } catch (error) {
      // Keep the fallback price: the page must work even if the API is down.
    }
  },
  methods: {
    formatNumber,
    selectTab(id) {
      this.tab = id;
    },
    onTabKey(event) {
      const index = TABS.indexOf(this.tab);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = TABS.length - 1;
      else return;
      event.preventDefault();
      this.tab = TABS[next];
      this.$nextTick(() => document.getElementById('tab-' + TABS[next]).focus());
    },
    async copy(id) {
      const block = document.getElementById('code-' + id);
      if (!block || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(block.innerText.trim());
        this.copied = id;
        clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => { this.copied = ''; }, 2000);
      } catch (error) {
        this.copied = '';
      }
    }
  }
}).mount('#conteudo');
