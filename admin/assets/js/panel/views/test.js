// Executar Teste: calls a capability from the panel with the customer's own API key and shows the result.
// The key lives only in this page's memory: it is never stored and is sent only to the API.

import { config } from '../../config.js';
import { formatMoney, formatBytes } from '../../format.js';
import { AppIcon, ErrorAlert, CodeBlock } from '../../ui.js';
import { store, loadCapabilities, refreshAccountQuietly } from '../store.js';

const MAX_REQUEST_BYTES = 1024 * 1024;

const DEFAULT_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Hello World</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: sans-serif; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`;

/** How each capability is invoked from this page. A new capability only needs an entry here. */
const RUNNERS = {
  html2pdf: {
    path: '/v1/html2pdf/json',
    params: [
      {
        name: 'html',
        label: 'Conteúdo HTML',
        type: 'textarea',
        default: DEFAULT_HTML,
        hint: 'O documento que será convertido. Use CSS em <style> e @page para tamanho e margens.'
      }
    ],
    body: (values) => JSON.stringify({ html: values.html }),
    fileName: 'teste.pdf'
  }
};

const HINTS = {
  missing_api_key: 'Informe a chave de API completa no campo acima.',
  invalid_api_key: 'Confira se a chave foi colada por inteiro e se não foi excluída em Chaves de API.',
  insufficient_balance: 'Adicione créditos para voltar a converter.',
  payload_too_large: 'Reduza o HTML: o limite por requisição é de 1 MB.',
  conversion_failed: 'Revise o HTML enviado. Conversões com erro não são cobradas.',
  busy: 'Aguarde alguns segundos e tente novamente.'
};

function defaultsFor(runner) {
  const values = {};
  runner.params.forEach((param) => {
    values[param.name] = param.default || '';
  });
  return values;
}

function shellQuote(text) {
  return "'" + text.replace(/'/g, "'\\''") + "'";
}

export const TestView = {
  name: 'TestView',
  components: { AppIcon, ErrorAlert, CodeBlock },
  data() {
    return {
      store,
      capability: 'html2pdf',
      apiKey: '',
      showKey: false,
      values: defaultsFor(RUNNERS.html2pdf),
      errors: {},
      busy: false,
      result: null
    };
  },
  created() {
    loadCapabilities().catch(() => {});
  },
  beforeUnmount() {
    this.releaseResult();
    this.apiKey = '';
  },
  computed: {
    runner() {
      return RUNNERS[this.capability];
    },
    capabilityOptions() {
      const listed = store.capabilities.filter((c) => RUNNERS[c.name]);
      if (listed.length) {
        return listed.map((c) => ({ name: c.name, label: `${c.displayName} (${c.name})`, price: c.price }));
      }
      // Price list unavailable: still offer the capabilities this page knows how to run.
      return Object.keys(RUNNERS).map((name) => ({ name, label: name, price: null }));
    },
    selectedCapability() {
      return this.capabilityOptions.find((c) => c.name === this.capability) || null;
    },
    priceText() {
      return this.selectedCapability && this.selectedCapability.price != null ? formatMoney(this.selectedCapability.price) : '';
    },
    requestBody() {
      return this.runner.body(this.values);
    },
    requestBytes() {
      return new TextEncoder().encode(this.requestBody).length;
    },
    sizeText() {
      return `${formatBytes(this.requestBytes)} de 1 MB`;
    },
    tooLarge() {
      return this.requestBytes > MAX_REQUEST_BYTES;
    },
    curlSnippet() {
      const body = this.requestBody.length <= 2000 ? shellQuote(this.requestBody) : "'{\"html\": \"...\"}'";
      return `curl -X POST "${config.apiUrl}${this.runner.path}" \\
  -H "X-Api-Key: pdfs_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d ${body} \\
  -o ${this.runner.fileName}`;
    },
    resultHint() {
      return this.result && this.result.error ? HINTS[this.result.error.code] || '' : '';
    }
  },
  watch: {
    capability(name) {
      this.values = defaultsFor(RUNNERS[name]);
      this.errors = {};
    }
  },
  methods: {
    formatMoney,
    formatBytes,
    resetParam(param) {
      this.values[param.name] = param.default || '';
    },
    releaseResult() {
      if (this.result && this.result.url) {
        URL.revokeObjectURL(this.result.url);
      }
      this.result = null;
    },
    validate() {
      const errors = {};
      const key = this.apiKey.trim();
      if (!key) {
        errors.apiKey = 'Informe sua chave de API.';
      } else if (!key.startsWith('pdfs_')) {
        errors.apiKey = 'A chave de API começa com "pdfs_". Cole a chave completa, exibida quando ela foi criada.';
      }
      this.runner.params.forEach((param) => {
        if (!String(this.values[param.name] || '').trim()) {
          errors[param.name] = `Preencha o campo ${param.label}.`;
        }
      });
      if (this.tooLarge) {
        errors.html = 'O conteúdo passa do limite de 1 MB por requisição.';
      }
      this.errors = errors;
      return Object.keys(errors).length === 0;
    },
    async run() {
      if (this.busy || !this.validate()) {
        return;
      }

      this.busy = true;
      this.releaseResult();
      const started = performance.now();
      let result;
      try {
        const response = await fetch(config.apiUrl + this.runner.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey.trim() },
          body: this.requestBody
        });
        const durationMs = Math.round(performance.now() - started);

        if (response.ok) {
          const blob = await response.blob();
          const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          // Custom headers are only readable when the API exposes them via CORS; otherwise fall back to the price list.
          const charged = response.headers.get('X-Charged-Amount');
          const balance = response.headers.get('X-Balance');
          const blocked = response.headers.get('X-Blocked-Resources');
          result = {
            ok: true,
            status: response.status,
            durationMs,
            size: pdf.size,
            url: URL.createObjectURL(pdf),
            transactionId: response.headers.get('X-Transaction-Id'),
            charged: charged != null ? Number(charged) : this.selectedCapability ? this.selectedCapability.price : null,
            balance: balance != null ? Number(balance) : null,
            blocked: blocked != null ? Number(blocked) : 0
          };
          refreshAccountQuietly();
        } else {
          const data = await response.json().catch(() => null);
          result = {
            ok: false,
            status: response.status,
            durationMs,
            error: {
              code: (data && data.error) || 'http_' + response.status,
              message: (data && data.message) || `A API respondeu com o status HTTP ${response.status}.`
            }
          };
          if (response.status === 401) {
            this.errors = { apiKey: result.error.message };
          }
        }
      } catch (error) {
        result = {
          ok: false,
          status: 0,
          durationMs: Math.round(performance.now() - started),
          error: { code: 'network_error', message: 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.' }
        };
      } finally {
        this.busy = false;
      }

      this.result = result;
      this.$nextTick(() => {
        const heading = this.$refs.resultTitle;
        if (heading) {
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    },
    onEditorKeydown(event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.run();
      }
    }
  },
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Executar Teste</h1>
          <p>Teste uma capacidade da API direto do painel, com a sua chave de API, e veja o resultado antes de integrar.</p>
        </div>
      </div>

      <div class="stack">
        <div class="alert alert-info" role="note">
          <app-icon name="info" class="alert-icon"></app-icon>
          <div>
            Cada teste bem-sucedido é uma chamada real à API e é <strong>cobrado como uma conversão comum</strong><template v-if="priceText"> ({{ priceText }})</template>.
            Assim como na integração, o conteúdo enviado e o PDF gerado não são armazenados.
          </div>
        </div>

        <form class="card" @submit.prevent="run" novalidate aria-labelledby="test-form-title">
          <h2 id="test-form-title" class="card-title">Parâmetros da chamada</h2>
          <p class="card-sub">Escolha a capacidade, informe a chave e preencha os parâmetros.</p>

          <div class="test-grid">
            <div class="field">
              <label for="test-capability">Capacidade</label>
              <select id="test-capability" v-model="capability">
                <option v-for="option in capabilityOptions" :key="option.name" :value="option.name">{{ option.label }}</option>
              </select>
              <span class="field-hint">Endpoint: <code>POST {{ runner.path }}</code></span>
            </div>

            <div class="field" :class="{ 'has-error': errors.apiKey }">
              <label for="test-key">Chave de API</label>
              <div class="test-key">
                <input id="test-key" v-model="apiKey" :type="showKey ? 'text' : 'password'" autocomplete="off" spellcheck="false"
                  autocapitalize="off" placeholder="pdfs_..." :aria-invalid="errors.apiKey ? 'true' : 'false'"
                  aria-describedby="test-key-hint test-key-error" data-lpignore="true" data-1p-ignore>
                <button type="button" class="btn btn-ghost" @click="showKey = !showKey" :aria-pressed="showKey ? 'true' : 'false'"
                  :aria-label="showKey ? 'Ocultar chave' : 'Mostrar chave'">
                  <app-icon :name="showKey ? 'eyeOff' : 'eye'" :size="16"></app-icon>
                </button>
              </div>
              <span id="test-key-hint" class="field-hint">A chave fica só na memória desta página e não é salva. Não tem a chave completa? <a href="#/chaves">Crie uma em Chaves de API</a>.</span>
              <span v-if="errors.apiKey" id="test-key-error" class="field-error">{{ errors.apiKey }}</span>
            </div>
          </div>

          <div v-for="param in runner.params" :key="param.name" class="field" :class="{ 'has-error': errors[param.name] }">
            <div class="test-label-row">
              <label :for="'test-param-' + param.name">{{ param.label }}</label>
              <button type="button" class="btn-link small" @click="resetParam(param)">Restaurar exemplo</button>
            </div>
            <textarea v-if="param.type === 'textarea'" :id="'test-param-' + param.name" v-model="values[param.name]"
              class="test-editor" rows="14" spellcheck="false" autocapitalize="off" wrap="off"
              :aria-invalid="errors[param.name] ? 'true' : 'false'" :aria-describedby="'test-param-' + param.name + '-hint'"
              @keydown="onEditorKeydown"></textarea>
            <input v-else :id="'test-param-' + param.name" v-model="values[param.name]" type="text">
            <div class="test-editor-foot">
              <span :id="'test-param-' + param.name + '-hint'" class="field-hint">{{ param.hint }} <span class="nowrap">Ctrl + Enter executa.</span></span>
              <span class="field-hint nowrap" :class="{ 'field-error': tooLarge }">{{ sizeText }}</span>
            </div>
            <span v-if="errors[param.name]" class="field-error">{{ errors[param.name] }}</span>
          </div>

          <div class="test-actions">
            <button type="submit" class="btn btn-primary btn-lg" :disabled="busy">
              <span v-if="busy" class="spinner" aria-hidden="true"></span>
              <app-icon v-else name="play" :size="18"></app-icon>
              {{ busy ? 'Executando…' : 'Executar Teste' }}
            </button>
            <span class="small muted">A chamada é feita do seu navegador direto para <span class="mono">{{ runner.path }}</span>.</span>
          </div>
        </form>

        <section v-if="result" class="card" aria-live="polite" aria-labelledby="test-result-title">
          <div class="test-result-head">
            <h2 id="test-result-title" ref="resultTitle" tabindex="-1" class="card-title">Resultado</h2>
            <span class="badge" :class="result.ok ? 'badge-success' : 'badge-muted'">
              HTTP {{ result.status || '—' }} · {{ result.durationMs }} ms
            </span>
          </div>

          <template v-if="result.ok">
            <div class="alert alert-success" role="status">
              <app-icon name="check" class="alert-icon"></app-icon>
              <div>PDF gerado com sucesso.</div>
            </div>
            <dl class="stat-list">
              <div><dt>Tamanho do PDF</dt><dd>{{ formatBytes(result.size) }}</dd></div>
              <div v-if="result.charged != null"><dt>Valor cobrado</dt><dd>{{ formatMoney(result.charged) }}</dd></div>
              <div><dt>Saldo restante</dt><dd>{{ result.balance != null ? formatMoney(result.balance) : (store.account ? formatMoney(store.account.balance) : '—') }}</dd></div>
              <div v-if="result.transactionId"><dt>Transação</dt><dd class="mono small">{{ result.transactionId }}</dd></div>
            </dl>
            <div v-if="result.blocked > 0" class="alert alert-warning" role="note">
              <app-icon name="alert" class="alert-icon"></app-icon>
              <div>{{ result.blocked }} recurso(s) externo(s) foram ignorados. Só são baixadas imagens JPG/PNG por URL https pública; use <code>data:</code> URI para os demais.</div>
            </div>
            <div class="btn-row">
              <a class="btn btn-primary" :href="result.url" :download="runner.fileName">
                <app-icon name="download" :size="16"></app-icon> Baixar PDF
              </a>
              <a class="btn btn-ghost" :href="result.url" target="_blank" rel="noopener">
                <app-icon name="external" :size="16"></app-icon> Abrir em nova aba
              </a>
            </div>
            <iframe class="test-preview" :src="result.url" title="Pré-visualização do PDF gerado"></iframe>
          </template>

          <template v-else>
            <div class="alert alert-error" role="alert">
              <app-icon name="alert" class="alert-icon"></app-icon>
              <div>
                <strong class="mono">{{ result.error.code }}</strong> — {{ result.error.message }}
                <div v-if="resultHint" class="small">{{ resultHint }}</div>
                <div v-if="result.error.code === 'insufficient_balance'" class="btn-row"><a class="btn btn-ghost btn-sm" href="#/creditos">Como obter créditos</a></div>
                <div v-if="result.error.code === 'invalid_api_key'" class="btn-row"><a class="btn btn-ghost btn-sm" href="#/chaves">Ir para Chaves de API</a></div>
              </div>
            </div>
          </template>
        </section>

        <details class="card test-curl">
          <summary class="card-title">Mesma chamada com cURL</summary>
          <p class="card-sub">Para repetir o teste fora do painel. Troque <code>pdfs_SUA_CHAVE</code> pela sua chave.</p>
          <code-block :code="curlSnippet" lang="bash" title="cURL"></code-block>
        </details>
      </div>
    </div>`
};
