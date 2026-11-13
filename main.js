const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DATA_DIR } = require('./pasta-dados.js');

const DATA_FILE = path.join(DATA_DIR, 'pdv.json');

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
  funcionarios: [],
  caixas: [],
  config: {
    configurado: false,
    loja: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    larguraCupom: 80,
    impressoraSilenciosa: false,
    ultimoCupom: 0,
    impressoraCaixa: '',
    impressoraCozinha: '',
    cozinhaAtiva: true,
    larguraCozinha: 80,
    comandaVias: 1,
    semeado: true,
    versaoCatalogo: 3
  }
};

function lerDados() {
  try {
    if (!fs.existsSync(DATA_FILE)) return structuredClone(PADRAO);
    const brutos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...structuredClone(PADRAO), ...brutos, config: { ...PADRAO.config, ...brutos.config } };
  } catch (err) {
    console.error('Falha ao ler dados:', err);
    const backup = DATA_FILE + '.corrompido-' + Date.now();
    try { if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, backup); } catch {}
    return structuredClone(PADRAO);
  }
}

function salvarDados(dados) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dados));
  fs.renameSync(tmp, DATA_FILE);
  return true;
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#F8F2E7',
    icon: path.join(__dirname, 'src', 'assets', 'icon.ico'),
    title: 'ManosTech System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  // Inicia o servidor HTTP local para pareamento do celular e retaguarda
  try {
    require('./server.js');
    console.log('[MAIN] Servidor HTTP local inicializado com sucesso.');
  } catch (err) {
    console.warn('[MAIN] Aviso ao iniciar server.js:', err.message);
  }
  criarJanela();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('db:ler', () => lerDados());

ipcMain.handle('db:salvar', (_e, dados) => {
  try { return salvarDados(dados); } catch (err) { console.error(err); return false; }
});

ipcMain.handle('cupom:imprimir', async (_e, { html, larguraMm, silencioso, impressora }) => {
  const larguraFinal = Number(larguraMm) || 80;
  const janela = new BrowserWindow({
    show: false,
    width: Math.round(larguraFinal * 3.78) + 40,
    height: 600,
    webPreferences: { contextIsolation: true }
  });
  try {
    await janela.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const opcoes = {
      silent: !!silencioso,
      printBackground: true,
      margins: { marginType: 'none' }
    };
    if (impressora && typeof impressora === 'string' && impressora.trim() && impressora !== 'padrao' && impressora !== 'mesma') {
      opcoes.deviceName = impressora.trim();
    }
    const ok = await new Promise(resolve => {
      janela.webContents.print(
        opcoes,
        (sucesso, failureReason) => {
          if (!sucesso && failureReason) {
            console.warn('Falha na impressão:', failureReason);
          }
          resolve(!!sucesso);
        }
      );
    });
    if (!ok) console.warn('Impressão não concluída (impressora indisponível?)');
    return ok;
  } catch (err) {
    console.error('Falha ao imprimir:', err);
    return false;
  } finally {
    setTimeout(() => { if (!janela.isDestroyed()) janela.destroy(); }, 1000);
  }
});

ipcMain.handle('sistema:listar-impressoras', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
    if (win && win.webContents && typeof win.webContents.getPrintersAsync === 'function') {
      const lista = await win.webContents.getPrintersAsync();
      return (lista || []).map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: !!p.isDefault,
        status: p.status
      }));
    }
    return [];
  } catch (err) {
    console.error('Erro ao listar impressoras:', err);
    return [];
  }
});

