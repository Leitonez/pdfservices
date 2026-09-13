import { config } from '../config.js';
import { apiRequest, ApiError } from '../api.js';
import { TurnstileWidget } from '../turnstile.js';
import { saveSession, redirectIfLoggedIn, sanitizeNext, panelUrl } from '../session.js';
import { AuthShell, PasswordInput, ErrorAlert, AppIcon } from '../ui.js';

const params = new URLSearchParams(window.location.search);
const next = sanitizeNext(params.get('next'));

if (!redirectIfLoggedIn(next)) {
  Vue.createApp({
    components: { AuthShell, PasswordInput, ErrorAlert, AppIcon, TurnstileWidget },
    data() {
      return {
        config,
        email: '',
        password: '',
        token: '',
        busy: false,
        error: '',
        errorCode: '',
        fieldErrors: {},
        expired: params.get('motivo') === 'expirada',
        resend: { open: false, token: '', busy: false, message: '', error: '' }
      };
    },
    methods: {
      async submit() {
        this.error = '';
        this.errorCode = '';
        this.fieldErrors = {};
        if (!this.email.trim() || !this.password) {
          this.fieldErrors = {
            email: this.email.trim() ? '' : 'Informe seu e-mail.',
            password: this.password ? '' : 'Informe sua senha.'
          };
          return;
        }
        if (!this.token) {
          this.error = 'Aguarde a verificação anti-robô ser concluída e tente novamente.';
          return;
        }

        this.busy = true;
        try {
          const session = await apiRequest('/v1/auth/login', {
            method: 'POST',
            body: { email: this.email.trim(), password: this.password, turnstileToken: this.token }
          });
          saveSession(session);
          window.location.replace(panelUrl + next);
          return;
        } catch (error) {
          this.errorCode = error instanceof ApiError ? error.code : 'error';
          this.error = error.message;
          this.fieldErrors = (error && error.fields) || {};
          if (this.errorCode === 'invalid_credentials') {
            this.password = '';
            this.$nextTick(() => this.$refs.password && this.$refs.password.focus());
          }
        } finally {
          this.busy = false;
          this.$refs.captcha && this.$refs.captcha.reset();
        }
      },
      openResend() {
        this.resend = { open: true, token: '', busy: false, message: '', error: '' };
      },
      async sendVerification() {
        this.resend.error = '';
        if (!this.resend.token) {
          this.resend.error = 'Aguarde a verificação anti-robô ser concluída e tente novamente.';
          return;
        }
        this.resend.busy = true;
        try {
          const result = await apiRequest('/v1/auth/resend-verification', {
            method: 'POST',
            body: { email: this.email.trim(), turnstileToken: this.resend.token }
          });
          this.resend.message = result && result.message;
        } catch (error) {
          this.resend.error = error.message;
        } finally {
          this.resend.busy = false;
          this.$refs.resendCaptcha && this.$refs.resendCaptcha.reset();
        }
      }
    },
    template: `
      <auth-shell>
        <div class="auth-heading">
          <p class="eyebrow">Painel do cliente</p>
          <h1>Entrar</h1>
          <p class="muted">Acesse o consumo, as chaves de API e a documentação da sua conta.</p>
        </div>

        <div v-if="expired && !error" class="alert alert-info" role="status">
          <app-icon name="info" class="alert-icon"></app-icon>
          <div>Sua sessão expirou. Entre novamente para continuar.</div>
        </div>

        <error-alert :message="error">
          {{ error }}
          <template v-if="errorCode === 'email_not_verified' && !resend.open">
            <br><button type="button" class="btn-link" @click="openResend">Reenviar e-mail de confirmação</button>
          </template>
        </error-alert>

        <section v-if="resend.open" class="inline-panel" aria-labelledby="resend-title">
          <h2 id="resend-title" class="inline-panel-title">Reenviar e-mail de confirmação</h2>
          <div v-if="resend.message" class="alert alert-success" role="status">
            <app-icon name="mail" class="alert-icon"></app-icon>
            <div>{{ resend.message }}</div>
          </div>
          <template v-else>
            <p class="muted small">Enviaremos um novo link de confirmação para <strong>{{ email.trim() }}</strong>.</p>
            <error-alert :message="resend.error"></error-alert>
            <turnstile-widget ref="resendCaptcha" action="resend" @token="t => resend.token = t" @expired="resend.token = ''" @error="resend.token = ''"></turnstile-widget>
            <button type="button" class="btn btn-ghost btn-block" :disabled="resend.busy" @click="sendVerification">
              <span v-if="resend.busy" class="spinner" aria-hidden="true"></span>
              {{ resend.busy ? 'Enviando…' : 'Reenviar e-mail' }}
            </button>
          </template>
        </section>

        <form @submit.prevent="submit" novalidate>
          <div class="field" :class="{ 'has-error': fieldErrors.email }">
            <label for="email">E-mail</label>
            <input id="email" v-model="email" type="email" autocomplete="username" inputmode="email" required autofocus
              :aria-invalid="fieldErrors.email ? 'true' : 'false'" :aria-describedby="fieldErrors.email ? 'email-error' : null">
            <span v-if="fieldErrors.email" id="email-error" class="field-error">{{ fieldErrors.email }}</span>
          </div>
          <div class="field" :class="{ 'has-error': fieldErrors.password }">
            <div class="label-row">
              <label for="password">Senha</label>
              <a href="../esqueci-senha" class="small">Esqueci minha senha</a>
            </div>
            <password-input ref="password" id="password" v-model="password" autocomplete="current-password" required
              :aria-invalid="fieldErrors.password ? 'true' : 'false'" :aria-describedby="fieldErrors.password ? 'password-error' : null"></password-input>
            <span v-if="fieldErrors.password" id="password-error" class="field-error">{{ fieldErrors.password }}</span>
          </div>

          <turnstile-widget ref="captcha" action="login" @token="t => token = t" @expired="token = ''" @error="token = ''"></turnstile-widget>

          <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="busy">
            <span v-if="busy" class="spinner" aria-hidden="true"></span>
            {{ busy ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>

        <p class="auth-alt">
          Ainda não tem conta? <a :href="config.websiteUrl + '/cadastro'">Criar conta</a>
        </p>
      </auth-shell>`
  }).mount('#app');
}
