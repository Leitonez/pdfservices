// Consumo: period filter, KPIs, conversions-per-day chart (with table view), totals per capability,
// the paginated transaction statement and the privacy note.

import { config } from '../../config.js';
import { authRequest } from '../../session.js';
import { formatMoney, formatNumber, formatDateTime, formatDayKey, formatBytes } from '../../format.js';
import { AppIcon, ErrorAlert } from '../../ui.js';
import { UsageChart } from '../chart.js';
import { todayKey, addDays, daysBetween, isDayKey, fillDays, weekdayOf } from '../dates.js';
import { store, refreshAccountQuietly, loadCapabilitiesQuietly, mainCapability, capabilityName } from '../store.js';

const PRESETS = [7, 30, 90];
const MAX_RANGE_DAYS = 366;

function formatDuration(ms) {
  const value = Number(ms) || 0;
  if (value < 1000) {
    return `${formatNumber(value)} ms`;
  }
  return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
}

export const UsageView = {
  name: 'UsageView',
  components: { AppIcon, ErrorAlert, UsageChart },
  data() {
    const today = todayKey();
    return {
      config,
      presets: PRESETS,
      preset: 30,
      today,
      from: addDays(today, -29),
      to: today,
      customFrom: addDays(today, -29),
      customTo: today,
      rangeError: '',
      usage: null,
      loading: false,
      error: '',
      view: 'chart',
      chartUnit: 'dia',
      tx: { items: [], continuation: null, loading: false, error: '', loaded: false }
    };
  },
  created() {
    this.requestSeq = 0;
    refreshAccountQuietly();
    loadCapabilitiesQuietly();
    this.loadUsage();
    this.loadTransactions(true);
  },
  computed: {
    account() {
      return store.account;
    },
    balance() {
      return this.account ? Number(this.account.balance) || 0 : null;
    },
    isZeroBalance() {
      return this.balance !== null && this.balance <= 0;
    },
    capability() {
      return mainCapability();
    },
    priceText() {
      return this.capability ? formatMoney(this.capability.price) : '—';
    },
    conversionsLeft() {
      if (this.balance === null || !this.capability || !(this.capability.price > 0)) {
        return null;
      }
      return Math.floor(this.balance / this.capability.price + 1e-6);
    },
    days() {
      return daysBetween(this.from, this.to) + 1;
    },
    rangeCaption() {
      return `${formatDayKey(this.from, true)} a ${formatDayKey(this.to, true)} · ${this.days} ${this.days === 1 ? 'dia' : 'dias'}`;
    },
    series() {
      return this.usage ? fillDays(this.usage.from, this.usage.to, this.usage.days) : [];
    },
    tableRows() {
      return this.series.slice().reverse();
    },
    averagePerDay() {
      if (!this.usage || !this.series.length) {
        return '';
      }
      const avg = this.usage.totalCount / this.series.length;
      return avg.toLocaleString('pt-BR', { maximumFractionDigits: avg < 10 ? 1 : 0 });
    },
    chartTitle() {
      return this.view === 'table' ? 'Conversões por dia' : `Conversões por ${this.chartUnit}`;
    }
  },
  methods: {
    formatMoney,
    formatNumber,
    formatDateTime,
    formatBytes,
    formatDuration,
    capabilityName,
    dayLabel(key) {
      return `${weekdayOf(key)}, ${formatDayKey(key, true)}`;
    },
    applyPreset(days) {
      this.preset = days;
      this.rangeError = '';
      this.to = todayKey();
      this.from = addDays(this.to, -(days - 1));
      this.loadUsage();
    },
    openCustom() {
      this.preset = 'custom';
      this.customFrom = this.from;
      this.customTo = this.to;
      this.$nextTick(() => this.$refs.customFrom && this.$refs.customFrom.focus());
    },
    applyCustom() {
      this.rangeError = '';
      const { customFrom: from, customTo: to } = this;
      if (!isDayKey(from) || !isDayKey(to)) {
        this.rangeError = 'Informe as duas datas.';
        return;
      }
      if (from > to) {
        this.rangeError = 'A data inicial deve ser anterior ou igual à final.';
        return;
      }
      if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
        this.rangeError = `O período pode ter no máximo ${MAX_RANGE_DAYS} dias.`;
        return;
      }
      this.from = from;
      this.to = to;
      this.loadUsage();
    },
    async loadUsage() {
      const seq = ++this.requestSeq;
      this.loading = true;
      this.error = '';
      try {
        const usage = await authRequest(`/v1/account/usage?from=${this.from}&to=${this.to}`);
        if (seq === this.requestSeq) {
          this.usage = usage;
        }
      } catch (error) {
        if (seq === this.requestSeq) {
          this.error = error.message;
        }
      } finally {
        if (seq === this.requestSeq) {
          this.loading = false;
        }
      }
    },
    async loadTransactions(reset) {
      if (this.tx.loading) {
        return;
      }
      this.tx.loading = true;
      this.tx.error = '';
      try {
        let path = '/v1/account/transactions?limit=25';
        if (!reset && this.tx.continuation) {
          path += '&continuation=' + encodeURIComponent(this.tx.continuation);
        }
        const page = await authRequest(path);
        const items = (page && page.items) || [];
        this.tx.items = reset ? items : this.tx.items.concat(items);
        this.tx.continuation = (page && page.continuation) || null;
        this.tx.loaded = true;
      } catch (error) {
        this.tx.error = error.message;
      } finally {
        this.tx.loading = false;
      }
    },
    refreshAll() {
      refreshAccountQuietly();
      this.loadUsage();
      this.loadTransactions(true);
    }
  },
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Consumo</h1>
          <p>Conversões, gastos e extrato da sua conta. Datas no horário de Brasília.</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" @click="refreshAll" :disabled="loading">
          <app-icon name="refresh" :size="15"></app-icon> Atualizar
        </button>
      </div>

      <div v-if="isZeroBalance" class="alert alert-warning" role="status">
        <app-icon name="alert" class="alert-icon"></app-icon>
        <div>
          <strong>Seu saldo está zerado.</strong>
          Novas conversões serão recusadas com o erro <code>402 insufficient_balance</code> até que a conta tenha créditos.
          Por enquanto, a CODECYCLE adiciona créditos mediante contato: informe a razão social, o CNPJ e o valor desejado.
          <div class="btn-row">
            <a class="btn btn-primary btn-sm" :href="config.contactUrl">Escrever para {{ config.contactEmail }}</a>
            <a class="btn btn-ghost btn-sm" href="#/creditos">Como obter créditos</a>
          </div>
        </div>
      </div>

      <div class="filter-row">
        <div class="segmented" role="group" aria-label="Período do relatório">
          <button v-for="p in presets" :key="p" type="button" :aria-pressed="preset === p ? 'true' : 'false'" @click="applyPreset(p)">{{ p }} dias</button>
          <button type="button" :aria-pressed="preset === 'custom' ? 'true' : 'false'" @click="openCustom">Personalizado</button>
        </div>
        <form v-if="preset === 'custom'" class="custom-range" @submit.prevent="applyCustom" aria-label="Período personalizado">
          <div class="field">
            <label for="range-from">De</label>
            <input id="range-from" ref="customFrom" type="date" v-model="customFrom" :max="today" required>
          </div>
          <div class="field">
            <label for="range-to">Até</label>
            <input id="range-to" type="date" v-model="customTo" :max="today" required>
          </div>
          <button type="submit" class="btn btn-ghost">Aplicar</button>
          <p v-if="rangeError" class="field-error range-error" role="alert">{{ rangeError }}</p>
        </form>
        <span v-else class="range-caption">{{ rangeCaption }}</span>
      </div>

      <error-alert :message="error">
        Não foi possível carregar o relatório de consumo. {{ error }}
        <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" @click="loadUsage">Tentar novamente</button></div>
      </error-alert>

      <div class="kpi-grid">
        <div class="kpi" :class="isZeroBalance ? 'kpi-warning' : 'kpi-primary'">
          <div class="kpi-label"><app-icon name="wallet" :size="16"></app-icon> Saldo atual</div>
          <div class="kpi-value">{{ balance === null ? '—' : formatMoney(balance) }}</div>
          <div class="kpi-foot" v-if="conversionsLeft !== null">≈ {{ formatNumber(conversionsLeft) }} conversões</div>
        </div>
        <div class="kpi" :class="{ 'is-refetching': loading && usage }">
          <div class="kpi-label"><app-icon name="file" :size="16"></app-icon> Conversões no período</div>
          <div class="kpi-value">{{ usage ? formatNumber(usage.totalCount) : '—' }}</div>
          <div class="kpi-foot" v-if="usage">Média de {{ averagePerDay }} por dia</div>
        </div>
        <div class="kpi" :class="{ 'is-refetching': loading && usage }">
          <div class="kpi-label"><app-icon name="chart" :size="16"></app-icon> Gasto no período</div>
          <div class="kpi-value">{{ usage ? formatMoney(usage.totalAmount) : '—' }}</div>
          <div class="kpi-foot">{{ days }} {{ days === 1 ? 'dia' : 'dias' }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label"><app-icon name="code" :size="16"></app-icon> Preço por conversão</div>
          <div class="kpi-value">{{ priceText }}</div>
          <div class="kpi-foot">{{ capability ? capability.displayName : 'HTML para PDF' }} · só sucesso é cobrado</div>
        </div>
      </div>

      <div class="stack">
        <section class="card" aria-labelledby="chart-title">
          <div class="card-head">
            <div>
              <h2 id="chart-title" class="card-title">{{ chartTitle }}</h2>
              <p class="card-sub">{{ rangeCaption }}</p>
            </div>
            <div class="segmented segmented-sm" role="group" aria-label="Forma de exibição">
              <button type="button" :aria-pressed="view === 'chart' ? 'true' : 'false'" @click="view = 'chart'">
                <app-icon name="chart" :size="14"></app-icon> Gráfico
              </button>
              <button type="button" :aria-pressed="view === 'table' ? 'true' : 'false'" @click="view = 'table'">
                <app-icon name="table" :size="14"></app-icon> Tabela
              </button>
            </div>
          </div>

          <div v-if="!usage && loading" class="page-loading" role="status"><span class="spinner" aria-hidden="true"></span> Carregando consumo…</div>
          <div v-else-if="!usage" class="empty-inline">Os dados do gráfico não estão disponíveis.</div>
          <usage-chart v-else-if="view === 'chart'" :series="series" :refetching="loading" @unit="u => chartUnit = u"></usage-chart>
          <div v-else class="table-scroll" :class="{ 'is-refetching': loading }" tabindex="0" role="region" aria-label="Conversões por dia (tabela)">
            <table class="table">
              <caption class="sr-only">Conversões e valor por dia, {{ rangeCaption }}</caption>
              <thead><tr><th scope="col">Data</th><th scope="col" class="num">Conversões</th><th scope="col" class="num">Valor</th></tr></thead>
              <tbody>
                <tr v-for="d in tableRows" :key="d.date">
                  <td>{{ dayLabel(d.date) }}</td>
                  <td class="num">{{ formatNumber(d.count) }}</td>
                  <td class="num">{{ formatMoney(d.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card card-flush" aria-labelledby="cap-title">
          <div class="card-head">
            <div>
              <h2 id="cap-title" class="card-title">Consumo por capacidade</h2>
              <p class="card-sub">{{ rangeCaption }}</p>
            </div>
          </div>
          <div class="table-wrap" :class="{ 'is-refetching': loading && usage }">
            <table class="table table-stack">
              <thead><tr><th scope="col">Capacidade</th><th scope="col" class="num">Conversões</th><th scope="col" class="num">Valor</th></tr></thead>
              <tbody>
                <tr v-for="c in (usage ? usage.capabilities : [])" :key="c.capability">
                  <td data-label="Capacidade"><div><span class="cell-main">{{ c.displayName }}</span> <span class="cell-sub mono">{{ c.capability }}</span></div></td>
                  <td data-label="Conversões" class="num">{{ formatNumber(c.count) }}</td>
                  <td data-label="Valor" class="num">{{ formatMoney(c.amount) }}</td>
                </tr>
                <tr v-if="usage && !usage.capabilities.length">
                  <td colspan="3" class="empty-inline">Nenhuma conversão no período selecionado.</td>
                </tr>
                <tr v-if="!usage">
                  <td colspan="3" class="empty-inline">{{ loading ? 'Carregando…' : 'Dados indisponíveis.' }}</td>
                </tr>
              </tbody>
              <tfoot v-if="usage && usage.capabilities.length">
                <tr>
                  <td>Total</td>
                  <td class="num">{{ formatNumber(usage.totalCount) }}</td>
                  <td class="num">{{ formatMoney(usage.totalAmount) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section class="card card-flush" aria-labelledby="tx-title">
          <div class="card-head">
            <div>
              <h2 id="tx-title" class="card-title">Extrato de transações</h2>
              <p class="card-sub">Todas as conversões cobradas, das mais recentes para as mais antigas (não depende do período acima).</p>
            </div>
          </div>
          <div v-if="tx.error" style="padding: 0 24px">
            <error-alert :message="tx.error">
              Não foi possível carregar o extrato. {{ tx.error }}
              <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" @click="loadTransactions(!tx.items.length)">Tentar novamente</button></div>
            </error-alert>
          </div>
          <div v-if="!tx.loaded && tx.loading" class="page-loading" style="padding: 24px" role="status"><span class="spinner" aria-hidden="true"></span> Carregando extrato…</div>
          <div v-else-if="tx.loaded && !tx.items.length" class="empty-state">
            <div class="empty-icon"><app-icon name="file" :size="24"></app-icon></div>
            <h3>Nenhuma transação ainda</h3>
            <p>Quando sua integração converter o primeiro HTML em PDF, cada cobrança aparecerá aqui com data, chave usada, tamanhos e duração.</p>
            <div class="btn-row">
              <a class="btn btn-primary" href="#/documentacao">Ver documentação</a>
              <a class="btn btn-ghost" href="#/chaves">Gerenciar chaves</a>
            </div>
          </div>
          <template v-else-if="tx.items.length">
            <div class="table-wrap">
              <table class="table table-stack">
                <thead>
                  <tr>
                    <th scope="col">Data e hora</th>
                    <th scope="col">Capacidade</th>
                    <th scope="col">Chave</th>
                    <th scope="col" class="num">Entrada</th>
                    <th scope="col" class="num">Saída</th>
                    <th scope="col" class="num">Duração</th>
                    <th scope="col" class="num">Valor</th>
                    <th scope="col" class="num">Saldo após</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in tx.items" :key="t.id">
                    <td data-label="Data e hora" class="nowrap"><span class="cell-main">{{ formatDateTime(t.createdAt) }}</span></td>
                    <td data-label="Capacidade">{{ capabilityName(t.capability) }}</td>
                    <td data-label="Chave">
                      <div>
                        <span>{{ t.apiKeyName || '—' }}</span>
                        <span v-if="t.apiKeyPrefix" class="cell-sub mono">{{ t.apiKeyPrefix }}…</span>
                      </div>
                    </td>
                    <td data-label="Entrada" class="num nowrap">{{ formatBytes(t.inputBytes) }}</td>
                    <td data-label="Saída" class="num nowrap">{{ formatBytes(t.outputBytes) }}</td>
                    <td data-label="Duração" class="num nowrap">{{ formatDuration(t.durationMs) }}</td>
                    <td data-label="Valor" class="num nowrap">{{ formatMoney(t.amount) }}</td>
                    <td data-label="Saldo após" class="num nowrap">{{ formatMoney(t.balanceAfter) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="load-more" v-if="tx.continuation">
              <button type="button" class="btn btn-ghost" @click="loadTransactions(false)" :disabled="tx.loading">
                <span v-if="tx.loading" class="spinner" aria-hidden="true"></span>
                {{ tx.loading ? 'Carregando…' : 'Carregar mais' }}
              </button>
            </div>
            <p v-else class="card-note" style="padding-top: 14px">Fim do extrato.</p>
          </template>
        </section>

        <aside class="privacy-note" aria-label="Privacidade">
          <app-icon name="shield" :size="20"></app-icon>
          <p>
            <strong>Privacidade:</strong> o HTML enviado e o PDF gerado nunca são armazenados nem registrados em log — existem
            apenas na memória durante a conversão. Este relatório usa somente metadados de cada transação: data e hora,
            capacidade, chave usada, valor, saldo, tamanhos em bytes e duração. Registros de acesso (IP e data/hora) são
            guardados por 6 meses, como exige o Marco Civil da Internet.
            <a :href="config.websiteUrl + '/privacidade'">Política de Privacidade</a>.
          </p>
        </aside>
      </div>
    </div>`
};
