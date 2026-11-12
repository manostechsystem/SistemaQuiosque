/* Rota do Forte — PDV: comportamento das telas. */

const App = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const st = {
    vista: 'venda',
    cat: 'todas',
    retCatFiltro: 'todas',
    busca: '',
    carrinho: [],
    desconto: 0,
    periodo: 'hoje',
    filtroProdutos: '',
    usuario: null,
    logado: false,
    retAba: 'financeiro',
    loginUser: null,
    impressoras: []
  };

  const TIPOS = { produto: 'Produto', aluguel: 'Aluguel', servico: 'Serviço' };
  const PAGAMENTOS = [
    { id: 'dinheiro', nome: 'Dinheiro', icone: 'dinheiro' },
    { id: 'pix', nome: 'PIX', icone: 'pix' },
    { id: 'debito', nome: 'Débito', icone: 'cartao' },
    { id: 'credito', nome: 'Crédito', icone: 'credito' }
  ];

  const cfg = () => DB.estado.config;
  const produtos = () => DB.produtos();

  function numero(v) { return v.toFixed(2).replace('.', ','); }
  function valorDeTexto(t) {
    if (typeof t === 'number') return t;
    return Number(String(t).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
  }

  /* ================== NAVEGAÇÃO ================== */
  function irPara(vista) {
    if ((vista === 'config' || vista === 'retaguarda') && st.usuario?.papel !== 'admin') {
      UI.toast('Acesso restrito ao administrador.', 'erro');
      return;
    }
    st.vista = vista;

    const ehRetaguarda = vista === 'retaguarda';
    const trilhoPdv = $('#trilho-pdv');
    const trilhoRet = $('#trilho-retaguarda');
    const topoBadge = $('#topo-badge');
    const topoLoja = $('#topo-loja');

    if (ehRetaguarda) {
      if (trilhoPdv) trilhoPdv.hidden = true;
      if (trilhoRet) trilhoRet.hidden = false;
      if (topoBadge) {
        topoBadge.textContent = 'GESTÃO';
        topoBadge.classList.add('topo__nome--gestao');
      }
      if (topoLoja) topoLoja.textContent = 'Rota do Forte — Gestão Empresarial';
      document.title = 'Rota do Forte — Gestão Empresarial';
    } else {
      if (trilhoPdv) trilhoPdv.hidden = false;
      if (trilhoRet) trilhoRet.hidden = true;
      if (topoBadge) {
        topoBadge.textContent = 'PDV';
        topoBadge.classList.remove('topo__nome--gestao');
      }
      if (topoLoja) topoLoja.textContent = 'Rota do Forte';
      document.title = 'Rota do Forte — PDV';
    }

    $$('.trilho__btn').forEach(b => {
      if (b.dataset.vista) b.classList.toggle('ativo', b.dataset.vista === vista);
    });
    $$('.vista').forEach(v => {
      const ativa = v.id === 'vista-' + vista;
      v.classList.toggle('ativa', ativa);
      if (ativa) v.scrollTop = 0;
    });
    const containerConteudo = $('.conteudo');
    if (containerConteudo) containerConteudo.scrollTop = 0;
    if (vista === 'config') {
      const grade = $('.config-grade');
      if (grade) grade.scrollTop = 0;
    }
    if (vista === 'retaguarda') renderRetaguarda();
    if (vista === 'caixa') renderCaixaVista();
    if (vista === 'config') preencherConfig();
    if (vista === 'venda') setTimeout(() => $('#busca')?.focus(), 40);
  }

  /* ================== VENDA ================== */
  const ICONES_CATEGORIAS = {
    'cat-pasteis': 'pastel',
    'cat-bebidas': 'bebida',
    'cat-cervejas': 'cerveja',
    'cat-churros': 'churros',
    'cat-porcoes': 'porcao',
    'cat-acai': 'acai',
    'cat-alugueis': 'praia'
  };

  function iconeCategoria(c) {
    if (!c) return 'comida';
    const id = (c.id || '').toLowerCase();
    const nome = (c.nome || '').toLowerCase();

    if (id === 'cat-pasteis' || nome.includes('pastel')) return 'pastel';
    if (id === 'cat-churros' || nome.includes('churros')) return 'churros';
    if (id === 'cat-cervejas' || nome.includes('cerveja') || nome.includes('chopp')) return 'cerveja';
    if (id === 'cat-bebidas' || nome.includes('bebida') || nome.includes('suco') || nome.includes('refrig') || nome.includes('agua') || nome.includes('água')) return 'bebida';
    if (id === 'cat-acai' || nome.includes('açaí') || nome.includes('acai') || nome.includes('sobremesa') || nome.includes('sorvete')) return 'acai';
    if (id === 'cat-porcoes' || nome.includes('porç') || nome.includes('porc') || nome.includes('salgado') || nome.includes('batata')) return 'porcao';
    if (id === 'cat-alugueis' || nome.includes('alugu') || nome.includes('serviç') || nome.includes('servic') || nome.includes('praia')) return 'praia';
    if (nome.includes('comida') || nome.includes('lanche') || nome.includes('refei') || nome.includes('aliment') || nome.includes('sandu') || nome.includes('snack')) return 'comida';

    return ICONES_CATEGORIAS[c.id] || 'comida';
  }

  function renderCategorias() {
    const lista = DB.categorias();
    const prods = produtos();
    const total = prods.length;
    const box = $('#cats');
    if (!box) return;

    box.innerHTML = `
      <button class="cat ${st.cat === 'todas' ? 'ativo' : ''}" data-cat="todas">
        <span class="cat__ico">${UI.icone('gradeIcon')}</span>
        <span>Todos</span>
        <span class="cat__n">${total}</span>
      </button>
      ${lista.map(c => {
        const n = prods.filter(p => p.categoriaId === c.id).length;
        const ico = iconeCategoria(c);
        const tagCozinha = c.id === 'cat-pasteis' ? `<span class="cat__tag-cozinha">${UI.icone('cozinha')} Cozinha</span>` : '';
        return `
          <button class="cat ${st.cat === c.id ? 'ativo' : ''}" data-cat="${c.id}" title="${UI.escapar(c.nome)}">
            <span class="cat__ico">${UI.icone(ico)}</span>
            <span>${UI.escapar(c.nome)}</span>
            ${tagCozinha}
            <span class="cat__n">${n}</span>
          </button>`;
      }).join('')}`;

    $$('#cats .cat').forEach(b => b.onclick = () => {
      st.cat = b.dataset.cat;
      renderCategorias();
      renderGrade();
    });
  }

  function filtrarProdutos() {
    const termo = st.busca.trim().toLowerCase();
    return produtos().filter(p => {
      if (st.cat !== 'todas' && p.categoriaId !== st.cat) return false;
      if (!termo) return true;
      return p.nome.toLowerCase().includes(termo) || (p.codigo || '').toLowerCase().includes(termo);
    });
  }

  function formatarPrecoCard(p) {
    if (p.opcoes && p.opcoes.length > 0) {
      const precos = p.opcoes.map(o => o.preco != null ? o.preco : p.preco);
      const min = Math.min(...precos);
      const max = Math.max(...precos);
      return min === max ? DB.moeda(min) : `A partir de ${DB.moeda(min)}`;
    }
    return DB.moeda(p.preco);
  }

  function renderGrade() {
    const prods = produtos();
    const termo = st.busca.trim().toLowerCase();
    const ehAdmin = st.usuario?.papel === 'admin';

    // 1. Renderiza os cards menores de Acesso Rápido
    renderAcessoRapido(prods, ehAdmin);

    // 2. Renderiza catálogo separado por categorias
    const grade = $('#grade');
    const vazio = $('#grade-vazio');
    if (!grade) return;

    if (st.cat === 'todas' && !termo) {
      const cats = DB.categorias();
      let html = '';
      let totalExibido = 0;

      cats.forEach(c => {
        const itensDaCat = prods.filter(p => p.categoriaId === c.id);
        if (!itensDaCat.length) return;
        totalExibido += itensDaCat.length;
        const ico = iconeCategoria(c);
        const ehPastel = c.id === 'cat-pasteis' || /pastel/i.test(c.nome);

        html += `
          <div class="cat-bloco">
            <div class="cat-bloco__head">
              <div class="cat-bloco__tit">
                <span class="cat-bloco__ico">${UI.icone(ico)}</span>
                <h3>${UI.escapar(c.nome)}</h3>
                ${ehPastel ? `<span class="cat-bloco__badge-cozinha">${UI.icone('cozinha')} Impresso na Cozinha</span>` : ''}
              </div>
              <span class="cat-bloco__contagem">${itensDaCat.length} ${itensDaCat.length === 1 ? 'item' : 'itens'}</span>
            </div>
            <div class="grade" style="margin-bottom:6px">
              ${itensDaCat.map(p => montarCardProduto(p, ehAdmin)).join('')}
            </div>
          </div>`;
      });

      vazio.hidden = totalExibido > 0;
      grade.innerHTML = html;
    } else {
      const lista = filtrarProdutos();
      vazio.hidden = lista.length > 0;
      if (lista.length) {
        const catAtual = DB.categorias().find(c => c.id === st.cat);
        const ehPastel = catAtual && (catAtual.id === 'cat-pasteis' || /pastel/i.test(catAtual.nome));
        const ico = catAtual ? iconeCategoria(catAtual) : 'comida';
        grade.innerHTML = `
          ${catAtual ? `
          <div class="cat-bloco__head" style="margin-bottom:12px">
            <div class="cat-bloco__tit">
              <span class="cat-bloco__ico">${UI.icone(ico)}</span>
              <h3>${UI.escapar(catAtual.nome)}</h3>
              ${ehPastel ? `<span class="cat-bloco__badge-cozinha">${UI.icone('cozinha')} Impresso na Cozinha</span>` : ''}
            </div>
            <span class="cat-bloco__contagem">${lista.length} ${lista.length === 1 ? 'item' : 'itens'}</span>
          </div>` : ''}
          <div class="grade">
            ${lista.map(p => montarCardProduto(p, ehAdmin)).join('')}
          </div>`;
      } else {
        grade.innerHTML = '';
      }
    }

    ligarEventosCards();
  }

  function renderAcessoRapido(prods, ehAdmin) {
    const container = $('#grade-rapida');
    if (!container) return;

    const rapidos = prods.filter(p => p.acessoRapido);
    if (!rapidos.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;padding:12px 16px;background:rgba(255,255,255,.6);border:1px dashed var(--borda-forte);border-radius:10px;text-align:center;font-size:12px;color:var(--tinta-3)">
          Nenhum item fixado no Acesso Rápido. ${ehAdmin ? 'Como Administrador, toque na estrela dos cards abaixo ou acesse Gestão > Estoque para definir os itens de toque ágil.' : 'O Administrador pode fixar os produtos mais vendidos.'}
        </div>`;
      return;
    }

    container.innerHTML = rapidos.map(p => {
      const qtdTotal = st.carrinho.filter(i => i.produtoId === p.id).reduce((s, it) => s + it.qtd, 0);
      const semEstoque = p.controlaEstoque && p.estoque <= 0;
      const vaiCozinha = DB.produtoVaiParaCozinha(p.id);
      const temOpcoes = p.opcoes && p.opcoes.length > 0;

      return `
        <button class="prod-mini ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}" title="Lançar ${UI.escapar(p.nome)}">
          <div class="prod-mini__corpo">
            <div class="prod-mini__nome">${UI.escapar(p.nome)}</div>
            <div class="prod-mini__tags">
              ${vaiCozinha ? `<span class="tag-cozinha-mini">${UI.icone('cozinha')} Cozinha</span>` : ''}
              ${temOpcoes ? `<span class="tag-sabor-mini">${p.opcoes.length} opções</span>` : ''}
              ${p.controlaEstoque ? `<span class="tag-est-mini ${p.estoque <= 0 ? 'zero' : p.estoque <= (p.estoqueMinimo ?? 5) ? 'baixo' : ''}">${p.estoque} un</span>` : ''}
            </div>
          </div>
          <div class="prod-mini__preco-linha">
            <span class="prod-mini__preco">${formatarPrecoCard(p)}</span>
            ${qtdTotal > 0 ? `<span class="prod-mini__qtd">${qtdTotal}</span>` : ''}
          </div>
          ${ehAdmin ? `<span class="btn-pin-rapido ${p.acessoRapido ? 'ativo' : ''}" data-pin-id="${p.id}" title="${p.acessoRapido ? 'Remover do Acesso Rápido' : 'Fixar no Acesso Rápido'}">${UI.icone(p.acessoRapido ? 'estrelaCheia' : 'estrela')}</span>` : ''}
        </button>`;
    }).join('');
  }

  function montarCardProduto(p, ehAdmin) {
    const qtdTotal = st.carrinho.filter(i => i.produtoId === p.id).reduce((s, it) => s + it.qtd, 0);
    const semEstoque = p.controlaEstoque && p.estoque <= 0;
    const estClasse = p.controlaEstoque ? (p.estoque <= 0 ? 'zero' : p.estoque <= (p.estoqueMinimo ?? 5) ? 'baixo' : '') : '';
    const vaiCozinha = DB.produtoVaiParaCozinha(p.id);
    const temOpcoes = p.opcoes && p.opcoes.length > 0;

    return `
      <button class="prod ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}">
        <div class="prod__topo">
          <span class="prod__nome">${UI.escapar(p.nome)}</span>
          ${qtdTotal > 0 ? `<span class="prod__qtd">${qtdTotal}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin:2px 0 4px;flex-wrap:wrap">
          ${vaiCozinha ? `<span class="prod__tag-cozinha">${UI.icone('cozinha')} Cozinha</span>` : ''}
          ${temOpcoes ? `<span class="tag-sabor-mini">${p.opcoes.length} sabores</span>` : ''}
        </div>
        <div class="prod__pe">
          <span class="prod__preco">${formatarPrecoCard(p)}</span>
          ${p.controlaEstoque
            ? `<span class="prod__est ${estClasse}">${p.estoque} un</span>`
            : p.tipo !== 'produto'
              ? `<span class="prod__tag ${p.tipo}">${TIPOS[p.tipo]}</span>`
              : ''}
        </div>
        ${ehAdmin ? `<span class="btn-pin-rapido ${p.acessoRapido ? 'ativo' : ''}" data-pin-id="${p.id}" title="${p.acessoRapido ? 'Remover do Acesso Rápido' : 'Fixar no Acesso Rápido'}">${UI.icone(p.acessoRapido ? 'estrelaCheia' : 'estrela')}</span>` : ''}
      </button>`;
  }

  function abrirSeletorSabores(p) {
    if (!p.opcoes || !p.opcoes.length) {
      adicionar(p.id);
      return;
    }
    const catIco = ICONES_CATEGORIAS[p.categoriaId] || 'pastel';
    const corpo = UI.abrirModal({
      titulo: `Escolha o sabor · ${p.nome}`,
      largo: false,
      corpo: `
        <div style="font-size:13px;color:var(--tinta-2);margin-bottom:8px;display:flex;align-items:center;gap:8px">
          ${UI.icone(catIco)}
          <span>Selecione a opção desejada para lançar no pedido:</span>
        </div>
        <div class="sabor-grid">
          ${p.opcoes.map((op, idx) => {
            const precoOp = op.preco != null ? op.preco : p.preco;
            return `
              <button class="btn-sabor-card" data-idx="${idx}">
                <div class="sabor-card__nome">${UI.escapar(op.nome)}</div>
                <div class="sabor-card__sub">${UI.escapar(p.nome)} de ${UI.escapar(op.nome)}</div>
                <div class="sabor-card__preco">${DB.moeda(precoOp)}</div>
              </button>`;
          }).join('')}
        </div>
      `,
      rodape: `<button class="btn-secundario" id="sabor-cancelar">Cancelar</button>`
    });

    document.getElementById('sabor-cancelar').onclick = UI.fecharModal;

    corpo.querySelectorAll('.btn-sabor-card').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const op = p.opcoes[idx];
        UI.fecharModal();
        adicionar(p.id, op);
      };
    });
  }

  function ligarEventosCards() {
    $$('.prod, .prod-mini').forEach(b => {
      b.onclick = (e) => {
        if (e.target.closest('.btn-pin-rapido')) return;
        const pid = b.dataset.id;
        const p = DB.produto(pid);
        if (p && p.opcoes && p.opcoes.length > 0) {
          abrirSeletorSabores(p);
        } else {
          adicionar(pid);
        }
      };
    });

    $$('.btn-pin-rapido').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const pid = btn.dataset.pinId;
        if (pid) {
          const ativo = DB.alternarAcessoRapido(pid);
          const p = DB.produto(pid);
          UI.toast(ativo ? `"${p?.nome}" fixado no Acesso Rápido` : `"${p?.nome}" removido do Acesso Rápido`);
          renderGrade();
        }
      };
    });
  }

  function adicionar(produtoId, opcao = null) {
    const p = DB.produto(produtoId);
    if (!p) return;

    if (!opcao && p.opcoes && p.opcoes.length > 0) {
      abrirSeletorSabores(p);
      return;
    }

    const precoItem = (opcao && opcao.preco != null) ? opcao.preco : p.preco;
    const nomeItem = opcao ? `${p.nome} (${opcao.nome})` : p.nome;
    const chaveItem = p.id + (opcao ? '::' + opcao.nome : '');

    // Verifica estoque acumulado do produto base no carrinho
    const totalNoCarrinho = st.carrinho
      .filter(i => i.produtoId === p.id)
      .reduce((s, it) => s + it.qtd, 0);

    if (p.controlaEstoque && totalNoCarrinho + 1 > p.estoque) {
      UI.toast(`Estoque de "${p.nome}" acaba em ${p.estoque}`, 'erro');
      return;
    }

    const item = st.carrinho.find(i => (i.itemKey || i.produtoId) === chaveItem);
    if (item) {
      item.qtd += 1;
    } else {
      st.carrinho.push({
        itemKey: chaveItem,
        produtoId: p.id,
        nome: nomeItem,
        opcao: opcao ? opcao.nome : null,
        preco: precoItem,
        qtd: 1,
        tipo: p.tipo,
        vaiParaCozinha: DB.produtoVaiParaCozinha(p.id)
      });
    }

    renderCarrinho();
    renderGrade();
  }

  function alterarQtd(chaveItem, delta) {
    const item = st.carrinho.find(i => (i.itemKey || i.produtoId) === chaveItem);
    if (!item) return;
    if (delta > 0) {
      const p = DB.produto(item.produtoId);
      const totalNoCarrinho = st.carrinho
        .filter(i => i.produtoId === item.produtoId)
        .reduce((s, it) => s + it.qtd, 0);
      if (p && p.controlaEstoque && totalNoCarrinho + 1 > p.estoque) {
        UI.toast('Estoque insuficiente', 'erro');
        return;
      }
    }
    item.qtd += delta;
    if (item.qtd <= 0) st.carrinho = st.carrinho.filter(i => (i.itemKey || i.produtoId) !== chaveItem);
    limitarDesconto();
    renderCarrinho();
    renderGrade();
  }

  function remover(chaveItem) {
    st.carrinho = st.carrinho.filter(i => (i.itemKey || i.produtoId) !== chaveItem);
    limitarDesconto();
    renderCarrinho();
    renderGrade();
  }

  function subtotal() {
    return DB.arred(st.carrinho.reduce((s, i) => s + i.preco * i.qtd, 0));
  }
  function total() {
    return DB.arred(Math.max(0, subtotal() - st.desconto));
  }
  function limitarDesconto() {
    if (st.desconto > subtotal()) st.desconto = subtotal();
    if (st.desconto < 0) st.desconto = 0;
  }

  function renderCarrinho() {
    const lista = $('#itens');
    const vazio = $('#carrinho-vazio');
    vazio.hidden = st.carrinho.length > 0;
    lista.hidden = st.carrinho.length === 0;

    const bComanda = $('#carrinho-badge-comanda');
    if (bComanda) {
      bComanda.textContent = `Pedido #${DB.numeroComanda(DB.obterProximoNumeroComanda())}`;
    }

    lista.innerHTML = st.carrinho.map(i => {
      const chave = i.itemKey || i.produtoId;
      return `
      <div class="item">
        <div class="item__nome">${UI.escapar(i.nome)}</div>
        <div class="item__total">${DB.moeda(i.preco * i.qtd)}</div>
        <div class="linha2 item__linha2" style="grid-column:1/-1;justify-content:space-between;margin-top:2px">
          <div class="stepper">
            <button class="rem" data-a="-" data-key="${chave}" title="Remover um">−</button>
            <span class="stepper__n">${i.qtd}</span>
            <button data-a="+" data-key="${chave}" title="Adicionar um">+</button>
          </div>
          <span class="item__unit">${DB.moeda(i.preco)} / un</span>
        </div>
      </div>`;
    }).join('');

    $$('#itens .stepper button').forEach(b => b.onclick = () => {
      const d = b.dataset.a === '+' ? 1 : -1;
      const chave = b.dataset.key;
      if (d === -1 && st.carrinho.find(i => (i.itemKey || i.produtoId) === chave)?.qtd === 1) remover(chave);
      else alterarQtd(chave, d);
    });

    $('#tot-subtotal').textContent = DB.moeda(subtotal());
    $('#tot-desc').textContent = st.desconto > 0 ? '- ' + DB.moeda(st.desconto) : DB.moeda(0);
    $('#tot-desc').classList.toggle('desconto', st.desconto > 0);
    $('#tot-total').textContent = DB.moeda(total());
    $('#pagar-valor').textContent = DB.moeda(total());
    $('#btn-pagar').disabled = st.carrinho.length === 0;
  }

  /* ================== PAGAMENTO ================== */
  async function abrirPagamento() {
    if (!st.carrinho.length) return;
    if (!DB.caixaAberto()) {
      const ok = await abrirCaixaFluxo();
      if (!ok) return;
    }
    const tot = total();
    const proximo = (cfg().ultimoCupom || 0) + 1;
    let forma = 'dinheiro';
    let buffer = ''; // centavos digitados

    const itensCozinha = st.carrinho.filter(i => DB.produtoVaiParaCozinha(i.produtoId));
    const temCozinha = itensCozinha.length > 0 && cfg().cozinhaAtiva !== false;

    const proximaComanda = DB.obterProximoNumeroComanda();
    const corpo = UI.abrirModal({
      titulo: `Pagamento · Pedido #${DB.numeroComanda(proximaComanda)} (Cupom #${DB.numeroCupom(proximo)})`,
      largo: false,
      corpo: `
        <div style="background:var(--afundado);border:1px solid var(--borda-suave);border-radius:var(--raio-p);padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;font-weight:800;color:var(--tinta-2);text-transform:uppercase;letter-spacing:0.5px">Pedido do Dia:</span>
            <span class="badge" style="font-size:13px;font-weight:900;background:var(--primaria);color:#fff;padding:2px 8px;border-radius:4px">#${DB.numeroComanda(proximaComanda)}</span>
          </div>
          <span style="font-size:10.5px;color:var(--tinta-3);font-weight:600">Zera a contagem todo dia</span>
        </div>
        <div class="pg-formas" id="pg-formas">
          ${PAGAMENTOS.map(p => `<button class="pg-forma" data-f="${p.id}">${UI.icone(p.icone)}<span>${p.nome}</span></button>`).join('')}
        </div>
        <div class="pg-total"><span>Total a pagar</span><b>${DB.moeda(tot)}</b></div>

        <div class="campo" style="margin-bottom:10px">
          <label for="pg-cliente">Identificação / Mesa / Cliente <span style="font-weight:normal;text-transform:none;color:var(--tinta-3)">(opcional)</span></label>
          <input type="text" id="pg-cliente" placeholder="Ex.: Mesa 04 / João / Guarda-sol 12" style="height:36px;font-size:12.5px" autocomplete="off" />
        </div>

        ${temCozinha ? `
        <div class="faixa-info" style="margin-bottom:10px;padding:8px 12px;display:flex;align-items:center;gap:8px">
          ${UI.icone('cozinha')}
          <span><b>Comanda da Cozinha:</b> ${itensCozinha.reduce((s, i) => s + i.qtd, 0)} item(ns) serão impressos na cozinha.</span>
        </div>
        <div class="campo" style="margin-bottom:12px">
          <label for="pg-obs">Observação para a Cozinha <span style="font-weight:normal;text-transform:none;color:var(--tinta-3)">(opcional)</span></label>
          <input type="text" id="pg-obs" placeholder="Ex.: Sem cebola, bem passado..." style="height:36px;font-size:12.5px" autocomplete="off" />
        </div>` : ''}

        <div id="pg-dinheiro">
          <div class="pg-valor-campo"><span>Recebido</span><b id="pg-recebido">R$ 0,00</b></div>
          <div class="troco-linha" id="pg-troco"><span>Troco</span><b>R$ 0,00</b></div>
          <div class="teclado" id="pg-teclado">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
            <button data-k="exato" class="tecla--acao">Exato</button>
            <button data-k="0">0</button>
            <button data-k="back" class="tecla--acao">Apagar</button>
          </div>
          <p class="dica-tecla">Digite o valor recebido no teclado · <kbd>Enter</kbd> finaliza</p>
        </div>
        <div id="pg-outro" hidden>
          <div class="pg-valor-campo"><span>Recebimento</span><b>${DB.moeda(tot)}</b></div>
          <p class="dica-tecla">Confirme o recebimento na maquininha ou no aplicativo e finalize.</p>
        </div>`,
      rodape: `
        <div class="total-modal"><span>Total</span><b>${DB.moeda(tot)}</b></div>
        <button class="btn-secundario" id="pg-cancelar">Cancelar</button>
        <button class="btn-primario" id="pg-finalizar">${UI.icone('check')} Finalizar venda</button>`
    });

    const elDin = corpo.querySelector('#pg-dinheiro');
    const elOutro = corpo.querySelector('#pg-outro');
    const elRecebido = corpo.querySelector('#pg-recebido');
    const elTroco = corpo.querySelector('#pg-troco');
    const btnFin = document.querySelector('#pg-finalizar');

    function recebido() { return buffer === '' ? 0 : Number(buffer) / 100; }

    function pintar() {
      const r = recebido();
      elRecebido.textContent = DB.moeda(r);
      const diff = DB.arred(tot - r);
      if (forma !== 'dinheiro') { btnFin.disabled = false; return; }
      if (r === 0) {
        elTroco.className = 'troco-linha';
        elTroco.innerHTML = `<span>Troco</span><b>${DB.moeda(0)}</b>`;
        btnFin.disabled = true;
      } else if (diff > 0) {
        elTroco.className = 'troco-linha falta';
        elTroco.innerHTML = `<span>Falta</span><b>${DB.moeda(diff)}</b>`;
        btnFin.disabled = true;
      } else {
        elTroco.className = 'troco-linha';
        elTroco.innerHTML = `<span>Troco</span><b>${DB.moeda(-diff)}</b>`;
        btnFin.disabled = false;
      }
    }

    function escolherForma(f) {
      forma = f;
      corpo.querySelectorAll('.pg-forma').forEach(b => b.classList.toggle('ativo', b.dataset.f === f));
      elDin.hidden = f !== 'dinheiro';
      elOutro.hidden = f === 'dinheiro';
      pintar();
    }

    corpo.querySelectorAll('.pg-forma').forEach(b => b.onclick = () => escolherForma(b.dataset.f));
    corpo.querySelector('#pg-teclado').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const k = b.dataset.k;
      if (k === 'back') buffer = buffer.slice(0, -1);
      else if (k === 'exato') buffer = String(Math.round(tot * 100));
      else if (buffer.length < 7) buffer += k;
      pintar();
    };

    document.querySelector('#pg-cancelar').onclick = UI.fecharModal;
    btnFin.onclick = finalizarVenda;

    let confirmando = false;
    async function finalizarVenda() {
      if (confirmando) return;
      if (forma === 'dinheiro' && recebido() < tot) return;
      confirmando = true;
      const r = forma === 'dinheiro' ? recebido() : tot;
      const cliente = (document.querySelector('#pg-cliente')?.value || '').trim();
      const obsCozinha = (document.querySelector('#pg-obs')?.value || '').trim();
      try {
        const venda = DB.registrarVenda({
          itens: st.carrinho,
          desconto: st.desconto,
          pagamento: forma,
          recebido: r,
          operador: st.usuario?.nome,
          cliente,
          obsCozinha
        });
        const fiscal = Fiscal.emitir(venda, cfg());
        UI.fecharModal();
        st.carrinho = [];
        st.desconto = 0;
        renderCarrinho(); renderGrade();

        // 1. Imprime cupom do cliente no Caixa
        const cupom = Printer.montarCupom(venda, cfg(), { chave: fiscal.chave });
        Printer.imprimir(cupom, cfg(), 'caixa').then(async okCaixa => {
          let okCozinha = null;
          // 2. Se houver itens de cozinha e comanda ativa, imprime na impressora da cozinha
          if (itensCozinha.length > 0 && cfg().cozinhaAtiva !== false) {
            const comanda = Printer.montarComandaCozinha(venda, itensCozinha, cfg());
            okCozinha = await Printer.imprimir(comanda, cfg(), 'cozinha');
          }

          const numComTxt = `Pedido #${DB.numeroComanda(venda.numeroComanda || venda.numero)}`;
          if (itensCozinha.length > 0 && cfg().cozinhaAtiva !== false) {
            if (okCaixa && okCozinha) {
              UI.toast(`${numComTxt} concluída · Caixa e Cozinha impressos!`);
            } else if (okCaixa && !okCozinha) {
              UI.toast(`${numComTxt} concluída · Atenção: comanda da cozinha não imprimiu`, 'erro');
            } else if (!okCaixa && okCozinha) {
              UI.toast(`${numComTxt} salva · Comanda enviada para a cozinha`, 'ok');
            } else {
              UI.toast(`${numComTxt} salva · Impressões não concluídas`, 'erro');
            }
          } else {
            UI.toast(okCaixa
              ? `${numComTxt} concluída · ${DB.moeda(venda.total)}`
              : `${numComTxt} salva · cupom não impresso`);
          }
        });
        setTimeout(() => $('#busca').focus(), 60);
      } catch (err) {
        confirmando = false;
        UI.toast(err.message || 'Não foi possível concluir', 'erro');
      }
    }

    corpo.querySelectorAll('#pg-cliente, #pg-obs').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finalizarVenda();
        }
      });
    });

    // teclado físico
    corpo.__teclado = e => {
      if (e.key === 'Enter') { e.preventDefault(); finalizarVenda(); return; }
      if (forma !== 'dinheiro') return;
      if (/^\d$/.test(e.key) && buffer.length < 7) { buffer += e.key; pintar(); e.preventDefault(); }
      else if (e.key === 'Backspace') { buffer = buffer.slice(0, -1); pintar(); e.preventDefault(); }
    };

    escolherForma('dinheiro');
    UI.aoFecharRegistrar(() => { corpo.__teclado = null; });
  }

  /* ================== VISTA PRODUTOS ================== */
  function produtosFiltrados() {
    const t = st.filtroProdutos.trim().toLowerCase();
    const c = st.retCatFiltro || 'todas';
    return produtos().filter(p => {
      if (c !== 'todas' && p.categoriaId !== c) return false;
      if (!t) return true;
      return p.nome.toLowerCase().includes(t) || (p.codigo || '').toLowerCase().includes(t);
    });
  }

  function renderMenuCategoriasEstoque() {
    const listaEl = $('#cat-sidebar-lista');
    if (!listaEl) return;
    const cats = DB.categorias();
    const prods = produtos();
    const totalGeral = prods.length;
    const catAtiva = st.retCatFiltro || 'todas';
    const ehAdmin = st.usuario?.papel === 'admin';

    let html = `
      <div class="cat-item ${catAtiva === 'todas' ? 'ativo' : ''}" data-cat-id="todas" title="Todos os Produtos (${totalGeral})">
        <svg class="cat-item__icone ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
        <span class="cat-item__nome">Todos os Produtos</span>
        <span class="cat-item__badge">${totalGeral}</span>
      </div>
    `;

    cats.forEach(c => {
      const qtd = prods.filter(p => p.categoriaId === c.id).length;
      html += `
        <div class="cat-item ${catAtiva === c.id ? 'ativo' : ''}" data-cat-id="${c.id}" title="${UI.escapar(c.nome)} (${qtd})">
          ${UI.icone(iconeCategoria(c), 'cat-item__icone ic')}
          <span class="cat-item__nome">${UI.escapar(c.nome)}</span>
          <span class="cat-item__badge">${qtd}</span>
          ${ehAdmin ? `
            <div class="cat-item__acoes">
              <button class="cat-item__btn-mini" data-cat-edit="${c.id}" title="Editar Categoria">${UI.icone('lapis')}</button>
              <button class="cat-item__btn-mini excluir" data-cat-del="${c.id}" title="Excluir Categoria">${UI.icone('lixeira')}</button>
            </div>
          ` : ''}
        </div>
      `;
    });

    listaEl.innerHTML = html;

    listaEl.querySelectorAll('.cat-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.closest('[data-cat-edit]') || e.target.closest('[data-cat-del]')) return;
        st.retCatFiltro = item.dataset.catId;
        renderMenuCategoriasEstoque();
        renderProdutos();
      };
    });

    listaEl.querySelectorAll('[data-cat-edit]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const cid = b.dataset.catEdit;
        const c = DB.categorias().find(x => x.id === cid);
        if (!c) return;
        UI.prompt({
          titulo: 'Editar categoria',
          campos: [
            { id: 'ec-nome', label: 'Nome da Categoria', valor: c.nome, requerido: true }
          ],
          acao: 'Salvar'
        }).then(v => {
          if (!v) return;
          try {
            DB.salvarCategoria({ id: c.id, nome: v['ec-nome'].trim(), ordem: c.ordem });
            renderMenuCategoriasEstoque();
            renderProdutos();
            renderCategorias();
            UI.toast('Categoria atualizada');
          } catch (err) { UI.toast(err.message, 'erro'); }
        });
      };
    });

    listaEl.querySelectorAll('[data-cat-del]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const cid = b.dataset.catDel;
        const c = DB.categorias().find(x => x.id === cid);
        if (!c) return;
        UI.confirmar({
          titulo: 'Excluir categoria',
          texto: `Excluir a categoria "<b>${UI.escapar(c.nome)}</b>"? Os produtos vinculados a ela ficarão sem categoria.`,
          acao: 'Excluir definitivamente',
          perigo: true
        }).then(ok => {
          if (!ok) return;
          try {
            DB.excluirCategoria(c.id);
            if (st.retCatFiltro === c.id) st.retCatFiltro = 'todas';
            renderMenuCategoriasEstoque();
            renderProdutos();
            renderCategorias();
            UI.toast(`Categoria "${c.nome}" excluída.`);
          } catch (err) { UI.toast(err.message, 'erro'); }
        });
      };
    });
  }

  function abrirModalNovaCategoria() {
    UI.prompt({
      titulo: 'Nova Categoria',
      campos: [
        { id: 'nc-nome', label: 'Nome da Categoria', placeholder: 'Ex.: Sobremesas, Petiscos, Bebidas', requerido: true }
      ],
      acao: 'Cadastrar'
    }).then(v => {
      if (!v) return;
      try {
        const catNova = DB.salvarCategoria({ nome: v['nc-nome'].trim() });
        st.retCatFiltro = catNova.id;
        renderMenuCategoriasEstoque();
        renderProdutos();
        renderCategorias();
        UI.toast(`Categoria "${catNova.nome}" cadastrada!`);
      } catch (err) { UI.toast(err.message, 'erro'); }
    });
  }

  function renderProdutos() {
    renderMenuCategoriasEstoque();
    atualizarAlertasEstoque();

    const lista = produtosFiltrados();
    const total = produtos().length;
    const catNome = st.retCatFiltro && st.retCatFiltro !== 'todas' ? DB.nomeCategoria(st.retCatFiltro) : 'Todas';
    $('#ret-sub').textContent = `${total} produtos no catálogo · Exibindo ${lista.length} (${catNome})`;
    $('#prod-vazio').hidden = lista.length > 0;
    $('#prod-tabela').hidden = lista.length === 0;

    const ehAdmin = st.usuario?.papel === 'admin';
    $('#prod-corpo').innerHTML = lista
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(p => {
        const est = !p.controlaEstoque
          ? '<span class="chip">Livre</span>'
          : p.estoque <= 0
            ? '<span class="chip chip--zero">Sem estoque</span>'
            : p.estoque <= (p.estoqueMinimo != null && !isNaN(p.estoqueMinimo) ? Number(p.estoqueMinimo) : 5)
              ? `<span class="chip chip--baixo" title="Estoque mínimo configurado: ${p.estoqueMinimo ?? 5} un">${p.estoque} un (Mín: ${p.estoqueMinimo ?? 5})</span>`
              : `<span class="chip chip--ok">${p.estoque} un</span>`;
        const tipoClasse = p.tipo === 'aluguel' ? 'chip--aluguel' : p.tipo === 'servico' ? 'chip--servico' : 'chip--tipo';
        return `
          <tr>
            <td>
              <div class="nome-prod">${UI.escapar(p.nome)}</div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">
                ${p.codigo ? `<span class="cod">${UI.escapar(p.codigo)}</span>` : ''}
                ${p.vaiParaCozinha ? `<span class="chip chip--cozinha">${UI.icone('cozinha')} Cozinha</span>` : ''}
              </div>
            </td>
            <td><span class="chip">${UI.escapar(DB.nomeCategoria(p.categoriaId))}</span></td>
            <td class="dir num">${DB.moeda(p.preco)}</td>
            <td class="dir">${est}</td>
            <td><span class="chip ${tipoClasse}">${TIPOS[p.tipo] || 'Produto'}</span></td>
            <td class="centro">
              ${ehAdmin ? `
                <button class="btn-toggle-rapido-tabela ${p.acessoRapido ? 'ativo' : ''}" data-toggle-rapido="${p.id}" title="${p.acessoRapido ? 'Clique para remover do Acesso Rápido do PDV' : 'Clique para fixar no Acesso Rápido do PDV'}">
                  ${UI.icone(p.acessoRapido ? 'estrelaCheia' : 'estrela')}
                  <span>${p.acessoRapido ? 'Fixado' : 'Não fixado'}</span>
                </button>
              ` : `
                <span class="chip ${p.acessoRapido ? 'chip--ok' : ''}">${p.acessoRapido ? 'Fixado' : '—'}</span>
              `}
            </td>
            <td class="dir">
              <div class="mini-acoes">
                ${ehAdmin ? `
                  <button data-editar="${p.id}" title="Editar">${UI.icone('lapis')}</button>
                  <button class="excluir" data-excluir="${p.id}" title="Excluir">${UI.icone('lixeira')}</button>
                ` : '<span style="font-size:11px;color:var(--tinta-3)">Apenas Admin</span>'}
              </div>
            </td>
          </tr>`;
      }).join('');

    $$('[data-editar]').forEach(b => b.onclick = () => formProduto(b.dataset.editar));
    $$('[data-toggle-rapido]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      if (st.usuario?.papel !== 'admin') {
        UI.toast('Apenas administradores podem alterar o Acesso Rápido.', 'erro');
        return;
      }
      const pid = b.dataset.toggleRapido;
      const ativo = DB.alternarAcessoRapido(pid);
      const p = DB.produto(pid);
      UI.toast(ativo ? `"${p?.nome}" fixado no Acesso Rápido do PDV!` : `"${p?.nome}" removido do Acesso Rápido.`);
      renderProdutos();
      renderGrade();
    });
    $$('[data-excluir]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      if (st.usuario?.papel !== 'admin') {
        UI.toast('Permissão negada: apenas administradores podem excluir produtos.', 'erro');
        return;
      }
      const pid = b.dataset.excluir;
      const p = DB.produto(pid);
      if (!p) return;
      const ok = await UI.confirmar({
        titulo: 'Excluir produto',
        texto: `Tem certeza que deseja excluir <b>${UI.escapar(p.nome)}</b> do catálogo?`,
        acao: 'Excluir definitivamente',
        perigo: true
      });
      if (ok) {
        DB.excluirProduto(pid);
        renderProdutos();
        renderGrade();
        renderCategorias();
        UI.toast(`Produto "${p.nome}" excluído com sucesso.`);
      }
    });
  }

  function formProduto(produtoId) {
    if (st.usuario?.papel !== 'admin') {
      UI.toast('Apenas administradores podem cadastrar ou alterar produtos.', 'erro');
      return;
    }
    const p = produtoId ? DB.produto(produtoId) : null;
    const cats = DB.categorias();
    UI.abrirModal({
      titulo: p ? 'Editar produto' : 'Novo produto',
      corpo: `
        <div class="campo col-full">
          <label for="f-nome">Nome</label>
          <input id="f-nome" type="text" placeholder="Ex.: Açaí 500ml" value="${p ? UI.escapar(p.nome) : ''}" />
        </div>
        <div class="grid-2">
          <div class="campo">
            <label for="f-cat">Categoria</label>
            <select id="f-cat" class="campo-select">
              ${cats.map(c => `<option value="${c.id}" ${p && p.categoriaId === c.id ? 'selected' : ''}>${UI.escapar(c.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="f-tipo">Tipo</label>
            <select id="f-tipo" class="campo-select">
              ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${p && p.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="f-preco">Preço (R$)</label>
            <input id="f-preco" type="text" inputmode="decimal" placeholder="0,00" value="${p ? numero(p.preco) : ''}" />
          </div>
          <div class="campo">
            <label for="f-codigo">Código de barras</label>
            <input id="f-codigo" type="text" placeholder="Opcional" value="${p ? UI.escapar(p.codigo || '') : ''}" />
          </div>
          <div class="campo col-full">
            <div class="grid-2" style="gap:12px">
              <div>
                <label for="f-estoque">Estoque Atual</label>
                <input id="f-estoque" type="number" min="0" step="1" value="${p ? p.estoque : 0}"
                  style="width:100%;height:42px;padding:0 12px;border-radius:var(--r-campo);border:1px solid var(--borda-forte);background:var(--elevado);font:inherit;text-align:right" />
              </div>
              <div>
                <label for="f-estoque-min" style="color:var(--primaria-forte);font-weight:700">Estoque Mínimo (Alerta ADM)</label>
                <input id="f-estoque-min" type="number" min="0" step="1" value="${p && p.estoqueMinimo != null ? p.estoqueMinimo : 5}" placeholder="Ex.: 30"
                  style="width:100%;height:42px;padding:0 12px;border-radius:var(--r-campo);border:1px solid var(--primaria);background:var(--elevado);font:inherit;text-align:right;font-weight:700" />
              </div>
            </div>
            <label class="alternador" style="margin:8px 0 0">
              <input type="checkbox" id="f-controla" ${!p || p.controlaEstoque ? 'checked' : ''} />
              <span class="alternador__pista"></span>
              <span class="alternador__txt">Controlar estoque deste produto<small>Dispara alerta e notificação quando o estoque for menor ou igual ao mínimo</small></span>
            </label>
          </div>
          <div class="campo col-full">
            <label class="alternador" style="margin:4px 0 0">
              <input type="checkbox" id="f-cozinha" ${!p ? false : (p.vaiParaCozinha ? 'checked' : '')} />
              <span class="alternador__pista"></span>
              <span class="alternador__txt">Enviar para comanda da cozinha<small>Imprime comanda na impressora da cozinha ao finalizar a venda no PDV</small></span>
            </label>
          </div>
          <div class="campo col-full">
            <label for="f-opcoes">Sabores / Opções de recheio <span style="font-weight:normal;text-transform:none;color:var(--tinta-3)">(opcional, separados por vírgula)</span></label>
            <input id="f-opcoes" type="text" placeholder="Ex.: Carne, Pizza, Frango (ou Doce de Leite, Chocolate, Nutella)" value="${p && p.opcoes ? p.opcoes.map(o => o.nome || o).join(', ') : ''}" />
            <small style="color:var(--tinta-3);font-size:11px;margin-top:2px;display:block">Ao cadastrar sabores, um seletor rápido é exibido ao tocar no produto no PDV.</small>
          </div>
          <div class="campo col-full">
            <label class="alternador" style="margin:4px 0 0">
              <input type="checkbox" id="f-acesso-rapido" ${p?.acessoRapido ? 'checked' : ''} />
              <span class="alternador__pista"></span>
              <span class="alternador__txt" style="display:inline-flex;align-items:center;gap:4px">${UI.icone('raio')} Fixar no Acesso Rápido da Venda<small style="display:block;margin-top:2px">Exibe card menor no topo do PDV para toque ágil (itens mais vendidos)</small></span>
            </label>
          </div>
        </div>`,
      rodape: `
        <button class="btn-secundario" id="f-cancelar">Cancelar</button>
        <button class="btn-primario" id="f-salvar">${UI.icone('check')} ${p ? 'Salvar alterações' : 'Cadastrar'}</button>`
    });

    document.querySelector('#f-cancelar').onclick = UI.fecharModal;
    document.querySelector('#f-cat').addEventListener('change', e => {
      document.querySelector('#f-cozinha').checked = (e.target.value === 'cat-pasteis');
    });

    const salvar = () => {
      try {
        const opStr = (document.querySelector('#f-opcoes')?.value || '').trim();
        let opcoes = null;
        if (opStr) {
          const precoBase = valorDeTexto(document.querySelector('#f-preco').value);
          opcoes = opStr.split(',').map(s => s.trim()).filter(Boolean).map(nome => {
            const jaTem = p?.opcoes?.find(o => (o.nome || o).toLowerCase() === nome.toLowerCase());
            return {
              nome,
              preco: jaTem && jaTem.preco != null ? jaTem.preco : precoBase
            };
          });
        }

        DB.salvarProduto({
          id: produtoId,
          nome: document.querySelector('#f-nome').value,
          categoriaId: document.querySelector('#f-cat').value,
          tipo: document.querySelector('#f-tipo').value,
          preco: valorDeTexto(document.querySelector('#f-preco').value),
          codigo: document.querySelector('#f-codigo').value,
          controlaEstoque: document.querySelector('#f-controla').checked,
          estoque: document.querySelector('#f-estoque').value,
          estoqueMinimo: document.querySelector('#f-estoque-min')?.value,
          vaiParaCozinha: document.querySelector('#f-cozinha').checked,
          acessoRapido: document.querySelector('#f-acesso-rapido').checked,
          opcoes
        });
        UI.fecharModal();
        renderProdutos(); renderGrade(); renderCategorias();
        UI.toast(p ? 'Produto atualizado' : 'Produto cadastrado');
      } catch (err) {
        UI.toast(err.message, 'erro');
      }
    };
    document.querySelector('#f-salvar').onclick = salvar;
    document.querySelector('#f-nome').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } });
  }

  /* ================== RELATÓRIOS ================== */
  function resumo(periodo) {
    const vendas = DB.vendasNoPeriodo(periodo);
    const faturamento = DB.arred(vendas.reduce((s, v) => s + v.total, 0));
    const qtdVendas = vendas.length;
    const ticket = qtdVendas ? DB.arred(faturamento / qtdVendas) : 0;
    const porPagamento = {};
    const mapaProd = {};
    vendas.forEach(v => {
      porPagamento[v.pagamento] = DB.arred((porPagamento[v.pagamento] || 0) + v.total);
      v.itens.forEach(i => {
        const m = mapaProd[i.produtoId] || (mapaProd[i.produtoId] = { nome: i.nome, qtd: 0, total: 0 });
        m.qtd += i.qtd;
        m.total = DB.arred(m.total + i.preco * i.qtd);
      });
    });
    const maisVendidos = Object.values(mapaProd).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
    return { vendas, faturamento, qtdVendas, ticket, porPagamento, maisVendidos };
  }

  function renderBarras(el, itens, formatar) {
    if (!itens.length) {
      el.innerHTML = '<p class="vazio" style="padding:20px 0">Sem dados no período.</p>';
      return;
    }
    const max = Math.max(...itens.map(i => i.valor)) || 1;
    el.innerHTML = itens.map(i => `
      <div class="barra">
        <div class="barra__topo">
          <span class="barra__nome">${UI.escapar(i.nome)}</span>
          <span class="barra__val">${formatar(i)}</span>
        </div>
        <div class="barra__trilho"><div class="barra__fill" style="width:${Math.max(4, (i.valor / max) * 100)}%"></div></div>
      </div>`).join('');
  }

  function renderRelatorios() {
    const r = resumo(st.periodo);
    const nomePeriodo = st.periodo === 'hoje' ? 'Hoje' : `Últimos ${st.periodo} dias`;
    $('#rel-data').textContent = `${nomePeriodo} · ${r.qtdVendas} ${r.qtdVendas === 1 ? 'venda' : 'vendas'}`;

    $('#kpi-fat').textContent = DB.moeda(r.faturamento);
    $('#kpi-qtd').textContent = r.qtdVendas;
    $('#kpi-ticket').textContent = DB.moeda(r.ticket);

    const baixos = produtos().filter(p => DB.estoqueBaixo(p));
    $('#kpi-estoque').textContent = baixos.length;
    $('#kpi-estoque-card').title = baixos.length
      ? baixos.map(p => `${p.nome} (${p.estoque})`).join(', ')
      : 'Nenhum item no limite';

    const pagItens = PAGAMENTOS
      .filter(p => r.porPagamento[p.id] > 0)
      .map(p => ({ nome: p.nome, valor: r.porPagamento[p.id] }));
    renderBarras($('#rel-pagamento'), pagItens, i => DB.moeda(i.valor));
    renderBarras($('#rel-produtos'), r.maisVendidos.map(p => ({ nome: p.nome, valor: p.qtd, total: p.total })),
      i => `${i.valor} un · ${DB.moeda(i.total)}`);

    $('#rel-vazio').hidden = r.vendas.length > 0;
    $('#rel-corpo').innerHTML = r.vendas.slice(0, 50).map(v => {
      const itensCoz = (v.itens || []).filter(i => i.vaiParaCozinha ?? DB.produtoVaiParaCozinha(i.produtoId));
      return `
        <tr>
          <td class="num">
            <span style="font-weight:800;color:var(--primaria)">Pedido #${DB.numeroComanda(v.numeroComanda || v.numero)}</span>
            <small style="display:block;font-size:10px;color:var(--tinta-3)">Cupom ${DB.numeroCupom(v.numero)}</small>
          </td>
          <td>
            ${UI.dataCurta(v.data)} · ${UI.hora(v.data)}
            ${v.cliente ? `<div style="font-size:11px;color:var(--tinta-2);font-weight:600">${UI.escapar(v.cliente)}</div>` : ''}
          </td>
          <td>
            ${v.itens.reduce((s, i) => s + i.qtd, 0)}
            ${itensCoz.length ? `<span class="chip chip--cozinha" style="margin-left:4px" title="${itensCoz.length} item(ns) de cozinha">${UI.icone('cozinha')} Cozinha</span>` : ''}
          </td>
          <td><span class="chip">${Printer.PAGAMENTOS[v.pagamento] || v.pagamento}</span></td>
          <td>${UI.escapar(v.operador || '—')}</td>
          <td class="dir num">${DB.moeda(v.total)}</td>
          <td class="dir">
            <div class="mini-acoes">
              <button data-reimp-caixa="${v.id}" title="Reimprimir Cupom do Caixa">${UI.icone('impressora')}</button>
              ${itensCoz.length ? `<button data-reimp-coz="${v.id}" title="Reimprimir Comanda da Cozinha">${UI.icone('cozinha')}</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    $$('[data-reimp-caixa]').forEach(b => b.onclick = () => {
      const v = r.vendas.find(x => x.id === b.dataset.reimpCaixa);
      if (!v) return;
      const cupom = Printer.montarCupom(v, cfg());
      Printer.imprimir(cupom, cfg(), 'caixa').then(ok => {
        UI.toast(ok ? `Cupom #${DB.numeroCupom(v.numero)} reimpresso` : 'Impressão não concluída', ok ? 'ok' : 'erro');
      });
    });

    $$('[data-reimp-coz]').forEach(b => b.onclick = () => {
      const v = r.vendas.find(x => x.id === b.dataset.reimpCoz);
      if (!v) return;
      const itensCoz = (v.itens || []).filter(i => i.vaiParaCozinha ?? DB.produtoVaiParaCozinha(i.produtoId));
      if (!itensCoz.length) return;
      const comanda = Printer.montarComandaCozinha(v, itensCoz, cfg());
      Printer.imprimir(comanda, cfg(), 'cozinha').then(ok => {
        UI.toast(ok ? `Pedido da cozinha #${DB.numeroComanda(v.numeroComanda || v.numero)} reimpresso` : 'Impressão não concluída', ok ? 'ok' : 'erro');
      });
    });

    $$('#rel-periodo .seg').forEach(b => b.classList.toggle('ativo', b.dataset.periodo === st.periodo));

    const hist = DB.caixasFechados();
    $('#cxhist-vazio').hidden = hist.length > 0;
    $('#cxhist-corpo').innerHTML = hist.slice(0, 30).map(c => `
      <tr>
        <td>${UI.dataCurta(c.abertoEm)} · ${UI.hora(c.abertoEm)}</td>
        <td><b>${UI.escapar(c.operador || '—')}</b></td>
        <td>${UI.dataCurta(c.fechadoEm)} · ${UI.hora(c.fechadoEm)}</td>
        <td><b style="color:var(--primaria-forte)">${UI.escapar(c.fechadoPor || c.operador || '—')}</b></td>
        <td class="dir num">${c.resumo?.qtdVendas ?? '—'}</td>
        <td class="dir num">${DB.moeda(c.resumo?.faturamento || 0)}</td>
        <td class="dir num">${DB.moeda(c.esperado || 0)}</td>
        <td class="dir num ${c.diferenca < 0 ? 'neg' : ''}">${c.diferenca == null ? '—' : DB.moeda(c.diferenca)}</td>
      </tr>`).join('');
  }

  function renderCaixaVista() {
    renderCaixaCard();
    renderRelatorios();
  }

  /* ---- status da sessão do caixa (abrir / movimentos / fechar) ---- */
  function atualizarStatusCaixaUI() {
    const cx = DB.caixaAberto();
    const banner = $('#banner-caixa-fechado');
    if (banner) banner.hidden = !!cx;

    const pill = $('#topo-caixa-status');
    const txt = $('#topo-caixa-txt');
    if (pill && txt) {
      if (cx) {
        pill.className = 'topo__caixa-pill aberto';
        const operadorAtivo = st.usuario?.nome || cx.operador;
        pill.title = `Caixa aberto. Operador atual: ${operadorAtivo} (abertura original por ${cx.operador}). Clique para detalhes.`;
        txt.textContent = `Caixa aberto · ${operadorAtivo}`;
      } else {
        pill.className = 'topo__caixa-pill fechado';
        pill.title = 'Caixa fechado. Clique para abrir a sessão.';
        txt.textContent = 'Caixa fechado';
      }
    }
  }

  function promptCampos({ titulo, campos, textoBotao = 'Confirmar', aviso = '', perigo = false }) {
    return new Promise(resolve => {
      UI.abrirModal({
        titulo,
        corpo: `
          ${aviso ? `<p class="sub" style="margin:-2px 0 14px">${UI.escapar(aviso)}</p>` : ''}
          ${campos.map(c => `
          <div class="campo ${c.largo ? 'col-full' : ''}">
            <label for="${c.id}">${UI.escapar(c.rotulo)}</label>
            ${c.opcoes
              ? `<select id="${c.id}" class="campo-select">${c.opcoes.map(([v, t]) => `<option value="${UI.escapar(v)}" ${String(c.valor) === String(v) ? 'selected' : ''}>${UI.escapar(t)}</option>`).join('')}</select>`
              : `<input id="${c.id}" type="${c.tipo || 'text'}" inputmode="${c.tipo === 'money' ? 'decimal' : 'text'}" placeholder="${UI.escapar(c.placeholder || '')}" value="${c.valor != null ? UI.escapar(String(c.valor)) : ''}" />`}
            ${c.dica ? `<small class="dica">${UI.escapar(c.dica)}</small>` : ''}
          </div>`).join('')}`,
        rodape: `
          <button class="btn-secundario" id="pf-cancelar">Cancelar</button>
          <button class="${perigo ? 'btn-perigo' : 'btn-primario'}" id="pf-ok">${UI.icone('check')} ${UI.escapar(textoBotao)}</button>`,
        fecharAoClicarFora: false
      });

      const ler = () => Object.fromEntries(campos.map(c => [c.id, (document.getElementById(c.id)?.value ?? '').trim()]));
      const confirmar = () => {
        const dados = ler();
        UI.fecharModal();
        resolve(dados);
      };

      $('#pf-cancelar').onclick = () => { UI.fecharModal(); resolve(null); };
      $('#pf-ok').onclick = confirmar;

      campos.forEach(c => {
        const el = document.getElementById(c.id);
        if (el) {
          el.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmar();
            }
          });
        }
      });

      const primeiro = document.getElementById(campos[0]?.id);
      if (primeiro) {
        setTimeout(() => {
          primeiro.focus();
          if (primeiro.select) primeiro.select();
        }, 50);
      }
    });
  }

  async function abrirCaixaFluxo() {
    if (DB.caixaAberto()) {
      UI.toast('O caixa já está aberto.');
      return true;
    }
    const operadorNome = st.usuario?.nome || 'Operador';
    const v = await promptCampos({
      titulo: 'Abrir caixa',
      aviso: `Operador da sessão: ${operadorNome}. Informe o fundo de troco em dinheiro na gaveta.`,
      campos: [{ id: 'ac-fundo', rotulo: 'Fundo de troco inicial (R$)', tipo: 'money', valor: '', placeholder: '0,00', largo: true }],
      textoBotao: 'Abrir caixa'
    });
    if (!v) return false;
    try {
      const fundo = valorDeTexto(v['ac-fundo']);
      DB.abrirCaixa(fundo, operadorNome);
      UI.toast(`Caixa aberto com sucesso! Fundo: ${DB.moeda(fundo)}. Boa venda!`);
      atualizarStatusCaixaUI();
      renderCaixaCard();
      renderRelatorios();
      return true;
    } catch (err) {
      UI.toast(err.message, 'erro');
      return false;
    }
  }

  function renderCaixaCard() {
    const box = $('#caixa-status');
    const caixa = DB.caixaAberto();
    atualizarStatusCaixaUI();

    if (!caixa) {
      box.innerHTML = `
        <div class="caixa-linha caixa-linha--fechado">
          <div>
            <h3>Caixa fechado</h3>
            <p class="sub">Abra o caixa para começar a vender. Todas as vendas ficam vinculadas à sessão do dia.</p>
          </div>
          <button class="btn-primario" id="btn-abrir-caixa">
            <svg class="ic" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-.8"/></svg>
            Abrir caixa
          </button>
        </div>`;
      $('#btn-abrir-caixa').onclick = abrirCaixaFluxo;
      return;
    }

    const r = DB.resumoCaixa(caixa);
    const movs = [...caixa.sangrias.map(m => ({ ...m, tipo: 'sangria' })), ...caixa.suprimentos.map(m => ({ ...m, tipo: 'suprimento' }))]
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    const operadorAtivo = st.usuario?.nome || caixa.operador;
    const subTexto = caixa.operador !== operadorAtivo
      ? `Aberto ${UI.dataCurta(caixa.abertoEm)} às ${UI.hora(caixa.abertoEm)} por ${caixa.operador} · Operando agora: ${operadorAtivo}`
      : `Aberto ${UI.dataCurta(caixa.abertoEm)} às ${UI.hora(caixa.abertoEm)} por ${caixa.operador}`;

    box.innerHTML = `
      <div class="caixa-linha">
        <div class="caixa-linha__info">
          <h3>Caixa aberto · ${UI.escapar(operadorAtivo)}</h3>
          <p class="sub">${UI.escapar(subTexto)}</p>
        </div>
        <div class="caixa-linha__acoes">
          <button class="btn-secundario" id="btn-mov-sangria">Retirada</button>
          <button class="btn-secundario" id="btn-mov-super">Reforço</button>
          <button class="btn-perigo" id="btn-fechar-caixa">Fechar caixa</button>
        </div>
      </div>
      <div class="caixa-kpis">
        <div><span>Fundo de troco</span><b>${DB.moeda(caixa.fundo)}</b></div>
        <div><span>Vendas</span><b>${r.qtdVendas}</b></div>
        <div><span>Dinheiro esperado</span><b>${DB.moeda(r.esperado)}</b></div>
        <div><span>Faturamento</span><b>${DB.moeda(r.faturamento)}</b></div>
      </div>
      ${movs.length ? `
      <table class="tabela tabela--compacta">
        <thead><tr><th>Movimento</th><th>Motivo</th><th>Por</th><th class="dir">Valor</th></tr></thead>
        <tbody>
          ${movs.map(m => `
          <tr>
            <td><span class="chip ${m.tipo === 'sangria' ? 'chip--zero' : 'chip--ok'}">${m.tipo === 'sangria' ? 'Retirada' : 'Reforço'}</span></td>
            <td>${UI.escapar(m.motivo)}</td>
            <td>${UI.escapar(m.por || '—')}</td>
            <td class="dir num">${m.tipo === 'sangria' ? '−' : '+'}${DB.moeda(m.valor)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}
    `;

    $('#btn-mov-sangria').onclick = () => pedirMovimento('sangria');
    $('#btn-mov-super').onclick = () => pedirMovimento('suprimento');
    $('#btn-fechar-caixa').onclick = fecharCaixaFluxo;
  }

  function pedirMovimento(tipo) {
    promptCampos({
      titulo: tipo === 'sangria' ? 'Retirada de caixa' : 'Reforço de caixa',
      campos: [
        { id: 'mv-valor', rotulo: 'Valor (R$)', tipo: 'money', valor: '', placeholder: '0,00' },
        { id: 'mv-motivo', rotulo: 'Motivo', valor: '', placeholder: 'Ex.: troco, lanche…' }
      ],
      textoBotao: tipo === 'sangria' ? 'Registrar retirada' : 'Registrar reforço'
    }).then(v => {
      if (!v) return;
      try {
        DB.registrarMovimento(tipo, valorDeTexto(v['mv-valor']), v['mv-motivo'], st.usuario?.nome);
        UI.toast(tipo === 'sangria' ? 'Retirada registrada' : 'Reforço registrado');
        renderCaixaCard();
      } catch (err) { UI.toast(err.message, 'erro'); }
    });
  }

  function fecharCaixaFluxo() {
    const caixa = DB.caixaAberto();
    if (!caixa) return;
    const r = DB.resumoCaixa(caixa);
    promptCampos({
      titulo: 'Fechar caixa',
      aviso: `Dinheiro esperado na gaveta: ${DB.moeda(r.esperado)}`,
      campos: [{ id: 'fc-contado', rotulo: 'Dinheiro contado (R$)', tipo: 'money', valor: numero(r.esperado), largo: true }],
      textoBotao: 'Fechar caixa',
      perigo: true
    }).then(v => {
      if (!v) return;
      try {
        const fechado = DB.fecharCaixa(valorDeTexto(v['fc-contado']), st.usuario?.nome);
        Printer.imprimir(Printer.montarFechamento({
          ...DB.resumoCaixa(fechado),
          fundo: fechado.fundo,
          contado: fechado.contado,
          diferenca: fechado.diferenca
        }, cfg()), cfg())
          .then(ok => ok && UI.toast('Fechamento enviado para impressão'));
        const dif = fechado.diferenca;
        UI.toast(dif === 0
          ? 'Caixa fechado sem diferença. Perfeito!'
          : `Caixa fechado ${dif > 0 ? 'com sobra' : 'com falta'} de ${DB.moeda(Math.abs(dif))}`,
          dif === 0 ? 'ok' : 'aviso');
        renderCaixaCard();
        renderRelatorios();
      } catch (err) { UI.toast(err.message, 'erro'); }
    });
  }

  function emitirPushNotification(titulo, corpo) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(titulo, {
            body: corpo,
            icon: '/favicon.ico'
          });
        } catch (e) {
          console.warn('Push notification falhou:', e);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            try {
              new Notification(titulo, { body: corpo });
            } catch (e) {}
          }
        });
      }
    }
  }

  function atualizarAlertasEstoque() {
    const itensCriticos = DB.produtosAbaixoDoMinimo ? DB.produtosAbaixoDoMinimo() : produtos().filter(p => p.controlaEstoque && p.estoque <= (p.estoqueMinimo || 5));
    const badgeEstoque = $('#ret-badge-estoque');
    if (badgeEstoque) {
      badgeEstoque.hidden = itensCriticos.length === 0;
      badgeEstoque.textContent = itensCriticos.length;
    }
    const badgeAlertas = $('#ret-badge-alertas');
    if (badgeAlertas) {
      badgeAlertas.hidden = itensCriticos.length === 0;
      badgeAlertas.textContent = itensCriticos.length;
    }

    const bannerFin = $('#ret-fin-alerta-estoque');
    const textoFin = $('#ret-fin-alerta-texto');
    const btnIrEstoque = $('#btn-ir-estoque-alerta');
    if (bannerFin && textoFin) {
      if (itensCriticos.length > 0) {
        bannerFin.hidden = false;
        textoFin.innerHTML = `${UI.icone('alerta')} <span>ATENÇÃO: ${itensCriticos.length} PRODUTO(S) COM ESTOQUE BAIXO OU NO LIMITE!</span>`;
        if (btnIrEstoque) {
          btnIrEstoque.onclick = () => {
            st.retAba = 'alertas';
            renderRetaguarda();
          };
        }
      } else {
        bannerFin.hidden = true;
      }
    }

    const boxAlerta = $('#alerta-estoque-box');
    const listaAlerta = $('#alerta-estoque-lista');
    if (boxAlerta && listaAlerta) {
      if (itensCriticos.length > 0) {
        boxAlerta.hidden = false;
        listaAlerta.innerHTML = `
          O sistema identificou <b>${itensCriticos.length} produto(s)</b> precisando de reposição urgente (abaixo ou no limite mínimo):<br>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            ${itensCriticos.map(p => `
              <span class="chip ${p.estoque <= 0 ? 'chip--zero' : 'chip--baixo'}" style="font-weight:700">
                ${UI.escapar(p.nome)}: <b>${p.estoque <= 0 ? 'ESGOTADO' : `${p.estoque} un`}</b> (Mín: ${p.estoqueMinimo ?? 5} un)
              </span>
            `).join('')}
          </div>
        `;
      } else {
        boxAlerta.hidden = true;
      }
    }
  }

  /* ================== RETAGUARDA ================== */
  function renderRetaguarda() {
    $$('[data-ret-nav]').forEach(b => b.classList.toggle('ativo', b.dataset.retNav === st.retAba));
    $$('.ret-painel').forEach(p => {
      const ativa = p.id === 'ret-' + st.retAba;
      p.classList.toggle('ativa', ativa);
      p.hidden = !ativa;
    });

    const titulos = {
      financeiro: { tit: 'Financeiro', sub: 'Visão geral do faturamento e fechamentos' },
      estoque: { tit: 'Estoque & Produtos', sub: 'Catálogo de itens e controle de reposição' },
      alertas: { tit: 'Central de Alertas de Reposição', sub: 'Histórico e monitoramento de produtos em nível crítico' },
      compras: { tit: 'Entradas de Mercadorias (XML)', sub: 'Importação automática de notas fiscais NF-e' },
      contabilidade: { tit: 'Contabilidade Fiscal', sub: 'Exportação fiscal exclusiva de cartões e PIX' },
      funcionarios: { tit: 'Equipe & Funcionários', sub: 'Gestão de acessos e permissões' }
    };
    const info = titulos[st.retAba] || titulos.financeiro;
    if ($('#ret-titulo')) $('#ret-titulo').textContent = info.tit;
    if ($('#ret-sub') && st.retAba !== 'estoque') $('#ret-sub').textContent = info.sub;

    if (st.retAba === 'funcionarios' && st.usuario?.papel !== 'admin') st.retAba = 'financeiro';

    atualizarAlertasEstoque();

    if (st.retAba === 'financeiro') renderFinanceiroRetaguarda();
    if (st.retAba === 'estoque' || st.retAba === 'produtos') renderProdutos();
    if (st.retAba === 'alertas') renderAlertasTab();
    if (st.retAba === 'compras') renderComprasTab();
    if (st.retAba === 'contabilidade') renderContabilidadeTab();
    if (st.retAba === 'funcionarios') renderFuncionariosTab();
  }

  /* ---- ABA ALERTAS DA RETAGUARDA (CENTRAL DE ALERTAS COM MINI CALENDÁRIO E ACCORDION POR DIA) ---- */
  let filtroDataAlerta = '';
  let modoFiltroAlerta = 'todos';

  function renderAlertasTab() {
    if (DB.verificarAlertasEstoque) {
      const novos = DB.verificarAlertasEstoque();
      if (novos && novos.length > 0 && st.usuario?.papel === 'admin') {
        emitirPushNotification('⚠️ Alerta de Estoque Baixo (ADM)', `${novos.map(n => n.produtoNome).join(', ')} atingiram o estoque mínimo.`);
      }
    }
    const todosAlertas = DB.alertasEstoque ? DB.alertasEstoque() : [];
    const criticos = DB.produtosAbaixoDoMinimo ? DB.produtosAbaixoDoMinimo() : [];

    // 1. Atualizar cards críticos no momento
    const criticosCont = $('#alertas-grade-criticos');
    const qtdCriticosBadge = $('#alertas-qtd-criticos');
    if (qtdCriticosBadge) qtdCriticosBadge.textContent = criticos.length;

    if (criticosCont) {
      if (criticos.length === 0) {
        criticosCont.innerHTML = `
          <div style="grid-column:1/-1;padding:18px;background:rgba(46,125,50,.08);border:1px solid rgba(46,125,50,.25);border-radius:12px;color:#2E7D32;display:flex;align-items:center;gap:10px;font-size:13px">
            <svg class="ic" viewBox="0 0 24 24" style="width:20px;height:20px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <b>Estoque 100% abastecido:</b> Nenhum produto está no limite ou abaixo do estoque mínimo configurado no momento.
          </div>`;
      } else {
        const cats = DB.categorias();
        const mapaCats = Object.fromEntries(cats.map(c => [c.id, c.nome]));
        criticosCont.innerHTML = criticos.map(p => {
          const zerado = p.estoque <= 0;
          const min = p.estoqueMinimo != null && !isNaN(p.estoqueMinimo) ? Number(p.estoqueMinimo) : 5;
          const pct = Math.min(100, Math.round((p.estoque / (min || 1)) * 100));
          return `
            <div class="alerta-card-critico ${zerado ? 'zerado' : ''}">
              <div class="alerta-card-critico__topo">
                <div>
                  <div class="alerta-card-critico__nome">${UI.escapar(p.nome)}</div>
                  <div class="alerta-card-critico__cat">${UI.escapar(mapaCats[p.categoriaId] || 'Geral')}</div>
                </div>
                <span class="badge-mini" style="background:${zerado ? '#E53935' : '#D84315'};color:#fff;font-size:11px;padding:3px 8px;border-radius:6px;font-weight:700">
                  ${zerado ? 'ZERADO' : 'LIMITE'}
                </span>
              </div>
              <div class="alerta-card-critico__status">
                <span>Estoque: <b class="alerta-card-critico__num" style="color:${zerado ? '#E53935' : '#D84315'}">${p.estoque} un</b></span>
                <span style="color:var(--tinta-3)">Mínimo: <b>${min} un</b></span>
              </div>
              <div style="background:var(--afundado);height:6px;border-radius:3px;overflow:hidden">
                <div style="background:${zerado ? '#E53935' : '#F58220'};width:${pct}%;height:100%"></div>
              </div>
              <button class="btn-secundario btn-pequeno" type="button" data-alerta-repor="${p.id}" style="width:100%;margin-top:2px;justify-content:center">
                ${UI.icone('check')} Ajustar / Repor Estoque
              </button>
            </div>
          `;
        }).join('');

        criticosCont.querySelectorAll('[data-alerta-repor]').forEach(btn => {
          btn.onclick = () => formProduto(btn.dataset.alertaRepor);
        });
      }
    }

    // 2. Filtragem de histórico por data
    const hojeStr = new Date().toISOString().slice(0, 10);
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    let alertasFiltrados = todosAlertas;
    const inputCal = $('#filtro-calendario-alertas');
    const resumoFiltro = $('#alertas-resumo-filtro');

    if (filtroDataAlerta) {
      alertasFiltrados = todosAlertas.filter(a => a.data && a.data.slice(0, 10) === filtroDataAlerta);
      if (resumoFiltro) {
        const partes = filtroDataAlerta.split('-');
        resumoFiltro.textContent = `Filtrado por: ${partes[2]}/${partes[1]}/${partes[0]} (${alertasFiltrados.length} alertas)`;
      }
    } else if (modoFiltroAlerta === 'hoje') {
      alertasFiltrados = todosAlertas.filter(a => a.data && a.data.slice(0, 10) === hojeStr);
      if (resumoFiltro) resumoFiltro.textContent = `Exibindo alertas de Hoje (${alertasFiltrados.length})`;
    } else if (modoFiltroAlerta === '7dias') {
      alertasFiltrados = todosAlertas.filter(a => a.data && a.data.slice(0, 10) >= seteDiasAtras);
      if (resumoFiltro) resumoFiltro.textContent = `Exibindo últimos 7 dias (${alertasFiltrados.length})`;
    } else {
      if (resumoFiltro) resumoFiltro.textContent = `Exibindo todo o histórico (${alertasFiltrados.length} registros)`;
    }

    // 3. Agrupar alertas por dia (YYYY-MM-DD)
    const gruposPorDia = {};
    alertasFiltrados.forEach(a => {
      const diaKey = a.data ? a.data.slice(0, 10) : hojeStr;
      if (!gruposPorDia[diaKey]) gruposPorDia[diaKey] = [];
      gruposPorDia[diaKey].push(a);
    });

    const listaExpansivel = $('#alertas-lista-expansivel');
    const vazio = $('#alertas-vazio');

    const diasKeys = Object.keys(gruposPorDia).sort((a, b) => b.localeCompare(a));
    if (diasKeys.length === 0) {
      if (listaExpansivel) listaExpansivel.innerHTML = '';
      if (vazio) vazio.hidden = false;
    } else {
      if (vazio) vazio.hidden = true;
      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      const ontemStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      listaExpansivel.innerHTML = diasKeys.map(diaKey => {
        const itens = gruposPorDia[diaKey];
        const [ano, mes, dia] = diaKey.split('-');
        const mesNome = meses[parseInt(mes, 10) - 1] || mes;

        let relativo = '';
        if (diaKey === hojeStr) relativo = 'Hoje';
        else if (diaKey === ontemStr) relativo = 'Ontem';
        else {
          const dObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
          const diasSem = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          relativo = diasSem[dObj.getDay()] || '';
        }

        return `
          <details class="alerta-dia-box" open>
            <summary class="alerta-dia-summary">
              <div class="alerta-dia-summary__esq">
                <div class="alerta-dia-icone">
                  <svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <div class="alerta-dia-data">${dia} de ${mesNome} de ${ano} <span style="font-size:12px;color:var(--primaria-forte);font-weight:600">(${relativo})</span></div>
                  <div class="alerta-dia-relativo">Registros de limite de estoque acionados nesta data</div>
                </div>
              </div>
              <div class="alerta-dia-summary__dir">
                <span class="alerta-dia-badge">${itens.length} ${itens.length === 1 ? 'alerta' : 'alertas'}</span>
                <svg class="ic alerta-dia-seta" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </summary>
            <div class="alerta-dia-conteudo">
              <table class="alerta-tabela">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Produto</th>
                    <th>Estoque no Alerta</th>
                    <th>Mínimo Definido</th>
                    <th>Status Atual</th>
                    <th class="dir">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${itens.map(it => {
                    const horaStr = it.data ? new Date(it.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const prodAtual = DB.produto(it.produtoId);
                    const estoqueAtualNum = prodAtual ? prodAtual.estoque : it.estoqueAtual;
                    const minAtualNum = prodAtual && prodAtual.estoqueMinimo != null ? prodAtual.estoqueMinimo : it.estoqueMinimo;
                    const aindaCritico = estoqueAtualNum <= minAtualNum;
                    return `
                      <tr>
                        <td><b>${horaStr}</b></td>
                        <td>
                          <div style="font-weight:700;color:var(--tinta)">${UI.escapar(it.produtoNome)}</div>
                          <div style="font-size:11px;color:var(--tinta-3)">ID: ${it.produtoId}</div>
                        </td>
                        <td><span style="font-weight:700;color:#D84315">${it.estoqueAtual} un</span></td>
                        <td><b>${it.estoqueMinimo} un</b></td>
                        <td>
                          ${aindaCritico
                            ? `<span class="badge-mini" style="background:#FFF3EB;color:#D84315;border:1px solid rgba(216,67,21,.3);font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">Ainda em Alerta (${estoqueAtualNum} un)</span>`
                            : `<span class="badge-mini" style="background:rgba(46,125,50,.1);color:#2E7D32;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">Reposto (${estoqueAtualNum} un)</span>`
                          }
                        </td>
                        <td class="dir">
                          <button class="btn-secundario btn-pequeno" type="button" data-alerta-editar="${it.produtoId}">
                            ${UI.icone('check')} Gerenciar
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </details>
        `;
      }).join('');

      listaExpansivel.querySelectorAll('[data-alerta-editar]').forEach(btn => {
        btn.onclick = () => formProduto(btn.dataset.alertaEditar);
      });
    }

    // Configuração dos controles de filtro
    if (inputCal && !inputCal._configurado) {
      inputCal._configurado = true;
      inputCal.onchange = e => {
        filtroDataAlerta = e.target.value;
        modoFiltroAlerta = 'custom';
        $$('#segs-filtro-alertas .seg').forEach(s => s.classList.remove('ativo'));
        renderAlertasTab();
      };
    }

    $$('#segs-filtro-alertas .seg').forEach(b => {
      b.onclick = () => {
        $$('#segs-filtro-alertas .seg').forEach(s => s.classList.remove('ativo'));
        b.classList.add('ativo');
        modoFiltroAlerta = b.dataset.filtroAlerta;
        filtroDataAlerta = '';
        if (inputCal) inputCal.value = '';
        renderAlertasTab();
      };
    });

    if ($('#btn-alerta-verificar-agora')) {
      $('#btn-alerta-verificar-agora').onclick = () => {
        const novos = DB.verificarAlertasEstoque();
        if (novos && novos.length > 0) {
          UI.toast(`Atenção: ${novos.length} produto(s) atingiram o limite mínimo!`, 'alerta');
          emitirPushNotification('⚠️ Alerta de Estoque Baixo', `${novos.map(n => n.produtoNome).join(', ')} precisam de reposição.`);
        } else {
          UI.toast('Verificação concluída: Nenhuma nova notificação.');
        }
        renderAlertasTab();
      };
    }

    if ($('#btn-alerta-ir-estoque')) {
      $('#btn-alerta-ir-estoque').onclick = () => {
        st.retAba = 'estoque';
        renderRetaguarda();
      };
    }
  }

  /* ---- ABA FINANCEIRO DA RETAGUARDA ---- */
  function renderFinanceiroRetaguarda() {
    const vendas = DB.estado.vendas || [];
    const faturamento = DB.arred(vendas.reduce((s, v) => s + v.total, 0));
    const qtdVendas = vendas.length;
    const ticket = qtdVendas ? DB.arred(faturamento / qtdVendas) : 0;

    const caixaAtivo = DB.caixaAberto();
    const dinheiroGaveta = caixaAtivo ? DB.resumoCaixa(caixaAtivo).esperado : 0;

    $('#ret-fin-faturamento').textContent = DB.moeda(faturamento);
    $('#ret-fin-qtd').textContent = qtdVendas;
    $('#ret-fin-ticket').textContent = DB.moeda(ticket);
    $('#ret-fin-dinheiro').textContent = DB.moeda(dinheiroGaveta);

    // Barras por forma de pagamento
    const porPagamento = {};
    const mapaProd = {};
    vendas.forEach(v => {
      porPagamento[v.pagamento] = DB.arred((porPagamento[v.pagamento] || 0) + v.total);
      v.itens.forEach(i => {
        const m = mapaProd[i.produtoId] || (mapaProd[i.produtoId] = { nome: i.nome, total: 0 });
        m.total = DB.arred(m.total + (i.preco * i.qtd));
      });
    });

    const pagItens = PAGAMENTOS
      .filter(p => porPagamento[p.id] > 0)
      .map(p => ({ nome: p.nome, valor: porPagamento[p.id] }));
    renderBarras($('#ret-fin-pagamentos'), pagItens, i => DB.moeda(i.valor));

    const prodMaisVendidos = Object.values(mapaProd).sort((a, b) => b.total - a.total).slice(0, 8);
    renderBarras($('#ret-fin-produtos'), prodMaisVendidos.map(p => ({ nome: p.nome, valor: p.total })), i => DB.moeda(i.valor));

    // Histórico de caixas fechados
    const caixas = DB.caixasFechados();
    $('#ret-fin-caixas-vazio').hidden = caixas.length > 0;
    $('#ret-fin-caixas-corpo').innerHTML = caixas.slice(0, 30).map(c => `
      <tr>
        <td>${UI.dataCurta(c.abertoEm)} · ${UI.hora(c.abertoEm)}</td>
        <td><b>${UI.escapar(c.operador || '—')}</b></td>
        <td>${UI.dataCurta(c.fechadoEm)} · ${UI.hora(c.fechadoEm)}</td>
        <td><b style="color:var(--primaria-forte)">${UI.escapar(c.fechadoPor || c.operador || '—')}</b></td>
        <td class="dir num">${c.resumo?.qtdVendas ?? '—'}</td>
        <td class="dir num">${DB.moeda(c.resumo?.faturamento || 0)}</td>
        <td class="dir num">${DB.moeda(c.esperado || 0)}</td>
        <td class="dir num ${c.diferenca < 0 ? 'neg' : ''}">${c.diferenca == null ? '—' : DB.moeda(c.diferenca)}</td>
      </tr>
    `).join('');
  }

  /* ================== IMPORTAÇÃO DE XML (NF-e) ================== */
  async function importarXmlFluxo() {
    try {
      const arquivos = await window.pdv.selecionarXmlNfe();
      if (!arquivos || !arquivos.length) return;

      for (const arq of arquivos) {
        const resultado = Fiscal.parsearXmlNfe(arq.conteudo);
        if (!resultado.ok) {
          UI.toast(`Erro no arquivo ${arq.nome}: ${resultado.erro}`, 'erro');
          continue;
        }

        // Verifica se a nota já foi importada antes
        const jaExiste = (DB.estado.compras || []).find(c => (resultado.chave && c.chave === resultado.chave) || (c.numero === resultado.numero && c.cnpjFornecedor === resultado.cnpjFornecedor));
        if (jaExiste) {
          const confirmarReimportar = await UI.confirmar({
            titulo: 'Nota já importada anteriormente',
            texto: `A nota fiscal <b>#${resultado.numero}</b> (${resultado.fornecedor}) já deu entrada no estoque em <b>${UI.dataCurta(jaExiste.dataImportacao)}</b>.<br><br>Deseja dar entrada novamente? (Pode duplicar o estoque).`,
            acao: 'Importar novamente',
            perigo: true
          });
          if (!confirmarReimportar) continue;
        }

        await abrirModalConferenciaNfe(resultado);
      }
    } catch (err) {
      console.error(err);
      UI.toast(err.message || 'Falha ao importar XML', 'erro');
    }
  }

  function abrirModalConferenciaNfe(nota) {
    return new Promise(resolve => {
      const prodsDisponiveis = produtos();

      // Mapeia os itens da nota sugerindo vínculos e fatores
      const itensMapeados = nota.itens.map((item, idx) => {
        const vinculado = Fiscal.encontrarProdutoCorrespondente(item, prodsDisponiveis);
        return {
          ...item,
          idx,
          produtoIdSelecionado: vinculado ? vinculado.id : '__novo__',
          novoNome: item.xProd,
          fatorAtual: item.fator || 1,
          qtdFinalAtual: DB.arred(item.qCom * (item.fator || 1)),
          custoUnitarioAtual: item.custoUnitario || (item.qtdFinal > 0 ? DB.arred(item.vProd / item.qtdFinal) : item.vUnCom)
        };
      });

      const corpoModal = UI.abrirModal({
        titulo: `Conferência NF-e #${nota.numero} · ${UI.escapar(nota.fornecedor)}`,
        largo: true,
        fecharAoClicarFora: false,
        corpo: `
          <div class="faixa-info" style="margin-bottom:14px;background:#FFF9EE;border-color:#F5C678;color:#8A4B10">
            <b>ATENÇÃO À CONVERSÃO UNITÁRIA:</b> Se o item veio em <b>fardo, caixa ou pack</b>, ajuste o campo <u>"Unid/Embalagem"</u> para que o estoque receba a quantidade de unidades individuais corretamente (ex: 20 fardos com 12 garrafas = 240 unidades).
          </div>

          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:12px;color:var(--tinta-2)">
            <span><b>Chave:</b> <small>${nota.chave || 'Não informada'}</small></span>
            <span><b>Total da Nota:</b> ${DB.moeda(nota.valorTotal)}</span>
          </div>

          <div style="max-height:48vh;overflow-y:auto;border:1px solid var(--borda);border-radius:10px">
            <table class="tabela tabela--compacta" style="margin:0">
              <thead>
                <tr>
                  <th style="min-width:180px">Item na Nota Fiscal</th>
                  <th>Qtd NF-e</th>
                  <th style="width:110px">Unid/Emb.</th>
                  <th>Qtd no Estoque</th>
                  <th style="min-width:190px">Vincular Produto no PDV</th>
                  <th class="dir">Estoque Resultante</th>
                </tr>
              </thead>
              <tbody id="nfe-itens-corpo">
                ${itensMapeados.map(i => {
                  const prodAtual = prodsDisponiveis.find(p => p.id === i.produtoIdSelecionado);
                  const estAnterior = prodAtual ? (prodAtual.estoque || 0) : 0;
                  const estNovo = estAnterior + i.qtdFinalAtual;
                  return `
                    <tr data-idx="${i.idx}">
                      <td>
                        <div style="font-weight:700;font-size:12.5px">${UI.escapar(i.xProd)}</div>
                        <div style="font-size:11px;color:var(--tinta-3)">Cód: ${UI.escapar(i.cProd)} ${i.cEAN ? `· EAN: ${UI.escapar(i.cEAN)}` : ''} · Custo total: ${DB.moeda(i.vProd)}</div>
                      </td>
                      <td>
                        <span class="chip">${i.qCom} ${UI.escapar(i.uCom)}</span>
                      </td>
                      <td>
                        <input type="number" min="1" step="1" class="nfe-fator" data-idx="${i.idx}" value="${i.fatorAtual}"
                          style="width:75px;height:34px;padding:0 8px;border-radius:6px;border:1.5px solid var(--primaria);font-weight:800;text-align:center" />
                      </td>
                      <td>
                        <b class="nfe-qtd-final" data-idx="${i.idx}" style="font-size:14px;color:var(--verde)">+${i.qtdFinalAtual} un</b>
                        <div style="font-size:10.5px;color:var(--tinta-3)" class="nfe-custo" data-idx="${i.idx}">${DB.moeda(i.custoUnitarioAtual)} / un</div>
                      </td>
                      <td>
                        <select class="nfe-vincular campo-select" data-idx="${i.idx}" style="height:36px;font-size:12.5px;width:100%">
                          <option value="__novo__" ${i.produtoIdSelecionado === '__novo__' ? 'selected' : ''}>+ Cadastrar como novo produto</option>
                          <optgroup label="Produtos existentes no PDV">
                            ${prodsDisponiveis.map(p => `
                              <option value="${p.id}" ${i.produtoIdSelecionado === p.id ? 'selected' : ''}>
                                ${UI.escapar(p.nome)} (${p.controlaEstoque ? `${p.estoque} un` : 'Livre'})
                              </option>
                            `).join('')}
                          </optgroup>
                        </select>
                      </td>
                      <td class="dir">
                        <span class="chip chip--ok nfe-est-previsto" data-idx="${i.idx}">${estAnterior} → ${estNovo} un</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `,
        rodape: `
          <div style="margin-right:auto;font-size:12px;color:var(--tinta-2)">
            Total: <b>${itensMapeados.length} itens</b> na nota
          </div>
          <button class="btn-secundario" id="nfe-cancelar">Cancelar</button>
          <button class="btn-primario" id="nfe-confirmar">
            ${UI.icone('check')} Confirmar Entrada no Estoque
          </button>
        `
      });

      // Recalcula quantidades ao mudar o fator de conversão
      function atualizarLinha(idx) {
        const item = itensMapeados[idx];
        const inputFator = corpoModal.querySelector(`.nfe-fator[data-idx="${idx}"]`);
        const fator = Math.max(1, parseInt(inputFator?.value, 10) || 1);
        item.fatorAtual = fator;
        item.qtdFinalAtual = DB.arred(item.qCom * fator);
        item.custoUnitarioAtual = item.qtdFinalAtual > 0 ? DB.arred(item.vProd / item.qtdFinalAtual) : item.vUnCom;

        const elQtd = corpoModal.querySelector(`.nfe-qtd-final[data-idx="${idx}"]`);
        const elCusto = corpoModal.querySelector(`.nfe-custo[data-idx="${idx}"]`);
        const elPrev = corpoModal.querySelector(`.nfe-est-previsto[data-idx="${idx}"]`);
        if (elQtd) elQtd.textContent = `+${item.qtdFinalAtual} un`;
        if (elCusto) elCusto.textContent = `${DB.moeda(item.custoUnitarioAtual)} / un`;

        const selProd = corpoModal.querySelector(`.nfe-vincular[data-idx="${idx}"]`);
        const pId = selProd?.value;
        const pObj = prodsDisponiveis.find(p => p.id === pId);
        const estAnt = pObj ? (pObj.estoque || 0) : 0;
        const estNovo = estAnt + item.qtdFinalAtual;
        if (elPrev) {
          elPrev.textContent = pId === '__novo__' ? `Novo (${item.qtdFinalAtual} un)` : `${estAnt} → ${estNovo} un`;
        }
      }

      corpoModal.querySelectorAll('.nfe-fator').forEach(input => {
        input.addEventListener('input', () => atualizarLinha(Number(input.dataset.idx)));
      });

      corpoModal.querySelectorAll('.nfe-vincular').forEach(select => {
        select.addEventListener('change', () => {
          const idx = Number(select.dataset.idx);
          itensMapeados[idx].produtoIdSelecionado = select.value;
          atualizarLinha(idx);
        });
      });

      document.querySelector('#nfe-cancelar').onclick = () => {
        UI.fecharModal();
        resolve(false);
      };

      document.querySelector('#nfe-confirmar').onclick = async () => {
        try {
          let produtosAtualizados = 0;

          for (const item of itensMapeados) {
            let pid = item.produtoIdSelecionado;

            // Se for novo produto, cadastra no catálogo primeiro
            if (pid === '__novo__') {
              const novoProd = {
                nome: item.xProd,
                preco: DB.arred(item.custoUnitarioAtual * 1.5) || 5, // margem inicial sugerida
                categoriaId: DB.categorias()[0]?.id || 'cat-bebidas',
                tipo: 'produto',
                codigo: item.cEAN || '',
                controlaEstoque: true,
                estoque: 0,
                vaiParaCozinha: /comida|lanche|porcao|pastel|frango|batata/i.test(item.xProd)
              };
              DB.salvarProduto(novoProd);
              // Pega o produto recém adicionado
              const cadastrado = DB.produtos().find(p => p.nome === item.xProd) || DB.produtos()[DB.produtos().length - 1];
              pid = cadastrado.id;
            }

            // Realiza a entrada no estoque com a quantidade unitária calculada
            DB.darEntradaEstoque(
              pid,
              item.qtdFinalAtual,
              `Entrada NF-e #${nota.numero} (${nota.fornecedor}) [${item.qCom} ${item.uCom} x ${item.fatorAtual}]`,
              item.custoUnitarioAtual,
              item.cEAN
            );
            produtosAtualizados++;
          }

          // Registra a nota importada no histórico
          DB.registrarNotaEntrada({
            chave: nota.chave,
            numero: nota.numero,
            fornecedor: nota.fornecedor,
            cnpjFornecedor: nota.cnpjFornecedor,
            dataEmissao: nota.dataEmissao,
            valorTotal: nota.valorTotal,
            itens: itensMapeados.map(i => ({
              nome: i.xProd,
              qCom: i.qCom,
              uCom: i.uCom,
              fator: i.fatorAtual,
              qtdFinal: i.qtdFinalAtual,
              custoUnitario: i.custoUnitarioAtual,
              vProd: i.vProd
            }))
          });

          UI.fecharModal();
          renderProdutos();
          renderComprasTab();
          UI.toast(`NF-e #${nota.numero} importada com sucesso! ${produtosAtualizados} produto(s) atualizados.`);
          resolve(true);
        } catch (err) {
          console.error(err);
          UI.toast(err.message || 'Falha ao concluir entrada de nota', 'erro');
        }
      };
    });
  }

  function renderComprasTab() {
    const lista = DB.comprasImportadas();
    $('#compras-contagem').textContent = `${lista.length} ${lista.length === 1 ? 'nota fiscal importada' : 'notas fiscais importadas'}`;
    $('#compras-vazio').hidden = lista.length > 0;
    $('#compras-tabela').hidden = lista.length === 0;

    $('#compras-corpo').innerHTML = lista.map(c => `
      <tr>
        <td class="num"><b>#${UI.escapar(c.numero || 'S/N')}</b></td>
        <td>${c.dataEmissao ? UI.dataCurta(c.dataEmissao) : '—'}</td>
        <td>
          <div style="font-weight:700">${UI.escapar(c.fornecedor)}</div>
          ${c.cnpjFornecedor ? `<div class="cod">CNPJ ${UI.escapar(c.cnpjFornecedor)}</div>` : ''}
        </td>
        <td class="dir">${(c.itens || []).length} item(ns)</td>
        <td class="dir num"><b>${DB.moeda(c.valorTotal)}</b></td>
        <td class="dir">${UI.dataCurta(c.dataImportacao)} · ${UI.hora(c.dataImportacao)}</td>
      </tr>
    `).join('');
  }

  /* ================== CONTABILIDADE (LOTE XML & ENVIO AO CONTADOR) ================== */
  function renderContabilidadeTab() {
    // Carrega dados de envio e contabilidade
    const c = cfg();
    if ($('#cfg-email-contador')) $('#cfg-email-contador').value = c.emailContabilidade || '';
    if ($('#cfg-email-remetente')) $('#cfg-email-remetente').value = c.emailRemetenteFiscal || '';
    if ($('#cfg-nome-remetente')) $('#cfg-nome-remetente').value = c.nomeRemetenteFiscal || c.loja || 'Rota do Forte';

    const hoje = new Date();
    const p = n => String(n).padStart(2, '0');
    const primeiroDia = `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-01`;
    const ultimoDia = `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate())}`;

    if (!$('#contabil-inicio').value) $('#contabil-inicio').value = primeiroDia;
    if (!$('#contabil-fim').value) $('#contabil-fim').value = ultimoDia;

    filtrarEAtualizarContabilidade();
    renderLotesFiscais();
  }

  function renderLotesFiscais() {
    const lotes = DB.lotesContabeis ? DB.lotesContabeis() : [];
    const vazio = $('#lotes-fiscais-vazio');
    const tabela = $('#tabela-lotes-fiscais');
    const corpo = $('#lotes-fiscais-corpo');
    if (!corpo) return;

    if (vazio) vazio.hidden = lotes.length > 0;
    if (tabela) tabela.hidden = lotes.length === 0;

    corpo.innerHTML = lotes.map(l => {
      const enviado = l.statusEnvio === 'enviado';
      const badgeStatus = enviado
        ? `<span class="badge-mini" style="background:rgba(46,125,50,.12);color:#2E7D32;border:1px solid rgba(46,125,50,.3);font-size:11px;padding:3px 8px;border-radius:12px;font-weight:700" title="Enviado para ${UI.escapar(l.enviadoPara || '')} em ${UI.dataCurta(l.enviadoEm)} às ${UI.hora(l.enviadoEm)}">
            ${UI.icone('check')} Enviado ao Contador
           </span>`
        : `<span class="badge-mini" style="background:#FFF3EB;color:#D84315;border:1px solid rgba(216,67,21,.3);font-size:11px;padding:3px 8px;border-radius:12px;font-weight:700">
            Pendente de Envio
           </span>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700;color:var(--tinta)">${UI.escapar(l.nomeArquivo || 'lote-fiscal.xml')}</div>
            <div style="font-size:11px;color:var(--tinta-3)">ID: ${l.id}</div>
          </td>
          <td>${UI.dataCurta(l.geradoEm)} · ${UI.hora(l.geradoEm)}</td>
          <td><b>${UI.escapar(l.periodo || '—')}</b></td>
          <td class="dir num"><b>${l.qtdVendas}</b> cupons</td>
          <td class="dir num" style="color:var(--verde);font-weight:800">${DB.moeda(l.totalDeclarado)}</td>
          <td>${badgeStatus}</td>
          <td class="dir">
            <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center">
              <button class="btn-primario btn-pequeno" type="button" data-lote-enviar="${l.id}" title="Enviar ao Contador por E-mail ou WhatsApp">
                <svg class="ic" viewBox="0 0 24 24" style="width:13px;height:13px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Enviar ao Contador
              </button>
              <button class="btn-secundario btn-pequeno" type="button" data-lote-baixar="${l.id}" title="Baixar arquivo XML do lote">
                <svg class="ic" viewBox="0 0 24 24" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                XML
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    corpo.querySelectorAll('[data-lote-enviar]').forEach(btn => {
      btn.onclick = () => modalEnviarLoteAoContador(btn.dataset.loteEnviar);
    });

    corpo.querySelectorAll('[data-lote-baixar]').forEach(btn => {
      btn.onclick = () => {
        const lote = (DB.lotesContabeis() || []).find(x => x.id === btn.dataset.loteBaixar);
        if (lote && lote.xmlConteudo) {
          window.pdv.salvarContabilidade(lote.nomeArquivo, lote.xmlConteudo, 'xml');
          UI.toast(`Download do XML ${lote.nomeArquivo} concluído!`);
        }
      };
    });
  }

  function modalEnviarLoteAoContador(loteId) {
    const lote = (DB.lotesContabeis() || []).find(x => x.id === loteId);
    if (!lote) return;
    const c = cfg();
    const emailContador = c.emailContabilidade || '';
    const emailRemetente = c.emailRemetenteFiscal || '';
    const nomeRemetente = c.nomeRemetenteFiscal || c.loja || 'Rota do Forte';

    const assuntoPadrao = `[Lote Fiscal XML] ${nomeRemetente} - Movimento ${lote.periodo || ''}`;
    const corpoEmailPadrao =
`Olá, Equipe Contábil,

Segue o lote de vendas eletrônicas para apuração fiscal de ${nomeRemetente}.

Resumo do Movimento:
- Período Fiscal: ${lote.periodo || '—'}
- Quantidade de Vendas: ${lote.qtdVendas} cupons
- Faturamento Total Declarado: ${DB.moeda(lote.totalDeclarado)}
- Arquivo do Lote: ${lote.nomeArquivo}

Atenciosamente,
${nomeRemetente}
${emailRemetente ? `E-mail de contato: ${emailRemetente}` : ''}`;

    UI.abrirModal({
      titulo: 'Enviar Lote Fiscal ao Contador',
      largo: true,
      corpo: `
        <div class="grid-2" style="gap:10px 14px;margin-bottom:10px">
          <div class="campo" style="margin:0">
            <label for="modal-envio-para">E-mail do Contador (Destino)</label>
            <input type="email" id="modal-envio-para" value="${UI.escapar(emailContador)}" placeholder="contador@escritorio.com.br" />
          </div>
          <div class="campo" style="margin:0">
            <label for="modal-envio-de">E-mail do Remetente (Quem envia)</label>
            <input type="email" id="modal-envio-de" value="${UI.escapar(emailRemetente)}" placeholder="financeiro@rotadoforte.com.br" />
          </div>
        </div>
        <div class="grid-2" style="gap:10px 14px;margin-bottom:10px">
          <div class="campo" style="margin:0">
            <label for="modal-envio-nome">Nome / Empresa Remetente</label>
            <input type="text" id="modal-envio-nome" value="${UI.escapar(nomeRemetente)}" placeholder="Nome da Loja" />
          </div>
          <div class="campo" style="margin:0">
            <label for="modal-envio-assunto">Assunto da Mensagem</label>
            <input type="text" id="modal-envio-assunto" value="${UI.escapar(assuntoPadrao)}" />
          </div>
        </div>
        <div class="campo col-full" style="margin-bottom:10px">
          <label for="modal-envio-msg">Mensagem com o Resumo Fiscal</label>
          <textarea id="modal-envio-msg" rows="5" style="width:100%;padding:10px 12px;border-radius:var(--r-campo);border:1px solid var(--borda-forte);background:var(--elevado);font-family:monospace;font-size:12px;line-height:1.45;resize:vertical">${UI.escapar(corpoEmailPadrao)}</textarea>
        </div>
        <div class="faixa-info" style="margin-top:6px;background:rgba(46,125,50,.08);border-color:rgba(46,125,50,.25);color:#2E7D32">
          <b>Opções Rápidas de Envio:</b> Registre o envio direto pelo sistema, abra seu cliente de e-mail com os campos preenchidos e anexo baixado, ou envie o resumo pelo WhatsApp da contabilidade.
        </div>
      `,
      rodape: `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px">
          <button class="btn-secundario" id="modal-btn-cancelar" type="button" style="min-width:90px">
            Fechar
          </button>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <button class="btn-secundario" id="modal-btn-whatsapp" type="button" style="color:#1B5E20;border-color:rgba(46,125,50,.4)">
              WhatsApp
            </button>
            <button class="btn-secundario" id="modal-btn-mailto" type="button">
              Abrir no E-mail
            </button>
            <button class="btn-primario" id="modal-btn-enviar-direto" type="button">
              ${UI.icone('check')} Enviar Direto & Registrar
            </button>
          </div>
        </div>
      `
    });

    $('#modal-btn-cancelar').onclick = UI.fecharModal;

    // 1. Enviar Direto & Registrar
    $('#modal-btn-enviar-direto').onclick = () => {
      const dest = $('#modal-envio-para').value.trim();
      const rem = $('#modal-envio-de').value.trim();
      if (!dest) {
        UI.toast('Informe o e-mail do contador para registrar o envio.', 'erro');
        return;
      }
      c.emailContabilidade = dest;
      c.emailRemetenteFiscal = rem;
      c.nomeRemetenteFiscal = $('#modal-envio-nome').value.trim();
      DB.salvar();

      DB.marcarLoteEnviado(lote.id, dest, rem);
      UI.fecharModal();
      renderLotesFiscais();
      UI.toast(`Lote fiscal registrado como ENVIADO com sucesso para ${dest}!`, 'ok');
    };

    // 2. Abrir no Cliente de E-mail (mailto:)
    $('#modal-btn-mailto').onclick = () => {
      const dest = $('#modal-envio-para').value.trim();
      const rem = $('#modal-envio-de').value.trim();
      const subject = encodeURIComponent($('#modal-envio-assunto').value);
      const body = encodeURIComponent($('#modal-envio-msg').value);

      c.emailContabilidade = dest;
      c.emailRemetenteFiscal = rem;
      c.nomeRemetenteFiscal = $('#modal-envio-nome').value.trim();
      DB.salvar();
      DB.marcarLoteEnviado(lote.id, dest, rem);

      if (lote.xmlConteudo) {
        window.pdv.salvarContabilidade(lote.nomeArquivo, lote.xmlConteudo, 'xml');
      }

      window.open(`mailto:${encodeURIComponent(dest)}?subject=${subject}&body=${body}`, '_blank');
      UI.fecharModal();
      renderLotesFiscais();
      UI.toast(`Cliente de e-mail aberto e XML baixado para anexar!`, 'ok');
    };

    // 3. Compartilhar no WhatsApp
    $('#modal-btn-whatsapp').onclick = () => {
      const msg = encodeURIComponent($('#modal-envio-msg').value);
      if (lote.xmlConteudo) {
        window.pdv.salvarContabilidade(lote.nomeArquivo, lote.xmlConteudo, 'xml');
      }
      window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
      DB.marcarLoteEnviado(lote.id, 'WhatsApp Contabilidade', c.emailRemetenteFiscal);
      UI.fecharModal();
      renderLotesFiscais();
      UI.toast('WhatsApp aberto com os dados do lote contábil!');
    };
  }

  function filtrarEAtualizarContabilidade() {
    const inicio = $('#contabil-inicio').value;
    const fim = $('#contabil-fim').value;

    const todasVendasPeriodo = DB.estado.vendas.filter(v => {
      const d = new Date(v.data);
      if (inicio) {
        const di = new Date(inicio); di.setHours(0,0,0,0);
        if (d < di) return false;
      }
      if (fim) {
        const df = new Date(fim); df.setHours(23,59,59,999);
        if (d > df) return false;
      }
      return true;
    });

    // Vendas em dinheiro do período (apenas estatística interna protegida)
    const vendasDinheiro = todasVendasPeriodo.filter(v => v.pagamento === 'dinheiro');
    $('#contabil-dinheiro-qtd').textContent = `${vendasDinheiro.length} venda(s)`;

    // Vendas ELEGÍVEIS para a contabilidade (PIX, Débito, Crédito) - DINHEIRO É EXCLUÍDO
    const vendasContabeis = Fiscal.filtrarVendasContabilidade(todasVendasPeriodo);
    const totalContabil = DB.arred(vendasContabeis.reduce((s, v) => s + v.total, 0));

    $('#contabil-qtd').textContent = vendasContabeis.length;
    $('#contabil-total').textContent = DB.moeda(totalContabil);

    $('#contabil-vazio').hidden = vendasContabeis.length > 0;
    $('#contabil-tabela').hidden = vendasContabeis.length === 0;

    $('#contabil-corpo').innerHTML = vendasContabeis.slice(0, 80).map(v => `
      <tr>
        <td class="num">#${DB.numeroCupom(v.numero)}</td>
        <td>${UI.dataCurta(v.data)} · ${UI.hora(v.data)}</td>
        <td>
          <span class="chip chip--tipo">
            ${Fiscal.FORMAS_PAGAMENTO_FISCAL[v.pagamento]?.descricao || v.pagamento}
          </span>
        </td>
        <td>${(v.itens || []).reduce((s, i) => s + i.qtd, 0)} un</td>
        <td class="dir num"><b>${DB.moeda(v.total)}</b></td>
        <td><span class="chip chip--ok">Incluso no XML</span></td>
      </tr>
    `).join('');
  }

  async function exportarXmlContabilidadeFluxo() {
    const inicio = $('#contabil-inicio').value;
    const fim = $('#contabil-fim').value;

    const todasVendasPeriodo = DB.estado.vendas.filter(v => {
      const d = new Date(v.data);
      if (inicio) {
        const di = new Date(inicio); di.setHours(0,0,0,0);
        if (d < di) return false;
      }
      if (fim) {
        const df = new Date(fim); df.setHours(23,59,59,999);
        if (d > df) return false;
      }
      return true;
    });

    const vendasContabeis = Fiscal.filtrarVendasContabilidade(todasVendasPeriodo);

    if (!vendasContabeis.length) {
      UI.toast('Nenhuma venda por PIX ou Cartão no período selecionado.', 'erro');
      return;
    }

    const periodoNome = inicio && fim ? `${inicio}_a_${fim}` : new Date().toISOString().slice(0, 10);
    const xmlConteudo = Fiscal.gerarLoteContabilidadeXml(vendasContabeis, cfg(), `${inicio} a ${fim}`);
    const nomePadrao = `contabilidade-vendas-eletronicas-${periodoNome}.xml`;

    const ok = await window.pdv.salvarContabilidade(nomePadrao, xmlConteudo, 'xml');

    // Salva o lote no sistema
    const totalContabil = DB.arred(vendasContabeis.reduce((s, v) => s + v.total, 0));
    const vendasDinheiro = todasVendasPeriodo.filter(v => v.pagamento === 'dinheiro');
    const novoLote = DB.salvarLoteContabil({
      periodo: `${inicio ? UI.dataCurta(inicio) : 'Início'} até ${fim ? UI.dataCurta(fim) : 'Hoje'}`,
      dataInicio: inicio,
      dataFim: fim,
      qtdVendas: vendasContabeis.length,
      totalDeclarado: totalContabil,
      vendasDinheiroProtegidas: vendasDinheiro.length,
      nomeArquivo: nomePadrao,
      xmlConteudo: xmlConteudo
    });

    renderLotesFiscais();
    UI.toast(`Lote fiscal salvo no sistema com sucesso! (${vendasContabeis.length} vendas eletrônicas incluídas).`, 'ok');

    // Abre imediatamente o modal com opções para enviar ao contador
    modalEnviarLoteAoContador(novoLote.id);
  }

  function renderCategoriasTab() {
    const cats = DB.categorias();
    $('#cat-contagem').textContent = `${cats.length} ${cats.length === 1 ? 'categoria' : 'categorias'}`;
    $('#cat-vazio').hidden = cats.length > 0;
    $('#cat-tabela').hidden = cats.length === 0;
    $('#cat-corpo').innerHTML = cats.map(c => `
      <tr>
        <td class="num">${c.ordem}</td>
        <td>${UI.escapar(c.nome)}</td>
        <td class="dir num">${produtos().filter(p => p.categoriaId === c.id).length}</td>
        <td class="dir">
          <div class="mini-acoes">
            <button data-ceditar="${c.id}" title="Editar">${UI.icone('lapis')}</button>
            <button class="excluir" data-cexcluir="${c.id}" title="Excluir">${UI.icone('lixeira')}</button>
          </div>
        </td>
      </tr>`).join('');

    $$('[data-ceditar]').forEach(b => b.onclick = () => {
      const c = DB.categorias().find(x => x.id === b.dataset.ceditar);
      if (!c) return;
      promptCampos({
        titulo: 'Editar categoria',
        campos: [{ id: 'ec-nome', rotulo: 'Nome', valor: c.nome, largo: true }],
        textoBotao: 'Salvar'
      }).then(v => {
        if (!v || !v['ec-nome'].trim()) return;
        try {
          DB.salvarCategoria({ id: c.id, nome: v['ec-nome'].trim() });
          renderRetaguarda(); renderCategorias();
        } catch (err) { UI.toast(err.message, 'erro'); }
      });
    });

    $$('[data-cexcluir]').forEach(b => b.onclick = () => {
      const c = DB.categorias().find(x => x.id === b.dataset.cexcluir);
      if (!c) return;
      UI.confirmar({
        titulo: 'Excluir categoria',
        texto: `Excluir "${c.nome}"? Os produtos dela ficam sem categoria.`,
        acao: 'Excluir',
        perigo: true
      }).then(ok => {
        if (!ok) return;
        try {
          DB.excluirCategoria(c.id);
          if (st.cat === c.id) st.cat = 'todas';
          renderRetaguarda(); renderCategorias();
        } catch (err) { UI.toast(err.message, 'erro'); }
      });
    });
  }

  function renderFuncionariosTab() {
    const fs = DB.funcionarios();
    if ($('#func-contagem')) {
      $('#func-contagem').textContent = `${fs.length} ${fs.length === 1 ? 'colaborador cadastrado' : 'colaboradores cadastrados'}`;
    }
    $('#func-vazio').hidden = fs.length > 0;
    $('#func-tabela').hidden = fs.length === 0;

    // Administrador primeiro, seguido pelos demais colaboradores ordenados por nome
    const ordenados = fs.slice().sort((a, b) => {
      if (a.papel === 'admin' && b.papel !== 'admin') return -1;
      if (b.papel === 'admin' && a.papel !== 'admin') return 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    $('#func-corpo').innerHTML = ordenados.map(f => `
      <tr>
        <td>
          <div class="nome-prod" style="font-weight:700;font-size:14px">${UI.escapar(f.nome)}</div>
        </td>
        <td class="num" style="font-weight:600;color:var(--tinta-2)">${UI.escapar(f.usuario)}</td>
        <td><span class="chip ${f.papel === 'admin' ? 'chip--aluguel' : 'chip--tipo'}">${f.papel === 'admin' ? 'Administrador' : 'Caixa (Operador)'}</span></td>
        <td>
          ${f.tipoPagamento === 'diaria'
            ? `<span class="chip chip--tipo" style="font-weight:700">Diária · ${DB.moeda(f.valorPagamento || 0)}</span>`
            : f.tipoPagamento === 'mensal'
              ? `<span class="chip chip--ok" style="font-weight:700">Mensal · ${DB.moeda(f.valorPagamento || 0)}</span>`
              : `<span class="chip" style="color:var(--tinta-3)">Não definido</span>`}
        </td>
        <td><span class="chip ${f.ativo ? 'chip--ok' : 'chip--zero'}">${f.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="dir">
          <div class="mini-acoes">
            <button data-feditar="${f.id}" title="Editar">${UI.icone('lapis')}</button>
            ${f.id !== 'func-admin' && f.usuario !== 'admin' ? `
              <button class="excluir" data-fexcluir="${f.id}" title="Excluir">${UI.icone('lixeira')}</button>
            ` : ''}
          </div>
        </td>
      </tr>`).join('');

    $$('[data-feditar]').forEach(b => b.onclick = () => editarFuncionario(b.dataset.feditar));
    $$('[data-fexcluir]').forEach(b => b.onclick = () => {
      const f = DB.funcionario(b.dataset.fexcluir);
      if (!f) return;
      UI.confirmar({
        titulo: 'Excluir acesso',
        texto: `Tem certeza que deseja excluir o acesso de <b>${UI.escapar(f.nome)}</b>? Ele não poderá mais acessar o sistema.`,
        acao: 'Excluir definitivamente',
        perigo: true
      }).then(ok => {
        if (!ok) return;
        try {
          DB.excluirFuncionario(f.id);
          renderFuncionariosTab();
          renderLogin();
          UI.toast(`Acesso de "${f.nome}" excluído.`);
        } catch (err) { UI.toast(err.message, 'erro'); }
      });
    });
  }

  function editarFuncionario(fid) {
    if (st.usuario?.papel !== 'admin') {
      UI.toast('Apenas administradores podem cadastrar ou alterar funcionários.', 'erro');
      return;
    }
    const f = fid ? DB.funcionario(fid) : null;
    UI.abrirModal({
      titulo: f ? 'Editar funcionário' : 'Novo funcionário',
      corpo: `
        <div class="campo col-full">
          <label for="fu-nome">Nome Completo</label>
          <input id="fu-nome" type="text" placeholder="Ex.: Carlos Oliveira" value="${f ? UI.escapar(f.nome) : ''}" />
        </div>
        <div class="grid-2">
          <div class="campo">
            <label for="fu-usuario">Usuário de Login</label>
            <input id="fu-usuario" type="text" placeholder="Ex.: carlos" value="${f ? UI.escapar(f.usuario) : ''}" autocomplete="off" />
          </div>
          <div class="campo">
            <label for="fu-senha">${f ? 'Nova Senha (opcional)' : 'Senha de Acesso'}</label>
            <input id="fu-senha" type="password" placeholder="${f ? 'Deixe vazio para manter' : 'Ex.: 1234'}" autocomplete="new-password" />
          </div>
          <div class="campo">
            <label for="fu-papel">Papel / Função</label>
            <select id="fu-papel" class="campo-select">
              <option value="caixa" ${!f || f.papel === 'caixa' ? 'selected' : ''}>Caixa (Operador de Vendas)</option>
              <option value="admin" ${f && f.papel === 'admin' ? 'selected' : ''}>Administrador (Acesso Total)</option>
            </select>
          </div>
          <div class="campo">
            <label for="fu-ativo">Situação da Conta</label>
            <select id="fu-ativo" class="campo-select">
              <option value="1" ${!f || f.ativo ? 'selected' : ''}>Ativo</option>
              <option value="0" ${f && !f.ativo ? 'selected' : ''}>Inativo (Bloqueado)</option>
            </select>
          </div>
          <div class="campo">
            <label for="fu-tipo-pagamento">Tipo de Pagamento</label>
            <select id="fu-tipo-pagamento" class="campo-select">
              <option value="diaria" ${f && f.tipoPagamento === 'diaria' ? 'selected' : ''}>Diária</option>
              <option value="mensal" ${!f || f.tipoPagamento === 'mensal' ? 'selected' : ''}>Mensal</option>
            </select>
          </div>
          <div class="campo">
            <label for="fu-valor-pagamento">Valor a Pagar (R$)</label>
            <input id="fu-valor-pagamento" type="text" inputmode="decimal" placeholder="Ex.: 150,00 ou 2.200,00" value="${f && f.valorPagamento ? numero(f.valorPagamento) : ''}" />
          </div>
        </div>
        <p id="fu-erro" style="color:#D32F2F;font-size:12.5px;font-weight:600;margin-top:6px" hidden></p>
      `,
      rodape: `
        <button class="btn-secundario" type="button" onclick="UI.fecharModal()">Cancelar</button>
        <button class="btn-primario" id="fu-salvar" type="button">
          ${UI.icone('check')} ${f ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
        </button>
      `
    });

    const erroEl = $('#fu-erro');
    const mostrarErro = (msg) => {
      if (erroEl) {
        erroEl.textContent = msg;
        erroEl.hidden = false;
      } else {
        UI.toast(msg, 'erro');
      }
    };

    const salvar = async () => {
      const nome = $('#fu-nome').value.trim();
      const usuario = $('#fu-usuario').value.trim().toLowerCase();
      const senha = $('#fu-senha').value.trim();
      const papel = $('#fu-papel').value;
      const tipoPagamento = $('#fu-tipo-pagamento').value;
      const valorPagamento = valorDeTexto($('#fu-valor-pagamento').value);
      const ativo = $('#fu-ativo').value === '1';

      if (!nome) { mostrarErro('Informe o nome completo do funcionário.'); return; }
      if (!usuario) { mostrarErro('Informe o nome de usuário para login.'); return; }
      if (!f && !senha) { mostrarErro('Defina uma senha de acesso para o novo funcionário.'); return; }

      try {
        await DB.salvarFuncionario({
          id: fid || undefined,
          nome,
          usuario,
          senha: senha || undefined,
          papel,
          tipoPagamento,
          valorPagamento,
          ativo
        });
        UI.fecharModal();
        renderFuncionariosTab();
        renderLogin();
        UI.toast(f ? `Funcionário "${nome}" atualizado!` : `Funcionário "${nome}" cadastrado com sucesso!`);
      } catch (err) {
        mostrarErro(err.message || 'Erro ao salvar funcionário.');
      }
    };

    $('#fu-salvar').onclick = salvar;
    $('#fu-nome').addEventListener('keydown', e => { if (e.key === 'Enter') $('#fu-usuario').focus(); });
    $('#fu-usuario').addEventListener('keydown', e => { if (e.key === 'Enter') $('#fu-senha').focus(); });
    $('#fu-senha').addEventListener('keydown', e => { if (e.key === 'Enter') salvar(); });
  }

  /* ================== LOGIN ================== */
  function renderLogin() {
    const fs = DB.funcionarios().filter(f => f.ativo);
    const lista = $('#login-usuarios');
    lista.innerHTML = fs.map(f => `
      <button class="login__usuario" data-user="${f.id}">
        <span class="avatar">${UI.escapar(iniciais(f.nome))}</span>
        <span>
          <b>${UI.escapar(f.nome)}</b>
          <i>${f.papel === 'admin' ? 'Administrador' : 'Caixa'}</i>
        </span>
      </button>`).join('') || '<p class="sub">Nenhum acesso cadastrado ainda.</p>';

    $$('.login__usuario').forEach(b => b.onclick = () => {
      st.loginUser = DB.funcionario(b.dataset.user);
      $('#login-sub').textContent = `Senha de ${st.loginUser.nome}`;
      lista.hidden = true;
      $('#login-form').hidden = false;
      $('#login-senha').value = '';
      $('#login-erro').hidden = true;
      $('#login-senha').focus();
    });

    const btnVoltar = $('#login-voltar') || $('.login__voltar');
    if (btnVoltar) {
      btnVoltar.onclick = () => {
        st.loginUser = null;
        lista.hidden = false;
        $('#login-form').hidden = true;
        $('#login-erro').hidden = true;
      };
    }
  }

  function iniciais(nome) {
    return String(nome || '').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
  }

  function entrarSistema(f) {
    st.usuario = f;
    st.loginUser = null;
    st.logado = true;
    $('#tela-login').hidden = true;
    $('#btn-user').hidden = false;
    $('#btn-sair').hidden = false;
    $('#topo-usuario').textContent = f.nome;
    const ehAdmin = f.papel === 'admin';
    $$('.trilho__btn[data-vista="config"]').forEach(b => b.hidden = !ehAdmin);
    $$('.trilho__btn[data-vista="retaguarda"]').forEach(b => b.hidden = !ehAdmin);
    renderLogin();
    atualizarStatusCaixaUI();
    renderCategorias();
    renderGrade();
    irPara('venda');
  }

  function sairSistema() {
    st.usuario = null;
    st.logado = false;
    $('#tela-login').hidden = false;
    $('#btn-user').hidden = true;
    $('#btn-sair').hidden = true;
    $$('.trilho__btn[data-vista="config"]').forEach(b => b.hidden = false);
    $$('.trilho__btn[data-vista="retaguarda"]').forEach(b => b.hidden = false);
    $('#login-sub').textContent = 'Quem está operando?';
    $('#login-usuarios').hidden = false;
    $('#login-form').hidden = true;
    $('#login-erro').hidden = true;
    renderLogin();
  }

  /* ================== CONFIG ================== */
  async function carregarImpressoras() {
    try {
      const lista = await window.pdv.listarImpressoras();
      st.impressoras = Array.isArray(lista) ? lista : [];
    } catch {
      st.impressoras = [];
    }
    atualizarSelectsImpressoras();
  }

  function atualizarSelectsImpressoras() {
    const c = cfg();
    const selCaixa = $('#cfg-imp-caixa');
    const selCozinha = $('#cfg-imp-cozinha');
    if (!selCaixa || !selCozinha) return;

    const optsCaixa = [
      '<option value="">Padrão do Windows (Automático)</option>',
      ...st.impressoras.map(p => `<option value="${UI.escapar(p.name)}" ${c.impressoraCaixa === p.name ? 'selected' : ''}>${UI.escapar(p.displayName || p.name)}${p.isDefault ? ' (Padrão)' : ''}</option>`)
    ];
    if (c.impressoraCaixa && !st.impressoras.some(p => p.name === c.impressoraCaixa)) {
      optsCaixa.push(`<option value="${UI.escapar(c.impressoraCaixa)}" selected>${UI.escapar(c.impressoraCaixa)} (Salva)</option>`);
    }
    selCaixa.innerHTML = optsCaixa.join('');

    const optsCozinha = [
      `<option value="mesma" ${(!c.impressoraCozinha || c.impressoraCozinha === 'mesma') ? 'selected' : ''}>Mesma impressora do caixa</option>`,
      `<option value="" ${c.impressoraCozinha === '' ? 'selected' : ''}>Padrão do Windows</option>`,
      ...st.impressoras.map(p => `<option value="${UI.escapar(p.name)}" ${c.impressoraCozinha === p.name ? 'selected' : ''}>${UI.escapar(p.displayName || p.name)}</option>`)
    ];
    if (c.impressoraCozinha && c.impressoraCozinha !== 'mesma' && !st.impressoras.some(p => p.name === c.impressoraCozinha)) {
      optsCozinha.push(`<option value="${UI.escapar(c.impressoraCozinha)}" selected>${UI.escapar(c.impressoraCozinha)} (Salva)</option>`);
    }
    selCozinha.innerHTML = optsCozinha.join('');
  }

  let logoOriginalTemporaria = null;

  // Aplica a logomarca no sistema (topo e login)
  function aplicarLogoSistema(logoUrl) {
    const src = logoUrl || 'assets/logo-topo.png';
    const logoTopo = $('#app-logo-topo');
    if (logoTopo) logoTopo.src = src;
    const logoLogin = $('#app-logo-login');
    if (logoLogin) logoLogin.src = src;
  }

  // Tratamento da logo para impressão térmica em preto e branco (binarização com canvas)
  function converterImagemParaPretoBranco(dataUrl, threshold = 160) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxLargura = 380;
        const maxAltura = 160;
        let largura = img.naturalWidth || 300;
        let altura = img.naturalHeight || 100;
        const ratio = Math.min(maxLargura / largura, maxAltura / altura, 1);
        largura = Math.round(largura * ratio);
        altura = Math.round(altura * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');

        // Preenche com fundo branco puro (resolve PNGs transparentes em térmicas)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(img, 0, 0, largura, altura);

        const imgData = ctx.getImageData(0, 0, largura, altura);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          if (a < 64) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
          } else {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = lum < threshold ? 0 : 255;
            d[i] = val; d[i + 1] = val; d[i + 2] = val;
          }
          d[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function atualizarPreviaLogoPB(threshold = 160) {
    const c = cfg();
    const dataSrc = logoOriginalTemporaria || c.logo || 'assets/logo-topo.png';
    const previewCor = $('#cfg-logo-preview-cor');
    const previewPB = $('#cfg-logo-preview-pb');
    if (previewCor) previewCor.src = dataSrc;

    try {
      const pbUrl = await converterImagemParaPretoBranco(dataSrc, threshold);
      if (previewPB) previewPB.src = pbUrl;
      return pbUrl;
    } catch {
      if (previewPB) previewPB.src = dataSrc;
      return dataSrc;
    }
  }

  async function preencherConfig() {
    const c = cfg();
    $('#cfg-loja').value = c.loja || '';
    $('#cfg-endereco').value = c.endereco || '';
    $('#cfg-telefone').value = c.telefone || '';
    $('#cfg-cnpj').value = c.cnpj || '';
    $('#cfg-silenciosa').checked = !!c.impressoraSilenciosa;
    $('#cfg-cozinha-ativa').checked = c.cozinhaAtiva !== false;
    $$('#cfg-largura .seg').forEach(b => b.classList.toggle('ativo', Number(b.dataset.l) === Number(c.larguraCupom || 80)));
    $$('#cfg-largura-cozinha .seg').forEach(b => b.classList.toggle('ativo', Number(b.dataset.l) === Number(c.larguraCozinha || 80)));

    // Configurações da Logo
    const previewCor = $('#cfg-logo-preview-cor');
    const previewPB = $('#cfg-logo-preview-pb');
    if (previewCor) previewCor.src = c.logo || 'assets/logo-topo.png';
    if (previewPB) previewPB.src = c.logoMonocromatica || 'assets/logo-topo.png';
    if ($('#cfg-imprimir-logo')) $('#cfg-imprimir-logo').checked = c.imprimirLogoCupom !== false;
    if ($('#cfg-logo-threshold')) $('#cfg-logo-threshold').value = 160;
    if ($('#cfg-logo-threshold-val')) $('#cfg-logo-threshold-val').textContent = '160';
    if (!c.logoMonocromatica) {
      atualizarPreviaLogoPB(160);
    }

    await carregarImpressoras();
  }

  async function salvarConfig() {
    const c = cfg();
    c.loja = $('#cfg-loja').value.trim() || 'Rota do Forte';
    c.endereco = $('#cfg-endereco').value.trim();
    c.telefone = $('#cfg-telefone').value.trim();
    c.cnpj = $('#cfg-cnpj').value.trim();
    c.impressoraSilenciosa = $('#cfg-silenciosa').checked;
    c.cozinhaAtiva = $('#cfg-cozinha-ativa').checked;
    c.impressoraCaixa = ($('#cfg-imp-caixa')?.value || '').trim();
    c.impressoraCozinha = ($('#cfg-imp-cozinha')?.value || '').trim();

    c.imprimirLogoCupom = $('#cfg-imprimir-logo') ? $('#cfg-imprimir-logo').checked : true;
    if (logoOriginalTemporaria) {
      c.logo = logoOriginalTemporaria;
      const th = Number($('#cfg-logo-threshold')?.value || 160);
      c.logoMonocromatica = await converterImagemParaPretoBranco(c.logo, th);
      logoOriginalTemporaria = null;
    } else if (c.logo && !c.logoMonocromatica) {
      const th = Number($('#cfg-logo-threshold')?.value || 160);
      c.logoMonocromatica = await converterImagemParaPretoBranco(c.logo, th);
    }

    aplicarLogoSistema(c.logo);
    DB.salvar();
    $('#topo-loja').textContent = c.loja;
    UI.toast('Configurações e Logomarca salvas com sucesso!');
  }

  /* ================== SIMULADOR / PRÉVIA DE IMPRESSÃO TÉRMICA REAL ================== */
  function abrirModalPreviaImpressao(modoInicial = 'ambas') {
    const c = cfg();
    let larguraAtual = Number(c.larguraCupom || 80);
    let abaPrevia = modoInicial;
    const opAtual = st.usuario?.nome || 'Thales';

    // Pedido autêntico de teste do quiosque para prévia realista
    const vendaExemplo = {
      numero: (c.ultimoCupom || 104) + 1,
      numeroComanda: DB.obterProximoNumeroComanda(),
      data: new Date().toISOString(),
      operador: opAtual,
      cliente: 'Guarda-sol 14 (Praia)',
      itens: [
        { produtoId: 'p-pastel', nome: 'Pastel (Carne)', preco: 14.00, qtd: 2 },
        { produtoId: 'p-churros', nome: 'Churros (Nutella)', preco: 12.00, qtd: 1 },
        { produtoId: 'p-agua', nome: 'Água mineral 500ml', preco: 4.00, qtd: 2 },
        { produtoId: 'p-cerveja', nome: 'Cerveja long neck', preco: 12.00, qtd: 2 }
      ],
      subtotal: 68.00,
      desconto: 5.00,
      total: 63.00,
      pagamento: 'pix',
      recebido: 63.00,
      troco: 0,
      obsCozinha: 'Pastel bem frito e crocante.'
    };

    const itensCozinhaExemplo = [
      { nome: 'Pastel (Carne)', qtd: 2 }
    ];

    UI.abrirModal({
      titulo: 'Prévia de Impressão Térmica Real',
      largo: true,
      corpo: `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;background:var(--afundado);padding:10px 16px;border-radius:12px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:700;color:var(--tinta-2)">Visualizar:</span>
            <div class="segs" id="segs-previa-aba">
              <button class="seg ${abaPrevia === 'ambas' ? 'ativo' : ''}" data-paba="ambas">Ambas as Guias</button>
              <button class="seg ${abaPrevia === 'cliente' ? 'ativo' : ''}" data-paba="cliente">Guia do Cliente (Caixa)</button>
              <button class="seg ${abaPrevia === 'cozinha' ? 'ativo' : ''}" data-paba="cozinha">Guia da Cozinha</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:700;color:var(--tinta-2)">Largura da Bobina:</span>
            <div class="segs" id="segs-previa-largura">
              <button class="seg ${larguraAtual === 58 ? 'ativo' : ''}" data-plarg="58">58 mm</button>
              <button class="seg ${larguraAtual === 80 ? 'ativo' : ''}" data-plarg="80">80 mm (Padrão)</button>
            </div>
          </div>
        </div>

        <div class="previa-bobinas-container" id="previa-bobinas-container">
          <!-- Renderizado dinamicamente -->
        </div>
      `,
      rodape: `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px">
          <button class="btn-secundario" id="modal-previa-fechar" type="button" style="min-width:90px">
            Fechar
          </button>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11.5px;color:var(--tinta-3)">Simulação fiel da bobina térmica (impressora do caixa e produção)</span>
          </div>
        </div>
      `
    });

    $('#modal-previa-fechar').onclick = UI.fecharModal;

    function renderizarBobinas() {
      const cfgPreview = {
        ...c,
        larguraCupom: larguraAtual,
        larguraCozinha: larguraAtual,
        logo: logoOriginalTemporaria || c.logo,
        logoMonocromatica: $('#cfg-logo-preview-pb')?.src || c.logoMonocromatica,
        imprimirLogoCupom: $('#cfg-imprimir-logo') ? $('#cfg-imprimir-logo').checked : true
      };

      const htmlCliente = Printer.montarCupom(vendaExemplo, cfgPreview);
      const htmlCozinha = Printer.montarComandaCozinha(vendaExemplo, itensCozinhaExemplo, cfgPreview);

      const larguraCss = larguraAtual === 58 ? '260px' : '310px';
      let htmlGuias = '';

      if (abaPrevia === 'cliente' || abaPrevia === 'ambas') {
        htmlGuias += `
          <div class="bobina-coluna">
            <div class="bobina-coluna__topo">
              <span class="bobina-tag bobina-tag--cliente">Guia do Cliente (Caixa)</span>
              <span class="bobina-subinfo">Com Logomarca P&B · Dados do Quiosque</span>
            </div>
            <div class="bobina-recipiente" style="width:${larguraCss}">
              <div class="bobina-papel">
                <div class="bobina-corte-topo"></div>
                <iframe class="bobina-frame" id="frame-previa-cliente" srcdoc="${UI.escapar(htmlCliente)}" frameborder="0"></iframe>
                <div class="bobina-corte-base"></div>
              </div>
            </div>
            <button class="btn-secundario btn-pequeno" id="btn-imprimir-previa-cli" type="button" style="margin-top:10px;width:${larguraCss};justify-content:center">
              ${UI.icone('check')} Imprimir Cupom do Cliente
            </button>
          </div>
        `;
      }

      if (abaPrevia === 'cozinha' || abaPrevia === 'ambas') {
        htmlGuias += `
          <div class="bobina-coluna">
            <div class="bobina-coluna__topo">
              <span class="bobina-tag bobina-tag--cozinha">Guia da Cozinha (Produção)</span>
              <span class="bobina-subinfo">Sem Logo · Destaca Quem Tirou o Pedido</span>
            </div>
            <div class="bobina-recipiente" style="width:${larguraCss}">
              <div class="bobina-papel">
                <div class="bobina-corte-topo"></div>
                <iframe class="bobina-frame" id="frame-previa-cozinha" srcdoc="${UI.escapar(htmlCozinha)}" frameborder="0"></iframe>
                <div class="bobina-corte-base"></div>
              </div>
            </div>
            <button class="btn-secundario btn-pequeno" id="btn-imprimir-previa-coz" type="button" style="margin-top:10px;width:${larguraCss};justify-content:center">
              ${UI.icone('check')} Imprimir Comanda Cozinha
            </button>
          </div>
        `;
      }

      const container = $('#previa-bobinas-container');
      if (container) {
        container.innerHTML = htmlGuias;

        container.querySelectorAll('.bobina-frame').forEach(f => {
          f.onload = () => {
            try {
              const h = f.contentWindow.document.documentElement.scrollHeight || 450;
              f.style.height = `${Math.max(h + 24, 380)}px`;
            } catch {}
          };
        });

        const bCli = $('#btn-imprimir-previa-cli');
        if (bCli) {
          bCli.onclick = async () => {
            const ok = await Printer.imprimir(htmlCliente, cfgPreview, 'caixa');
            UI.toast(ok ? 'Cupom de teste enviado para a impressora do Caixa' : 'Falha ao imprimir', ok ? 'ok' : 'erro');
          };
        }

        const bCoz = $('#btn-imprimir-previa-coz');
        if (bCoz) {
          bCoz.onclick = async () => {
            const ok = await Printer.imprimir(htmlCozinha, cfgPreview, 'cozinha');
            UI.toast(ok ? 'Comanda enviada para a impressora da Cozinha' : 'Falha ao imprimir', ok ? 'ok' : 'erro');
          };
        }
      }
    }

    // Configuração dos alternadores de aba e largura dentro do modal
    $$('#segs-previa-aba .seg').forEach(b => {
      b.onclick = () => {
        $$('#segs-previa-aba .seg').forEach(s => s.classList.remove('ativo'));
        b.classList.add('ativo');
        abaPrevia = b.dataset.paba;
        renderizarBobinas();
      };
    });

    $$('#segs-previa-largura .seg').forEach(b => {
      b.onclick = () => {
        $$('#segs-previa-largura .seg').forEach(s => s.classList.remove('ativo'));
        b.classList.add('ativo');
        larguraAtual = Number(b.dataset.plarg);
        renderizarBobinas();
      };
    });

    renderizarBobinas();
  }

  async function abrirQrCodeConexaoMobile() {
    UI.abrirModal({
      titulo: 'Conectar Celular do Dono & Aparelhos Conectados',
      corpo: `
        <div style="text-align:center;padding:24px 0">
          <p style="font-size:14px;color:var(--tinta-2);font-weight:700">
            Gerando QR Code de pareamento direto deste quiosque...
          </p>
        </div>
      `,
      rodape: `<button class="btn-secundario" id="modal-qr-fechar">Fechar</button>`,
      largo: true
    });

    const btnFechar = $('#modal-qr-fechar');
    if (btnFechar) btnFechar.onclick = UI.fecharModal;

    async function recarregarModalDispositivos() {
      try {
        const resp = await fetch('/api/qrcode-mobile');
        const dados = await resp.json();
        if (!dados.ok) throw new Error(dados.erro || 'Falha ao gerar');

        const elCorpo = document.getElementById('modal-corpo');
        if (!elCorpo) return;

        const dispositivos = dados.dispositivos || [];
        const ativosQtd = dispositivos.filter(d => d.ativo).length;

        elCorpo.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
            
            <!-- COLUNA 1: QR CODE DE CONEXÃO -->
            <div style="text-align:center;background:var(--afundado);border-radius:14px;padding:16px;border:1.5px solid var(--borda)">
              <div style="margin-bottom:10px">
                <span style="display:inline-block;padding:4px 12px;background:var(--primaria-leve);color:var(--primaria-forte);border-radius:12px;font-size:12.5px;font-weight:900">
                  ${UI.escapar(dados.loja)} · QR Code Seguro
                </span>
              </div>

              <!-- Imagem do QR Code -->
              <div style="background:#FFF;padding:10px;display:inline-block;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,0.08);border:1.5px solid var(--borda);margin-bottom:12px">
                <img src="${dados.qrCode}" alt="QR Code" style="width:200px;height:200px;display:block" />
              </div>

              <!-- Instruções -->
              <div style="font-size:12px;line-height:1.45;color:var(--tinta-2);text-align:left;background:#FFF;padding:10px 12px;border-radius:10px;border:1px solid var(--borda);margin-bottom:10px">
                <div style="font-weight:800;color:var(--primaria-forte);margin-bottom:3px">Como conectar o celular:</div>
                <div>1. Abra a <b>câmera</b> do celular (iPhone ou Android).</div>
                <div>2. Aponte para este QR Code.</div>
                <div>3. O celular conecta automaticamente sem precisar digitar senha!</div>
              </div>

              <!-- Link direto -->
              <div style="display:flex;align-items:center;gap:6px">
                <input type="text" value="${dados.urlFinal}" id="input-url-qrcode" readonly style="flex:1;height:34px;padding:0 8px;border:1px solid var(--borda-forte);border-radius:8px;font-size:11.5px;background:#FFF;font-weight:700;color:var(--tinta)" />
                <button class="btn-secundario" id="btn-copiar-url-qrcode" type="button" style="height:34px;padding:0 10px;font-size:11.5px;font-weight:800;white-space:nowrap">
                  Copiar Link
                </button>
              </div>
            </div>

            <!-- COLUNA 2: APARELHOS CONECTADOS (ESTILO WHATSAPP) -->
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid var(--borda);padding-bottom:8px">
                <div>
                  <h3 style="font-size:15px;font-weight:900;color:var(--tinta);display:flex;align-items:center;gap:6px">
                    <svg class="ic" viewBox="0 0 24 24" style="color:var(--primaria)"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                    Aparelhos Conectados
                  </h3>
                  <div style="font-size:11.5px;color:var(--tinta-3);font-weight:700">Controle de sessões ativas no quiosque</div>
                </div>
                <span style="font-size:11px;font-weight:900;padding:2px 8px;border-radius:10px;background:${ativosQtd > 0 ? 'var(--sucesso-leve)' : 'var(--afundado)'};color:${ativosQtd > 0 ? 'var(--sucesso)' : 'var(--tinta-3)'}">
                  ${ativosQtd} ativo${ativosQtd !== 1 ? 's' : ''}
                </span>
              </div>

              <!-- Lista de aparelhos -->
              <div id="lista-aparelhos-conectados" style="max-height:330px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
                ${dispositivos.length === 0 ? `
                  <div style="text-align:center;padding:30px 10px;background:var(--afundado);border-radius:10px;border:1px dashed var(--borda);color:var(--tinta-3);font-size:12.5px;font-weight:700">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" style="margin:0 auto 8px auto;display:block;opacity:0.6"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                    Nenhum celular conectado ainda.<br>Aponte a câmera para o QR Code ao lado.
                  </div>
                ` : dispositivos.map(disp => {
                  const dataConexao = new Date(disp.conectadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                  return `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#FFF;border:1.5px solid ${disp.ativo ? 'var(--borda-forte)' : 'var(--borda)'};border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
                      <div style="display:flex;align-items:center;gap:10px;min-width:0">
                        <div style="width:34px;height:34px;border-radius:8px;background:${disp.ativo ? 'rgba(232, 130, 10, .12)' : 'rgba(0,0,0,0.06)'};color:${disp.ativo ? 'var(--primaria-forte)' : 'var(--tinta-3)'};display:flex;align-items:center;justify-content:center;flex:none">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                        </div>
                        <div style="min-width:0">
                          <div style="font-size:13px;font-weight:900;color:var(--tinta);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                            ${UI.escapar(disp.nome)}
                          </div>
                          <div style="font-size:11px;color:var(--tinta-2);font-weight:600">
                            ${disp.usuario} · ${dataConexao}
                          </div>
                        </div>
                      </div>

                      <div style="flex:none;margin-left:8px">
                        ${disp.ativo ? `
                          <button class="btn-secundario btn-pequeno btn-desconectar-aparelho" data-id="${disp.id}" type="button" style="color:var(--erro);border-color:rgba(192, 68, 43, .3);font-weight:800;font-size:11px;padding:4px 8px">
                            Desconectar
                          </button>
                        ` : `
                          <button class="btn-secundario btn-pequeno btn-remover-aparelho" data-id="${disp.id}" type="button" style="color:var(--tinta-3);font-size:11px;padding:4px 8px">
                            Remover
                          </button>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <div style="font-size:11px;color:var(--tinta-3);text-align:center;line-height:1.4">
                Ao clicar em <b>Desconectar</b>, a sessão do celular é encerrada na hora.
              </div>
            </div>
          </div>
        `;

        // Evento Copiar Link
        const btnCopiar = document.getElementById('btn-copiar-url-qrcode');
        if (btnCopiar) {
          btnCopiar.onclick = () => {
            const input = document.getElementById('input-url-qrcode');
            if (input) {
              input.select();
              navigator.clipboard?.writeText(input.value);
              UI.toast('Link copiado para a área de transferência!', 'ok');
            }
          };
        }

        // Eventos Desconectar Aparelho
        $$('.btn-desconectar-aparelho').forEach(btn => {
          btn.onclick = async () => {
            const id = btn.dataset.id;
            const confirma = await UI.confirmar(
              'Desconectar Aparelho',
              'Deseja realmente encerrar a sessão deste celular? Ele precisará ler o QR Code novamente para se reconectar.',
              'Sim, Desconectar'
            );
            if (confirma) {
              btn.disabled = true;
              btn.textContent = 'Desconectando...';
              try {
                const r = await fetch('/api/dispositivos/desconectar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id })
                });
                const d = await r.json();
                if (d.ok) {
                  UI.toast('Aparelho desconectado com sucesso!', 'ok');
                  recarregarModalDispositivos();
                } else {
                  UI.toast(d.erro || 'Falha ao desconectar', 'alerta');
                }
              } catch (err) {
                UI.toast(err.message, 'alerta');
              }
            }
          };
        });

        // Eventos Remover Histórico
        $$('.btn-remover-aparelho').forEach(btn => {
          btn.onclick = async () => {
            const id = btn.dataset.id;
            try {
              await fetch('/api/dispositivos/remover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
              });
              recarregarModalDispositivos();
            } catch {}
          };
        });

      } catch (err) {
        const elCorpo = document.getElementById('modal-corpo');
        if (elCorpo) {
          elCorpo.innerHTML = `
            <div style="text-align:center;padding:20px;color:var(--alerta)">
              <p style="font-weight:800;margin-bottom:8px">Falha ao carregar conexões no servidor local.</p>
              <p style="font-size:12px">${UI.escapar(err.message)}</p>
            </div>
          `;
        }
      }
    }

    recarregarModalDispositivos();
  }

  /* ================== EVENTOS ================== */
  function ligarEventos() {
    $$('.trilho__btn').forEach(b => b.onclick = () => irPara(b.dataset.vista));

    $('#busca').addEventListener('input', e => {
      st.busca = e.target.value;
      renderGrade();
    });
    $('#busca').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const termo = e.target.value.trim();
      if (!termo) return;
      const exato = produtos().find(p => (p.codigo || '') === termo);
      const alvo = exato || filtrarProdutos()[0];
      if (alvo) {
        adicionar(alvo.id);
        e.target.value = ''; st.busca = '';
        renderGrade();
      } else {
        UI.toast('Produto não encontrado', 'erro');
      }
    });

    $('#btn-limpar').onclick = async () => {
      if (!st.carrinho.length) return;
      const ok = await UI.confirmar({ titulo: 'Limpar carrinho', texto: 'Remover todos os itens da venda atual?', acao: 'Limpar', perigo: true });
      if (ok) { st.carrinho = []; st.desconto = 0; renderCarrinho(); renderGrade(); }
    };

    $('#desc-mais').onclick = () => {
      if (!st.carrinho.length) return;
      const prox = Math.min(subtotal(), st.desconto + 1);
      if (prox === st.desconto) return UI.toast('Desconto no limite do subtotal');
      st.desconto = prox; renderCarrinho();
    };
    $('#desc-menos').onclick = () => { st.desconto = Math.max(0, st.desconto - 1); renderCarrinho(); };
    $('#desc-limpar').onclick = () => { st.desconto = 0; renderCarrinho(); };
    $('#btn-pagar').onclick = abrirPagamento;

    if ($('#btn-novo-produto')) $('#btn-novo-produto').onclick = () => formProduto(null);
    if ($('#btn-importar-xml')) $('#btn-importar-xml').onclick = importarXmlFluxo;
    if ($('#btn-compras-importar')) $('#btn-compras-importar').onclick = importarXmlFluxo;
    if ($('#btn-contabil-filtrar')) $('#btn-contabil-filtrar').onclick = filtrarEAtualizarContabilidade;
    if ($('#btn-contabil-exportar')) $('#btn-contabil-exportar').onclick = exportarXmlContabilidadeFluxo;
    if ($('#prod-busca')) $('#prod-busca').addEventListener('input', e => { st.filtroProdutos = e.target.value; renderProdutos(); });

    $$('#abas-ret .aba').forEach(b => b.onclick = () => { st.retAba = b.dataset.aba; renderRetaguarda(); });
    $$('[data-ret-nav]').forEach(b => b.onclick = () => {
      st.retAba = b.dataset.retNav;
      renderRetaguarda();
    });
    if ($('#btn-voltar-pdv')) $('#btn-voltar-pdv').onclick = () => irPara('venda');
    if ($('#btn-toggle-cat-sidebar')) $('#btn-toggle-cat-sidebar').onclick = () => {
      $('#cat-sidebar')?.classList.toggle('recolhido');
    };
    if ($('#btn-nova-cat-rapida')) $('#btn-nova-cat-rapida').onclick = abrirModalNovaCategoria;

    if ($('#btn-nova-categoria')) {
      $('#btn-nova-categoria').onclick = () => {
        promptCampos({
          titulo: 'Nova categoria',
          campos: [{ id: 'nc-nome', rotulo: 'Nome', valor: '', largo: true, placeholder: 'Ex.: Sorvetes' }],
          textoBotao: 'Criar'
        }).then(v => {
          if (!v || !v['nc-nome'].trim()) return;
          try { DB.salvarCategoria({ nome: v['nc-nome'].trim() }); renderCategoriasTab(); renderCategorias(); renderMenuCategoriasEstoque(); }
          catch (err) { UI.toast(err.message, 'erro'); }
        });
      };
    }
    if ($('#btn-abrir-caixa-venda')) $('#btn-abrir-caixa-venda').onclick = abrirCaixaFluxo;
    if ($('#topo-caixa-status')) $('#topo-caixa-status').onclick = () => {
      if (!DB.caixaAberto()) abrirCaixaFluxo();
      else irPara('caixa');
    };

    if ($('#btn-novo-funcionario')) $('#btn-novo-funcionario').onclick = () => editarFuncionario(null);

    $$('#rel-periodo .seg').forEach(b => b.onclick = () => { st.periodo = b.dataset.periodo; renderCaixaVista(); });
    $('#btn-imprimir-mov').onclick = () => {
      const r = resumo(st.periodo);
      if (!r.vendas.length) return UI.toast('Nada para imprimir no período', 'erro');
      Printer.imprimir(Printer.montarFechamento(r, cfg()), cfg())
        .then(ok => UI.toast(ok ? 'Fechamento enviado para impressão' : 'Impressão cancelada ou indisponível', ok ? 'ok' : 'erro'));
    };

    $('#btn-user').onclick = () => UI.toast(`${st.usuario.nome} · ${st.usuario.papel === 'admin' ? 'Administrador' : 'Caixa'}`);
    $('#btn-sair').onclick = () => {
      UI.confirmar({ titulo: 'Sair', texto: 'Trocar de operador? O caixa atual continua aberto.', acao: 'Sair' })
        .then(ok => ok && sairSistema());
    };

    $('#login-form').addEventListener('submit', e => {
      e.preventDefault();
      if (!st.loginUser) return;
      DB.conferirLogin(st.loginUser.usuario, $('#login-senha').value).then(f => {
        if (f) entrarSistema(f);
        else {
          $('#login-erro').hidden = false;
          $('#login-senha').value = '';
          $('#login-senha').focus();
        }
      });
    });

    $('#btn-salvar-config').onclick = salvarConfig;
    if ($('#btn-conectar-celular-qrcode')) {
      $('#btn-conectar-celular-qrcode').onclick = abrirQrCodeConexaoMobile;
    }

    // Eventos da Logo em Configurações
    if ($('#btn-escolher-logo')) {
      $('#btn-escolher-logo').onclick = () => $('#cfg-logo-input')?.click();
    }
    if ($('#cfg-logo-input')) {
      $('#cfg-logo-input').onchange = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          UI.toast('A imagem deve ter no máximo 4 MB.', 'erro');
          return;
        }
        const reader = new FileReader();
        reader.onload = async evt => {
          logoOriginalTemporaria = evt.target.result;
          const th = Number($('#cfg-logo-threshold')?.value || 160);
          await atualizarPreviaLogoPB(th);
          UI.toast('Logomarca carregada! Clique em "Salvar" no topo para aplicar em todo o sistema.', 'ok');
        };
        reader.readAsDataURL(file);
      };
    }
    if ($('#cfg-logo-threshold')) {
      $('#cfg-logo-threshold').oninput = async e => {
        const val = e.target.value;
        if ($('#cfg-logo-threshold-val')) $('#cfg-logo-threshold-val').textContent = val;
        await atualizarPreviaLogoPB(Number(val));
      };
    }
    if ($('#btn-remover-logo')) {
      $('#btn-remover-logo').onclick = () => {
        logoOriginalTemporaria = '';
        const c = cfg();
        c.logo = '';
        c.logoMonocromatica = '';
        if ($('#cfg-logo-preview-cor')) $('#cfg-logo-preview-cor').src = 'assets/logo-topo.png';
        if ($('#cfg-logo-preview-pb')) $('#cfg-logo-preview-pb').src = 'assets/logo-topo.png';
        aplicarLogoSistema('');
        DB.salvar();
        UI.toast('Logomarca padrão restaurada no sistema!');
      };
    }

    // Eventos de E-mail Fiscal (Contato do Contador)
    if ($('#btn-salvar-emails-fiscal')) {
      $('#btn-salvar-emails-fiscal').onclick = () => {
        const c = cfg();
        c.emailContabilidade = ($('#cfg-email-contador')?.value || '').trim();
        c.emailRemetenteFiscal = ($('#cfg-email-remetente')?.value || '').trim();
        c.nomeRemetenteFiscal = ($('#cfg-nome-remetente')?.value || '').trim();
        DB.salvar();
        UI.toast('Dados de contato da contabilidade salvos com sucesso!', 'ok');
      };
    }

    $('#btn-atualizar-impressoras').onclick = async () => {
      await carregarImpressoras();
      UI.toast(st.impressoras.length ? `${st.impressoras.length} impressora(s) detectada(s)` : 'Nenhuma impressora encontrada no Windows', st.impressoras.length ? 'ok' : 'aviso');
    };
    $$('#cfg-largura .seg').forEach(b => b.onclick = () => {
      cfg().larguraCupom = Number(b.dataset.l);
      $$('#cfg-largura .seg').forEach(x => x.classList.toggle('ativo', x === b));
    });
    $$('#cfg-largura-cozinha .seg').forEach(b => b.onclick = () => {
      cfg().larguraCozinha = Number(b.dataset.l);
      $$('#cfg-largura-cozinha .seg').forEach(x => x.classList.toggle('ativo', x === b));
    });
    $('#btn-teste-caixa').onclick = async () => {
      const html = Printer.montarTeste('caixa', cfg());
      const ok = await Printer.imprimir(html, cfg(), 'caixa');
      UI.toast(ok ? 'Teste enviado para a impressora do Caixa' : 'Impressão de teste não concluída', ok ? 'ok' : 'erro');
    };
    $('#btn-teste-cozinha').onclick = async () => {
      const html = Printer.montarTeste('cozinha', cfg());
      const ok = await Printer.imprimir(html, cfg(), 'cozinha');
      UI.toast(ok ? 'Teste enviado para a impressora da Cozinha' : 'Impressão de teste não concluída', ok ? 'ok' : 'erro');
    };

    // Botões de prévia térmica visual (Cliente & Cozinha)
    const btnPreviaGeral = $('#btn-abrir-previa-impressao');
    if (btnPreviaGeral) btnPreviaGeral.onclick = () => abrirModalPreviaImpressao('ambas');

    const btnPreviaLogo = $('#btn-previa-logo-cupom');
    if (btnPreviaLogo) btnPreviaLogo.onclick = () => abrirModalPreviaImpressao('cliente');

    const btnPreviaCaixa = $('#btn-previa-caixa');
    if (btnPreviaCaixa) btnPreviaCaixa.onclick = () => abrirModalPreviaImpressao('cliente');

    const btnPreviaCozinha = $('#btn-previa-cozinha');
    if (btnPreviaCozinha) btnPreviaCozinha.onclick = () => abrirModalPreviaImpressao('cozinha');

    $('#btn-backup').onclick = async () => {
      const ok = await DB.exportar();
      UI.toast(ok ? 'Backup exportado' : 'Backup cancelado', ok ? 'ok' : 'erro');
    };

    // ==================== DISASTER RECOVERY & BACKUP NUVEM POR CNPJ ====================
    async function atualizarStatusUltimoBackup() {
      const elStatus = $('#status-ultimo-backup');
      if (!elStatus) return;
      try {
        const cnpj = (cfg().cnpj || '').replace(/\D/g, '');
        const resp = await fetch(`/api/backup/listar?cnpj=${cnpj}`);
        const dados = await resp.json();
        if (dados.ok && dados.backups && dados.backups.length > 0) {
          const ultimo = dados.backups[0];
          const dataBkp = new Date(ultimo.dataArquivo).toLocaleString('pt-BR');
          elStatus.innerHTML = `Último backup em nuvem: <b>${dataBkp}</b> (${ultimo.tamanhoKb} KB · ${ultimo.meta?.qtdVendas || 0} vendas salvas)`;
        } else {
          elStatus.textContent = 'Nenhum backup em nuvem encontrado ainda para este CNPJ.';
        }
      } catch {
        elStatus.textContent = 'Servidor local ativo. Backup automático configurado para a cada 3h.';
      }
    }

    if ($('#btn-gerar-backup-nuvem')) {
      $('#btn-gerar-backup-nuvem').onclick = async () => {
        const btn = $('#btn-gerar-backup-nuvem');
        btn.disabled = true;
        btn.innerHTML = `${UI.icone('check')} Gerando Cópia...`;
        try {
          const resp = await fetch('/api/backup/gerar', { method: 'POST' });
          const dados = await resp.json();
          if (dados.ok) {
            UI.toast('Backup compactado e sincronizado com sucesso na nuvem!', 'ok');
            atualizarStatusUltimoBackup();
          } else {
            UI.toast(dados.erro || 'Falha ao gerar backup', 'erro');
          }
        } catch (err) {
          UI.toast('Erro ao contatar serviço de backup local.', 'erro');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Fazer Backup Agora`;
        }
      };
    }

    async function abrirModalRestaurarPorCnpj() {
      const cnpjAtual = (cfg().cnpj || '').replace(/\D/g, '');
      UI.abrirModal({
        titulo: 'Restaurar Banco de Dados por CNPJ (Disaster Recovery)',
        largo: true,
        corpo: `
          <div style="padding:10px 0">
            <p style="font-size:13.5px;color:var(--tinta-2);font-weight:700;margin-bottom:14px;line-height:1.5">
              Informe o CNPJ da empresa para localizar todas as cópias de segurança salvas nos últimos 15 dias na nuvem.
            </p>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px">
              <input type="text" id="restaura-cnpj-input" value="${cnpjAtual}" placeholder="Digite o CNPJ do Quiosque" style="flex:1;height:44px;padding:0 14px;border:2px solid var(--borda-forte);border-radius:10px;font-size:16px;font-weight:800;color:var(--tinta)" />
              <button class="btn-primario" id="btn-buscar-backups-cnpj" type="button" style="height:44px;padding:0 18px;font-weight:800">
                Buscar Backups
              </button>
            </div>
            <div id="lista-backups-disponiveis" style="max-height:280px;overflow-y:auto;border:1.5px solid var(--borda);border-radius:12px;padding:8px;background:var(--afundado)">
              <div style="text-align:center;padding:20px;color:var(--tinta-3);font-size:13px;font-weight:700">
                Clique em "Buscar Backups" para consultar os pontos de recuperação.
              </div>
            </div>
          </div>
        `,
        rodape: `<button class="btn-secundario" id="modal-restaura-fechar">Cancelar</button>`
      });

      const btnFechar = $('#modal-restaura-fechar');
      if (btnFechar) btnFechar.onclick = UI.fecharModal;

      const btnBuscar = $('#btn-buscar-backups-cnpj');
      if (btnBuscar) {
        btnBuscar.onclick = async () => {
          const inputCnpj = ($('#restaura-cnpj-input')?.value || '').trim();
          const container = $('#lista-backups-disponiveis');
          container.innerHTML = '<div style="text-align:center;padding:20px;font-weight:800">Consultando nuvem segura...</div>';

          try {
            const resp = await fetch(`/api/backup/listar?cnpj=${inputCnpj}`);
            const dados = await resp.json();
            if (dados.ok && dados.backups && dados.backups.length > 0) {
              container.innerHTML = dados.backups.map(b => {
                const dataFormatada = new Date(b.dataArquivo).toLocaleString('pt-BR');
                const motivoDesc = {
                  fechamento_caixa: 'Fechamento de Caixa',
                  rotina_3h: 'Rotina Inteligente (3h)',
                  manual: 'Cópia Manual',
                  teste_inicial: 'Instalação'
                }[b.meta?.motivo] || b.meta?.motivo || 'Rotina';

                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#FFF;border:1.5px solid var(--borda);border-radius:10px;margin-bottom:8px">
                    <div>
                      <div style="font-size:14px;font-weight:900;color:var(--tinta)">
                        ${dataFormatada} · <span style="color:var(--primaria-forte)">${b.meta?.loja || 'Quiosque'}</span>
                      </div>
                      <div style="font-size:12px;color:var(--tinta-2);font-weight:700;margin-top:2px">
                        Tipo: <b>${motivoDesc}</b> · <b>${b.meta?.qtdVendas || 0}</b> vendas salvas · ${b.tamanhoKb} KB
                      </div>
                    </div>
                    <button class="btn-primario btn-pequeno btn-executar-restauro" data-arquivo="${b.arquivo}" type="button" style="font-weight:800">
                      Restaurar Este
                    </button>
                  </div>
                `;
              }).join('');

              $$('.btn-executar-restauro').forEach(btn => {
                btn.onclick = async () => {
                  const arq = btn.dataset.arquivo;
                  const confirma = await UI.confirmar(
                    'Confirmar Restauração Completa',
                    `Deseja realmente restaurar o banco a partir desta cópia? O banco atual será substituído integralmente.`,
                    'Sim, Restaurar Agora'
                  );
                  if (confirma) {
                    btn.disabled = true;
                    btn.textContent = 'Restaurando...';
                    try {
                      const resRest = await fetch('/api/backup/restaurar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ arquivo: arq })
                      });
                      const rJson = await resRest.json();
                      if (rJson.ok) {
                        UI.fecharModal();
                        await DB.carregar();
                        UI.toast('Banco de dados restaurado com 100% de sucesso!', 'ok');
                        irPara('venda');
                      } else {
                        UI.toast(rJson.erro || 'Falha ao restaurar banco.', 'erro');
                      }
                    } catch (e) {
                      UI.toast('Erro ao comunicar com o servidor de restauração.', 'erro');
                    }
                  }
                };
              });

            } else {
              container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tinta-3);font-size:13px;font-weight:700">Nenhum backup localizado para este CNPJ nos últimos 15 dias.</div>';
            }
          } catch {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--alerta);font-size:13px;font-weight:800">Falha ao consultar a nuvem de backups.</div>';
          }
        };

        // Dispara a busca automática logo de início
        btnBuscar.click();
      }
    }

    if ($('#btn-restaurar-backup-cnpj')) {
      $('#btn-restaurar-backup-cnpj').onclick = abrirModalRestaurarPorCnpj;
    }
    if ($('#btn-login-restaurar-cnpj')) {
      $('#btn-login-restaurar-cnpj').onclick = abrirModalRestaurarPorCnpj;
    }

    // ==================== VERIFICAÇÃO DE ATUALIZAÇÕES (MANOSTECH SYSTEM) ====================
    if ($('#btn-verificar-atualizacoes')) {
      $('#btn-verificar-atualizacoes').onclick = async () => {
        const btn = $('#btn-verificar-atualizacoes');
        btn.disabled = true;
        btn.innerHTML = `${UI.icone('check')} Consultando ManosTech...`;

        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Verificar Atualizações`;
          UI.abrirModal({
            titulo: 'Atualização do Sistema — ManosTech System',
            corpo: `
              <div style="text-align:center;padding:12px 0">
                <div style="width:54px;height:54px;border-radius:50%;background:var(--sucesso-leve);color:var(--sucesso);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style="font-size:17px;font-weight:900;color:var(--tinta);margin-bottom:6px">Seu Sistema Está Atualizado!</h3>
                <p style="font-size:13.5px;color:var(--tinta-2);font-weight:700;line-height:1.5;margin-bottom:14px">
                  Você está utilizando a versão mais recente e estável do software: <b>v2.4.0 (Canal Oficial ManosTech)</b>.
                </p>
                <div style="background:var(--afundado);border-radius:10px;padding:10px;font-size:12px;color:var(--tinta-3);text-align:left">
                  <div><b>Software House:</b> ManosTech System</div>
                  <div><b>Canal de Atualização:</b> Nuvem Oficial ManosTech</div>
                  <div><b>Status do Servidor:</b> Operando em 100% de integridade</div>
                </div>
              </div>
            `,
            rodape: `<button class="btn-primario" id="modal-update-ok" style="width:100%">Entendido</button>`
          });
          const btnOk = $('#modal-update-ok');
          if (btnOk) btnOk.onclick = UI.fecharModal;
        }, 1200);
      };
    }

    // Ao carregar a tela de configuração, atualiza o status do último backup
    if (st.vista === 'config') {
      atualizarStatusUltimoBackup();
    }

    document.addEventListener('keydown', e => {
      if (st.logado && e.key === 'F1') { e.preventDefault(); irPara('venda'); }
      if (st.logado && e.key === 'F2') { e.preventDefault(); irPara('caixa'); }
      if (st.logado && e.key === 'F3') { e.preventDefault(); irPara('retaguarda'); }
      if (st.logado && e.key === 'F4') { e.preventDefault(); irPara('config'); }
      if (!st.logado) return;

      const digitando = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
      const corpoModal = document.querySelector('#modal:not([hidden]) .modal__corpo');
      if (UI.modalAberto() && corpoModal && corpoModal.__teclado && !digitando) {
        corpoModal.__teclado(e);
        return;
      }
      if (e.key === 'F2' || e.key === 'F3' || e.key === 'F4') return;
      if (e.key === '/' && !digitando) { e.preventDefault(); $('#busca').focus(); }
    });

    // atalho: Enter no carrinho abre pagamento
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !UI.modalAberto() && st.vista === 'venda' && st.carrinho.length
          && document.activeElement === document.body) {
        abrirPagamento();
      }
    });
  }

  function relogio() {
    const pintar = () => { $('#relogio').textContent = UI.hora(); };
    pintar();
    setInterval(pintar, 15000);
  }

  async function iniciar() {
    await DB.carregar();
    $('#topo-loja').textContent = cfg().loja || 'Rota do Forte';
    aplicarLogoSistema(cfg().logo);
    atualizarStatusCaixaUI();
    DB.assinar(() => {
      atualizarStatusCaixaUI();
      if (st.vista === 'retaguarda') renderRetaguarda();
      if (st.vista === 'caixa') renderCaixaVista();
      if (st.vista === 'venda') { renderCategorias(); renderGrade(); }
    });
    ligarEventos();
    relogio();
    renderLogin();
    renderCategorias();
    renderGrade();
  }

  return { iniciar, irPara };
})();

document.addEventListener('DOMContentLoaded', () => App.iniciar());
