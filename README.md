# PDF Services

API comercial de conversão de **HTML para PDF** da [CODECYCLE](https://codecycle.com.br), construída sobre o [iText](https://itextpdf.com) (iText Core 9 + pdfHTML 6).

- Site: https://pdfservices.sistema.site
- Painel do cliente: https://my.pdfservices.sistema.site
- API: https://api.pdfservices.sistema.site

> **Licença:** este projeto é software livre sob a **GNU Affero General Public License v3** ([LICENSE](LICENSE)), a mesma licença do iText AGPL que ele utiliza. Qualquer pessoa que interaja com o serviço pela rede tem direito ao código-fonte, que está neste repositório. Toda resposta da API traz o header `X-Source-Code` apontando para cá.

## Privacidade

O HTML enviado e o PDF gerado são processados **apenas em memória** e **nunca são armazenados nem registrados em logs**. O serviço grava somente metadados de cada transação (data/hora, capacidade, chave usada, valor cobrado, saldo resultante, tamanhos em bytes e duração) e registros de acesso (IP + data/hora) mantidos por 6 meses, conforme o art. 15 do Marco Civil da Internet.

## Estrutura

| Pasta | Conteúdo | Tecnologia |
|---|---|---|
| [`api/`](api) | API (conversão, contas, chaves, consumo) | Azure Functions isolated, .NET 10, iText, Cosmos DB |
| [`website/`](website) | Landing page, cadastro, termos e privacidade | HTML + CSS + Vue 3 global (CDN), sem build |
| [`admin/`](admin) | Painel do cliente (login, consumo, chaves, documentação, conta) | HTML + CSS + Vue 3 global (CDN), sem build |

Os frontends são 100% estáticos: sem npm, bundlers ou transpilação. Os arquivos `assets/css/theme.css`, `assets/js/config.js`, `api.js`, `turnstile.js` e `format.js` existem nas duas pastas (cada uma é publicada separadamente) e devem ser mantidos idênticos.

## API

Rotas sem prefixo (`host.json` → `routePrefix: ""`).

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| GET | `/ping` | — | Retorna `pong` |
| GET | `/v1/capabilities` | — | Capacidades e preços |
| POST | `/v1/html2pdf/{format}` | `X-Api-Key` | Converte HTML em PDF. `format=html`: o corpo é o HTML; `format=json`: `{"html": "..."}`. Máx. 1 MB. |
| POST | `/v1/auth/signup` | Turnstile | Cria conta (nome, razão social, CNPJ, e-mail, senha) |
| POST | `/v1/auth/login` | Turnstile | Retorna o bearer token do painel |
| POST | `/v1/auth/verify-email` | token do e-mail | Confirma o e-mail |
| POST | `/v1/auth/resend-verification` | Turnstile | Reenvia a confirmação |
| POST | `/v1/auth/forgot-password` | Turnstile | Envia link de redefinição |
| POST | `/v1/auth/reset-password` | token do e-mail | Redefine a senha |
| GET | `/v1/account` | Bearer | Dados da conta e saldo |
| POST | `/v1/account/change-password` | Bearer | Troca a senha (encerra as outras sessões) |
| POST | `/v1/account/delete` | Bearer | Exclui a conta (anonimiza dados pessoais) |
| GET/POST | `/v1/account/api-keys` | Bearer | Lista / cria chaves de API |
| DELETE | `/v1/account/api-keys/{id}` | Bearer | Revoga uma chave |
| GET | `/v1/account/usage?from=&to=` | Bearer | Consumo diário por capacidade |
| GET | `/v1/account/transactions` | Bearer | Extrato de transações (paginado) |

Exemplo:

```bash
curl -X POST https://api.pdfservices.sistema.site/v1/html2pdf/html \
  -H "X-Api-Key: pdfs_..." \
  -H "Content-Type: text/html; charset=utf-8" \
  --data-binary @documento.html -o documento.pdf
```

### Segurança

- **Anti-bot:** cadastro, login, reenvio de confirmação e recuperação de senha exigem um token do [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/), validado no servidor (hostname e action conferidos em produção).
- **Senhas:** PBKDF2-HMAC-SHA256 (600.000 iterações). Bloqueio temporário após 5 tentativas erradas. Respostas genéricas que não revelam e-mails cadastrados.
- **Sessão do painel:** JWT HS256 (8 h) com *security stamp*: trocar a senha ou excluir a conta invalida todas as sessões.
- **Chaves de API e tokens de e-mail:** só o SHA-256 é armazenado; a chave completa é exibida uma única vez.
- **Recursos externos no HTML (SSRF):** imagens por `data:` URI ou por URL `https` pública na porta 443, somente PNG/JPEG (verificados pelos *magic bytes*), com limites de quantidade, tamanho e tempo. Cada conexão, inclusive após redirecionamentos, é validada no nível do socket contra endereços privados, loopback, link-local (metadata), CGNAT e o IP de plataforma do Azure. CSS, fontes, SVG e arquivos locais não são carregados.
- **Cobrança:** o débito do saldo, o agregado diário, a transação e o registro de acesso são gravados em um único *transactional batch* do Cosmos DB, protegido por ETag. Conversões com erro não são cobradas.

### Modelo de dados (Cosmos DB, serverless)

| Container | Partition key | Documentos |
|---|---|---|
| `accounts` | `/accountId` | conta (`type: account`), consumo diário (`usage`), transações (`transaction`), registros de acesso (`access`, TTL de 183 dias) |
| `emails` | `/id` | índice de unicidade de e-mail (id = SHA-256 do e-mail) |
| `apikeys` | `/id` | chaves de API (id = SHA-256 da chave) |
| `tokens` | `/id` | tokens de confirmação/redefinição (TTL) |
| `settings` | `/id` | configuração, como o preço de cada capacidade (`capability-html2pdf`) |

O banco, os containers e o preço inicial (R$ 0,001) são criados automaticamente na inicialização (`Cosmos__InitializeOnStartup`).

**Operação:**
- **Adicionar créditos:** edite o campo `balance` do documento da conta (container `accounts`, `type: "account"`) no Data Explorer. Prefira fazer isso fora dos momentos de uso intenso da conta, para não sobrescrever um débito concorrente.
- **Alterar o preço:** edite `price` no documento `capability-html2pdf` do container `settings`. A API aplica o novo valor em até 1 minuto.

## Desenvolvimento local

Pré-requisitos: .NET SDK 10, [Azure Functions Core Tools 4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) e Python 3 (apenas para servir os arquivos estáticos).

```bash
cp api/local.settings.example.json api/local.settings.json   # e preencha os valores
cd api && func start --port 7215
```

```bash
python -m http.server 5501 --directory website
python -m http.server 5502 --directory admin
```

Em `localhost`, os frontends apontam para `http://localhost:7215` e usam a chave de teste do Turnstile que sempre passa (`1x00000000000000000000AA`); a API local deve usar a secret de teste correspondente (`1x0000000000000000000000000000000AA`). Com `Mailgun__TestMode=true`, o Mailgun aceita os e-mails sem entregá-los e o conteúdo aparece no log da API. Use um banco separado (`Cosmos__DatabaseName=Development`) para não misturar dados de teste com produção.

## Configuração (App Settings da Function App)

| Chave | Produção |
|---|---|
| `Cosmos__ConnectionString` | connection string do Cosmos DB |
| `Cosmos__DatabaseName` | `Production` |
| `Auth__JwtSigningKey` | base64 de 64 bytes aleatórios (veja abaixo) |
| `Turnstile__SecretKey` | Secret Key do widget Turnstile |
| `Turnstile__AllowedHostnames` | `pdfservices.sistema.site,my.pdfservices.sistema.site` |
| `Mailgun__ApiKey` | sending key do domínio no Mailgun |
| `Mailgun__Domain` | `mail.pdfservices.sistema.site` |
| `Mailgun__FromAddress` | `autenticacao@mail.pdfservices.sistema.site` (padrão) |
| `Mailgun__BaseUrl` | `https://api.mailgun.net` (US) ou `https://api.eu.mailgun.net` (EU) |
| `Mailgun__TestMode` | `false` |
| `App__WebsiteUrl` / `App__AdminUrl` | opcionais; o padrão já são as URLs de produção |
| `Html2Pdf__*` | opcionais: `MaxRequestBytes`, `MaxExternalImages`, `MaxImageBytes`, `MaxTotalImageBytes`, `ExternalRequestTimeoutSeconds` |

Gerar a chave JWT (PowerShell):

```powershell
$b = New-Object byte[] 64; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

## Publicação (checklist)

- **Function App:** configure as App Settings acima; em **CORS**, permita `https://pdfservices.sistema.site` e `https://my.pdfservices.sistema.site`; associe o domínio `api.pdfservices.sistema.site`.
- **Cosmos DB:** em *Networking*, permita o acesso a partir da Function App (ou de serviços do Azure).
- **Firebase Hosting:** dois sites no mesmo projeto: `website/` → `pdfservices.sistema.site` e `admin/` → `my.pdfservices.sistema.site`. `firebase.json` e `.firebaserc` ficam fora do repositório.
- **Mailgun:** domínio de envio `mail.pdfservices.sistema.site` verificado (registros SPF/DKIM no DNS); remetente `autenticacao@mail.pdfservices.sistema.site`.
- **Cloudflare Turnstile:** widget com os hostnames `pdfservices.sistema.site` e `my.pdfservices.sistema.site`.

Arquivos de segredo e perfis de publicação (`local.settings.json`, `*.pubxml`, `Properties/PublishProfiles/`, `firebase.json`, `.firebaserc`) estão no `.gitignore` e nunca devem ser versionados.
