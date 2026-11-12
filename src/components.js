/* Componentes de interface reaproveitáveis: ícones, avisos e modal. */

const UI = (() => {
  const ICONES = {
    mais: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    lixeira: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
    lapis: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    caixa: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    dinheiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
    pix: '<path d="m12 2 4.5 4.5L12 11 7.5 6.5z"/><path d="m12 13 4.5 4.5L12 22l-4.5-4.5z"/><path d="m2 12 4.5-4.5L11 12l-4.5 4.5z"/><path d="m13 12 4.5-4.5L22 12l-4.5 4.5z"/>',
    cartao: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h3"/>',
    credito: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M17 15h2"/>',
    impressora: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>',
    alerta: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    onda: '<path d="M2 14c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 5 0"/><path d="M2 19c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 5 0"/>',
    cozinha: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    arquivo: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    raio: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    estrela: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    estrelaCheia: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>',
    gradeIcon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    pastel: '<path d="M3 17c0-6 4-11 9-11s9 5 9 11H3z"/><path d="M6 14c1.5-2 3.5-3 6-3s4.5 1 6 3"/><circle cx="12" cy="9" r="1"/>',
    bebida: '<path d="M7 2h10l-1 16a3 3 0 0 1-3 2.5h-2a3 3 0 0 1-3-2.5L7 2z"/><line x1="6" y1="6" x2="18" y2="6"/>',
    cerveja: '<path d="M17 8h1a3 3 0 0 1 0 6h-1"/><path d="M5 6h12v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z"/><path d="M8 11v6"/><path d="M12 11v6"/>',
    churros: '<path d="m14 4-9 9a2 2 0 0 0 2.8 2.8l9-9a2 2 0 0 0-2.8-2.8z"/><path d="m7.5 10.5 3 3"/><path d="m10.5 7.5 3 3"/>',
    porcao: '<path d="M4 11a8 8 0 0 1 16 0H4z"/><rect x="2" y="14" width="20" height="2" rx="1"/><path d="M4 19a3 3 0 0 0 3 2h10a3 3 0 0 0 3-2H4z"/>',
    comida: '<path d="M18 2v20"/><path d="M21 15V2a4 4 0 0 0-4 4v5a4 4 0 0 0 4 4z"/><path d="M4 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2"/><path d="M7 11v11"/>',
    prato: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 2v20"/>',
    lanche: '<path d="M4 11a8 8 0 0 1 16 0H4z"/><rect x="2" y="14" width="20" height="2" rx="1"/><path d="M4 19a3 3 0 0 0 3 2h10a3 3 0 0 0 3-2H4z"/>',
    acai: '<path d="M12 3a4 4 0 0 1 4 4c0 1.5-.7 2.8-1.8 3.5H9.8A4 4 0 0 1 12 3z"/><path d="M6 11h12l-1.5 8a2.5 2.5 0 0 1-2.5 2h-4a2.5 2.5 0 0 1-2.5-2L6 11z"/>',
    praia: '<path d="M12 2v20"/><path d="M12 2a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M8 22h8"/>'
  };

  function icone(nome, classe = 'ic') {
    return `<svg class="${classe}" viewBox="0 0 24 24">${ICONES[nome] || ''}</svg>`;
  }

  let toastTimer = null;
  function toast(mensagem, tipo = 'ok') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = 'toast' + (tipo === 'erro' ? ' erro' : '');
    el.innerHTML = icone(tipo === 'erro' ? 'alerta' : 'check') + `<span>${escapar(mensagem)}</span>`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------------- modal ---------------- */
  const fundo = document.getElementById('modal');
  const elTit = document.getElementById('modal-tit');
  const elCorpo = document.getElementById('modal-corpo');
  const elPe = document.getElementById('modal-pe');
  const caixa = fundo ? fundo.querySelector('.modal') : null;

  let aoFechar = null;

  function abrirModal({ titulo, corpo, rodape = '', largo = false, fecharAoClicarFora = true }) {
    elTit.textContent = titulo;
    elCorpo.innerHTML = corpo;
    elPe.innerHTML = rodape;
    elPe.hidden = !rodape;
    caixa.classList.toggle('modal--largo', !!largo);
    fundo.hidden = false;
    fundo.dataset.fora = fecharAoClicarFora ? '1' : '0';
    const primeiro = elCorpo.querySelector('input, select, button');
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
    return elCorpo;
  }

  function fecharModal() {
    fundo.hidden = true;
    elCorpo.innerHTML = '';
    elPe.innerHTML = '';
    if (aoFechar) { const fn = aoFechar; aoFechar = null; fn(); }
  }

  function modalAberto() { return fundo && !fundo.hidden; }

  function aoFecharRegistrar(fn) { aoFechar = fn; }

  function confirmar({ titulo, texto, acao = 'Confirmar', perigo = false }) {
    return new Promise(resolve => {
      let resolvido = false;
      const responder = (valor) => {
        if (resolvido) return;
        resolvido = true;
        fecharModal();
        resolve(valor);
      };

      abrirModal({
        titulo,
        corpo: `<p style="font-size:13.5px;line-height:1.6;color:var(--tinta-2)">${texto}</p>`,
        rodape: `<button class="btn-secundario" id="modal-conf-cancelar">Cancelar</button>
                 <button class="btn-primario" id="modal-conf-ok" ${perigo ? 'style="background:linear-gradient(180deg,#E4664A,#C0442B);border-color:#9C3420;color:#fff;text-shadow:none"' : ''}>${escapar(acao)}</button>`,
        fecharAoClicarFora: true
      });

      const btnCanc = document.getElementById('modal-conf-cancelar');
      const btnOk = document.getElementById('modal-conf-ok');
      if (btnCanc) btnCanc.onclick = () => responder(false);
      if (btnOk) btnOk.onclick = () => responder(true);

      aoFecharRegistrar(() => {
        if (!resolvido) {
          resolvido = true;
          resolve(false);
        }
      });
    });
  }

  function hora(iso) {
    const d = iso ? new Date(iso) : new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function dataCurta(iso) {
    const d = new Date(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // eventos globais do modal
  if (fundo) {
    document.getElementById('modal-x').onclick = fecharModal;
    fundo.addEventListener('mousedown', e => {
      if (e.target === fundo && fundo.dataset.fora === '1') fecharModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalAberto()) { e.stopPropagation(); e.preventDefault(); fecharModal(); }
    }, true);
  }

  return { icone, toast, escapar, abrirModal, fecharModal, modalAberto, aoFecharRegistrar, confirmar, hora, dataCurta, ICONES };
})();
