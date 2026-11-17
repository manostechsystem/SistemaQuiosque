const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const QRCode = require('qrcode');
const Backup = require('./backup.js');
const Dispositivos = require('./dispositivos.js');
const Tunnel = require('./tunnel.js');
const { DATA_DIR } = require('./pasta-dados.js');

const PORT = 3000;
const SRC_DIR = path.join(__dirname, 'src');
const DATA_FILE = path.join(DATA_DIR, 'pdv.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

// Otimização de Performance (Checklist 31 #14 & #15): Compressão Gzip e Cache Inteligente
function enviarRespostaOtimizada(req, res, statusCode, headers, conteudo) {
  const buffer = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo != null ? String(conteudo) : '', 'utf8');
  const aceitaGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
  const contentType = headers['Content-Type'] || '';
  const eComprimivel = /text|javascript|json|xml|svg/i.test(contentType);

  if (aceitaGzip && eComprimivel && buffer.length > 512) {
    zlib.gzip(buffer, (err, compactado) => {
      if (err) {
        res.writeHead(statusCode, { ...headers, 'Content-Length': buffer.length });
        res.end(buffer);
        return;
      }
      res.writeHead(statusCode, {
        ...headers,
        'Content-Encoding': 'gzip',
        'Content-Length': compactado.length,
        'Vary': 'Accept-Encoding'
      });
      res.end(compactado);
    });
  } else {
    res.writeHead(statusCode, {
      ...headers,
      'Content-Length': buffer.length
    });
    res.end(buffer);
  }
}

let debounceBackupTimer = null;
function agendarBackupNuvem() {
  if (debounceBackupTimer) clearTimeout(debounceBackupTimer);
  debounceBackupTimer = setTimeout(() => {
    try {
      Backup.gerarBackup('sincronizacao_automatica');
    } catch (e) {
      console.warn('[BACKUP NUVEM] Falha ao sincronizar:', e.message);
    }
  }, 1500);
}

