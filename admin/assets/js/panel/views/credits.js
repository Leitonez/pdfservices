// Comprar créditos: placeholder ("Em breve"). Credits are added by CODECYCLE on request for now.

import { config } from '../../config.js';
import { formatMoney, formatNumber } from '../../format.js';
import { AppIcon } from '../../ui.js';
import { store, refreshAccountQuietly, loadCapabilitiesQuietly, mainCapability } from '../store.js';

export const CreditsView = {
  name: 'CreditsView',
  components: { AppIcon },
  data() {
    return { config };
  },
  created() {
    refreshAccountQuietly();
    loadCapabilitiesQuietly();
  },
  computed: {
    account() {
      return store.account;
    },
    capability() {
      return mainCapability();
    },
    balanceText() {
      return this.account ? formatMoney(this.account.balance) : '—';
    },
    priceText() {
      return this.capability ? formatMoney(this.capability.price) : '—';
    },
    conversionsLeft() {
      if (!this.account || !this.capability || !(this.capability.price > 0)) {
        return '—';
      }
      return formatNumber(Math.floor(Number(this.account.balance) / this.capability.price + 1e-6));
    },
    per1000() {
      return this.capability ? formatMoney(this.capability.price * 1000) : '—';
    }
  },
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Comprar créditos <span class="badge badge-accent">Em breve</span></h1>
          <p>A compra de créditos direto pelo painel está a caminho. Enquanto isso, a CODECYCLE adiciona créditos à sua conta mediante contato.</p>
        </div>
      </div>

      <div class="credits-grid">
        <section class="card" aria-labelledby="balance-title">
          <p id="balance-title" class="eyebrow">Saldo atual</p>
          <div class="hero-figure">{{ balanceText }}</div>
          <p class="hero-sub">Créditos pré-pagos em reais, usados a cada conversão bem-sucedida.</p>
          <dl class="stat-list">
            <div><dt>Preço por conversão</dt><dd>{{ priceText }}</dd></div>
            <div><dt>Conversões possíveis com o saldo</dt><dd>≈ {{ conversionsLeft }}</dd></div>
            <div><dt>Custo de 1.000 conversões</dt><dd>{{ per1000 }}</dd></div>
            <div><dt>Validade dos créditos</dt><dd>Enquanto a conta estiver ativa</dd></div>
          </dl>
          <a class="btn btn-primary btn-lg" :href="config.contactUrl">
            <app-icon name="mail" :size="18"></app-icon> Falar com a CODECYCLE
          </a>
        </section>

        <section class="card" aria-labelledby="how-title">
          <h2 id="how-title" class="card-title" style="margin-bottom: 16px">Como adicionar créditos agora</h2>
          <ol class="steps">
            <li>Entre em contato com a CODECYCLE pelo e-mail <a :href="config.contactUrl">{{ config.contactEmail }}</a>.</li>
            <li>Informe a razão social e o CNPJ da conta<span v-if="account"> (<strong>{{ account.companyName }}</strong>, {{ account.cnpj }})</span> e o valor desejado.</li>
            <li>Combinamos o pagamento e a nota fiscal com você.</li>
            <li>Após a confirmação, os créditos aparecem no saldo do painel.</li>
          </ol>
          <div class="alert alert-info" style="margin: 8px 0 0">
            <app-icon name="info" class="alert-icon"></app-icon>
            <div>Só conversões bem-sucedidas são cobradas. Com o saldo zerado, a API recusa novas conversões com o erro <code>402 insufficient_balance</code>.</div>
          </div>
        </section>
      </div>
    </div>`
};
