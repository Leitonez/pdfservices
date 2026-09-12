// Tiny syntax highlighter for the documentation snippets (uses the theme's .k .s .n .p .c classes).
// Rules are tried left to right at each position; rule regexes must not contain capturing groups.

const STRING_DQ = /"(?:[^"\\\n]|\\.)*"/;
const STRING_SQ = /'(?:[^'\\\n]|\\.)*'/;
const NUMBER = /\b\d+(?:[.,]\d+)?\b/;

function words(list) {
  return new RegExp('\\b(?:' + list.join('|') + ')\\b');
}

const LANGUAGES = {
  bash: [
    [/#[^\n]*/, 'c'],
    [STRING_DQ, 's'],
    [STRING_SQ, 's'],
    [/(?<=\s)--?[A-Za-z][\w-]*/, 'p'],
    [/\$[A-Za-z_]\w*/, 'n'],
    [words(['curl', 'export']), 'k']
  ],
  csharp: [
    [/\/\/[^\n]*/, 'c'],
    [/\$?@?"(?:[^"\\\n]|\\.)*"/, 's'],
    [words(['using', 'var', 'new', 'await', 'string', 'byte', 'if', 'throw', 'return', 'async', 'static', 'int', 'true', 'false', 'null']), 'k'],
    [/\b[A-Z][A-Za-z]+(?=[\s.<(])/, 'p'],
    [NUMBER, 'n']
  ],
  js: [
    [/\/\/[^\n]*/, 'c'],
    [/`(?:[^`\\]|\\.)*`/, 's'],
    [STRING_DQ, 's'],
    [STRING_SQ, 's'],
    [words(['import', 'from', 'const', 'let', 'await', 'new', 'if', 'throw', 'return', 'async', 'function', 'true', 'false', 'null']), 'k'],
    [/\b[A-Za-z_]\w*(?=\s*:)/, 'p'],
    [NUMBER, 'n']
  ],
  python: [
    [/#[^\n]*/, 'c'],
    [/f?"(?:[^"\\\n]|\\.)*"/, 's'],
    [/f?'(?:[^'\\\n]|\\.)*'/, 's'],
    [words(['import', 'from', 'with', 'open', 'as', 'if', 'raise', 'def', 'return', 'True', 'False', 'None']), 'k'],
    [/\b[a-z_]+(?==)/, 'p'],
    [NUMBER, 'n']
  ],
  php: [
    [/\/\/[^\n]*/, 'c'],
    [/<\?php/, 'k'],
    [STRING_DQ, 's'],
    [STRING_SQ, 's'],
    [/\$[A-Za-z_]\w*/, 'p'],
    [words(['if', 'throw', 'new', 'true', 'false', 'null', 'return']), 'k'],
    [/\b[A-Z][A-Z_]{3,}\b/, 'n'],
    [NUMBER, 'n']
  ],
  css: [
    [/\/\*[\s\S]*?\*\//, 'c'],
    [STRING_DQ, 's'],
    [STRING_SQ, 's'],
    [/@[\w-]+/, 'k'],
    [/[a-z-]+(?=\s*:)/, 'p'],
    [/\b\d+(?:\.\d+)?(?:cm|mm|px|pt|in|em|rem|%)?/, 'n']
  ],
  html: [
    [/<!--[\s\S]*?-->/, 'c'],
    [/\/\*[\s\S]*?\*\//, 'c'],
    [STRING_DQ, 's'],
    [/<\/?[a-zA-Z][\w-]*|\/?>/, 'k'],
    [/\b[a-z-]+(?==)/, 'p'],
    [/@[\w-]+/, 'k'],
    [/[a-z-]+(?=\s*:\s*[^:])/, 'p']
  ],
  json: [
    [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/, 'p'],
    [STRING_DQ, 's'],
    [words(['true', 'false', 'null']), 'k'],
    [/-?\b\d+(?:\.\d+)?\b/, 'n']
  ],
  http: [
    [/^HTTP\/[\d.]+/m, 'k'],
    [/^[A-Za-z][\w-]*(?=:)/m, 'p'],
    [/^(?:POST|GET)\b/m, 'k'],
    [NUMBER, 'n']
  ]
};

const compiled = new Map();

function compile(lang) {
  if (!compiled.has(lang)) {
    const rules = LANGUAGES[lang];
    const regex = new RegExp(rules.map(([re]) => '(' + re.source + ')').join('|'), 'gm');
    compiled.set(lang, { regex, classes: rules.map(([, cls]) => cls) });
  }
  return compiled.get(lang);
}

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Returns HTML (escaped) with <span class="k|s|n|p|c"> tokens. Unknown languages are only escaped. */
export function highlight(code, lang) {
  if (!LANGUAGES[lang]) {
    return escapeHtml(code);
  }

  const { regex, classes } = compile(lang);
  regex.lastIndex = 0;
  let html = '';
  let last = 0;
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    const group = match.findIndex((value, index) => index > 0 && value !== undefined);
    html += escapeHtml(code.slice(last, match.index));
    html += `<span class="${classes[group - 1]}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(code.slice(last));
}
