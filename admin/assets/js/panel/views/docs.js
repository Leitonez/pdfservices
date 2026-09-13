// Documentação: html2pdf integration guide.

import { config } from '../../config.js';
import { formatMoney } from '../../format.js';
import { AppIcon, CodeBlock } from '../../ui.js';
import { mainCapability, loadCapabilitiesQuietly } from '../store.js';
import {
  buildExamples, REQUEST_FORMATS, RESPONSE_HEADERS, ERRORS, ERROR_SAMPLE, RESPONSE_SAMPLE, PAGE_CSS, FONT_CSS, IMAGE_HTML
} from './docs-content.js';

const SECTIONS = [
  { id: 'doc-visao-geral', label: 'Visão geral' },
  { id: 'doc-autenticacao', label: 'Autenticação' },
  { id: 'doc-requisicao', label: 'Requisição' },
  { id: 'doc-exemplos', label: 'Exemplos' },
  { id: 'doc-resposta', label: 'Resposta' },
  { id: 'doc-erros', label: 'Erros' },
  { id: 'doc-limites', label: 'Limites e recursos' },
  { id: 'doc-css', label: 'CSS e layout' },
  { id: 'doc-privacidade', label: 'Privacidade' },
  { id: 'doc-codigo-aberto', label: 'Código aberto' }
];

