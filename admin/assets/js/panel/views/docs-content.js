// Content of the integration guide (html2pdf): code samples and reference tables.

export function buildExamples(apiUrl) {
  return [
    {
      id: 'curl',
      label: 'cURL',
      lang: 'bash',
      code: `# Formato html: o corpo da requisição é o próprio documento HTML
curl -X POST "${apiUrl}/v1/html2pdf/html" \\
  -H "X-Api-Key: $PDFSERVICES_API_KEY" \\
  -H "Content-Type: text/html; charset=utf-8" \\
  --data-binary @documento.html \\
  -D cabecalhos.txt \\
  -o documento.pdf

# Formato json: o HTML vai no campo "html"
curl -X POST "${apiUrl}/v1/html2pdf/json" \\
  -H "X-Api-Key: $PDFSERVICES_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"html": "<h1>Olá, PDF!</h1>"}' \\
  -o documento.pdf`
    },
    {
      id: 'csharp',
      label: 'C#',
      lang: 'csharp',
      code: `using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;

// Reutilize uma única instância de HttpClient na aplicação.
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
http.DefaultRequestHeaders.Add("X-Api-Key", Environment.GetEnvironmentVariable("PDFSERVICES_API_KEY"));

string html = await File.ReadAllTextAsync("documento.html");
using var content = new StringContent(html, Encoding.UTF8, "text/html"); // text/html; charset=utf-8

using HttpResponseMessage response = await http.PostAsync("${apiUrl}/v1/html2pdf/html", content);
if (!response.IsSuccessStatusCode)
{
    // Erros vêm em JSON: { "error": "codigo", "message": "..." }
    string erro = await response.Content.ReadAsStringAsync();
    throw new InvalidOperationException($"Falha na conversão ({(int)response.StatusCode}): {erro}");
}

byte[] pdf = await response.Content.ReadAsByteArrayAsync();
await File.WriteAllBytesAsync("documento.pdf", pdf);

string saldo = response.Headers.GetValues("X-Balance").First();
Console.WriteLine($"PDF gerado. Saldo restante: R$ {saldo}");`
    },
    {
      id: 'node',
      label: 'Node.js',
      lang: 'js',
      code: `// Node.js 18+ (fetch nativo). Salve como converter.mjs
import { readFile, writeFile } from 'node:fs/promises';

const html = await readFile('documento.html', 'utf8');

const response = await fetch('${apiUrl}/v1/html2pdf/json', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.PDFSERVICES_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ html })
});

if (!response.ok) {
  const erro = await response.json();
  throw new Error(\`\${response.status} \${erro.error}: \${erro.message}\`);
}

await writeFile('documento.pdf', Buffer.from(await response.arrayBuffer()));
console.log('Transação:', response.headers.get('X-Transaction-Id'));
console.log('Saldo restante: R$', response.headers.get('X-Balance'));`
    },
    {
      id: 'python',
      label: 'Python',
      lang: 'python',
      code: `import os
import requests

with open("documento.html", "rb") as arquivo:
    html = arquivo.read()

response = requests.post(
    "${apiUrl}/v1/html2pdf/html",
    data=html,
    headers={
        "X-Api-Key": os.environ["PDFSERVICES_API_KEY"],
        "Content-Type": "text/html; charset=utf-8",
    },
    timeout=60,
)

if response.status_code != 200:
    erro = response.json()
    raise RuntimeError(f"{response.status_code} {erro['error']}: {erro['message']}")

with open("documento.pdf", "wb") as arquivo:
    arquivo.write(response.content)

print("Cobrado: R$", response.headers["X-Charged-Amount"])
print("Saldo restante: R$", response.headers["X-Balance"])`
    },
    {
      id: 'php',
      label: 'PHP',
      lang: 'php',
      code: `<?php
$html = file_get_contents('documento.html');

$ch = curl_init('${apiUrl}/v1/html2pdf/html');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $html,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
        'X-Api-Key: ' . getenv('PDFSERVICES_API_KEY'),
        'Content-Type: text/html; charset=utf-8',
    ],
]);

$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($body === false) {
    throw new RuntimeException('Não foi possível conectar à API.');
}
if ($status !== 200) {
    $erro = json_decode($body, true);
    throw new RuntimeException("{$status} {$erro['error']}: {$erro['message']}");
}

file_put_contents('documento.pdf', $body);`
    }
  ];
}

