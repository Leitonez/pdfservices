// Minha conta: account data, password change, session and account deletion.

import { config } from '../../config.js';
import { authRequest, saveSession, clearSession, getSession } from '../../session.js';
import { formatMoney, formatDate, formatDateTime } from '../../format.js';
import { AppIcon, ErrorAlert, ModalDialog, PasswordInput } from '../../ui.js';
import { store, refreshAccount, refreshAccountQuietly, toast } from '../store.js';

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

function emptyPasswordForm() {
  return { current: '', next: '', confirm: '', busy: false, error: '', fields: {}, success: '' };
}

export const AccountView = {
  name: 'AccountView',
  components: { AppIcon, ErrorAlert, ModalDialog, PasswordInput },
  data() {
    return {
      config,
      pw: emptyPasswordForm(),
      del: { open: false, password: '', ack: false, busy: false, error: '', fieldError: '' },
      sessionExpiresAt: (getSession() || {}).expiresAt,
      minLength: MIN_LENGTH
    };
  },
  created() {
    refreshAccountQuietly();
  },
  computed: {
    account() {
      return store.account;
    },
    balanceText() {
      return this.account ? formatMoney(this.account.balance) : '—';
    }
  },
  methods: {
    formatDate,
    formatDateTime,
    async changePassword() {
      const pw = this.pw;
      pw.error = '';
      pw.success = '';
      const fields = {};
      if (!pw.current) {
        fields.currentPassword = 'Informe a senha atual.';
      }
      if (pw.next.length < MIN_LENGTH) {
        fields.newPassword = `A nova senha deve ter pelo menos ${MIN_LENGTH} caracteres.`;
      } else if (pw.next.length > MAX_LENGTH) {
        fields.newPassword = `A nova senha deve ter no máximo ${MAX_LENGTH} caracteres.`;
      } else if (pw.next === pw.current) {
        fields.newPassword = 'A nova senha deve ser diferente da atual.';
      }
      if (!fields.newPassword && pw.confirm !== pw.next) {
        fields.confirm = 'As senhas não conferem.';
      }
      pw.fields = fields;
      if (Object.keys(fields).length) {
        return;
      }

      pw.busy = true;
      try {
        const session = await authRequest('/v1/account/change-password', {
          method: 'POST',
          body: { currentPassword: pw.current, newPassword: pw.next }
        });
        saveSession(session);
        if (session.account) {
          store.account = session.account;
        }
        this.sessionExpiresAt = session.expiresAt;
        this.pw = emptyPasswordForm();
        this.pw.success = 'Senha alterada. As outras sessões abertas foram encerradas; esta continua ativa.';
        toast('Senha alterada com sucesso.');
      } catch (error) {
        pw.fields = error.fields || {};
        pw.error = Object.keys(pw.fields).length ? '' : error.message;
      } finally {
        pw.busy = false;
      }
    },
    openDelete() {
      this.del = { open: true, password: '', ack: false, busy: false, error: '', fieldError: '' };
      refreshAccountQuietly();
    },
    closeDelete() {
      this.del = { open: false, password: '', ack: false, busy: false, error: '', fieldError: '' };
    },
    async confirmDelete() {
      const del = this.del;
      del.error = '';
      del.fieldError = '';
      if (!del.password) {
        del.fieldError = 'Informe sua senha.';
        return;
      }
      if (!del.ack) {
        del.error = 'Marque a caixa de ciência para continuar.';
        return;
      }
      del.busy = true;
      try {
        await authRequest('/v1/account/delete', { method: 'POST', body: { password: del.password } });
        clearSession();
        window.location.replace(config.websiteUrl + '/');
      } catch (error) {
        del.fieldError = (error.fields && error.fields.password) || '';
        del.error = del.fieldError ? '' : error.message;
        del.busy = false;
      }
    },
    retry() {
      refreshAccount().catch(() => {});
    }
  },
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Minha conta</h1>
          <p>Dados cadastrais, senha e exclusão da conta.</p>
        </div>
      </div>

      <div class="stack">
        <section class="card" aria-labelledby="account-title">
          <div class="card-head">
            <div>
              <h2 id="account-title" class="card-title">Dados da conta</h2>
              <p class="card-sub">Para corrigir razão social, CNPJ ou e-mail, escreva para <a :href="config.contactUrl">{{ config.contactEmail }}</a>.</p>
            </div>
          </div>
          <div v-if="!account" class="page-loading" role="status"><span class="spinner" aria-hidden="true"></span> Carregando…</div>
          <dl v-else class="dl-grid">
            <div><dt>Nome</dt><dd>{{ account.name || '—' }}</dd></div>
            <div>
              <dt>E-mail</dt>
              <dd>
                {{ account.email }}
                <span v-if="account.emailVerified" class="badge badge-success">Confirmado</span>
                <span v-else class="badge badge-muted">Não confirmado</span>
              </dd>
            </div>
            <div><dt>Razão social</dt><dd>{{ account.companyName }}</dd></div>
            <div><dt>CNPJ</dt><dd class="mono">{{ account.cnpj }}</dd></div>
            <div><dt>Cliente desde</dt><dd>{{ formatDate(account.createdAt) }}</dd></div>
            <div><dt>Saldo atual</dt><dd>{{ balanceText }} <a href="#/creditos" class="small">Obter créditos</a></dd></div>
          </dl>
        </section>

        <div class="two-col">
          <section class="card" aria-labelledby="password-title">
            <div class="card-head">
              <div>
                <h2 id="password-title" class="card-title">Trocar senha</h2>
                <p class="card-sub">Mínimo de {{ minLength }} caracteres. As outras sessões abertas serão encerradas.</p>
              </div>
            </div>
            <div v-if="pw.success" class="alert alert-success" role="status">
              <app-icon name="check" class="alert-icon"></app-icon><div>{{ pw.success }}</div>
            </div>
            <error-alert :message="pw.error"></error-alert>
            <form @submit.prevent="changePassword" novalidate>
              <input v-if="account" class="sr-only" type="email" autocomplete="username" :value="account.email" tabindex="-1" aria-hidden="true" readonly>
              <div class="field" :class="{ 'has-error': pw.fields.currentPassword }">
                <label for="current-password">Senha atual</label>
                <password-input id="current-password" v-model="pw.current" autocomplete="current-password" required
                  :aria-invalid="pw.fields.currentPassword ? 'true' : 'false'" :aria-describedby="pw.fields.currentPassword ? 'current-password-error' : null"></password-input>
                <span v-if="pw.fields.currentPassword" id="current-password-error" class="field-error">{{ pw.fields.currentPassword }}</span>
              </div>
              <div class="field" :class="{ 'has-error': pw.fields.newPassword }">
                <label for="new-password">Nova senha</label>
                <password-input id="new-password" v-model="pw.next" autocomplete="new-password" required maxlength="128"
                  :aria-invalid="pw.fields.newPassword ? 'true' : 'false'" :aria-describedby="pw.fields.newPassword ? 'new-password-error' : null"></password-input>
                <span v-if="pw.fields.newPassword" id="new-password-error" class="field-error">{{ pw.fields.newPassword }}</span>
              </div>
              <div class="field" :class="{ 'has-error': pw.fields.confirm }">
                <label for="confirm-password">Confirme a nova senha</label>
                <password-input id="confirm-password" v-model="pw.confirm" autocomplete="new-password" required maxlength="128"
                  :aria-invalid="pw.fields.confirm ? 'true' : 'false'" :aria-describedby="pw.fields.confirm ? 'confirm-password-error' : null"></password-input>
                <span v-if="pw.fields.confirm" id="confirm-password-error" class="field-error">{{ pw.fields.confirm }}</span>
              </div>
              <button type="submit" class="btn btn-primary" :disabled="pw.busy">
                <span v-if="pw.busy" class="spinner" aria-hidden="true"></span>
                {{ pw.busy ? 'Salvando…' : 'Alterar senha' }}
              </button>
            </form>
          </section>

          <section class="card" aria-labelledby="session-title">
            <div class="card-head">
              <div>
                <h2 id="session-title" class="card-title">Sessão e segurança</h2>
              </div>
            </div>
            <ul class="danger-list">
              <li>Esta sessão expira em <strong>{{ formatDateTime(sessionExpiresAt) }}</strong>; depois disso, basta entrar de novo.</li>
              <li>Ao trocar ou redefinir a senha, todas as outras sessões são encerradas.</li>
              <li>Após várias tentativas de login com senha errada, a conta é bloqueada por alguns minutos.</li>
              <li>A CODECYCLE nunca pede sua senha ou chave de API por e-mail ou telefone.</li>
            </ul>
          </section>
        </div>

        <section class="card danger-zone" aria-labelledby="danger-title">
          <div class="card-head">
            <h2 id="danger-title" class="card-title"><app-icon name="alert"></app-icon> Zona de perigo</h2>
          </div>
          <div class="danger-zone-body">
            <p><strong>Excluir conta.</strong> Remove seus dados pessoais, revoga todas as chaves de API e descarta o saldo restante. Não é possível desfazer.</p>
            <button type="button" class="btn btn-danger" @click="openDelete">Excluir conta</button>
          </div>
        </section>
      </div>

      <modal-dialog v-if="del.open" title="Excluir conta definitivamente" danger wide @close="closeDelete">
        <p>Esta ação é <strong>irreversível</strong>. Ao confirmar:</p>
        <ul class="danger-list">
          <li>seu nome, e-mail e senha são apagados, e você perde o acesso ao painel;</li>
          <li>todas as chaves de API são revogadas — integrações que as usam param na hora;</li>
          <li>os dados da empresa (razão social e CNPJ) e o histórico de transações são mantidos pelo prazo exigido em lei, por obrigações legais e fiscais;</li>
          <li>o e-mail fica livre para um novo cadastro no futuro, que começará do zero.</li>
        </ul>
        <div class="forfeit-box">
          <span>Saldo que será <strong style="font-size: inherit">perdido</strong>:</span>
          <strong>{{ balanceText }}</strong>
        </div>
        <error-alert :message="del.error"></error-alert>
        <form id="delete-account-form" @submit.prevent="confirmDelete" novalidate>
          <div class="field" :class="{ 'has-error': del.fieldError }">
            <label for="delete-password">Confirme com sua senha</label>
            <password-input id="delete-password" v-model="del.password" autocomplete="current-password" required autofocus
              :aria-invalid="del.fieldError ? 'true' : 'false'" :aria-describedby="del.fieldError ? 'delete-password-error' : null"></password-input>
            <span v-if="del.fieldError" id="delete-password-error" class="field-error">{{ del.fieldError }}</span>
          </div>
          <label class="checkbox">
            <input type="checkbox" v-model="del.ack">
            <span>Entendo que a exclusão é irreversível e que o saldo de {{ balanceText }} será perdido.</span>
          </label>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="closeDelete">Cancelar</button>
          <button type="submit" form="delete-account-form" class="btn btn-danger" :disabled="del.busy || !del.ack || !del.password">
            <span v-if="del.busy" class="spinner" aria-hidden="true"></span>
            {{ del.busy ? 'Excluindo…' : 'Excluir minha conta' }}
          </button>
        </template>
      </modal-dialog>
    </div>`
};