export const DocsView = {
  name: 'DocsView',
  components: { AppIcon, CodeBlock },
  data() {
    return {
      config,
      sections: SECTIONS,
      activeSection: SECTIONS[0].id,
      examples: buildExamples(config.apiUrl),
      tab: 'curl',
      formats: REQUEST_FORMATS,
      headers: RESPONSE_HEADERS,
      errors: ERRORS,
      errorSample: ERROR_SAMPLE,
      responseSample: RESPONSE_SAMPLE,
      pageCss: PAGE_CSS,
      fontCss: FONT_CSS,
      imageHtml: IMAGE_HTML
    };
  },
  created() {
    loadCapabilitiesQuietly();
  },
  mounted() {
    this.observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) {
        this.activeSection = visible[0].target.id;
      }
    }, { rootMargin: '-80px 0px -65% 0px' });
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      el && this.observer.observe(el);
    });
  },
  beforeUnmount() {
    this.observer && this.observer.disconnect();
  },
  computed: {
    priceText() {
      const capability = mainCapability();
      return capability ? formatMoney(capability.price) : 'o preço vigente';
    },
    currentExample() {
      return this.examples.find((e) => e.id === this.tab);
    }
  },
  methods: {
    goTo(id) {
      const el = document.getElementById(id);
      if (!el) {
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const heading = el.querySelector('h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      this.activeSection = id;
    },
    onTabKey(event, index) {
      let next = index;
      if (event.key === 'ArrowRight') {
        next = (index + 1) % this.examples.length;
      } else if (event.key === 'ArrowLeft') {
        next = (index - 1 + this.examples.length) % this.examples.length;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = this.examples.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      this.tab = this.examples[next].id;
      this.$nextTick(() => this.$refs['tab-' + this.tab][0].focus());
    }
  },
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Documentação</h1>
          <p>Guia de integração da conversão de HTML em PDF: autenticação, formatos, respostas, erros, limites e boas práticas.</p>
        </div>
        <a class="btn btn-ghost btn-sm" :href="config.sourceCodeUrl" target="_blank" rel="noopener">
          <app-icon name="external" :size="15"></app-icon> Código-fonte
        </a>
      </div>

      <div class="docs-layout">
        <article class="card docs-article">
          <section id="doc-visao-geral" class="doc-section">
            <h2><app-icon name="book"></app-icon> Visão geral</h2>
            <p>
              A API do PDF Services converte documentos HTML em PDF com o <strong>iText pdfHTML</strong>. Você envia o HTML por HTTPS e recebe
              o PDF na própria resposta, na mesma requisição — sem filas, sem webhooks e sem armazenamento.
            </p>
            <div class="endpoint" aria-label="Endereço da conversão">
              <span class="method">POST</span>
              <span>{{ config.apiUrl }}/v1/html2pdf/<span class="url-param">{formato}</span></span>
            </div>
            <p>
              Cada conversão bem-sucedida debita <strong>{{ priceText }}</strong> do seu saldo pré-pago.
              Requisições com erro, inclusive falhas de conversão, não são cobradas.
            </p>
            <h3>Primeiros passos</h3>
            <ol>
              <li>Crie uma chave em <a href="#/chaves">Chaves de API</a> e guarde-a como segredo do seu servidor.</li>
              <li>Envie o HTML para <code>/v1/html2pdf/html</code> (ou <code>/json</code>) com o cabeçalho <code>X-Api-Key</code>.</li>
              <li>Grave os bytes da resposta como <code>.pdf</code>. Pronto.</li>
            </ol>
          </section>

          <section id="doc-autenticacao" class="doc-section">
            <h2><app-icon name="key"></app-icon> Autenticação</h2>
            <p>Envie sua chave de API no cabeçalho <code>X-Api-Key</code> em todas as requisições de conversão:</p>
            <code-block code="X-Api-Key: pdfs_SuaChaveCompletaAqui" lang="http" title="Cabeçalho"></code-block>
            <ul>
              <li>As chaves começam com <code>pdfs_</code>. A chave completa só aparece uma vez, no momento da criação.</li>
              <li>Chame a API <strong>somente a partir do seu servidor</strong>. Nunca exponha a chave em JavaScript de navegador, aplicativos móveis ou repositórios.</li>
              <li>Use uma chave por sistema ou ambiente (até 20 por conta): o extrato mostra qual chave gerou cada cobrança.</li>
              <li>Se uma chave vazar, exclua-a no painel — ela deixa de funcionar na hora — e crie outra.</li>
            </ul>
          </section>

          <section id="doc-requisicao" class="doc-section">
            <h2><app-icon name="code"></app-icon> Requisição</h2>
            <p>O formato na URL define como o HTML é enviado no corpo:</p>
            <div class="table-wrap">
              <table class="table table-stack stack-block">
                <thead><tr><th scope="col">Formato</th><th scope="col">Content-Type</th><th scope="col">Corpo</th></tr></thead>
                <tbody>
                  <tr v-for="f in formats" :key="f.format">
                    <td data-label="Formato" class="nowrap"><code>/v1/html2pdf/{{ f.format }}</code></td>
                    <td data-label="Content-Type" class="nowrap"><code>{{ f.contentType }}</code></td>
                    <td data-label="Corpo">{{ f.body }} <span class="cell-sub">{{ f.tip }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul>
              <li>Tamanho máximo da requisição: <strong>1 MB</strong>. Para documentos maiores, prefira imagens por URL em vez de embutidas.</li>
              <li>Envie o HTML em <strong>UTF-8</strong>. No formato html, o charset do <code>Content-Type</code> é respeitado; sem charset, assume-se UTF-8.</li>
              <li>Envie um documento completo (<code>&lt;!DOCTYPE html&gt;</code>, <code>&lt;html&gt;</code>, <code>&lt;head&gt;</code> com <code>&lt;style&gt;</code>) para ter controle total do layout.</li>
            </ul>
          </section>

          <section id="doc-exemplos" class="doc-section">
            <h2><app-icon name="file"></app-icon> Exemplos</h2>
            <p>Os exemplos leem a chave da variável de ambiente <code>PDFSERVICES_API_KEY</code>.</p>
            <div class="tabs" role="tablist" aria-label="Linguagem do exemplo">
              <button v-for="(ex, i) in examples" :key="ex.id" :ref="'tab-' + ex.id" type="button" class="tab" role="tab"
                :id="'tab-' + ex.id" :aria-selected="tab === ex.id ? 'true' : 'false'" :aria-controls="'panel-' + ex.id"
                :tabindex="tab === ex.id ? 0 : -1" @click="tab = ex.id" @keydown="onTabKey($event, i)">{{ ex.label }}</button>
            </div>
            <div class="tab-panel" role="tabpanel" :id="'panel-' + currentExample.id" :aria-labelledby="'tab-' + currentExample.id">
              <code-block :code="currentExample.code" :lang="currentExample.lang" :title="currentExample.label"></code-block>
            </div>
          </section>

          <section id="doc-resposta" class="doc-section">
            <h2><app-icon name="check"></app-icon> Resposta</h2>
            <p>Em caso de sucesso, a API responde <strong>200</strong> com o PDF no corpo (<code>application/pdf</code>) e estes cabeçalhos:</p>
            <div class="table-wrap">
              <table class="table table-stack stack-block">
                <thead><tr><th scope="col">Cabeçalho</th><th scope="col">Exemplo</th><th scope="col">Descrição</th></tr></thead>
                <tbody>
                  <tr v-for="h in headers" :key="h.name">
                    <td data-label="Cabeçalho" class="nowrap"><code>{{ h.name }}</code></td>
                    <td data-label="Exemplo" class="nowrap mono small">{{ h.example }}</td>
                    <td data-label="Descrição">{{ h.description }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <code-block :code="responseSample" lang="http" title="Exemplo de resposta"></code-block>
          </section>

          <section id="doc-erros" class="doc-section">
            <h2><app-icon name="alert"></app-icon> Erros</h2>
            <p>Erros respondem em JSON, com um código estável em <code>error</code> (use-o na sua lógica) e uma mensagem em português em <code>message</code>:</p>
            <code-block :code="errorSample" lang="json" title="Corpo de erro"></code-block>
            <div class="table-wrap">
              <table class="table table-stack stack-block">
                <thead><tr><th scope="col">HTTP</th><th scope="col">Código</th><th scope="col">Significado</th></tr></thead>
                <tbody>
                  <tr v-for="e in errors" :key="e.code">
                    <td data-label="HTTP" class="mono">{{ e.status }}</td>
                    <td data-label="Código" class="nowrap"><code>{{ e.code }}</code></td>
                    <td data-label="Significado">{{ e.meaning }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="alert alert-info">
              <app-icon name="info" class="alert-icon"></app-icon>
              <div>Somente respostas <strong>200</strong> são cobradas. Para <code>503</code>, tente de novo com espera crescente (por exemplo 1 s, 2 s, 4 s). Os demais erros exigem correção na requisição, na chave ou no saldo.</div>
            </div>
          </section>

          <section id="doc-limites" class="doc-section">
            <h2><app-icon name="shield"></app-icon> Limites e recursos externos</h2>
            <p>Por segurança e previsibilidade, a conversão acontece isolada da rede, com poucas exceções:</p>
            <h3>Imagens</h3>
            <ul>
              <li>Use imagens embutidas via <code>data:</code> URI (recomendado) ou URLs <strong>https públicas, na porta 443</strong>, somente <strong>JPG ou PNG</strong>.</li>
              <li>Até <strong>20 imagens</strong> externas por documento, <strong>5 MB</strong> cada e <strong>15 MB</strong> no total, com tempo limite de <strong>10 s</strong> para baixá-las.</li>
              <li>Endereços internos ou privados (localhost, redes locais, metadados de nuvem) são bloqueados.</li>
              <li>Imagens fora dessas regras são omitidas do PDF e contadas no cabeçalho <code>X-Blocked-Resources</code>.</li>
            </ul>
            <code-block :code="imageHtml" lang="html" title="Imagens"></code-block>
            <h3>CSS, fontes e scripts</h3>
            <ul>
              <li>Folhas de estilo, fontes e scripts externos <strong>não são baixados</strong>. Coloque o CSS em <code>&lt;style&gt;</code> no próprio documento.</li>
              <li>Fontes próprias são suportadas via <code>@font-face</code> com <code>data:</code> URI (TTF ou WOFF em base64); o arquivo embutido conta para o limite de 1 MB. Fontes de URLs externas (ex.: Google Fonts) não são baixadas.</li>
              <li>As fontes padrão incluem um fallback Unicode (Noto): acentos e símbolos comuns, como →, saem corretos sem configuração extra.</li>
              <li><strong>JavaScript não é executado.</strong> Gere o HTML final no seu servidor (gráficos, por exemplo, como imagens PNG ou JPG).</li>
            </ul>
            <code-block :code="fontCss" lang="css" title="Fonte embutida"></code-block>
          </section>

          <section id="doc-css" class="doc-section">
            <h2><app-icon name="file"></app-icon> Dicas de CSS e layout</h2>
            <ul>
              <li>Defina tamanho do papel, orientação e margens com <code>@page</code> — por exemplo <code>@page { size: A4; margin: 2cm }</code> ou <code>size: A4 landscape</code>.</li>
              <li>Controle quebras de página com <code>page-break-before</code>, <code>page-break-after</code> e <code>page-break-inside: avoid</code>.</li>
              <li>Use unidades físicas (<code>cm</code>, <code>mm</code>, <code>pt</code>) para medidas de impressão.</li>
              <li>Layouts simples com blocos e tabelas são os mais previsíveis; teste documentos complexos antes de ir para produção.</li>
            </ul>
            <code-block :code="pageCss" lang="html" title="Página, margens e quebras"></code-block>
          </section>

          <section id="doc-privacidade" class="doc-section">
            <h2><app-icon name="lock"></app-icon> Privacidade</h2>
            <ul>
              <li>O HTML enviado e o PDF gerado <strong>nunca são armazenados nem registrados em log</strong>: existem apenas na memória, durante a requisição.</li>
              <li>Guardamos somente metadados da transação: data e hora, capacidade, chave usada, valor, saldo, tamanhos em bytes e duração.</li>
              <li>Registros de acesso (IP e data/hora) são mantidos por 6 meses, como exige o Marco Civil da Internet.</li>
            </ul>
            <p>Detalhes na <a :href="config.websiteUrl + '/privacidade'">Política de Privacidade</a>.</p>
          </section>

          <section id="doc-codigo-aberto" class="doc-section">
            <h2><app-icon name="code"></app-icon> Código aberto (AGPL v3)</h2>
            <p>
              O PDF Services é software livre sob a licença <strong>AGPL v3</strong> e usa o iText na versão AGPL. O código-fonte está em
              <a :href="config.sourceCodeUrl" target="_blank" rel="noopener">{{ config.sourceCodeUrl.replace('https://', '') }}</a>
              e é informado em cada resposta no cabeçalho <code>X-Source-Code</code>.
            </p>
            <p>Por isso, todo PDF gerado traz no metadado <strong>Producer</strong> a identificação do software usado:</p>
            <code-block code="Producer: CodeCycle AGPL PDF Services (https://pdfservices.sistema.site); ...iText (AGPL-version)" lang="text" title="Metadado do PDF"></code-block>
          </section>
        </article>

        <nav class="docs-toc" aria-label="Nesta página">
          <p class="docs-toc-title">Nesta página</p>
          <ol>
            <li v-for="s in sections" :key="s.id">
              <button type="button" :class="{ 'is-active': activeSection === s.id }" @click="goTo(s.id)">{{ s.label }}</button>
            </li>
          </ol>
        </nav>
      </div>
    </div>`
};
