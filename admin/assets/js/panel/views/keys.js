// Chaves de API: list, create (the full key is shown only once) and delete.

import { config } from '../../config.js';
import { authRequest } from '../../session.js';
import { formatDateTime, formatDate } from '../../format.js';
import { AppIcon, ErrorAlert, ModalDialog, CopyButton, CodeBlock } from '../../ui.js';
import { toast } from '../store.js';

const MAX_KEYS = 20;

export const KeysView = {
  name: 'KeysView',
  components: { AppIcon, ErrorAlert, ModalDialog, CopyButton, CodeBlock },
  data() {
    return {
      keys: [],
      loading: true,
      error: '',
      maxKeys: MAX_KEYS,
      create: { open: false, name: '', busy: false, error: '', fieldError: '', key: '', created: null },
      remove: { key: null, busy: false, error: '' }
    };
  },
  created() {
    this.load();
  },
  computed: {
    limitReached() {
      return this.keys.length >= MAX_KEYS;
    },
    snippet() {
      return `curl -X POST "${config.apiUrl}/v1/html2pdf/json" \\
  -H "X-Api-Key: pdfs_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"html": "<h1>Olá, PDF!</h1>"}' \\
  -o documento.pdf`;
    }
  },
  methods: {
    formatDate,
    formatDateTime,
    masked(key) {
      return (key.prefix || 'pdfs_') + '…';
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const keys = await authRequest('/v1/account/api-keys');
        this.keys = Array.isArray(keys) ? keys : [];
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.create = { open: true, name: '', busy: false, error: '', fieldError: '', key: '', created: null };
    },
    closeCreate() {
      // Drop the plain key from memory as soon as the dialog closes.
      this.create = { open: false, name: '', busy: false, error: '', fieldError: '', key: '', created: null };
    },
    async submitCreate() {
      const name = this.create.name.trim();
      this.create.error = '';
      this.create.fieldError = '';
      if (!name) {
        this.create.fieldError = 'Dê um nome à chave (até 60 caracteres).';
        return;
      }
      this.create.busy = true;
      try {
        const created = await authRequest('/v1/account/api-keys', { method: 'POST', body: { name } });
        this.create.key = created.key;
        this.create.created = { id: created.id, name: created.name, prefix: created.prefix, createdAt: created.createdAt };
        this.keys.unshift({ ...this.create.created });
      } catch (error) {
        this.create.error = error.message;
        this.create.fieldError = (error.fields && error.fields.name) || '';
      } finally {
        this.create.busy = false;
      }
    },
    askDelete(key) {
      this.remove = { key, busy: false, error: '' };
    },
    closeDelete() {
      this.remove = { key: null, busy: false, error: '' };
    },
    async confirmDelete() {
      const key = this.remove.key;
      this.remove.busy = true;
      this.remove.error = '';
      try {
        await authRequest('/v1/account/api-keys/' + encodeURIComponent(key.id), { method: 'DELETE' });
      } catch (error) {
        if (error.status !== 404) {
          this.remove.error = error.message;
          this.remove.busy = false;
          return;
        }
      }
      this.keys = this.keys.filter((k) => k.id !== key.id);
      this.closeDelete();
      toast(`Chave "${key.name}" excluída.`);
    }
  },
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Chaves de API</h1>
          <p>Cada integração autentica com uma chave no cabeçalho <code>X-Api-Key</code>. Use chaves diferentes por sistema ou ambiente para identificar o consumo no extrato.</p>
        </div>
        <button v-if="keys.length" type="button" class="btn btn-primary" @click="openCreate" :disabled="limitReached">
          <app-icon name="plus" :size="16"></app-icon> Nova chave
        </button>
      </div>

      <error-alert :message="error">
        Não foi possível carregar as chaves. {{ error }}
        <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" @click="load">Tentar novamente</button></div>
      </error-alert>

      <div class="stack">
        <div v-if="loading" class="page-loading" role="status"><span class="spinner" aria-hidden="true"></span> Carregando chaves…</div>

        <section v-else-if="!error && !keys.length" class="card empty-state">
          <div class="empty-icon"><app-icon name="key" :size="26"></app-icon></div>
          <h3>Crie sua primeira chave de API</h3>
          <p>Com uma chave você já pode converter HTML em PDF a partir do seu sistema. Leva menos de um minuto: dê um nome, copie a chave e siga o guia de integração.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" @click="openCreate"><app-icon name="plus" :size="16"></app-icon> Criar chave</button>
            <a class="btn btn-ghost" href="#/documentacao">Ver documentação</a>
          </div>
        </section>

        <section v-else-if="keys.length" class="card card-flush" aria-labelledby="keys-title">
          <div class="card-head">
            <div>
              <h2 id="keys-title" class="card-title">Suas chaves</h2>
              <p class="card-sub">{{ keys.length }} de {{ maxKeys }} chaves. Por segurança, só o início de cada chave é exibido.</p>
            </div>
          </div>
          <div v-if="limitReached" style="padding: 0 24px">
            <div class="alert alert-warning" role="status">
              <app-icon name="alert" class="alert-icon"></app-icon>
              <div>Você atingiu o limite de {{ maxKeys }} chaves. Exclua uma chave que não usa mais para criar outra.</div>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Chave</th>
                  <th scope="col">Criada em</th>
                  <th scope="col">Último uso</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="k in keys" :key="k.id">
                  <td data-label="Nome"><span class="cell-main">{{ k.name }}</span></td>
                  <td data-label="Chave"><span class="key-prefix" :title="'Começa com ' + k.prefix">{{ masked(k) }}</span></td>
                  <td data-label="Criada em" class="nowrap">{{ formatDate(k.createdAt) }}</td>
                  <td data-label="Último uso" class="nowrap">
                    <span v-if="k.lastUsedAt">{{ formatDateTime(k.lastUsedAt) }}</span>
                    <span v-else class="faint">Nunca usada</span>
                  </td>
                  <td class="actions">
                    <button type="button" class="btn btn-danger-ghost btn-sm" @click="askDelete(k)" :aria-label="'Excluir a chave ' + k.name">
                      <app-icon name="trash" :size="15"></app-icon> Excluir
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="!loading" class="card tip-card" aria-labelledby="tip-title">
          <div class="empty-icon"><app-icon name="code" :size="22"></app-icon></div>
          <div style="min-width: 0; flex: 1">
            <h2 id="tip-title" class="card-title">Como usar a chave</h2>
            <p class="card-sub">Envie a chave no cabeçalho <code>X-Api-Key</code>. Guarde-a como segredo do servidor (variável de ambiente ou cofre de segredos) — nunca em código que roda no navegador ou em repositórios.</p>
            <code-block :code="snippet" lang="bash" title="Teste rápido com cURL"></code-block>
            <a href="#/documentacao">Guia completo de integração, com exemplos em C#, Node.js, Python e PHP →</a>
          </div>
        </section>
      </div>

      <modal-dialog v-if="create.open && !create.key" title="Nova chave de API" @close="closeCreate">
        <form id="create-key-form" @submit.prevent="submitCreate" novalidate>
          <error-alert :message="create.fieldError ? '' : create.error"></error-alert>
          <div class="field" :class="{ 'has-error': create.fieldError }">
            <label for="key-name">Nome da chave</label>
            <input id="key-name" v-model="create.name" type="text" maxlength="60" required autofocus autocomplete="off"
              placeholder="Ex.: ERP produção" aria-describedby="key-name-hint key-name-error" :aria-invalid="create.fieldError ? 'true' : 'false'">
            <span id="key-name-hint" class="field-hint">Um nome que identifique onde a chave será usada (até 60 caracteres).</span>
            <span v-if="create.fieldError" id="key-name-error" class="field-error">{{ create.fieldError }}</span>
          </div>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="closeCreate">Cancelar</button>
          <button type="submit" form="create-key-form" class="btn btn-primary" :disabled="create.busy">
            <span v-if="create.busy" class="spinner" aria-hidden="true"></span>
            {{ create.busy ? 'Criando…' : 'Criar chave' }}
          </button>
        </template>
      </modal-dialog>

      <modal-dialog v-if="create.key" title="Chave criada" persistent wide @close="closeCreate">
        <p>A chave <strong>{{ create.created.name }}</strong> está pronta para uso.</p>
        <div class="alert alert-warning" role="alert">
          <app-icon name="alert" class="alert-icon"></app-icon>
          <div><strong>Copie e guarde esta chave agora.</strong> Por segurança, ela não será exibida novamente — guardamos apenas um resumo criptográfico dela. Se perdê-la, exclua-a e crie outra.</div>
        </div>
        <label class="small muted" for="new-key">Sua chave de API</label>
        <div class="key-reveal">
          <code id="new-key">{{ create.key }}</code>
          <copy-button :text="create.key" label="Copiar chave" variant="primary" :small="false"></copy-button>
        </div>
        <p class="small muted">Guarde-a como segredo do servidor. Nunca a coloque em código que roda no navegador, em aplicativos móveis ou em repositórios.</p>
        <template #footer>
          <button type="button" class="btn btn-primary" @click="closeCreate">Já copiei e guardei a chave</button>
        </template>
      </modal-dialog>

      <modal-dialog v-if="remove.key" title="Excluir chave de API" danger @close="closeDelete">
        <p>A chave <strong>{{ remove.key.name }}</strong> (<span class="mono">{{ masked(remove.key) }}</span>) será revogada.</p>
        <div class="alert alert-error">
          <app-icon name="alert" class="alert-icon"></app-icon>
          <div>Integrações que ainda usam esta chave <strong>param de funcionar na hora</strong>, recebendo o erro <code>401 invalid_api_key</code>. Esta ação não pode ser desfeita.</div>
        </div>
        <error-alert :message="remove.error"></error-alert>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="closeDelete" autofocus>Cancelar</button>
          <button type="button" class="btn btn-danger" @click="confirmDelete" :disabled="remove.busy">
            <span v-if="remove.busy" class="spinner" aria-hidden="true"></span>
            {{ remove.busy ? 'Excluindo…' : 'Excluir chave' }}
          </button>
        </template>
      </modal-dialog>
    </div>`
};
