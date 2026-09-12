// Static pages (Termos, Privacidade, 404): header/footer only, plus scrollable wrappers for legal tables.

import { mountChrome } from '../site.js';

mountChrome();

// 404: echo the requested path in the terminal mock (textContent, never HTML).
const notFoundPath = document.getElementById('nf-path');
if (notFoundPath) {
  notFoundPath.textContent = window.location.pathname;
}

const article = document.querySelector('.legal');
if (article) {
  article.querySelectorAll('table').forEach((table) => {
    const section = table.closest('section');
    const heading = section ? section.querySelector('h2') : null;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Tabela: ' + (heading ? heading.textContent.trim() : 'detalhes') + ' (role horizontalmente se necessário)');
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
  article.classList.add('is-enhanced');
}
