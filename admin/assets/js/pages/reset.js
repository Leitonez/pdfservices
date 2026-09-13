import { apiRequest } from '../api.js';
import { redirectIfLoggedIn, clearSession } from '../session.js';
import { AuthShell, PasswordInput, ErrorAlert, AppIcon, takeHashToken } from '../ui.js';

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;
const token = takeHashToken();

// Without a token this is just an entry page: logged-in users go to the panel.
// With a token the link is always honored (it proves ownership of the e-mail).
if (token || !redirectIfLoggedIn()) {
  Vue.createApp({
    components: { AuthShell, PasswordInput, ErrorAlert, AppIcon },
    data() {
      return {
        token,
        password: '',
        confirm: '',
        busy: false,
        error: '',
        errorCode: '',
        fieldErrors: {},
        message: '',
        minLength: MIN_LENGTH
      };
    },
    methods: {
      validate() {
        const errors = {};
        if (this.password.length < MIN_LENGTH) {
          errors.password = `A senha deve ter pelo menos ${MIN_LENGTH} caracteres.`;
        } else if (this.password.length > MAX_LENGTH) {
          errors.password = `A senha deve ter no máximo ${MAX_LENGTH} caracteres.`;
        }
        if (!errors.password && this.confirm !== this.password) {
          errors.confirm = 'As senhas não conferem.';
        }
        this.fieldErrors = errors;
        return Object.keys(errors).length === 0;
      },
      async submit() {
        this.error = '';
        this.errorCode = '';
        if (!this.validate()) {
          return;
        }
        this.busy = true;
        try {
          const result = await apiRequest('/v1/auth/reset-password', {
            method: 'POST',
            body: { token: this.token, password: this.password }
          });
          // Every existing session was invalidated by the new password.
          clearSession();
          this.message = (result && result.message) || 'Senha redefinida! Você já pode entrar com a nova senha.';
        } catch (error) {
          this.errorCode = error.code;
          this.error = error.message;
          this.fieldErrors = error.fields || {};
        } finally {
          this.busy = false;
        }
      }
    },
    template: `
      <auth-shell>
        <div class="auth-heading">
          <p class="eyebrow">Recuperar acesso</p>
          <h1>Criar nova senha</h1>
        </div>

        <template v-if="!token">
          <div class="alert alert-error" role="alert">
            <app-icon name="alert" class="alert-icon"></app-icon>
            <div>Link inválido ou incompleto. Abra o link exatamente como recebido no e-mail ou solicite uma nova redefinição.</div>
          </div>
          <a href="../esqueci-senha" class="btn btn-primary btn-block">Solicitar novo link</a>
          <p class="auth-alt"><a href="../login">Voltar para o login</a></p>
        </template>

        <template v-else-if="message">
          <div class="alert alert-success" role="status">
            <app-icon name="check" class="alert-icon"></app-icon>
            <div>{{ message }}</div>
          </div>
          <a href="../login" class="btn btn-primary btn-block btn-lg">Ir para o login</a>
        </template>

        <template v-else>
          <p class="muted">Escolha uma senha com pelo menos {{ minLength }} caracteres. Por segurança, as sessões abertas serão encerradas.</p>
          <error-alert :message="error">
            {{ error }}
            <template v-if="errorCode === 'invalid_token'">
              <br><a href="../esqueci-senha">Solicitar um novo link</a>
            </template>
          </error-alert>
          <form @submit.prevent="submit" novalidate>
            <div class="field" :class="{ 'has-error': fieldErrors.password }">
              <label for="password">Nova senha</label>
              <password-input id="password" v-model="password" autocomplete="new-password" required autofocus :maxlength="128"
                :aria-invalid="fieldErrors.password ? 'true' : 'false'" aria-describedby="password-hint password-error"></password-input>
              <span id="password-hint" class="field-hint">Mínimo de {{ minLength }} caracteres. Frases longas são ótimas senhas.</span>
              <span v-if="fieldErrors.password" id="password-error" class="field-error">{{ fieldErrors.password }}</span>
            </div>
            <div class="field" :class="{ 'has-error': fieldErrors.confirm }">
              <label for="confirm">Confirme a nova senha</label>
              <password-input id="confirm" v-model="confirm" autocomplete="new-password" required :maxlength="128"
                :aria-invalid="fieldErrors.confirm ? 'true' : 'false'" :aria-describedby="fieldErrors.confirm ? 'confirm-error' : null"></password-input>
              <span v-if="fieldErrors.confirm" id="confirm-error" class="field-error">{{ fieldErrors.confirm }}</span>
            </div>
            <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="busy">
              <span v-if="busy" class="spinner" aria-hidden="true"></span>
              {{ busy ? 'Salvando…' : 'Salvar nova senha' }}
            </button>
          </form>
          <p class="auth-alt"><a href="../login">Voltar para o login</a></p>
        </template>
      </auth-shell>`
  }).mount('#app');
}
