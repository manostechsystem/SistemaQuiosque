// Auditoria de layout executada dentro da página renderizada
// (roda dentro de uma async arrow no diag.js — terminamos com return)
const r = { problema: [] };

  // 1. Overflow horizontal da página
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) r.problema.push('overflow-x: ' + doc.scrollWidth + '>' + doc.clientWidth);

  // 2. Elementos que estouram a viewport
  const estourados = [];
  document.querySelectorAll('body *').forEach(el => {
    const b = el.getBoundingClientRect();
    if (b.width > 0 && (b.right > innerWidth + 2 || b.left < -2)) {
      const st = getComputedStyle(el);
      if (st.visibility !== 'hidden' && st.display !== 'none')
        estourados.push((el.id || el.className || el.tagName) + '@' + Math.round(b.left));
    }
  });
  if (estourados.length) r.problema.push('fora da viewport: ' + estourados.slice(0, 6).join(' | '));

  // 3. Fontes
  r.fontes = document.fonts.status + ' baloo:' + document.fonts.check('800 20px "Baloo 2"') + ' dm:' + document.fonts.check('400 14px "DM Sans"');

  // 4. Logo visível
  const logo = document.querySelector('.topo__marca img');
  r.logo = logo ? Math.round(logo.getBoundingClientRect().width) + 'x' + Math.round(logo.getBoundingClientRect().height) + ' natural ' + logo.naturalWidth : 'ausente';

  // 5. Itens essenciais presentes
  r.ids = ['grade', 'itens', 'cats', 'busca', 'btn-pagar', 'tot-total', 'relogio', 'toast', 'modal']
    .map(id => id + ':' + !!document.getElementById(id)).join(' ');

  // 6. Contraste do texto principal do produto
  const prod = document.querySelector('.prod__nome');
  if (prod) {
    const st = getComputedStyle(prod);
    r.produtoNome = st.fontFamily.split(',')[0] + ' ' + st.fontSize;
  }

  // 7. Trilho lateral
  const trilho = document.querySelector('.trilho');
  if (trilho) {
    const b = trilho.getBoundingClientRect();
    r.trilho = Math.round(b.width) + 'px, ' + trilho.querySelectorAll('button').length + ' botões';
  }

  return JSON.stringify(r);
