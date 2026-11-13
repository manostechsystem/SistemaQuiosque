/* Módulo Fiscal e Contábil:
   1. Parser de XML de notas fiscais de compra (NF-e) com conversão automática de fardo/caixa -> unitário.
   2. Geração e exportação do lote XML de vendas para a contabilidade (apenas PIX, Cartões de Débito e Crédito; DINHEIRO NUNCA É INCLUÍDO).
*/

const Fiscal = (() => {
  let configurado = false;

  function configurar({ ativo }) {
    configurado = !!ativo;
  }

  function emitir(venda, config) {
    if (!configurado) {
      return { ok: true, fiscal: false, mensagem: 'Cupom não fiscal' };
    }
    return { ok: false, fiscal: true, mensagem: 'Emissão fiscal ainda não configurada' };
  }

  /* ========================================================
     PARSER DE XML DE NOTA FISCAL DE COMPRA (NF-e)
     ======================================================== */
  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Tenta deduzir o fator de conversão de fardo/caixa/pack para unidades
  function deduzirFator(xProd, uCom, qCom, uTrib, qTrib) {
    // 1. Se na nota qTrib > qCom (ex: 20 fardos com qTrib = 240 unidades)
    if (qTrib > 0 && qCom > 0 && qTrib > qCom) {
      const divisao = Math.round(qTrib / qCom);
      if (divisao > 1) return divisao;
    }

    // 2. Procura padrões na descrição do produto:
    // Ex.: "FD C/ 12", "CX COM 24", "PACK C/6", "FARDO C/ 12 UN", "C/12", "X 12", "12UN"
    const desc = String(xProd || '').toUpperCase();
    const padroes = [
      /(?:FD|FARDO|CX|CAIXA|PACK|PCT|PACOTE)?\s*(?:C\/|COM|\*|X)\s*(\d+)/i,
      /\b(\d+)\s*(?:UN|UNID|GARR|LATAS|LATA|PCT)\b/i,
      /\bC(\d+)\b/i
    ];

    for (const regex of padroes) {
      const match = desc.match(regex);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n > 1 && n <= 1000) return n;
      }
    }

    // 3. Unidades comerciais comuns
    const u = String(uCom || '').trim().toUpperCase();
    if (u === 'DZ' || u === 'DUZIA') return 12;

    return 1;
  }

  // Parser do texto XML (usando DOMParser do navegador)
  function parsearXmlNfe(xmlTexto) {
    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(xmlTexto, 'text/xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Arquivo XML inválido ou corrompido.');
      }

      const infNFe = doc.querySelector('infNFe');
      if (!infNFe) {
        throw new Error('O arquivo selecionado não é uma NF-e válida (tag infNFe ausente).');
      }

      const chave = (infNFe.getAttribute('Id') || '').replace(/^NFe/, '');
      const nNF = doc.querySelector('ide > nNF')?.textContent?.trim() || '';
      const dhEmi = doc.querySelector('ide > dhEmi')?.textContent?.trim() || doc.querySelector('ide > dEmi')?.textContent?.trim() || '';
      const xNomeEmit = doc.querySelector('emit > xNome')?.textContent?.trim() || doc.querySelector('emit > xFant')?.textContent?.trim() || 'Fornecedor';
      const cnpjEmit = doc.querySelector('emit > CNPJ')?.textContent?.trim() || doc.querySelector('emit > CPF')?.textContent?.trim() || '';
      const vNF = Number(doc.querySelector('total > ICMSTot > vNF')?.textContent || 0);

      const detNodes = Array.from(doc.querySelectorAll('det'));
      const itens = detNodes.map((det, idx) => {
        const prod = det.querySelector('prod');
        if (!prod) return null;

        const cProd = prod.querySelector('cProd')?.textContent?.trim() || '';
        const cEAN = (prod.querySelector('cEAN')?.textContent?.trim() || '').replace(/SEM\s*GTIN/i, '');
        const xProd = prod.querySelector('xProd')?.textContent?.trim() || '';
        const ncm = prod.querySelector('NCM')?.textContent?.trim() || '';
        const uCom = (prod.querySelector('uCom')?.textContent?.trim() || 'UN').toUpperCase();
        const qCom = Number(prod.querySelector('qCom')?.textContent || 0);
        const vUnCom = Number(prod.querySelector('vUnCom')?.textContent || 0);
        const vProd = Number(prod.querySelector('vProd')?.textContent || 0);

        const uTrib = (prod.querySelector('uTrib')?.textContent?.trim() || '').toUpperCase();
        const qTrib = Number(prod.querySelector('qTrib')?.textContent || 0);
        const vUnTrib = Number(prod.querySelector('vUnTrib')?.textContent || 0);

        const fator = deduzirFator(xProd, uCom, qCom, uTrib, qTrib);
        const qtdFinal = DB.arred(qCom * fator);
        const custoUnitario = qtdFinal > 0 ? DB.arred(vProd / qtdFinal) : vUnCom;

        return {
          numItem: idx + 1,
          cProd,
          cEAN,
          xProd,
          ncm,
          uCom,
          qCom,
          vUnCom,
          vProd,
          uTrib,
          qTrib,
          fator,
          qtdFinal,
          custoUnitario
        };
      }).filter(Boolean);

      return {
        ok: true,
        chave,
        numero: nNF,
        dataEmissao: dhEmi,
        fornecedor: xNomeEmit,
        cnpjFornecedor: cnpjEmit,
        valorTotal: vNF,
        itens
      };
    } catch (err) {
      return { ok: false, erro: err.message || 'Falha ao processar arquivo XML.' };
    }
  }

  // Tenta encontrar o produto correspondente no catálogo do PDV
  function encontrarProdutoCorrespondente(itemXml, listaProdutos) {
    if (!listaProdutos || !listaProdutos.length) return null;

    // 1. Por código de barras (EAN)
    if (itemXml.cEAN) {
      const matchEan = listaProdutos.find(p => p.codigo && p.codigo.trim() === itemXml.cEAN.trim());
      if (matchEan) return matchEan;
    }

    // 2. Por código interno (se cadastrado)
    if (itemXml.cProd) {
      const matchCod = listaProdutos.find(p => p.codigo && p.codigo.trim() === itemXml.cProd.trim());
      if (matchCod) return matchCod;
    }

    // 3. Por similaridade de palavras-chave no nome
    const nomeXmlLimpo = itemXml.xProd.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(fd|fardo|cx|caixa|pack|pct|un|com|c|\d+ml|\d+l|\d+g)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const palavras = nomeXmlLimpo.split(' ').filter(p => p.length >= 3);
    if (!palavras.length) return null;

    let melhor = null;
    let maxAcertos = 0;

    for (const p of listaProdutos) {
      const nomeP = p.nome.toLowerCase();
      let acertos = 0;
      for (const termo of palavras) {
        if (nomeP.includes(termo)) acertos++;
      }
      if (acertos > maxAcertos && acertos >= 2) {
        maxAcertos = acertos;
        melhor = p;
      }
    }

    return melhor;
  }

  // Sugere a melhor categoria para um produto importado da NF-e com base no nome e NCM fiscal
  function sugerirCategoriaNfe(xProd, ncm, categoriasDisponiveis = []) {
    const desc = String(xProd || '').toLowerCase();
    const codNcm = String(ncm || '').trim();

    // 1. Padrões de Bebidas (NCM capítulo 22 ou palavras-chave)
    const isBebida = codNcm.startsWith('22') ||
      /\b(cerveja|chopp|chop|refrigerante|refri|coca|fanta|sprite|guaran[aá]|pepsi|suco|nectar|água|agua|ice|energ[eé]tico|red bull|monster|vodka|gin|vinho|whisky|whiskey|rum|campari|cacha[cç]a|tequila|licor|espumante|gelo|t[oó]nica|corona|brahma|heineken|amstel|skol|antarctica|budweiser|stella)\b/i.test(desc);

    // 2. Padrões de Alimentos / Cozinha / Refeições (NCM 02, 04, 16, 19, 20, 21)
    const isAlimento = /^(02|04|16|19|20|21)/.test(codNcm) ||
      /\b(pastel|lanche|burguer|burger|batata|frango|carne|picanha|calabresa|queijo|mussarela|presunto|bacon|p[aã]o|salgado|coxinha|kibe|esfiha|molho|ketchup|maionese|mostarda|arroz|feij[aã]o|massa|macarr[aã]o|pizza|por[cç][aã]o|peixe|camar[aã]o|til[aá]pia|azeite|[oó]leo|farofa|salada|tomate|cebola|alface)\b/i.test(desc);

    // 3. Padrões de Sobremesas / Doces (NCM 17, 18)
    const isSobremesa = /^(17|18)/.test(codNcm) ||
      /\b(chocolate|bombom|sorvete|picol[eé]|a[cç]a[ií]|bala|chiclete|pirulito|doce|sobremesa|torta|bolo|pudim|leite condensado|nutella|creme de avel[aã]|bis|kitkat)\b/i.test(desc);

    // 4. Insumos / Descartáveis / Limpeza
    const isInsumo = /\b(copo|guardanapo|prato|bobina|sacola|embalagem|detergente|desinfetante|sab[aã]o|papel toalha|filme pvc|papel alum[ií]nio|canudo)\b/i.test(desc);

    // Tenta encontrar a categoria correspondente cadastrada no sistema
    let targetCat = null;

    if (isBebida) {
      targetCat = categoriasDisponiveis.find(c => /bebida/i.test(c.nome));
    } else if (isAlimento) {
      targetCat = categoriasDisponiveis.find(c => /aliment|lanche|refei|cozinha|comida|por[cç]/i.test(c.nome));
    } else if (isSobremesa) {
      targetCat = categoriasDisponiveis.find(c => /sobremesa|doce/i.test(c.nome));
    } else if (isInsumo) {
      targetCat = categoriasDisponiveis.find(c => /insumo|descart[aá]ve|limpeza/i.test(c.nome));
    }

    // Se achou uma categoria específica, retorna ela
    if (targetCat) return targetCat.id;

    // Se não encontrou nenhuma correspondência, prioriza a categoria "Outros"
    const catOutros = categoriasDisponiveis.find(c => /^\s*outro/i.test(c.nome)) ||
                      categoriasDisponiveis.find(c => c.id === 'cat-outros') ||
                      categoriasDisponiveis.find(c => /outro/i.test(c.nome)) ||
                      categoriasDisponiveis.find(c => /divers/i.test(c.nome));
    if (catOutros) return catOutros.id;

    // Fallback padrão: 'cat-outros' ou a primeira categoria disponível
    return categoriasDisponiveis.length ? (categoriasDisponiveis.find(c => c.id === 'cat-outros')?.id || 'cat-outros') : 'cat-outros';
  }

  /* ========================================================
     EXPORTAÇÃO DE XMLs PARA CONTABILIDADE
     REGRA OBRIGATÓRIA: DINHEIRO NUNCA É INCLUSO.
     Apenas PIX, Cartão de Débito e Cartão de Crédito.
     ======================================================== */
  const FORMAS_PAGAMENTO_FISCAL = {
    pix: { codigo: '17', descricao: 'PIX' },
    debito: { codigo: '04', descricao: 'Cartão de Débito' },
    credito: { codigo: '03', descricao: 'Cartão de Crédito' }
  };

  // Filtra as vendas elegíveis para envio contábil
  function filtrarVendasContabilidade(vendas, filtro = {}) {
    return vendas.filter(v => {
      // 1. REGRA CRÍTICA: DINHEIRO NUNCA PODE SER INFORMADO
      if (v.pagamento === 'dinheiro') return false;
      if (!FORMAS_PAGAMENTO_FISCAL[v.pagamento]) return false;

      // 2. Filtro de data (se fornecido)
      if (filtro.inicio) {
        const d = new Date(v.data);
        const di = new Date(filtro.inicio);
        di.setHours(0, 0, 0, 0);
        if (d < di) return false;
      }
      if (filtro.fim) {
        const d = new Date(v.data);
        const df = new Date(filtro.fim);
        df.setHours(23, 59, 59, 999);
        if (d > df) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.data) - new Date(b.data));
  }

  function formatarDataNfe(dataStr) {
    const d = new Date(dataStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}-03:00`;
  }

  function calcularDvChave44(chave43) {
    const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < 43; i++) {
      soma += parseInt(chave43[i], 10) * pesos[i];
    }
    const resto = soma % 11;
    return (resto === 0 || resto === 1) ? 0 : 11 - resto;
  }

  function gerarChaveNfce(venda, config) {
    const d = new Date(venda.data);
    const p = n => String(n).padStart(2, '0');
    const uf = '42'; // Santa Catarina
    const aamm = String(d.getFullYear()).slice(2) + p(d.getMonth() + 1);
    const cnpj = (config.cnpj || '00000000000000').replace(/\D/g, '').padEnd(14, '0').slice(0, 14);
    const mod = '65'; // NFC-e
    const serie = '001';
    const nNF = String(venda.numero || 1).padStart(9, '0');
    const tpEmis = '1'; // Normal
    const cNF = String(Math.abs(Math.floor(d.getTime() % 89999999)) + 10000000).slice(0, 8);

    const chave43 = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    const dv = calcularDvChave44(chave43);
    return chave43 + dv;
  }

  // Monta o XML individual no padrão padrão SEFAZ de NFC-e para cada venda
  function montarXmlVendaContabil(venda, config) {
    const chave = gerarChaveNfce(venda, config);
    const cnpjEmit = (config.cnpj || '00.000.000/0001-00').replace(/\D/g, '');
    const razaoEmit = config.loja || 'ManosTech System';
    const dataEmissao = formatarDataNfe(venda.data);
    const formaPag = FORMAS_PAGAMENTO_FISCAL[venda.pagamento] || { codigo: '99', descricao: 'Outros' };

    const itensXml = (venda.itens || []).map((item, idx) => {
      const vUnit = Number(item.preco || 0).toFixed(2);
      const vTotal = Number((item.preco || 0) * (item.qtd || 1)).toFixed(2);
      const prodObj = DB.produto(item.produtoId);
      const cEan = (prodObj?.codigo || '').trim() || 'SEM GTIN';

      return `      <det nItem="${idx + 1}">
        <prod>
          <cProd>${escapar(item.produtoId || idx + 1)}</cProd>
          <cEAN>${escapar(cEan)}</cEAN>
          <xProd>${escapar(item.nome)}</xProd>
          <NCM>22021000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>${Number(item.qtd || 1).toFixed(4)}</qCom>
          <vUnCom>${vUnit}</vUnCom>
          <vProd>${vTotal}</vProd>
          <cEANTrib>${escapar(cEan)}</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>${Number(item.qtd || 1).toFixed(4)}</qTrib>
          <vUnTrib>${vUnit}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMSSN102>
              <orig>0</orig>
              <CSOSN>102</CSOSN>
            </ICMSSN102>
          </ICMS>
          <PIS>
            <PISNT>
              <CST>07</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>07</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>`;
    }).join('\n');

    const subtotal = Number(venda.subtotal || venda.total).toFixed(2);
    const desconto = Number(venda.desconto || 0).toFixed(2);
    const total = Number(venda.total).toFixed(2);

    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide>
        <cUF>42</cUF>
        <cNF>${chave.slice(35, 43)}</cNF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>65</mod>
        <serie>1</serie>
        <nNF>${venda.numero}</nNF>
        <dhEmi>${dataEmissao}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>4205407</cMunFG>
        <tpImp>4</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${chave.slice(43)}</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0.0</verProc>
      </ide>
      <emit>
        <CNPJ>${cnpjEmit}</CNPJ>
        <xNome>${escapar(razaoEmit)}</xNome>
        <enderEmit>
          <xLgr>${escapar(config.endereco || 'Estrada Geral do Forte')}</xLgr>
          <nro>SN</nro>
          <xBairro>Praia do Forte</xBairro>
          <cMun>4205407</cMun>
          <xMun>Florianópolis</xMun>
          <UF>SC</UF>
          <fone>${escapar((config.telefone || '').replace(/\D/g, ''))}</fone>
        </enderEmit>
        <IE>ISENTO</IE>
        <CRT>1</CRT>
      </emit>
${itensXml}
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${subtotal}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>${desconto}</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${total}</vNF>
        </ICMSTot>
      </total>
      <pag>
        <detPag>
          <tPag>${formaPag.codigo}</tPag>
          <vPag>${total}</vPag>
        </detPag>
      </pag>
      <infAdic>
        <infCpl>DOCUMENTO ELETRONICO DE VENDAS - MANOSTECH SYSTEM. FORMA DE RECEBIMENTO: ${formaPag.descricao}.</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
  }

  // Gera um arquivo consolidado XML com todas as vendas do período (excluindo dinheiro)
  function gerarLoteContabilidadeXml(vendasValidas, config, periodoStr) {
    const totalGeral = DB.arred(vendasValidas.reduce((s, v) => s + v.total, 0));
    const cnpjEmit = (config.cnpj || '').replace(/\D/g, '');

    const xmlsVendas = vendasValidas.map(v => montarXmlVendaContabil(v, config)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<loteContabilVendas xmlns="http://www.rotadoforte.com.br/contabilidade" versao="1.0">
  <cabecalho>
    <loja>${escapar(config.loja || 'ManosTech System')}</loja>
    <cnpj>${cnpjEmit}</cnpj>
    <periodo>${escapar(periodoStr || 'Mensal')}</periodo>
    <geradoEm>${new Date().toISOString()}</geradoEm>
    <totalVendas>${vendasValidas.length}</totalVendas>
    <valorTotal>${totalGeral.toFixed(2)}</valorTotal>
  </cabecalho>
  <documentosFiscalVenda>
${xmlsVendas}
  </documentosFiscalVenda>
</loteContabilVendas>`;
  }

  return {
    configurar,
    emitir,
    parsearXmlNfe,
    deduzirFator,
    encontrarProdutoCorrespondente,
    sugerirCategoriaNfe,
    filtrarVendasContabilidade,
    montarXmlVendaContabil,
    gerarLoteContabilidadeXml,
    FORMAS_PAGAMENTO_FISCAL
  };
})();
