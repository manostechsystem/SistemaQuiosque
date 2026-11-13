/* Camada de dados: estado em memória + persistência em JSON via preload. */

const DB = (() => {
  const estado = {
    categorias: [],
    produtos: [],
    vendas: [],
    ajustes: [],
    caixas: [],
    funcionarios: [],
    compras: [],
    alertasEstoque: [],
    config: {}
  };

  const PADRAO = {
    categorias: [
      { id: 'cat-bebidas', nome: 'Bebidas', ordem: 1 },
      { id: 'cat-comidas', nome: 'Alimentos & Refeições', ordem: 2 },
      { id: 'cat-sobremesas', nome: 'Sobremesas & Doces', ordem: 3 },
      { id: 'cat-servicos', nome: 'Serviços & Diversos', ordem: 4 },
      { id: 'cat-outros', nome: 'Outros', ordem: 5 }
    ],
    produtos: [],
    vendas: [],
    ajustes: [],
    caixas: [],
    funcionarios: [],
    compras: [],
    alertasEstoque: [],
    lotesContabeis: [],
    config: {
      configurado: false,
      loja: '',
      cnpj: '',
      endereco: '',
      telefone: '',
      larguraCupom: 80,
      impressoraSilenciosa: false,
      ultimoCupom: 0,
      dataUltimaComanda: '',
      ultimoNumeroComanda: 0,
      impressoraCaixa: '',
      impressoraCozinha: '',
      cozinhaAtiva: true,
      larguraCozinha: 80,
      comandaVias: 1,
      semeado: false,
      versaoCatalogo: 3,
      logo: '',
      logoMonocromatica: '',
      imprimirLogoCupom: true,
      emailContabilidade: '',
      emailRemetenteFiscal: '',
      nomeRemetenteFiscal: ''
    }
  };

  const ouvintes = new Set();
  let timerSalvar = null;

  function id(prefixo) {
    return prefixo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function arred(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function moeda(n) {
    return 'R$ ' + arred(n || 0).toFixed(2).replace('.', ',');
  }
  function numeroCupom(n) { return String(n).padStart(4, '0'); }
  function numeroComanda(n) { return String(n || 1).padStart(3, '0'); }

  function obterProximoNumeroComanda(dataIso = new Date().toISOString()) {
    const dataDia = (dataIso || '').slice(0, 10) || hoje();
    // Vendas de hoje
    const vendasHoje = (estado.vendas || []).filter(v => (v.data || '').slice(0, 10) === dataDia);
    const maxComandaHoje = vendasHoje.reduce((max, v) => Math.max(max, Number(v.numeroComanda) || 0), 0);
    const ultimoCfg = (estado.config.dataUltimaComanda === dataDia) ? (Number(estado.config.ultimoNumeroComanda) || 0) : 0;
    return Math.max(maxComandaHoje, ultimoCfg) + 1;
  }

  function hoje() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function categorias() {
    if (!estado.categorias.some(c => c.id === 'cat-outros' || /outro/i.test(c.nome))) {
      estado.categorias.push({ id: 'cat-outros', nome: 'Outros', ordem: 99 });
    }
    return [...estado.categorias].sort((a, b) => a.ordem - b.ordem);
  }

  function nomeCategoria(id) {
    return (estado.categorias.find(c => c.id === id) || {}).nome || 'Sem categoria';
  }

  function alertar() { ouvintes.forEach(fn => fn()); }

  async function carregar() {
    let dados = null;
    try { dados = await window.pdv.ler(); } catch { dados = null; }
    if (!dados) dados = structuredClone(PADRAO);

    estado.categorias = dados.categorias?.length ? dados.categorias : structuredClone(PADRAO.categorias);
    estado.produtos = dados.produtos || [];
    estado.vendas = dados.vendas || [];
    estado.ajustes = dados.ajustes || [];
    estado.caixas = dados.caixas || [];
    estado.funcionarios = dados.funcionarios || [];
    estado.compras = dados.compras || [];
    estado.alertasEstoque = dados.alertasEstoque || [];
    estado.lotesContabeis = dados.lotesContabeis || [];
    const versaoCarregada = dados.config?.versaoCatalogo || 0;
    estado.config = { ...PADRAO.config, ...(dados.config || {}) };
    estado.config.versaoCatalogo = versaoCarregada;

    // Inicialização e consistência da comanda diária (todo dia zera a contagem)
    if (!estado.config.dataUltimaComanda) {
      estado.config.dataUltimaComanda = hoje();
      estado.config.ultimoNumeroComanda = 0;
    }
    const contadoresDia = {};
    (estado.vendas || []).forEach(v => {
      const dia = (v.data || '').slice(0, 10) || hoje();
      if (contadoresDia[dia] == null) contadoresDia[dia] = 0;
      if (!v.numeroComanda) {
        contadoresDia[dia]++;
        v.numeroComanda = contadoresDia[dia];
      } else {
        contadoresDia[dia] = Math.max(contadoresDia[dia], Number(v.numeroComanda) || 0);
      }
    });

    // Primeiro uso: cria o administrador padrão (admin / admin).
    if (!estado.funcionarios.length) {
      estado.funcionarios.push({
        id: 'func-admin',
        nome: 'Administrador',
        usuario: 'admin',
        senha: await window.pdv.hashSenha('admin'),
        papel: 'admin',
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      await salvar();
    }

    if (!estado.config.semeado) {
      estado.config.semeado = true;
      estado.config.versaoCatalogo = 3;
      await salvar();
    }
    estado.produtos.forEach(p => {
      if (p.controlaEstoque && (p.estoqueMinimo == null || isNaN(p.estoqueMinimo))) {
        p.estoqueMinimo = /água|agua/i.test(p.nome) ? 30 : 5;
      }
    });
    verificarAlertasEstoque();
    alertar();
    return estado;
  }

  function salvar() {
    clearTimeout(timerSalvar);
    return new Promise(resolve => {
      timerSalvar = setTimeout(async () => {
        try { resolve(await window.pdv.salvar(JSON.parse(JSON.stringify(estado)))); }
        catch { resolve(false); }
      }, 120);
    });
  }

  /* --------- funcionários --------- */
  function funcionarios() {
    return [...estado.funcionarios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function funcionario(id) { return estado.funcionarios.find(f => f.id === id) || null; }

  async function salvarFuncionario(dados) {
    const base = {
      nome: (dados.nome || '').trim(),
      usuario: (dados.usuario || '').trim().toLowerCase(),
      papel: dados.papel === 'admin' ? 'admin' : 'caixa',
      tipoPagamento: dados.tipoPagamento === 'diaria' ? 'diaria' : 'mensal',
      valorPagamento: arred(Number(dados.valorPagamento) || 0),
      ativo: dados.ativo !== false
    };
    if (!base.nome) throw new Error('Informe o nome.');
    if (!base.usuario) throw new Error('Informe o usuário de acesso.');
    if (estado.funcionarios.some(f => f.usuario === base.usuario && f.id !== dados.id)) {
      throw new Error('Já existe alguém com esse usuário.');
    }

    const senha = (dados.senha || '').trim();
    if (!dados.id && !senha) throw new Error('Defina uma senha inicial.');

    if (dados.id) {
      const f = funcionario(dados.id);
      if (!f) throw new Error('Funcionário não encontrado.');
      Object.assign(f, base);
      if (senha) f.senha = await window.pdv.hashSenha(senha);
    } else {
      estado.funcionarios.push({
        id: id('func'),
        ...base,
        senha: await window.pdv.hashSenha(senha),
        criadoEm: new Date().toISOString()
      });
    }
    salvar(); alertar();
  }

  function excluirFuncionario(fid) {
    const i = estado.funcionarios.findIndex(f => f.id === fid);
    if (i >= 0) estado.funcionarios.splice(i, 1);
    salvar(); alertar();
  }

  async function conferirLogin(usuario, senha) {
    const u = String(usuario || '').trim().toLowerCase();
    const f = estado.funcionarios.find(x => x.usuario === u);
    if (!f || !f.ativo) return null;
    const ok = await window.pdv.conferirSenha(senha, f.senha);
    return ok ? f : null;
  }

  /* --------- categorias --------- */
  function salvarCategoria(dados) {
    const nome = (dados.nome || '').trim();
    if (!nome) throw new Error('Informe o nome da categoria.');
    if (dados.id) {
      const c = estado.categorias.find(x => x.id === dados.id);
      if (!c) throw new Error('Categoria não encontrada.');
      c.nome = nome;
      if (dados.ordem) c.ordem = Number(dados.ordem);
    } else {
      const ordem = Number(dados.ordem) || (Math.max(0, ...estado.categorias.map(c => c.ordem)) + 1);
      estado.categorias.push({ id: id('cat'), nome, ordem });
    }
    salvar(); alertar();
  }

  function excluirCategoria(cid) {
    const usados = estado.produtos.filter(p => p.categoriaId === cid).length;
    if (usados) throw new Error(`${usados} produto(s) usam essa categoria. Mova-os antes de excluir.`);
    const i = estado.categorias.findIndex(c => c.id === cid);
    if (i >= 0) estado.categorias.splice(i, 1);
    salvar(); alertar();
  }

  /* --------- caixa (abertura, movimentos, fechamento) --------- */
  function caixaAberto() { return estado.caixas.find(c => !c.fechadoEm) || null; }

  function vendasDoCaixa(cid) { return estado.vendas.filter(v => v.caixaId === cid); }

  function resumoCaixa(caixa) {
    const vendas = vendasDoCaixa(caixa.id);
    const faturamento = arred(vendas.reduce((s, v) => s + v.total, 0));
    const porPagamento = {};
    const mapaProd = {};
    vendas.forEach(v => {
      porPagamento[v.pagamento] = arred((porPagamento[v.pagamento] || 0) + v.total);
      v.itens.forEach(i => {
        const m = mapaProd[i.produtoId] || (mapaProd[i.produtoId] = { nome: i.nome, qtd: 0, total: 0 });
        m.qtd += i.qtd;
        m.total = arred(m.total + i.preco * i.qtd);
      });
    });
    const sangrias = arred(caixa.sangrias.reduce((s, m) => s + m.valor, 0));
    const suprimentos = arred(caixa.suprimentos.reduce((s, m) => s + m.valor, 0));
    const dinheiro = porPagamento.dinheiro || 0;
    return {
      qtdVendas: vendas.length,
      faturamento,
      ticket: vendas.length ? arred(faturamento / vendas.length) : 0,
      porPagamento,
      maisVendidos: Object.values(mapaProd).sort((a, b) => b.qtd - a.qtd).slice(0, 12),
      sangrias,
      suprimentos,
      dinheiro,
      esperado: arred(caixa.fundo + dinheiro + suprimentos - sangrias)
    };
  }

  function abrirCaixa(fundo, operador) {
    if (caixaAberto()) throw new Error('Já existe um caixa aberto.');
    const caixa = {
      id: id('cx'),
      abertoEm: new Date().toISOString(),
      fechadoEm: null,
      operador: operador || '—',
      fundo: arred(fundo || 0),
      sangrias: [],
      suprimentos: [],
      esperado: null,
      contado: null,
      diferenca: null,
      resumo: null
    };
    estado.caixas.push(caixa);
    salvar(); alertar();
    return caixa;
  }

  function registrarMovimento(tipo, valor, motivo, por) {
    const caixa = caixaAberto();
    if (!caixa) throw new Error('Nenhum caixa aberto.');
    const v = arred(valor);
    if (!(v > 0)) throw new Error('Informe um valor maior que zero.');
    if (tipo === 'sangria') {
      if (v > resumoCaixa(caixa).esperado) throw new Error('Retirada maior que o dinheiro em caixa.');
      caixa.sangrias.push({ id: id('mov'), data: new Date().toISOString(), valor: v, motivo: motivo || 'Retirada', por });
    } else {
      caixa.suprimentos.push({ id: id('mov'), data: new Date().toISOString(), valor: v, motivo: motivo || 'Reforço', por });
    }
    salvar(); alertar();
  }

  function fecharCaixa(contado, por) {
    const caixa = caixaAberto();
    if (!caixa) throw new Error('Nenhum caixa aberto.');
    const r = resumoCaixa(caixa);
    caixa.resumo = { qtdVendas: r.qtdVendas, faturamento: r.faturamento, porPagamento: r.porPagamento };
    caixa.esperado = r.esperado;
    caixa.contado = arred(contado || 0);
    caixa.diferenca = arred(caixa.contado - caixa.esperado);
    caixa.fechadoEm = new Date().toISOString();
    caixa.fechadoPor = por || caixa.operador;
    salvar(); alertar();
    return caixa;
  }

  function caixasFechados() {
    return estado.caixas
      .filter(c => c.fechadoEm)
      .sort((a, b) => new Date(b.fechadoEm) - new Date(a.fechadoEm));
  }

  /* --------- produtos --------- */
  function produtos() { return estado.produtos; }

  function produto(id) { return estado.produtos.find(p => p.id === id); }

  function salvarProduto(dados) {
    const base = {
      nome: (dados.nome || '').trim(),
      preco: arred(dados.preco || 0),
      categoriaId: dados.categoriaId || estado.categorias[0]?.id,
      tipo: dados.tipo || 'produto',
      codigo: (dados.codigo || '').trim(),
      controlaEstoque: !!dados.controlaEstoque,
      estoque: Number(dados.estoque) || 0,
      estoqueMinimo: dados.estoqueMinimo != null && !isNaN(dados.estoqueMinimo) ? Math.max(0, Number(dados.estoqueMinimo)) : 5,
      vaiParaCozinha: !!dados.vaiParaCozinha,
      acessoRapido: !!dados.acessoRapido,
      opcoes: Array.isArray(dados.opcoes) ? dados.opcoes : null
    };
    if (!base.nome) throw new Error('Informe o nome do produto.');
    if (!(base.preco > 0)) throw new Error('Informe um preço maior que zero.');

    if (dados.id) {
      const p = produto(dados.id);
      if (!p) throw new Error('Produto não encontrado.');
      Object.assign(p, base);
    } else {
      estado.produtos.push({ id: id('prod'), ...base });
    }
    verificarAlertasEstoque();
    salvar(); alertar();
  }

  function alternarAcessoRapido(pid) {
    const p = produto(pid);
    if (!p) return false;
    p.acessoRapido = !p.acessoRapido;
    salvar(); alertar();
    return p.acessoRapido;
  }

  function produtoVaiParaCozinha(pid) {
    const p = produto(pid);
    if (!p) return false;
    if (typeof p.vaiParaCozinha === 'boolean') return p.vaiParaCozinha;
    return p.categoriaId === 'cat-pasteis' || /pastel/i.test(p.nome);
  }

  function excluirProduto(pid) {
    const i = estado.produtos.findIndex(p => p.id === pid);
    if (i >= 0) estado.produtos.splice(i, 1);
    salvar(); alertar();
  }

  function ajustarEstoque(pid, novaQtd, motivo) {
    const p = produto(pid);
    if (!p) return;
    const anterior = p.estoque;
    p.estoque = Number(novaQtd) || 0;
    estado.ajustes.push({
      id: id('aj'),
      data: new Date().toISOString(),
      produtoId: pid,
      de: anterior,
      para: p.estoque,
      motivo: motivo || 'Ajuste manual'
    });
    verificarAlertasEstoque();
    salvar(); alertar();
  }

  function estoqueBaixo(p) {
    if (!p || !p.controlaEstoque) return false;
    const min = p.estoqueMinimo != null && !isNaN(p.estoqueMinimo) ? Number(p.estoqueMinimo) : 5;
    return p.estoque <= min;
  }

  function verificarAlertasEstoque() {
    if (!estado.alertasEstoque) estado.alertasEstoque = [];
    const prods = estado.produtos.filter(p => p.controlaEstoque);
    const hojeStr = new Date().toISOString().slice(0, 10);
    let alterou = false;
    const novos = [];

    prods.forEach(p => {
      const min = p.estoqueMinimo != null && !isNaN(p.estoqueMinimo) ? Number(p.estoqueMinimo) : 5;
      if (p.estoque <= min) {
        const jaRegistrouHoje = estado.alertasEstoque.some(a =>
          a.produtoId === p.id && a.data && a.data.slice(0, 10) === hojeStr
        );
        if (!jaRegistrouHoje) {
          const alerta = {
            id: id('alt'),
            data: new Date().toISOString(),
            produtoId: p.id,
            produtoNome: p.nome,
            categoriaId: p.categoriaId,
            estoqueAtual: p.estoque,
            estoqueMinimo: min,
            urgencia: p.estoque <= 0 ? 'zerado' : 'baixo'
          };
          estado.alertasEstoque.unshift(alerta);
          novos.push(alerta);
          alterou = true;
        }
      }
    });

    if (alterou) {
      salvar();
      alertar();
    }
    return novos;
  }

  function alertasEstoque() {
    return (estado.alertasEstoque || []).slice().sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  function produtosAbaixoDoMinimo() {
    return estado.produtos.filter(p => p.controlaEstoque && p.estoque <= (p.estoqueMinimo != null && !isNaN(p.estoqueMinimo) ? Number(p.estoqueMinimo) : 5));
  }

  /* --------- entradas de estoque (XML NF-e) --------- */
  function darEntradaEstoque(pid, qtdEntrada, motivo, custoUnitario, codigoBarras) {
    const p = produto(pid);
    if (!p) throw new Error('Produto não encontrado para entrada.');
    const anterior = Number(p.estoque) || 0;
    const qtdNum = Number(qtdEntrada) || 0;
    p.estoque = anterior + qtdNum;
    p.controlaEstoque = true;
    if (codigoBarras && !p.codigo) {
      p.codigo = String(codigoBarras).trim();
    }
    if (custoUnitario && Number(custoUnitario) > 0) {
      p.custo = Number(custoUnitario);
    }
    estado.ajustes.push({
      id: id('aj'),
      data: new Date().toISOString(),
      produtoId: pid,
      de: anterior,
      para: p.estoque,
      qtd: qtdNum,
      motivo: motivo || 'Entrada por XML'
    });
    salvar(); alertar();
    return p;
  }

  function registrarNotaEntrada(dadosNota) {
    if (!estado.compras) estado.compras = [];
    const registro = {
      id: id('compra'),
      chave: dadosNota.chave || '',
      numero: dadosNota.numero || '',
      fornecedor: dadosNota.fornecedor || 'Fornecedor',
      cnpjFornecedor: dadosNota.cnpjFornecedor || '',
      dataEmissao: dadosNota.dataEmissao || '',
      dataImportacao: new Date().toISOString(),
      valorTotal: dadosNota.valorTotal || 0,
      itens: dadosNota.itens || []
    };
    estado.compras.push(registro);
    salvar(); alertar();
    return registro;
  }

  function comprasImportadas() {
    return (estado.compras || []).slice().sort((a, b) => new Date(b.dataImportacao) - new Date(a.dataImportacao));
  }

  /* --------- vendas --------- */
  function registrarVenda({ itens, desconto, pagamento, recebido, operador, cliente, obsCozinha }) {
    if (!itens.length) throw new Error('Carrinho vazio.');
    const cx = caixaAberto();
    if (!cx) throw new Error('Abra o caixa para vender.');
    const subtotal = arred(itens.reduce((s, i) => s + i.preco * i.qtd, 0));
    const desc = arred(Math.min(desconto || 0, subtotal));
    const total = arred(subtotal - desc);
    const numero = (estado.config.ultimoCupom || 0) + 1;
    const agoraIso = new Date().toISOString();
    const dataDia = agoraIso.slice(0, 10);
    const numeroComanda = obterProximoNumeroComanda(agoraIso);

    const venda = {
      id: id('v'),
      numero,
      numeroComanda,
      data: agoraIso,
      itens: itens.map(i => ({
        ...i,
        vaiParaCozinha: i.vaiParaCozinha != null ? !!i.vaiParaCozinha : produtoVaiParaCozinha(i.produtoId)
      })),
      subtotal,
      desconto: desc,
      total,
      pagamento,
      recebido: recebido == null ? total : arred(recebido),
      troco: recebido == null ? 0 : arred(Math.max(0, recebido - total)),
      caixaId: cx.id,
      operador: operador || '—',
      cliente: (cliente || '').trim(),
      obsCozinha: (obsCozinha || '').trim()
    };

    estado.vendas.push(venda);
    estado.config.ultimoCupom = numero;
    estado.config.dataUltimaComanda = dataDia;
    estado.config.ultimoNumeroComanda = numeroComanda;

    itens.forEach(i => {
      const p = produto(i.produtoId);
      if (p && p.controlaEstoque) p.estoque = Math.max(0, p.estoque - i.qtd);
    });
    verificarAlertasEstoque();

    salvar(); alertar();
    return venda;
  }

  function vendasNoPeriodo(dias) {
    const agora = new Date();
    let inicio;
    if (dias === 'hoje') {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    } else {
      inicio = new Date(agora.getTime() - Number(dias) * 86400000);
      inicio.setHours(0, 0, 0, 0);
    }
    return estado.vendas.filter(v => new Date(v.data) >= inicio).sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  /* --------- lotes contábeis para contador --------- */
  function salvarLoteContabil(lote) {
    if (!estado.lotesContabeis) estado.lotesContabeis = [];
    const novoLote = {
      id: lote.id || id('lote'),
      geradoEm: new Date().toISOString(),
      periodo: lote.periodo || '',
      dataInicio: lote.dataInicio || '',
      dataFim: lote.dataFim || '',
      qtdVendas: Number(lote.qtdVendas) || 0,
      totalDeclarado: Number(lote.totalDeclarado) || 0,
      vendasDinheiroProtegidas: Number(lote.vendasDinheiroProtegidas) || 0,
      nomeArquivo: lote.nomeArquivo || 'lote-fiscal.xml',
      xmlConteudo: lote.xmlConteudo || '',
      statusEnvio: lote.statusEnvio || 'nao_enviado',
      enviadoEm: lote.enviadoEm || null,
      enviadoPara: lote.enviadoPara || '',
      enviadoPor: lote.enviadoPor || ''
    };
    estado.lotesContabeis.unshift(novoLote);
    salvar();
    alertar();
    return novoLote;
  }

  function lotesContabeis() {
    return (estado.lotesContabeis || []).slice().sort((a, b) => new Date(b.geradoEm) - new Date(a.geradoEm));
  }

  function marcarLoteEnviado(loteId, emailDestino, emailRemetente) {
    if (!estado.lotesContabeis) estado.lotesContabeis = [];
    const lote = estado.lotesContabeis.find(l => l.id === loteId);
    if (!lote) throw new Error('Lote fiscal não encontrado.');
    lote.statusEnvio = 'enviado';
    lote.enviadoEm = new Date().toISOString();
    lote.enviadoPara = emailDestino || estado.config.emailContabilidade || '';
    lote.enviadoPor = emailRemetente || estado.config.emailRemetenteFiscal || '';
    salvar();
    alertar();
    return lote;
  }

  function assinar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

  function exportar() { return window.pdv.exportarBackup(); }

  return {
    estado, carregar, salvar, assinar, alertar,
    produtos, produto, salvarProduto, excluirProduto, ajustarEstoque, estoqueBaixo, produtoVaiParaCozinha, alternarAcessoRapido,
    verificarAlertasEstoque, alertasEstoque, produtosAbaixoDoMinimo,
    darEntradaEstoque, registrarNotaEntrada, comprasImportadas,
    salvarLoteContabil, lotesContabeis, marcarLoteEnviado,
    categorias, nomeCategoria, salvarCategoria, excluirCategoria,
    funcionarios, funcionario, salvarFuncionario, excluirFuncionario, conferirLogin,
    caixaAberto, abrirCaixa, registrarMovimento, fecharCaixa, caixasFechados,
    vendasDoCaixa, resumoCaixa,
    registrarVenda, vendasNoPeriodo, exportar,
    arred, moeda, numeroCupom, numeroComanda, obterProximoNumeroComanda, hoje, id
  };
})();
