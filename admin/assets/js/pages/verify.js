import { apiRequest } from '../api.js';
import { redirectIfLoggedIn } from '../session.js';
import { AuthShell, AppIcon, takeHashToken } from '../ui.js';

const token = takeHashToken();

// Without a token there is nothing to verify: logged-in users go to the panel.
if (token || !redirectIfLoggedIn()) {
  Vue.createApp({
    components: { AuthShell, AppIcon },
    data() {
      return { state: token ? 'loading' : 'error', message: token ? '' : 'Link inválido ou incompleto. Abra o link exatamente como recebido no e-mail.' };
    },
    async mounted() {
      if (!token) {
        return;
      }
      try {
        const result = await apiRequest('/v1/auth/verify-email', { method: 'POST', body: { token } });
        this.state = 'success';
        this.message = (result && result.message) || 'E-mail confirmado! Você já pode entrar.';
      } catch (error) {
        this.state = 'error';
        this.message = error.message;
      }
      this.$nextTick(() => this.$refs.heading && this.$refs.heading.focus());
    },
    template: `
      <auth-shell>
        <div class="auth-heading">
          <p class="eyebrow">Confirmação de e-mail</p>
          <h1 ref="heading" tabindex="-1">
            {{ state === 'loading' ? 'Confirmando seu e-mail…' : state === 'success' ? 'E-mail confirmado' : 'Não foi possível confirmar' }}
          </h1>
        </div>

        <div v-if="state === 'loading'" class="status-block" role="status">
          <span class="spinner spinner-lg" aria-hidden="true"></span>
          <span class="muted">Aguarde um instante.</span>
        </div>

        <template v-else-if="state === 'success'">
          <div class="alert alert-success" role="status">
            <app-icon name="check" class="alert-icon"></app-icon>
            <div>{{ message }}</div>
          </div>
          <a href="../login" class="btn btn-primary btn-block btn-lg">Entrar</a>
        </template>

        <template v-else>
          <div class="alert alert-error" role="alert">
            <app-icon name="alert" class="alert-icon"></app-icon>
            <div>{{ message }}</div>
          </div>
          <p class="muted small">
            Links de confirmação expiram e só podem ser usados uma vez. Tente entrar: se o e-mail ainda não estiver confirmado,
            a tela de login oferece a opção de receber um novo link.
          </p>
          <a href="../login" class="btn btn-ghost btn-block">Ir para o login</a>
        </template>
      </auth-shell>`
  }).mount('#app');
}
