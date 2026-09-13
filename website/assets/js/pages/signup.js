// Signup page: client-side validation, Turnstile, POST /v1/auth/signup and the "check your e-mail" state
// with resend (POST /v1/auth/resend-verification). Turnstile tokens are single use: every submit resets the widget.

import { apiRequest } from '../api.js';
import { config } from '../config.js';
import { isValidCnpj, maskCnpj, normalizeCnpj } from '../cnpj.js';
import { formatMoney } from '../format.js';
import { mountChrome } from '../site.js';
import { TurnstileWidget } from '../turnstile.js';

const { createApp } = window.Vue;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const RESEND_COOLDOWN_SECONDS = 60;
const FIELD_ORDER = ['name', 'companyName', 'cnpj', 'email', 'password', 'confirmPassword', 'acceptTerms'];
const FIELD_IDS = {
  name: 'f-name',
  companyName: 'f-company',
  cnpj: 'f-cnpj',
  email: 'f-email',
  password: 'f-password',
  confirmPassword: 'f-confirm',
  acceptTerms: 'f-terms'
};

mountChrome();

createApp({
  components: { TurnstileWidget },
  data() {
    return {
      config,
      price: 0.001,
      form: {
        name: '',
        companyName: '',
        cnpj: '',
        email: '',
        password: '',
        confirmPassword: '',
        acceptTerms: false
      },
      errors: {},
      alert: '',
      attempted: false,
      showPassword: false,
      token: '',
      submitting: false,
      done: false,
      sentTo: '',
      resendToken: '',
      resending: false,
      resendMessage: '',
      resendError: '',
      cooldown: 0
    };
  },
  computed: {
    loginUrl() {
      return config.adminUrl + '/login';
    },
    priceLabel() {
      return formatMoney(this.price);
    },
    canSubmit() {
      return Boolean(this.token) && !this.submitting;
    },
    canResend() {
      return Boolean(this.resendToken) && !this.resending && this.cooldown === 0;
    },
    resendLabel() {
      if (this.resending) return 'Reenviando…';
      if (this.cooldown > 0) return 'Reenviar em ' + this.cooldown + 's';
      return 'Reenviar e-mail';
    },
    strength() {
      const value = this.form.password;
      if (!value) return 0;
      if (value.length < PASSWORD_MIN) return 1;
      const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
      let level = 2;
      if (value.length >= 14 || classes >= 3) level = 3;
      if ((value.length >= 14 && classes >= 3) || value.length >= 20) level = 4;
      return level;
    },
    strengthLabel() {
      return ['', 'curta demais', 'razoável', 'boa', 'forte'][this.strength];
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
      // Fallback price stays.
    }
  },
  beforeUnmount() {
    clearInterval(this.cooldownTimer);
  },
  methods: {
    validateField(key) {
      const f = this.form;
      switch (key) {
        case 'name': {
          const value = f.name.trim();
          if (value.length < 3) return 'Informe seu nome completo.';
          if (value.length > 120) return 'Use no máximo 120 caracteres.';
          return '';
        }
        case 'companyName': {
          const value = f.companyName.trim();
          if (value.length < 2) return 'Informe a razão social da empresa.';
          if (value.length > 200) return 'Use no máximo 200 caracteres.';
          return '';
        }
        case 'cnpj':
          if (!normalizeCnpj(f.cnpj)) return 'Informe o CNPJ da empresa.';
          return isValidCnpj(f.cnpj) ? '' : 'CNPJ inválido. Confira os caracteres digitados.';
        case 'email': {
          const value = f.email.trim();
          if (!value) return 'Informe seu e-mail.';
          return value.length <= 254 && EMAIL_PATTERN.test(value) ? '' : 'E-mail inválido.';
        }
        case 'password':
          if (f.password.length < PASSWORD_MIN) return 'A senha deve ter pelo menos ' + PASSWORD_MIN + ' caracteres.';
          if (f.password.length > PASSWORD_MAX) return 'A senha deve ter no máximo ' + PASSWORD_MAX + ' caracteres.';
          return '';
        case 'confirmPassword':
          if (!f.confirmPassword) return 'Confirme a senha.';
          return f.confirmPassword === f.password ? '' : 'As senhas não conferem.';
        case 'acceptTerms':
          return f.acceptTerms ? '' : 'É preciso aceitar os Termos de Uso e a Política de Privacidade.';
        default:
          return '';
      }
    },
    /** Live re-validation once the user has tried to submit. */
    revalidate(key) {
      if (this.attempted || this.errors[key]) {
        this.errors[key] = this.validateField(key);
        if (key === 'password' && this.form.confirmPassword) {
          this.errors.confirmPassword = this.validateField('confirmPassword');
        }
      }
    },
    /** On blur, only flag fields that already have content (no errors for untouched fields). */
    blurValidate(key) {
      const value = this.form[key];
      if (typeof value === 'string' && value.trim() !== '') {
        this.errors[key] = this.validateField(key);
      }
    },
    onCnpjInput(event) {
      const masked = maskCnpj(event.target.value);
      this.form.cnpj = masked;
      event.target.value = masked;
      this.revalidate('cnpj');
    },
    focusField(key) {
      this.$nextTick(() => {
        const element = document.getElementById(FIELD_IDS[key]);
        if (element) element.focus();
      });
    },
    firstError() {
      return FIELD_ORDER.find((key) => this.errors[key]);
    },
    resetCaptcha() {
      if (this.$refs.captcha) this.$refs.captcha.reset();
      this.token = '';
    },
    async submit() {
      this.alert = '';
      this.attempted = true;
      const errors = {};
      for (const key of FIELD_ORDER) {
        errors[key] = this.validateField(key);
      }
      this.errors = errors;

      const first = this.firstError();
      if (first) {
        this.alert = 'Verifique os campos destacados.';
        this.focusField(first);
        return;
      }
      if (!this.token) {
        this.alert = 'Conclua a verificação anti-robô para continuar.';
        return;
      }

      const email = this.form.email.trim();
      this.submitting = true;
      let failure = null;
      try {
        await apiRequest('/v1/auth/signup', {
          method: 'POST',
          body: {
            name: this.form.name.trim(),
            companyName: this.form.companyName.trim(),
            cnpj: normalizeCnpj(this.form.cnpj),
            email,
            password: this.form.password,
            acceptTerms: true,
            turnstileToken: this.token
          }
        });
      } catch (error) {
        failure = error;
      }
      this.submitting = false;
      this.resetCaptcha();

      if (failure) {
        const fields = failure.fields || {};
        if (failure.code === 'validation_error' && Object.keys(fields).length > 0) {
          this.errors = { ...fields };
          this.alert = failure.message;
          const firstField = this.firstError();
          if (firstField) this.focusField(firstField);
        } else {
          this.alert = failure.message;
        }
        return;
      }

      this.sentTo = email;
      this.form.password = '';
      this.form.confirmPassword = '';
      this.done = true;
      this.resendMessage = '';
      this.resendError = '';
      window.scrollTo({ top: 0 });
      this.$nextTick(() => this.$refs.successTitle && this.$refs.successTitle.focus());
    },
    async resend() {
      if (!this.canResend) return;
      this.resending = true;
      this.resendMessage = '';
      this.resendError = '';
      let result = null;
      let failure = null;
      try {
        result = await apiRequest('/v1/auth/resend-verification', {
          method: 'POST',
          body: { email: this.sentTo, turnstileToken: this.resendToken }
        });
      } catch (error) {
        failure = error;
      }
      this.resending = false;
      if (this.$refs.resendCaptcha) this.$refs.resendCaptcha.reset();
      this.resendToken = '';

      if (failure) {
        this.resendError = failure.message;
        return;
      }
      this.resendMessage = (result && result.message) || 'Se houver uma conta aguardando confirmação com este e-mail, enviaremos um novo link.';
      this.startCooldown();
    },
    startCooldown() {
      this.cooldown = RESEND_COOLDOWN_SECONDS;
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = setInterval(() => {
        this.cooldown -= 1;
        if (this.cooldown <= 0) {
          this.cooldown = 0;
          clearInterval(this.cooldownTimer);
        }
      }, 1000);
    },
    useAnotherEmail() {
      clearInterval(this.cooldownTimer);
      this.cooldown = 0;
      this.done = false;
      this.alert = '';
      this.errors = {};
      this.attempted = false;
      this.focusField('email');
    }
  }
}).mount('#conteudo');
