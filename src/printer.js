/* Monta o HTML do cupom (58/80 mm) e manda imprimir pelo processo principal. */

const Printer = (() => {
  const PAGAMENTOS = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    debito: 'Cartão de débito',
    credito: 'Cartão de crédito'
  };

  function dataHora(iso) {
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function escapar(t) {
    return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function dinheiro(n) { return DB.moeda(n).replace('R$ ', ''); }

  function base(larguraMm, corpo) {
    const largura = larguraMm === 58 ? 52 : 72; // área útil
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: ${larguraMm}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        width: ${largura}mm;
        margin: 0; padding: 2mm 1mm 4mm;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: ${larguraMm === 58 ? 9 : 10}px;
        line-height: 1.35;
        color: #000;
      }
      .marca { text-align: center; margin-bottom: 2mm; }
      .marca__nome { font-size: ${larguraMm === 58 ? 17 : 20}px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
      .marca__sub { font-size: 8px; letter-spacing: .18em; text-transform: uppercase; margin-top: 0.5mm; }
      .onda { height: 2mm; margin: 1.5mm 0; border-top: 1px solid #000; border-bottom: 1px solid #000; }
      .info { text-align: center; font-size: 8.5px; line-height: 1.45; }
      .infos { font-size: 8.5px; line-height: 1.45; }
      .sep { border-top: 1px dashed #000; margin: 1.8mm 0; }
      .linha { display: flex; justify-content: space-between; gap: 2mm; }
      .item { margin-bottom: 1.2mm; }
      .item__nome { font-weight: 700; }
      .item__calc { font-size: 8.5px; display: flex; justify-content: space-between; }
      .tot { font-weight: 800; }
      .tot--grande { font-size: 14px; font-weight: 800; display: flex; justify-content: space-between; margin: 1mm 0 2mm; }
      .centro { text-align: center; }
      .rodape { text-align: center; font-size: 8.5px; margin-top: 2mm; line-height: 1.5; }
      .chave { font-size: 7.5px; word-break: break-all; text-align: center; margin-top: 1.5mm; }
      .mini { font-size: 8px; }
    </style></head><body>${corpo}</body></html>`;
  }

  function itensHTML(venda) {
    return venda.itens.map(i => `
      <div class="item">
        <div class="item__nome">${escapar(i.nome)}</div>
        <div class="item__calc">
          <span>${i.qtd} x ${dinheiro(i.preco)}</span>
          <span>${dinheiro(i.preco * i.qtd)}</span>
        </div>
      </div>`).join('');
  }

  function montarCupom(venda, config, extra = {}) {
    const pagamento = PAGAMENTOS[venda.pagamento] || venda.pagamento;
    const descontoHTML = venda.desconto > 0
      ? `<div class="linha"><span>Desconto</span><span>-${dinheiro(venda.desconto)}</span></div>
         <div class="linha"><span>Subtotal</span><span>${dinheiro(venda.subtotal)}</span></div>`
      : '';
    const trocoHTML = venda.pagamento === 'dinheiro'
      ? `<div class="linha"><span>Recebido</span><span>${dinheiro(venda.recebido)}</span></div>
         <div class="linha tot"><span>Troco</span><span>${dinheiro(venda.troco)}</span></div>`
      : '';

    const logoSrc = config.logoMonocromatica || config.logo;
    const deveImprimirLogo = config.imprimirLogoCupom !== false && !!logoSrc;
    const logoHTML = deveImprimirLogo
      ? `<div style="text-align:center;margin-bottom:2mm">
           <img src="${logoSrc}" alt="Logo" style="max-width:${(config.larguraCupom || 80) === 58 ? '38mm' : '48mm'};max-height:22mm;object-fit:contain;display:inline-block;filter:grayscale(100%) contrast(250%);image-rendering:pixelated;" />
         </div>`
      : '';

    const corpo = `
      <div class="marca">
        ${logoHTML}
        <div class="marca__nome">${escapar(config.loja || 'Rota do Forte')}</div>
        <div class="marca__sub">Quiosque · Praia</div>
      </div>
      <div class="onda"></div>
      ${config.endereco ? `<div class="info">${escapar(config.endereco)}</div>` : ''}
      ${config.telefone ? `<div class="info">${escapar(config.telefone)}</div>` : ''}
      ${config.cnpj ? `<div class="info">CNPJ ${escapar(config.cnpj)}</div>` : ''}
      <div class="destaque-comanda" style="border:2px dashed #000;border-radius:4px;padding:2mm;margin:2mm 0;text-align:center">
        <div style="font-size:${(config.larguraCupom || 80) === 58 ? 8.5 : 9.5}px;font-weight:800;letter-spacing:0.5px">SEU PEDIDO DO DIA</div>
        <div style="font-size:${(config.larguraCupom || 80) === 58 ? 22 : 26}px;font-weight:900;line-height:1.15;margin:1mm 0">PEDIDO #${DB.numeroComanda(venda.numeroComanda || venda.numero)}</div>
        <div style="font-size:8px;font-weight:700;color:#333">Acompanhe pelo número do seu pedido</div>
      </div>
      <div class="sep"></div>
      <div class="linha infos">
        <span>Cupom #${DB.numeroCupom(venda.numero)}</span>
        <span>${dataHora(venda.data)}</span>
      </div>
      <div class="linha infos" style="margin-top:0.4mm">
        <span>Atendente: <b>${escapar(venda.operador || 'Caixa')}</b></span>
      </div>
      <div class="sep"></div>
      ${itensHTML(venda)}
      <div class="sep"></div>
      ${descontoHTML}
      <div class="tot--grande"><span>TOTAL</span><span>R$ ${dinheiro(venda.total)}</span></div>
      <div class="linha"><span>Pagamento</span><span>${escapar(pagamento)}</span></div>
      ${trocoHTML}
      <div class="sep"></div>
      <div class="centro mini">${venda.itens.reduce((s, i) => s + i.qtd, 0)} ${venda.itens.reduce((s, i) => s + i.qtd, 0) === 1 ? 'item' : 'itens'}</div>
      <div class="rodape">
        Obrigado e boa praia!<br>
        <span class="mini">Documento não fiscal</span>
      </div>
      ${extra.chave ? `<div class="chave">Chave: ${escapar(extra.chave)}</div>` : ''}
    `;

    return base(config.larguraCupom || 80, corpo);
  }

  function montarFechamento(resumo, config) {
    const linhasPag = Object.entries(resumo.porPagamento)
      .map(([k, v]) => `<div class="linha"><span>${escapar(PAGAMENTOS[k] || k)}</span><span>R$ ${dinheiro(v)}</span></div>`)
      .join('');
    const linhasProd = resumo.maisVendidos.slice(0, 12).map(p =>
      `<div class="linha mini"><span>${escapar(p.nome)}</span><span>${p.qtd}x · R$ ${dinheiro(p.total)}</span></div>`
    ).join('');

    const logoSrc = config.logoMonocromatica || config.logo;
    const deveImprimirLogo = config.imprimirLogoCupom !== false && !!logoSrc;
    const logoHTML = deveImprimirLogo
      ? `<div style="text-align:center;margin-bottom:2mm">
           <img src="${logoSrc}" alt="Logo" style="max-width:${(config.larguraCupom || 80) === 58 ? '38mm' : '48mm'};max-height:22mm;object-fit:contain;display:inline-block;filter:grayscale(100%) contrast(250%);image-rendering:pixelated;" />
         </div>`
      : '';

    const corpo = `
      <div class="marca">
        ${logoHTML}
        <div class="marca__nome">${escapar(config.loja || 'Rota do Forte')}</div>
        <div class="marca__sub">Fechamento de caixa</div>
      </div>
      <div class="onda"></div>
      <div class="info">${dataHora(new Date().toISOString())}</div>
      <div class="sep"></div>
      <div class="linha"><span>Faturamento</span><span>R$ ${dinheiro(resumo.faturamento)}</span></div>
      <div class="linha"><span>Vendas</span><span>${resumo.qtdVendas}</span></div>
      <div class="linha"><span>Ticket médio</span><span>R$ ${dinheiro(resumo.ticket)}</span></div>
      ${resumo.esperado != null ? `
      <div class="sep"></div>
      <div class="linha"><span>Fundo de troco</span><span>R$ ${dinheiro(resumo.fundo)}</span></div>
      <div class="linha"><span>Dinheiro esperado</span><span>R$ ${dinheiro(resumo.esperado)}</span></div>
      ${resumo.contado != null ? `<div class="linha"><span>Dinheiro contado</span><span>R$ ${dinheiro(resumo.contado)}</span></div>` : ''}
      ${resumo.diferenca != null ? `<div class="linha ${resumo.diferenca === 0 ? '' : 'destaque'}"><span>Diferença</span><span>R$ ${dinheiro(resumo.diferenca)}</span></div>` : ''}
      ` : ''}
      <div class="sep"></div>
      <div class="tot mini">POR FORMA DE PAGAMENTO</div>
      ${linhasPag || '<div class="mini">Nenhum lançamento</div>'}
      <div class="sep"></div>
      <div class="tot mini">MAIS VENDIDOS</div>
      ${linhasProd || '<div class="mini">Nenhum lançamento</div>'}
      <div class="sep"></div>
      <div class="rodape mini">Conferido por: ____________________</div>
    `;
    return base(config.larguraCupom || 80, corpo);
  }

  function baseComanda(larguraMm, corpo) {
    const largura = larguraMm === 58 ? 52 : 72;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: ${larguraMm}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        width: ${largura}mm;
        margin: 0; padding: 2mm 1mm 6mm;
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #000;
        line-height: 1.3;
      }
      .cabecalho { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
      .tag { font-size: ${larguraMm === 58 ? 12 : 14}px; font-weight: 900; letter-spacing: 1px; }
      .numero { font-size: ${larguraMm === 58 ? 22 : 26}px; font-weight: 900; margin: 1mm 0; }
      .meta { font-size: ${larguraMm === 58 ? 8.5 : 9.5}px; }
      .destaque-cliente {
        border: 2px solid #000;
        border-radius: 4px;
        padding: 2mm;
        margin: 2mm 0;
        text-align: center;
        font-weight: 800;
        font-size: ${larguraMm === 58 ? 12 : 14}px;
      }
      .itens { margin: 2mm 0; }
      .item-cozinha {
        display: flex;
        align-items: flex-start;
        gap: 2mm;
        padding: 2mm 0;
        border-bottom: 1px solid #000;
      }
      .item-cozinha:last-child { border-bottom: none; }
      .item-cozinha__qtd {
        flex: none;
        font-size: ${larguraMm === 58 ? 16 : 19}px;
        font-weight: 900;
        min-width: ${larguraMm === 58 ? 18 : 22}mm;
      }
      .item-cozinha__nome {
        font-size: ${larguraMm === 58 ? 12 : 14}px;
        font-weight: 800;
        line-height: 1.25;
        text-transform: uppercase;
      }
      .obs-bloco {
        border: 1.5px dashed #000;
        padding: 2mm;
        margin: 3mm 0 2mm;
        border-radius: 4px;
      }
      .obs-bloco__tit { font-size: 9px; font-weight: 900; text-transform: uppercase; margin-bottom: 1mm; }
      .obs-bloco__txt { font-size: ${larguraMm === 58 ? 10.5 : 12}px; font-weight: 700; }
      .rodape-cozinha {
        border-top: 2px dashed #000;
        margin-top: 3mm;
        padding-top: 2mm;
        text-align: center;
        font-size: 9px;
        font-weight: 700;
      }
    </style></head><body>${corpo}</body></html>`;
  }

  function montarComandaCozinha(venda, itensCozinha, config, extra = {}) {
    const largura = Number(config.larguraCozinha) || Number(config.larguraCupom) || 80;
    const totalItens = (itensCozinha || []).reduce((s, i) => s + (i.qtd || 1), 0);
    const numComandaFormatado = DB.numeroComanda(venda.numeroComanda || venda.numero);
    const numCupomFormatado = DB.numeroCupom(venda.numero);

    const corpo = `
      <div class="cabecalho">
        <div class="tag">*** PRODUÇÃO COZINHA ***</div>
        <div class="numero" style="font-size:${largura === 58 ? 26 : 32}px;font-weight:900;margin:1.5mm 0">PEDIDO #${numComandaFormatado}</div>
        <div class="meta" style="font-size:${largura === 58 ? 8.5 : 9.5}px;font-weight:700">PEDIDO DO DIA · Cupom #${numCupomFormatado} · ${dataHora(venda.data)}</div>
        <div style="margin-top:1.5mm;padding:1mm 2mm;border:1.5px solid #000;border-radius:3px;font-size:${largura === 58 ? '9.5' : '11'}px;font-weight:900;text-transform:uppercase;display:inline-block">
          QUEM TIROU O PEDIDO: ${escapar(venda.operador || 'Caixa')}
        </div>
      </div>

      ${venda.cliente ? `
      <div class="destaque-cliente">
        ${escapar(venda.cliente)}
      </div>` : ''}

      <div class="itens">
        ${(itensCozinha || []).map(i => `
          <div class="item-cozinha">
            <div class="item-cozinha__qtd">[ ${i.qtd}x ]</div>
            <div class="item-cozinha__nome">${escapar(i.nome)}</div>
          </div>
        `).join('')}
      </div>

      ${venda.obsCozinha ? `
      <div class="obs-bloco">
        <div class="obs-bloco__tit">Observação da cozinha:</div>
        <div class="obs-bloco__txt">${escapar(venda.obsCozinha)}</div>
      </div>` : ''}

      <div class="rodape-cozinha">
        TOTAL: ${totalItens} ${totalItens === 1 ? 'ITEM DE COZINHA' : 'ITENS DE COZINHA'}<br>
        <span style="font-size:8px;font-weight:normal">Impresso em ${dataHora(new Date().toISOString())}</span>
      </div>
    `;

    return baseComanda(largura, corpo);
  }

  function montarTeste(tipo, config) {
    if (tipo === 'cozinha') {
      const vendaFake = {
        numero: 999,
        numeroComanda: 1,
        data: new Date().toISOString(),
        operador: 'Teste',
        cliente: 'MESA 01 / TESTE',
        obsCozinha: 'Sem cebola (teste de impressão)'
      };
      const itensFake = [
        { nome: 'Pastel de camarão (Teste)', qtd: 2 },
        { nome: 'Porção de batata (Teste)', qtd: 1 }
      ];
      return montarComandaCozinha(vendaFake, itensFake, config);
    }
    const vendaFake = {
      numero: 999,
      data: new Date().toISOString(),
      itens: [{ produtoId: 'p-teste', nome: 'Item de teste', preco: 10, qtd: 1 }],
      subtotal: 10,
      desconto: 0,
      total: 10,
      pagamento: 'dinheiro',
      recebido: 10,
      troco: 0
    };
    return montarCupom(vendaFake, config);
  }

  async function imprimir(html, config, destino = 'caixa') {
    let largura = Number(config.larguraCupom) || 80;
    let impressora = (config.impressoraCaixa || '').trim();

    if (destino === 'cozinha') {
      largura = Number(config.larguraCozinha) || Number(config.larguraCupom) || 80;
      const impCoz = (config.impressoraCozinha || '').trim();
      impressora = (impCoz && impCoz !== 'mesma') ? impCoz : (config.impressoraCaixa || '').trim();
    } else if (destino && destino !== 'caixa') {
      // impressora específica passada diretamente
      impressora = String(destino).trim();
    }

    const silencioso = !!config.impressoraSilenciosa;
    try {
      return await window.pdv.imprimirCupom(html, largura, silencioso, impressora);
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  return { imprimir, montarCupom, montarComandaCozinha, montarFechamento, montarTeste, PAGAMENTOS };
})();
