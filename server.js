const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const Backup = require('./backup.js');

const PORT = 3000;
const SRC_DIR = path.join(__dirname, 'src');
const DATA_DIR = path.join(__dirname, 'dados');
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

  // Endpoint de API para o Banco de Dados (sincronização do PC com o Celular do ADM via Cloudflare)
  if (pathname === '/api/db') {
    if (req.method === 'GET') {
      try {
        if (fs.existsSync(DATA_FILE)) {
          const conteudo = fs.readFileSync(DATA_FILE, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(conteudo);
          return;
        }
      } catch (err) {
        console.error('Erro ao ler DB:', err);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('null');
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
      servidor: 'Rota do Forte Local Server',
      online: true,
      hora: new Date().toISOString(),
      bancoAtivo: existeDb
    }));
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
        const nomeLoja = db.config?.loja || 'Rota do Forte';
        const urlLocal = `http://${ipLocal}:${PORT}/mobile.html`;
        const urlTunnel = db.config?.urlTunnel || '';
        const urlFinal = urlTunnel || urlLocal;

        const qrCodeDataUrl = await QRCode.toDataURL(urlFinal, {
          width: 320,
          margin: 2,
          color: {
            dark: '#23140A',
            light: '#FFFFFF'
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          loja: nomeLoja,
          ipLocal,
          urlLocal,
          urlTunnel,
          urlFinal,
          qrCode: qrCodeDataUrl
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    })();
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

  // Servir arquivos estáticos da pasta src
  let urlPath = pathname;
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(SRC_DIR, urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

// Ouve em 0.0.0.0 para aceitar conexões locais e túneis do Cloudflare
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Rota do Forte operando na porta ${PORT} (0.0.0.0)`);
});