export const REQUEST_FORMATS = [
  {
    format: 'html',
    contentType: 'text/html; charset=utf-8',
    body: 'O próprio documento HTML, em bytes.',
    tip: 'Mais simples e eficiente: não é preciso escapar o HTML.'
  },
  {
    format: 'json',
    contentType: 'application/json',
    body: 'Objeto JSON com o HTML no campo "html": {"html": "..."}',
    tip: 'Prático quando o seu cliente HTTP já trabalha com JSON.'
  }
];

export const RESPONSE_HEADERS = [
  { name: 'Content-Type', example: 'application/pdf', description: 'O corpo da resposta é o PDF gerado.' },
  { name: 'X-Transaction-Id', example: '8f3c…', description: 'Identificador da transação, o mesmo que aparece no extrato do painel. Guarde-o para conciliação e suporte.' },
  { name: 'X-Charged-Amount', example: '0.001', description: 'Valor debitado nesta conversão, em reais, com ponto decimal.' },
  { name: 'X-Balance', example: '9.999', description: 'Saldo restante após a cobrança, em reais, com ponto decimal.' },
  { name: 'X-Blocked-Resources', example: '0', description: 'Quantidade de recursos externos recusados pela política de recursos (ex.: imagem http, GIF ou endereço interno).' },
  { name: 'X-Source-Code', example: 'https://github.com/…', description: 'Endereço do código-fonte do serviço (exigência da licença AGPL v3).' }
];

export const ERRORS = [
  { status: 400, code: 'invalid_format', meaning: 'O formato na URL não é html nem json.' },
  { status: 400, code: 'invalid_json', meaning: 'No formato json, o corpo não é um JSON válido.' },
  { status: 400, code: 'invalid_body', meaning: 'No formato json, falta o campo "html" (texto).' },
  { status: 400, code: 'empty_html', meaning: 'O HTML enviado está vazio.' },
  { status: 401, code: 'missing_api_key', meaning: 'O cabeçalho X-Api-Key não foi enviado.' },
  { status: 401, code: 'invalid_api_key', meaning: 'A chave não existe ou foi excluída.' },
  { status: 402, code: 'insufficient_balance', meaning: 'Saldo insuficiente para a conversão. Adicione créditos.' },
  { status: 413, code: 'payload_too_large', meaning: 'A requisição passou de 1 MB.' },
  { status: 415, code: 'unsupported_charset', meaning: 'O charset informado no Content-Type não é suportado. Envie em UTF-8.' },
  { status: 422, code: 'conversion_failed', meaning: 'O HTML não pôde ser convertido. Nada é cobrado.' },
  { status: 503, code: 'busy', meaning: 'Muitas requisições simultâneas para a conta. Tente de novo em instantes.' },
  { status: 503, code: 'capability_unavailable', meaning: 'A capacidade está temporariamente indisponível.' }
];

export const ERROR_SAMPLE = `{
  "error": "insufficient_balance",
  "message": "Saldo insuficiente (saldo atual: R$ 0,00). Adicione créditos para continuar."
}`;

export const RESPONSE_SAMPLE = `HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="document.pdf"
X-Transaction-Id: 5b0e7c1f9a2d4e8b
X-Charged-Amount: 0.001
X-Balance: 41.237
X-Blocked-Resources: 0
X-Source-Code: https://github.com/Leitonez/pdfservices

%PDF-1.7 …`;

export const PAGE_CSS = `<style>
  /* Tamanho do papel, orientação e margens */
  @page {
    size: A4;              /* A4 landscape, Letter, 210mm 297mm… */
    margin: 2cm;

    /* Numeração de páginas no rodapé */
    @bottom-right {
      content: "Página " counter(page) " de " counter(pages);
      font-size: 9pt;
      color: #64748b;
    }
  }

  body { font-family: "Minha Fonte", Helvetica, sans-serif; font-size: 11pt; }

  h1 { page-break-before: always; }   /* cada capítulo em nova página */
  h1:first-of-type { page-break-before: avoid; }
  table, figure { page-break-inside: avoid; }
  .quebra { page-break-after: always; }
</style>`;

export const FONT_CSS = `<style>
  @font-face {
    font-family: "Minha Fonte";
    src: url(data:font/ttf;base64,AAEAAAALAIAAAwAwT1MvMg…) format("truetype");
    font-weight: 400;
  }
</style>`;

export const IMAGE_HTML = `<!-- Embutida no documento (recomendado: não depende de rede) -->
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg…" alt="Logotipo">

<!-- URL https pública (porta 443), somente JPG ou PNG -->
<img src="https://www.exemplo.com.br/imagens/assinatura.png" alt="Assinatura">`;