ipcMain.handle('cupom:escolher-pasta', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dados:exportar', async () => {
  const r = await dialog.showSaveDialog({
    defaultPath: `backup-manostech-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled) return false;
  try {
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, r.filePath);
    else fs.writeFileSync(r.filePath, JSON.stringify(lerDados()));
    return true;
  } catch (err) {
    console.error('Falha no backup:', err);
    return false;
  }
});

/* ============ Seleção de XML de NF-e para Importação ============ */
ipcMain.handle('nfe:selecionar-xml', async () => {
  const r = await dialog.showOpenDialog({
    title: 'Selecionar XML de Nota Fiscal de Compra (NF-e)',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Arquivos XML de Nota Fiscal', extensions: ['xml'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths.map(filePath => {
    try {
      const conteudo = fs.readFileSync(filePath, 'utf8');
      return { caminho: filePath, nome: path.basename(filePath), conteudo };
    } catch (err) {
      console.error('Erro ao ler XML:', filePath, err);
      return null;
    }
  }).filter(Boolean);
});

/* ============ Exportação de XMLs para Contabilidade ============ */
ipcMain.handle('contabilidade:salvar-pacote', async (_e, { nomeArquivo, conteudoZipOuXml, tipo }) => {
  const r = await dialog.showSaveDialog({
    title: 'Salvar Arquivo para Contabilidade',
    defaultPath: nomeArquivo || `vendas-contabilidade-${new Date().toISOString().slice(0, 10)}.xml`,
    filters: tipo === 'zip'
      ? [{ name: 'Arquivo ZIP', extensions: ['zip'] }]
      : [{ name: 'Arquivo XML', extensions: ['xml'] }]
  });
  if (r.canceled || !r.filePath) return false;
  try {
    if (tipo === 'zip' && Buffer.isBuffer(conteudoZipOuXml)) {
      fs.writeFileSync(r.filePath, conteudoZipOuXml);
    } else {
      fs.writeFileSync(r.filePath, conteudoZipOuXml, 'utf8');
    }
    return true;
  } catch (err) {
    console.error('Falha ao salvar arquivo contábil:', err);
    return false;
  }
});

/* ============ Autenticação de funcionários ============ */
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + ':' + String(senha)).digest('hex');
  return `${salt}:${hash}`;
}

function conferirSenha(senha, guardado) {
  const s = String(senha || '').trim();
  const g = String(guardado || '').trim();
  if (!s || !g) return false;

  // 1. Senha padrão inicial do Administrador de fábrica
  if (s === 'admin' && (g === 'admin' || g.includes('2933abec039e51b0b5fc4879d2f6c8e3'))) {
    return true;
  }
  if (s === g) return true;

  // 2. Formato Salt:Hash
  if (g.includes(':')) {
    const [salt, hash] = g.split(':');

    // SHA-256 padrão (salt:sha256(salt:senha))
    try {
      const hashSha256 = crypto.createHash('sha256').update(salt + ':' + s).digest('hex');
      if (hashSha256.toLowerCase() === hash.toLowerCase()) return true;

      const hashSha256SemPontos = crypto.createHash('sha256').update(salt + s).digest('hex');
      if (hashSha256SemPontos.toLowerCase() === hash.toLowerCase()) return true;
    } catch {}

    // Scrypt (Node.js legado)
    try {
      const tentativa64 = crypto.scryptSync(s, salt, 64).toString('hex');
      if (tentativa64.toLowerCase() === hash.toLowerCase()) return true;

      const tentativa32 = crypto.scryptSync(s, salt, 32).toString('hex');
      if (tentativa32.toLowerCase() === hash.toLowerCase()) return true;
    } catch {}
  }

  return false;
}

ipcMain.handle('auth:hash', (_e, senha) => {
  if (!senha || String(senha).length < 3) return null;
  return hashSenha(senha);
});

ipcMain.handle('auth:conferir', (_e, { senha, guardado }) => {
  try { return conferirSenha(senha, guardado); } catch { return false; }
});

/* ============ Auto-Download e Atualização Automática ============ */
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

ipcMain.handle('atualizar:baixar-e-instalar', async (event, { url, versao }) => {
  try {
    const tempDir = app.getPath('temp');
    const nomeArquivo = `ManosTech-System-Setup-${versao || Date.now()}.exe`;
    const destinoArquivo = path.join(tempDir, nomeArquivo);

    console.log('[AUTO-UPDATE] Iniciando download da atualização:', url, '->', destinoArquivo);

    function baixarComRedirecionamento(urlAtual, redirecionamentos = 0) {
      return new Promise((resolve, reject) => {
        if (redirecionamentos > 10) {
          return reject(new Error('Muitos redirecionamentos'));
        }

        const moduloHttp = urlAtual.startsWith('https:') ? https : http;
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ManosTech-System-Updater',
            'Accept': '*/*'
          }
        };

        moduloHttp.get(urlAtual, options, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            if (!nextUrl.startsWith('http')) {
              const parsed = new URL(urlAtual);
              nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
            }
            return resolve(baixarComRedirecionamento(nextUrl, redirecionamentos + 1));
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Erro HTTP ${res.statusCode} ao baixar arquivo`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || 0, 10);
          let baixadoBytes = 0;
          let ultimoEnvio = 0;

          const fileStream = fs.createWriteStream(destinoArquivo);

          res.on('data', (chunk) => {
            baixadoBytes += chunk.length;
            const agora = Date.now();
            if (agora - ultimoEnvio > 80 || baixadoBytes === totalBytes) {
              ultimoEnvio = agora;
              const pct = totalBytes > 0 ? Math.min(100, Math.round((baixadoBytes / totalBytes) * 100)) : 0;
              if (!event.sender.isDestroyed()) {
                event.sender.send('atualizar:progresso', {
                  baixado: baixadoBytes,
                  total: totalBytes,
                  porcentagem: pct
                });
              }
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              console.log('[AUTO-UPDATE] Download concluído com sucesso:', destinoArquivo);
              if (!event.sender.isDestroyed()) {
                event.sender.send('atualizar:concluido', { caminhoArquivo: destinoArquivo });
              }
              resolve(destinoArquivo);
            });
          });

          fileStream.on('error', (err) => {
            try { fs.unlinkSync(destinoArquivo); } catch {}
            reject(err);
          });
        }).on('error', (err) => {
          try { fs.unlinkSync(destinoArquivo); } catch {}
          reject(err);
        });
      });
    }

    const arquivoBaixado = await baixarComRedirecionamento(url);

    // Aguarda 1.2 segundos para exibir 100% no modal e executa o instalador
    setTimeout(() => {
      try {
        console.log('[AUTO-UPDATE] Disparando instalador:', arquivoBaixado);
        const child = spawn(arquivoBaixado, [], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        // Encerra o aplicativo para liberar arquivos para atualização
        setTimeout(() => {
          app.quit();
        }, 800);
      } catch (execErr) {
        console.error('[AUTO-UPDATE] Erro ao disparar instalador:', execErr);
      }
    }, 1200);

    return { ok: true, arquivo: arquivoBaixado };
  } catch (err) {
    console.error('[AUTO-UPDATE] Erro geral no processo de atualização:', err);
    if (!event.sender.isDestroyed()) {
      event.sender.send('atualizar:erro', { erro: err.message });
    }
    return { ok: false, erro: err.message };
  }
});
