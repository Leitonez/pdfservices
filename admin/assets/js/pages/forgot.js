import { apiRequest } from '../api.js';
import { TurnstileWidget } from '../turnstile.js';
import { redirectIfLoggedIn } from '../session.js';
import { AuthShell, ErrorAlert, AppIcon } from '../ui.js';

if (!redirectIfLoggedIn()) {
  Vue.createApp({
    components: { AuthShell, ErrorAlert, AppIcon, TurnstileWidget },
    data() {
      return { email: '', token: '', busy: false, error: '', emailError: '', message: '' };
    },
    methods: {
      async submit() {
        this.error = '';
        this.emailError = '';
        const email = this.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          this.emailError = 'Informe um e-mail válido.';
          return;
        }
        if (!this.token) {
          this.error = 'Aguarde a verificação anti-robô ser concluída e tente novamente.';
          return;
        }
        this.busy = true;
        try {
          const result = await apiRequest('/v1/auth/forgot-password', {
            method: 'POST',
            body: { email, turnstileToken: this.token }
          });
          this.message = (result && result.message) || 'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.';
        } catch (error) {
          this.error = error.message;
          this.emailError = (error.fields && error.fields.email) || '';
        } finally {
          this.busy = false;
          this.$refs.captcha && this.$refs.captcha.reset();
        }
      }
    },
    template: `
      <auth-shell>
        <div class="auth-heading">
          <p class="eyebrow">Recuperar acesso</p>
          <h1>Esqueci minha senha</h1>
          <p class="muted" v-if="!message">Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>
        </div>

        <template v-if="message">
          <div class="alert alert-success" role="status">
            <app-icon name="mail" class="alert-icon"></app-icon>
            <div>{{ message }}</div>
          </div>
          <p class="muted small">O link é válido por tempo limitado. Confira também a caixa de spam.</p>
          <a href="../login" class="btn btn-ghost btn-block">Voltar para o login</a>
        </template>

        <form v-else @submit.prevent="submit" novalidate>
          <error-alert :message="error"></error-alert>
          <div class="field" :class="{ 'has-error': emailError }">
            <label for="email">E-mail</label>
            <input id="email" v-model="email" type="email" autocomplete="email" inputmode="email" required autofocus
              :aria-invalid="emailError ? 'true' : 'false'" :aria-describedby="emailError ? 'email-error' : null">
            <span v-if="emailError" id="email-error" class="field-error">{{ emailError }}</span>
          </div>
          <turnstile-widget ref="captcha" action="forgot" @token="t => token = t" @expired="token = ''" @error="token = ''"></turnstile-widget>
          <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="busy">
            <span v-if="busy" class="spinner" aria-hidden="true"></span>
            {{ busy ? 'Enviando…' : 'Enviar link de redefinição' }}
          </button>
        </form>

        <p v-if="!message" class="auth-alt"><a href="../login">Voltar para o login</a></p>
      </auth-shell>`
  }).mount('#app');
}