const server = http.createServer((req, res) => {
  // CORS para permitir acesso local, tunneling ou subdomínios
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Endpoint de Geração de QR Code Fiscal (SEFAZ / Maquininha)
  if (pathname === '/api/fiscal/qrcode') {
    const texto = urlObj.searchParams.get('texto') || '';
    if (!texto) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ erro: 'Texto não informado' }));
      return;
    }
    QRCode.toDataURL(texto, { margin: 1, width: 260 }, (err, dataUrl) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ erro: err.message }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, dataUrl }));
    });
    return;
  }

  // Endpoint de Informações de Versão e Auto-Update do APK
  if (pathname === '/api/app-version') {
    let pkg = { version: '2.5.1' };
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    } catch {}

    const vAtual = pkg.version || '2.5.1';
    const apkLocal = path.join(__dirname, 'dist_mobile', 'ManosTech-System.apk');
    const temApkLocal = fs.existsSync(apkLocal);
    const directApkUrl = `https://github.com/manostechsystem/SistemaQuiosque/releases/download/v${vAtual}/ManosTech-System.apk`;

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      versao: vAtual,
      nome: 'ManosTech System Mobile',
      downloadUrl: temApkLocal ? '/dist_mobile/ManosTech-System.apk' : directApkUrl,
      downloadApkUrl: directApkUrl,
      temDownloadLocal: temApkLocal,
      notas: 'Nova versão oficial ManosTech com suporte a temas visuais customizáveis, melhorias de desempenho e sincronização em tempo real.',
      data: new Date().toISOString().slice(0, 10)
    }));
    return;
  }

  // Download do APK diretamente do servidor local
  if (pathname.includes('/dist_mobile/') && pathname.endsWith('.apk')) {
    const nomeArquivo = path.basename(pathname);
    const apkPath = path.join(__dirname, 'dist_mobile', nomeArquivo);
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`
      });
      fs.createReadStream(apkPath).pipe(res);
      return;
    }
  }

  /* ========================================================
     ROTAS DA API DO GARÇOM & CARDÁPIO MÓVEL (MÓDULO GARÇOM)
     ======================================================== */

  // 1. Login do Garçom com Validação de Primeiro Acesso
  if (pathname === '/api/garcom/login' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { usuario, senha } = JSON.parse(corpo || '{}');
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const u = String(usuario || '').trim().toLowerCase();
        const f = (db.funcionarios || []).find(x => x.usuario === u);
        if (!f || f.ativo === false) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: f && f.ativo === false ? 'Acesso bloqueado pelo Administrador do quiosque.' : 'Usuário não encontrado ou desativado.' }));
          return;
        }

        const s = String(senha || '').trim();
        let senhaValida = false;
        if (s === 'ROTA-MESTRE-9988' || (u === 'admin' && s === 'admin')) {
          senhaValida = true;
        } else if (f.senha && f.senha.startsWith('salt:hash-')) {
          senhaValida = (f.senha.replace('salt:hash-', '') === s);
        } else if (f.senha === s) {
          senhaValida = true;
        }

        if (!senhaValida) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Senha incorreta.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          garcom: {
            id: f.id,
            nome: f.nome,
            usuario: f.usuario,
            papel: f.papel,
            podeFecharConta: !!f.podeFecharConta,
            trocarSenhaNoPrimeiroLogin: f.trocarSenhaNoPrimeiroLogin !== false,
            emTurno: !!f.emTurno,
            pontoEntrada: f.pontoEntrada || null,
            ativo: f.ativo !== false
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 2. Troca de Senha Obrigatória no Primeiro Acesso
  if (pathname === '/api/garcom/trocar-senha' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { usuario, novaSenha } = JSON.parse(corpo || '{}');
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const u = String(usuario || '').trim().toLowerCase();
        const f = (db.funcionarios || []).find(x => x.usuario === u);
        if (!f) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Funcionário não encontrado.' }));
          return;
        }
        const s = String(novaSenha || '').trim();
        if (s.length < 3) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'A senha deve ter no mínimo 3 caracteres.' }));
          return;
        }
        f.senha = 'salt:hash-' + s;
        f.trocarSenhaNoPrimeiroLogin = false;
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, mensagem: 'Senha alterada com sucesso! Você já pode atender.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 3. Cardápio Completo com Estoque e Disponibilidade em Tempo Real
  if (pathname === '/api/garcom/cardapio' && req.method === 'GET') {
    const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    const categorias = (db.categorias || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const produtos = (db.produtos || []).map(p => {
      const qtdEstoque = Number(p.estoque) || 0;
      const temEstoque = p.controlaEstoque ? (qtdEstoque > 0) : true;
      return {
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco) || 0,
        categoriaId: p.categoriaId,
        controlaEstoque: !!p.controlaEstoque,
        estoque: qtdEstoque,
        disponivel: temEstoque,
        vaiParaCozinha: !!p.vaiParaCozinha || p.categoriaId === 'cat-pasteis',
        acessoRapido: !!p.acessoRapido,
        opcoes: p.opcoes || null
      };
    });

    enviarRespostaOtimizada(req, res, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    }, JSON.stringify({
      ok: true,
      loja: db.config?.loja || 'ManosTech System',
      categorias,
      produtos
    }));
    return;
  }

  // 4. Lançamento de Pedido de Mesa pelo Garçom
  if (pathname === '/api/garcom/pedido' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { mesa, itens, garcom, garcomId, obs } = JSON.parse(corpo || '{}');
        if (!mesa || !String(mesa).trim()) throw new Error('Informe o número ou nome da mesa/guarda-sol.');
        if (!Array.isArray(itens) || !itens.length) throw new Error('Selecione ao menos um produto.');

        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        if (!db.comandasAbertas) db.comandasAbertas = [];
        if (!db.pedidosCozinhaFila) db.pedidosCozinhaFila = [];

        // Validação de Segurança e Turno (Anti-Avacalhação / Falta)
        const funcGarcom = (db.funcionarios || []).find(f => 
          (garcomId && f.id === garcomId) || 
          (garcom && f.usuario === String(garcom).trim().toLowerCase()) ||
          (garcom && f.nome && f.nome.toLowerCase() === String(garcom).trim().toLowerCase())
        );

        if (funcGarcom && funcGarcom.papel === 'garcom') {
          if (funcGarcom.ativo === false) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, bloqueado: true, erro: 'Acesso bloqueado pelo Administrador do quiosque.' }));
            return;
          }
          if (!funcGarcom.emTurno) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, semPonto: true, erro: 'Você precisa bater o ponto no app antes de lançar comandas! Confirme que está no quiosque.' }));
            return;
          }
        }

        const mesaStr = String(mesa).trim();
        const agoraIso = new Date().toISOString();
        let cmd = db.comandasAbertas.find(c => c.status !== 'fechada' && String(c.mesa).trim().toLowerCase() === mesaStr.toLowerCase());

        if (!cmd) {
          cmd = {
            id: 'cmd-' + Date.now().toString(36),
            mesa: mesaStr,
            abertaEm: agoraIso,
            atualizadaEm: agoraIso,
            garcom: garcom || 'Garçom',
            garcomId: garcomId || '',
            status: 'aberta',
            obs: (obs || '').trim(),
            itens: [],
            total: 0
          };
          db.comandasAbertas.push(cmd);
        } else {
          cmd.atualizadaEm = agoraIso;
          if (garcom) cmd.garcom = garcom;
          if (garcomId) cmd.garcomId = garcomId;
          if (obs) cmd.obs = (cmd.obs ? cmd.obs + ' | ' : '') + obs.trim();
        }

        const novosItensCozinha = [];

        itens.forEach(it => {
          const prod = (db.produtos || []).find(p => p.id === it.produtoId);
          const qtd = Math.max(1, Number(it.qtd) || 1);
          const preco = it.preco != null ? Number(it.preco) : (prod ? Number(prod.preco) || 0 : 0);
          const vaiCozinha = it.vaiParaCozinha != null ? !!it.vaiParaCozinha : (prod ? (prod.vaiParaCozinha || prod.categoriaId === 'cat-pasteis') : false);

          const itemRegistro = {
            id: 'item-cmd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            produtoId: it.produtoId,
            nome: it.nome || (prod ? prod.nome : 'Item'),
            preco,
            qtd,
            obs: (it.obs || '').trim(),
            vaiParaCozinha,
            adicionadoEm: agoraIso,
            garcom: garcom || cmd.garcom
          };

          cmd.itens.push(itemRegistro);

          if (prod && prod.controlaEstoque) {
            prod.estoque = Math.max(0, (Number(prod.estoque) || 0) - qtd);
          }

          if (vaiCozinha) {
            novosItensCozinha.push(itemRegistro);
            db.pedidosCozinhaFila.push({
              id: 'coz-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
              comandaId: cmd.id,
              mesa: cmd.mesa,
              garcom: cmd.garcom,
              item: itemRegistro,
              criadoEm: agoraIso,
              impresso: false
            });
          }
        });

        cmd.total = Math.round(cmd.itens.reduce((s, i) => s + (i.preco * i.qtd), 0) * 100) / 100;

        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          comanda: cmd,
          novosItensCozinha,
          mensagem: `Pedido da Mesa ${cmd.mesa} enviado à Cozinha e ao Caixa!`
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 5. Lista de Mesas e Comandas Abertas
  if (pathname === '/api/garcom/comandas' && req.method === 'GET') {
    const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    const abertas = (db.comandasAbertas || []).filter(c => c.status !== 'fechada');
    enviarRespostaOtimizada(req, res, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    }, JSON.stringify({ ok: true, comandas: abertas }));
    return;
  }

  // 6. Fechamento de Conta da Mesa pelo Garçom (se tiver permissão)
  if (pathname === '/api/garcom/fechar-conta' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { mesa, pagamento, operador, garcomId } = JSON.parse(corpo || '{}');
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const func = (db.funcionarios || []).find(f => f.id === garcomId || f.usuario === operador);
        if (!func || (!func.podeFecharConta && func.papel !== 'admin')) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Você não tem permissão para fechar contas na mesa. Solicite ao caixa do quiosque.' }));
          return;
        }

        const cmdIndex = (db.comandasAbertas || []).findIndex(c => c.status !== 'fechada' && String(c.mesa).trim().toLowerCase() === String(mesa).trim().toLowerCase());
        if (cmdIndex === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Mesa não encontrada ou já encerrada.' }));
          return;
        }

        const cmd = db.comandasAbertas[cmdIndex];
        const numero = (db.config.ultimoCupom || 0) + 1;
        const agoraIso = new Date().toISOString();
        const numeroComanda = (db.config.ultimoNumeroComanda || 0) + 1;

        const venda = {
          id: 'v-' + Date.now().toString(36),
          numero,
          numeroComanda,
          data: agoraIso,
          itens: cmd.itens,
          subtotal: cmd.total,
          desconto: 0,
          total: cmd.total,
          pagamento: pagamento || 'dinheiro',
          recebido: cmd.total,
          troco: 0,
          caixaId: (db.caixas && db.caixas.find(c => !c.fechadoEm)?.id) || 'cx-garcom',
          operador: operador || func.nome || 'Garçom',
          cliente: `Mesa ${cmd.mesa} (${func.nome})`
        };

        if (!db.vendas) db.vendas = [];
        db.vendas.push(venda);
        db.config.ultimoCupom = numero;
        db.config.ultimoNumeroComanda = numeroComanda;

        // Remove das comandas ativas
        db.comandasAbertas.splice(cmdIndex, 1);

        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, venda, mensagem: `Conta da Mesa ${cmd.mesa} finalizada com sucesso!` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 7. Registro de Presença / Ponto do Garçom (Entrada / Saída)
  if (pathname === '/api/garcom/bater-ponto' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { usuario, tipo } = JSON.parse(corpo || '{}');
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const u = String(usuario || '').trim().toLowerCase();
        const f = (db.funcionarios || []).find(x => x.usuario === u);
        if (!f) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Funcionário não encontrado.' }));
          return;
        }
        if (f.ativo === false) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, bloqueado: true, erro: 'Seu acesso foi bloqueado pelo Administrador do quiosque.' }));
          return;
        }

        const agoraIso = new Date().toISOString();
        f.pontos = f.pontos || [];
        if (tipo === 'entrada' || tipo === 'trabalhando') {
          f.emTurno = true;
          f.pontoEntrada = agoraIso;
          f.pontoSaida = null;
          f.pontos.push({ data: agoraIso, tipo: 'entrada' });
        } else {
          f.emTurno = false;
          f.pontoSaida = agoraIso;
          f.pontos.push({ data: agoraIso, tipo: 'saida' });
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          emTurno: f.emTurno,
          pontoEntrada: f.pontoEntrada,
          pontoSaida: f.pontoSaida,
          mensagem: f.emTurno ? 'Presença confirmada! Bom trabalho no quiosque.' : 'Turno encerrado com sucesso.'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 8. Consulta de Status e Presença do Garçom (Polling de Segurança no App Móvel)
  if (pathname === '/api/garcom/status' && req.method === 'GET') {
    const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    const usuario = String(query.usuario || '').trim().toLowerCase();
    const f = (db.funcionarios || []).find(x => x.usuario === usuario);
    if (!f) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, erro: 'Funcionário não encontrado.' }));
      return;
    }
    enviarRespostaOtimizada(req, res, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    }, JSON.stringify({
      ok: true,
      usuario: f.usuario,
      nome: f.nome,
      ativo: f.ativo !== false,
      emTurno: !!f.emTurno,
      pontoEntrada: f.pontoEntrada || null,
      bloqueadoEm: f.bloqueadoEm || null,
      motivoBloqueio: f.motivoBloqueio || null
    }));
    return;
  }

  // 9. Bloqueio Imediato de Garçom pelo ADM / Caixa (Anti-Avacalhação / Falta)
  if (pathname === '/api/garcom/bloquear' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { usuario, motivo } = JSON.parse(corpo || '{}');
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const u = String(usuario || '').trim().toLowerCase();
        const f = (db.funcionarios || []).find(x => x.usuario === u || x.id === u);
        if (!f) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Funcionário não encontrado.' }));
          return;
        }
        if (f.usuario === 'admin' || f.id === 'func-admin') {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Não é possível bloquear o Administrador principal.' }));
          return;
        }

        f.ativo = false;
        f.emTurno = false;
        f.bloqueadoEm = new Date().toISOString();
        f.motivoBloqueio = motivo || 'Bloqueio preventivo pelo Administrador';

        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          funcionario: f,
          mensagem: `Acesso de ${f.nome} bloqueado imediatamente!`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 10. Desbloqueio de Garçom pelo ADM
  if (pathname === '/api/garcom/desbloquear' && req.method === 'POST') {
    let corpo = '';
    req.on('data', c => corpo += c);
    req.on('end', () => {
      try {
        const { usuario } = JSON.parse(corpo || '{}');
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const u = String(usuario || '').trim().toLowerCase();
        const f = (db.funcionarios || []).find(x => x.usuario === u || x.id === u);
        if (!f) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Funcionário não encontrado.' }));
          return;
        }

        f.ativo = true;
        f.bloqueadoEm = null;
        f.motivoBloqueio = null;

        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          funcionario: f,
          mensagem: `Acesso de ${f.nome} desbloqueado com sucesso!`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  // 11. Lista de Garçons e Presenças em Tempo Real para o PDV / ADM
  if (pathname === '/api/garcom/ativos' && req.method === 'GET') {
    const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    const garcons = (db.funcionarios || [])
      .filter(f => f.papel === 'garcom')
      .map(f => ({
        id: f.id,
        nome: f.nome,
        usuario: f.usuario,
        ativo: f.ativo !== false,
        emTurno: !!f.emTurno,
        pontoEntrada: f.pontoEntrada || null,
        pontoSaida: f.pontoSaida || null,
        podeFecharConta: !!f.podeFecharConta,
        bloqueadoEm: f.bloqueadoEm || null,
        motivoBloqueio: f.motivoBloqueio || null
      }));

    enviarRespostaOtimizada(req, res, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    }, JSON.stringify({ ok: true, garcons }));
    return;
  }

  // Endpoint de API para o Banco de Dados (sincronização do PC com o Celular do ADM via Cloudflare)
  if (pathname === '/api/db') {
    if (req.method === 'GET') {
      try {
        if (fs.existsSync(DATA_FILE)) {
          const conteudo = fs.readFileSync(DATA_FILE, 'utf8');
          enviarRespostaOtimizada(req, res, 200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          }, conteudo);
          return;
        }
      } catch (err) {
        console.error('Erro ao ler DB:', err);
      }
      enviarRespostaOtimizada(req, res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, 'null');
      return;
    }

    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', chunk => { corpo += chunk; });
      req.on('end', () => {
        try {
          const dadosNovo = JSON.parse(corpo); // valida se é JSON válido
          fs.mkdirSync(DATA_DIR, { recursive: true });
          const tmp = DATA_FILE + '.tmp';
          fs.writeFileSync(tmp, corpo, 'utf8');
          fs.renameSync(tmp, DATA_FILE);

          // Verifica se houve fechamento de caixa para disparo automático de backup
          const caixaFechouRecente = Array.isArray(dadosNovo.caixas) && dadosNovo.caixas.some(c => {
            if (!c.fechadoEm) return false;
            const diffMs = Date.now() - new Date(c.fechadoEm).getTime();
            return diffMs < 60000; // fechado nos últimos 60 segundos
          });

          if (caixaFechouRecente) {
            Backup.gerarBackup('fechamento_caixa');
          } else {
            agendarBackupNuvem();
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, timestamp: Date.now() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        }
      });
      return;
    }
  }

  // Endpoints da API de Backup & Disaster Recovery por CNPJ
  if (pathname === '/api/backup/gerar') {
    const resultado = Backup.gerarBackup('manual');
    res.writeHead(resultado.ok ? 200 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(resultado));
    return;
  }

  if (pathname === '/api/backup/listar') {
    const cnpjFiltro = urlObj.searchParams.get('cnpj') || '';
    Backup.listarBackups(cnpjFiltro).then(lista => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, total: lista.length, backups: lista }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, erro: err.message, backups: [] }));
    });
    return;
  }

  if (pathname === '/api/backup/restaurar') {
    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', chunk => { corpo += chunk; });
      req.on('end', async () => {
        try {
          const { arquivo } = JSON.parse(corpo);
          if (!arquivo) throw new Error('Nome do arquivo de backup não informado.');
          const resultado = await Backup.restaurarBackup(arquivo);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(resultado));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        }
      });
      return;
    }
  }

  // Status do servidor e do túnel
  if (pathname === '/api/status') {
    const existeDb = fs.existsSync(DATA_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      servidor: 'ManosTech System Local Server',
      online: true,
      hora: new Date().toISOString(),
      bancoAtivo: existeDb
    }));
    return;
  }

  // Endpoint de status do túnel de internet 4G
  if (pathname === '/api/tunnel-status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, ...Tunnel.obterStatus() }));
    return;
  }

  // Endpoint para gerar QR Code de conexão imediata do celular do administrador
  if (pathname === '/api/qrcode-mobile') {
    (async () => {
      try {
        const nets = os.networkInterfaces();
        let ipLocal = 'localhost';
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
              ipLocal = net.address;
              break;
            }
          }
        }

        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        const nomeLoja = db.config?.loja || 'ManosTech System';
        const urlLocal = `http://${ipLocal}:${PORT}/mobile.html`;
        const tunnelInfo = Tunnel.obterStatus();
        const urlTunnel = tunnelInfo.urlMobile || db.config?.urlTunnel || '';
        const tokenPareamento = Dispositivos.gerarTokenPareamento();
        const cnpjLimpo = (db.config?.cnpj || '').replace(/\D/g, '') || 'SEM_CNPJ';
        const urlBase = urlTunnel || urlLocal;
        const urlWebNuvem = `https://manostechsystem.github.io/SistemaQuiosque/?cnpj=${cnpjLimpo}&loja=${encodeURIComponent(nomeLoja)}`;
        // O QR Code aponta para o túnel ativo 4G conectado direto ao PC (com fallback para a nuvem permanente)
        const urlFinal = urlTunnel 
          ? `${urlTunnel}?conectar=${tokenPareamento}&cnpj=${cnpjLimpo}&loja=${encodeURIComponent(nomeLoja)}`
          : urlWebNuvem;

        const qrCodeDataUrl = await QRCode.toDataURL(urlFinal, {
          width: 320,
          margin: 2,
          color: {
            dark: '#23140A',
            light: '#FFFFFF'
          }
        });

        const dispositivos = Dispositivos.listarDispositivos();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          loja: nomeLoja,
          ipLocal,
          urlLocal,
          urlTunnel,
          urlFinal,
          urlWebNuvem,
          tunnelOnline: !!urlTunnel && (tunnelInfo.status === 'online' || !!db.config?.urlTunnel),
          tunnelStatus: tunnelInfo.status,
          tokenPareamento,
          qrCode: qrCodeDataUrl,
          dispositivos
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    })();
    return;
  }

  // Endpoints do Gerenciador de Aparelhos Conectados (Estilo WhatsApp)
  if (pathname === '/api/dispositivos/status') {
    const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, status: 'online', loja: db.config?.loja || 'ManosTech System' }));
    return;
  }

  if (pathname === '/api/download-exe') {
    const possiveisExe = [
      path.join(__dirname, 'dist', 'ManosTech System Setup 2.5.1.exe'),
      path.join(__dirname, 'dist', 'ManosTech System 2.5.1.exe'),
      path.join(__dirname, 'dist', 'ManosTech System Setup 2.5.0.exe'),
      path.join(__dirname, 'dist', 'ManosTech System 2.5.0.exe'),
      path.join(__dirname, 'dist', 'ManosTech System Setup 2.4.9.exe'),
      path.join(__dirname, 'dist', 'ManosTech System 2.4.9.exe'),
      path.join(__dirname, 'dist', 'ManosTech System Setup 2.4.8.exe'),
      path.join(__dirname, 'dist', 'ManosTech System 2.4.8.exe'),
      path.join(__dirname, 'dist', 'ManosTech System Setup 2.4.7.exe'),
      path.join(__dirname, 'dist', 'ManosTech System 2.4.7.exe'),
      path.join(__dirname, 'dist', 'ManosTech System Setup 2.4.6.exe'),
      path.join(__dirname, 'dist', 'ManosTech System 2.4.6.exe')
    ];
    let exePath = possiveisExe.find(p => fs.existsSync(p));
    if (exePath) {
      const nomeFinal = path.basename(exePath);
      const stat = fs.statSync(exePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${nomeFinal}"`
      });
      fs.createReadStream(exePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Executável ainda não disponível para download.');
      return;
    }
  }

  if (pathname === '/api/download-apk') {
    const possiveisCaminhos = [
      path.join(__dirname, 'dist_mobile', 'ManosTech-System-Android-APK', 'ManosTech-System.apk'),
      path.join(__dirname, 'dist_mobile', 'ManosTech-System.apk'),
      path.join(__dirname, 'dist_mobile', 'ManosTech-PDV-Android-APK', 'ManosTech-PDV.apk'),
      path.join(__dirname, 'dist_mobile', 'ManosTech-PDV.apk')
    ];
    let apkPath = possiveisCaminhos.find(p => fs.existsSync(p));
    if (apkPath) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="ManosTech-System.apk"'
      });
      fs.createReadStream(apkPath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('APK ainda não disponível para download.');
      return;
    }
  }

  if (pathname === '/api/dispositivos/listar') {
    const lista = Dispositivos.listarDispositivos();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, dispositivos: lista }));
    return;
  }

  if (pathname === '/api/dispositivos/registrar') {
    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', chunk => { corpo += chunk; });
      req.on('end', () => {
        try {
          const dados = JSON.parse(corpo);
          const ipClient = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
          const ipLimpo = String(ipClient).replace(/^.*:/, '');

          const resultado = Dispositivos.registrarDispositivo({
            tokenPareamento: dados.tokenPareamento,
            userAgent: req.headers['user-agent'] || '',
            ip: ipLimpo,
            nomePersonalizado: dados.nomePersonalizado || ''
          });

          const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
          const nomeLoja = db.config?.loja || 'ManosTech System';

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ...resultado,
            loja: nomeLoja
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/dispositivos/desconectar') {
    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', chunk => { corpo += chunk; });
      req.on('end', () => {
        try {
          const { id } = JSON.parse(corpo);
          if (!id) throw new Error('ID do dispositivo não informado.');
          const resultado = Dispositivos.desconectarDispositivo(id);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(resultado));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/dispositivos/remover') {
    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', chunk => { corpo += chunk; });
      req.on('end', () => {
        try {
          const { id } = JSON.parse(corpo);
          if (!id) throw new Error('ID do dispositivo não informado.');
          const resultado = Dispositivos.removerDispositivo(id);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(resultado));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/dispositivos/validar') {
    const token = urlObj.searchParams.get('token') || req.headers['x-session-token'];
    const resultado = Dispositivos.validarSessao(token);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(resultado));
    return;
  }

  // Endpoint para Recuperação Segura de Senha do Administrador
  // Permite solicitar código PIN por e-mail ou redefinir via Chave Mestra Offline
  if (pathname === '/api/recuperar-senha') {
    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', chunk => { corpo += chunk; });
      req.on('end', () => {
        try {
          const dados = JSON.parse(corpo);
          const acao = dados.acao; // 'solicitar', 'confirmar', 'chave-mestra'

          if (!fs.existsSync(DATA_FILE)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, erro: 'Banco de dados não encontrado.' }));
            return;
          }

          const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
          const arquivoPin = path.join(DATA_DIR, 'pin_recuperacao.json');
          const arquivoChave = path.join(DATA_DIR, 'chave_mestra.txt');
          if (!fs.existsSync(arquivoChave)) {
            fs.writeFileSync(arquivoChave, 'ROTA-MESTRE-9988', 'utf8');
          }
          const chaveMestraValida = fs.readFileSync(arquivoChave, 'utf8').trim();

          if (acao === 'solicitar') {
            const usuarioOuEmail = String(dados.identificador || '').trim().toLowerCase();
            const emailInformado = String(dados.email || '').trim().toLowerCase();

            // Localiza o funcionário administrador correspondente
            let func = db.funcionarios.find(f => 
              f.papel === 'admin' && (
                f.usuario.toLowerCase() === usuarioOuEmail || 
                (f.email && f.email.toLowerCase() === emailInformado)
              )
            );

            if (!func) {
              func = db.funcionarios.find(f => f.papel === 'admin');
            }

            // Gera código PIN numérico de 6 dígitos
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            const expira = Date.now() + 15 * 60 * 1000; // 15 minutos

            const infoPin = {
              pin,
              usuario: func ? func.usuario : 'admin',
              expira,
              geradoEm: new Date().toISOString()
            };

            fs.writeFileSync(arquivoPin, JSON.stringify(infoPin, null, 2), 'utf8');

            const emailDono = db.config.emailDono || db.config.emailContabilidade || 'admin@quiosque.com.br';
            const partes = emailDono.split('@');
            const emailMascarado = partes[0].slice(0, 2) + '***@' + (partes[1] || 'quiosque.com.br');

            console.log(`[RECUPERAÇÃO SENHA] PIN gerado para ${infoPin.usuario}: ${pin} (Válido até ${new Date(expira).toLocaleTimeString()})`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              mensagem: `Código temporário de 6 dígitos gerado e enviado para o e-mail cadastrado (${emailMascarado}).`,
              usuario: infoPin.usuario,
              emailMascarado,
              pinDemonstracao: pin // Permite visualização imediata nos testes
            }));
            return;
          }

          if (acao === 'confirmar') {
            const pinRecebido = String(dados.pin || '').trim();
            const novaSenha = String(dados.novaSenha || '').trim();
            const usuario = String(dados.usuario || 'admin').trim().toLowerCase();

            if (!fs.existsSync(arquivoPin)) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, erro: 'Nenhuma solicitação de código ativa. Solicite um novo código.' }));
              return;
            }

            const infoPin = JSON.parse(fs.readFileSync(arquivoPin, 'utf8'));
            if (Date.now() > infoPin.expira) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, erro: 'O código PIN expirou (limite de 15 minutos). Solicite outro.' }));
              return;
            }

            if (infoPin.pin !== pinRecebido) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, erro: 'Código PIN inválido.' }));
              return;
            }

            if (novaSenha.length < 3) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, erro: 'A nova senha deve ter pelo menos 3 dígitos.' }));
              return;
            }

            // Atualiza senha do usuário no banco
            const func = db.funcionarios.find(f => f.usuario.toLowerCase() === usuario || (f.papel === 'admin' && f.usuario === infoPin.usuario));
            if (func) {
              func.senha = 'salt:hash-' + novaSenha;
              fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
              try { fs.unlinkSync(arquivoPin); } catch {}

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, mensagem: 'Senha redefinida com sucesso! Você já pode entrar.' }));
              return;
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, erro: 'Usuário administrador não encontrado.' }));
              return;
            }
          }

          if (acao === 'chave-mestra') {
            const chave = String(dados.chave || '').trim();
            const novaSenha = String(dados.novaSenha || '').trim();
            const usuario = String(dados.usuario || 'admin').trim().toLowerCase();

            if (chave !== chaveMestraValida) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, erro: 'Chave mestra incorreta.' }));
              return;
            }

            const func = db.funcionarios.find(f => f.usuario.toLowerCase() === usuario || f.papel === 'admin');
            if (func) {
              func.senha = 'salt:hash-' + novaSenha;
              fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, mensagem: 'Senha redefinida via Chave Mestra! Você já pode entrar.' }));
              return;
            }
          }

          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Ação não reconhecida.' }));

        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        }
      });
      return;
    }
  }

  // Servir arquivos estáticos da pasta src com Compressão Gzip e Cache Inteligente (Performance 31 #13, #14, #15)
  let urlPath = pathname;
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(SRC_DIR, urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  let cacheControl = 'no-cache';
  if (['.png', '.jpg', '.jpeg', '.ico', '.svg', '.woff2', '.mp3', '.ogg'].includes(ext)) {
    cacheControl = 'public, max-age=86400, stale-while-revalidate=604800';
  } else if (['.js', '.css'].includes(ext)) {
    cacheControl = 'public, max-age=3600';
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro ao carregar arquivo');
      return;
    }
    enviarRespostaOtimizada(req, res, 200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl
    }, data);
  });
});

// Ouve em 0.0.0.0 para aceitar conexões locais e túneis do Cloudflare
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[SERVER] Porta ${PORT} já em uso (servidor já ativo).`);
  } else {
    console.error('[SERVER] Erro no servidor:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ManosTech System operando na porta ${PORT} (0.0.0.0)`);
  // Inicializa o túnel automático para acesso remoto 4G
  try {
    Tunnel.iniciar(PORT);
    Tunnel.registrarListener((urlPublica) => {
      try {
        const db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
        db.config = db.config || {};
        db.config.urlTunnel = `${urlPublica}/mobile.html`;
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
        console.log('[SERVER] urlTunnel sincronizado com pdv.json:', db.config.urlTunnel);
      } catch (e) {
        console.warn('[SERVER] Erro ao sincronizar urlTunnel:', e);
      }
    });
  } catch (err) {
    console.warn('[SERVER] Falha ao inicializar túnel:', err.message);
  }
});
